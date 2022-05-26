// @ts-check
'use strict'

const streamx = require('streamx')
const b4a = require('b4a')
const binding = require('./binding')

const MAX_PACKET = 2048 // it's always way less than this, but whatevs
const BUFFER_SIZE = 65536 + MAX_PACKET

module.exports = class UDXStream extends streamx.Duplex {
  constructor (udx, id, opts = {}) {
    super({ mapWritable: toBuffer })

    this.udx = udx
    this.socket = null

    this._handle = b4a.allocUnsafe(binding.sizeof_udx_napi_stream_t)
    this._view = new Uint32Array(this._handle.buffer, this._handle.byteOffset, this._handle.byteLength >> 2)

    this._wreqs = []
    this._wfree = []

    this._sreqs = []
    this._sfree = []
    this._closed = false

    this._readBuffer = b4a.allocUnsafe(BUFFER_SIZE)

    this._onwrite = null
    this._ondestroy = null
    this._firewall = opts.firewall || firewallAll

    this.id = id
    this.remoteId = 0
    this.remotePort = 0
    this.remoteHost = null

    binding.udx_napi_stream_init(this.udx._handle, this._handle, id, this,
      this._ondata,
      this._onend,
      this._ondrain,
      this._onack,
      this._onsend,
      this._onmessage,
      this._onclose,
      this._onfirewall
    )

    binding.udx_napi_stream_recv_start(this._handle, this._readBuffer)
  }

  get connected () {
    return this.socket !== null
  }

  get rtt () {
    return this._view[binding.offsetof_udx_stream_t_srtt >> 2]
  }

  get cwnd () {
    return this._view[binding.offsetof_udx_stream_t_cwnd >> 2]
  }

  get inflight () {
    return this._view[binding.offsetof_udx_stream_t_inflight >> 2]
  }

  get localPort () {
    return this.socket ? this.socket.address().port : null
  }

  get localHost () {
    return this.socket ? this.socket.address().host : null
  }

  setInteractive (bool) {
    if (!this._closed) return
    binding.udx_napi_stream_set_mode(this._handle, bool ? 0 : 1)
  }

  connect (socket, remoteId, port, host) {
    if (this._closed) return

    if (this.connected) throw new Error('Already connected')
    if (socket.closing) throw new Error('Socket is closed')

    if (!host) host = '127.0.0.1'

    if (!socket.bound) socket.bind(0)

    this.remoteId = remoteId
    this.remotePort = port
    this.remoteHost = host
    this.socket = socket

    binding.udx_napi_stream_connect(this._handle, socket._handle, remoteId, port, host)

    if (socket.idle) socket._onbusy()

    socket.streams.add(this)
    this.on('close', () => {
      socket.streams.delete(this)
      socket._closeMaybe()

      if (socket.idle) socket._onidle()
    })
  }

  async send (buffer) {
    if (!this.connected || this._closed) return false

    const id = this._allocSend()
    const req = this._sreqs[id]

    req.buffer = buffer

    const promise = new Promise((resolve) => {
      req.onflush = resolve
    })

    binding.udx_napi_stream_send(this._handle, req.handle, id, buffer)

    return promise
  }

  trySend (buffer) {
    if (!this.connected || this._closed) return

    const id = this._allocSend()
    const req = this._sreqs[id]

    req.buffer = buffer
    req.onflush = noop

    binding.udx_napi_stream_send(this._handle, req.handle, id, buffer)
  }

  _read (cb) {
    cb(null)
  }

  _writeContinue (err) {
    if (this._onwrite === null) return
    const cb = this._onwrite
    this._onwrite = null
    cb(err)
  }

  _destroyContinue (err) {
    if (this._ondestroy === null) return
    const cb = this._ondestroy
    this._ondestroy = null
    cb(err)
  }

  _write (buffer, cb) {
    const id = this._allocWrite()
    const req = this._wreqs[id]

    req.buffer = buffer

    const drained = binding.udx_napi_stream_write(this._handle, req.handle, id, req.buffer) !== 0

    if (drained) cb(null)
    else this._onwrite = cb
  }

  _final (cb) {
    const id = this._allocWrite()
    const req = this._wreqs[id]

    req.buffer = b4a.allocUnsafe(0)

    const drained = binding.udx_napi_stream_write_end(this._handle, req.handle, id, req.buffer) !== 0

    if (drained) cb(null)
    else this._onwrite = cb
  }

  _predestroy () {
    if (!this._closed) binding.udx_napi_stream_destroy(this._handle)
    this._closed = true
    this._writeContinue(null)
  }

  _destroy (cb) {
    if (this.connected) this._ondestroy = cb
    else cb(null)
  }

  _ondata (read) {
    const data = this._readBuffer.subarray(0, read)

    this.push(data)

    this._readBuffer = this._readBuffer.byteLength - read > MAX_PACKET
      ? this._readBuffer.subarray(read)
      : b4a.allocUnsafe(BUFFER_SIZE)

    return this._readBuffer
  }

  _onend (read) {
    if (read > 0) this.push(this._readBuffer.subarray(0, read))
    this.push(null)
  }

  _ondrain () {
    this._writeContinue(null)
  }

  _onack (id) {
    const req = this._wreqs[id]

    req.buffer = null
    this._wfree.push(id)

    // gc the free list
    if (this._wfree.length >= 64 && this._wfree.length === this._wreqs.length) {
      this._wfree = []
      this._wreqs = []
    }
  }

  _onsend (id, err) {
    const req = this._sreqs[id]

    const onflush = req.onflush

    req.buffer = null
    req.onflush = null

    this._sfree.push(id)

    onflush(err >= 0)

    // gc the free list
    if (this._sfree.length >= 16 && this._sfree.length === this._sreqs.length) {
      this._sfree = []
      this._sreqs = []
    }
  }

  _onmessage (buf) {
    this.emit('message', buf)
  }

  _onclose (errno) {
    this._closed = true
    this.socket = null

    // no error, we don't need to do anything
    if (errno === 0) return this._destroyContinue(null)

    let [code, msg] = getSystemErrorMap().get(errno)

    if (code === 'ECONNRESET') msg = 'stream destroyed by remote'
    else if (code === 'ETIMEDOUT') msg = 'stream timed out'

    msg = `${code}: ${msg}`

    const err = new Error(msg)
    err.errno = errno
    err.code = code

    if (this._ondestroy === null) this.destroy(err)
    else this._destroyContinue(err)
  }

  _onfirewall (socket, port, host) {
    return this._firewall(socket, port, host) ? 1 : 0
  }

  _allocWrite () {
    if (this._wfree.length > 0) return this._wfree.pop()
    const handle = b4a.allocUnsafe(binding.sizeof_udx_stream_write_t)
    return this._wreqs.push({ handle, buffer: null }) - 1
  }

  _allocSend () {
    if (this._sfree.length > 0) return this._sfree.pop()
    const handle = b4a.allocUnsafe(binding.sizeof_udx_stream_send_t)
    return this._sreqs.push({ handle, buffer: null, resolve: null, reject: null }) - 1
  }
}

function noop () {}

function toBuffer (data) {
  return typeof data === 'string' ? b4a.from(data) : data
}

function firewallAll (socket, port, host) {
  return true
}

function getSystemErrorMap () {
  return new Map([
    [ -7, [ 'E2BIG', 'argument list too long' ] ],
    [ -13, [ 'EACCES', 'permission denied' ] ],
    [ -98, [ 'EADDRINUSE', 'address already in use' ] ],
    [ -99, [ 'EADDRNOTAVAIL', 'address not available' ] ],
    [ -97, [ 'EAFNOSUPPORT', 'address family not supported' ] ],
    [ -11, [ 'EAGAIN', 'resource temporarily unavailable' ] ],
    [ -3000, [ 'EAI_ADDRFAMILY', 'address family not supported' ] ],
    [ -3001, [ 'EAI_AGAIN', 'temporary failure' ] ],
    [ -3002, [ 'EAI_BADFLAGS', 'bad ai_flags value' ] ],
    [ -3013, [ 'EAI_BADHINTS', 'invalid value for hints' ] ],
    [ -3003, [ 'EAI_CANCELED', 'request canceled' ] ],
    [ -3004, [ 'EAI_FAIL', 'permanent failure' ] ],
    [ -3005, [ 'EAI_FAMILY', 'ai_family not supported' ] ],
    [ -3006, [ 'EAI_MEMORY', 'out of memory' ] ],
    [ -3007, [ 'EAI_NODATA', 'no address' ] ],
    [ -3008, [ 'EAI_NONAME', 'unknown node or service' ] ],
    [ -3009, [ 'EAI_OVERFLOW', 'argument buffer overflow' ] ],
    [ -3014, [ 'EAI_PROTOCOL', 'resolved protocol is unknown' ] ],
    [ -3010, [ 'EAI_SERVICE', 'service not available for socket type' ] ],
    [ -3011, [ 'EAI_SOCKTYPE', 'socket type not supported' ] ],
    [ -114, [ 'EALREADY', 'connection already in progress' ] ],
    [ -9, [ 'EBADF', 'bad file descriptor' ] ],
    [ -16, [ 'EBUSY', 'resource busy or locked' ] ],
    [ -125, [ 'ECANCELED', 'operation canceled' ] ],
    [ -4080, [ 'ECHARSET', 'invalid Unicode character' ] ],
    [ -103, [ 'ECONNABORTED', 'software caused connection abort' ] ],
    [ -111, [ 'ECONNREFUSED', 'connection refused' ] ],
    [ -104, [ 'ECONNRESET', 'connection reset by peer' ] ],
    [ -89, [ 'EDESTADDRREQ', 'destination address required' ] ],
    [ -17, [ 'EEXIST', 'file already exists' ] ],
    [ -14, [ 'EFAULT', 'bad address in system call argument' ] ],
    [ -27, [ 'EFBIG', 'file too large' ] ],
    [ -113, [ 'EHOSTUNREACH', 'host is unreachable' ] ],
    [ -4, [ 'EINTR', 'interrupted system call' ] ],
    [ -22, [ 'EINVAL', 'invalid argument' ] ],
    [ -5, [ 'EIO', 'i/o error' ] ],
    [ -106, [ 'EISCONN', 'socket is already connected' ] ],
    [ -21, [ 'EISDIR', 'illegal operation on a directory' ] ],
    [ -40, [ 'ELOOP', 'too many symbolic links encountered' ] ],
    [ -24, [ 'EMFILE', 'too many open files' ] ],
    [ -90, [ 'EMSGSIZE', 'message too long' ] ],
    [ -36, [ 'ENAMETOOLONG', 'name too long' ] ],
    [ -100, [ 'ENETDOWN', 'network is down' ] ],
    [ -101, [ 'ENETUNREACH', 'network is unreachable' ] ],
    [ -23, [ 'ENFILE', 'file table overflow' ] ],
    [ -105, [ 'ENOBUFS', 'no buffer space available' ] ],
    [ -19, [ 'ENODEV', 'no such device' ] ],
    [ -2, [ 'ENOENT', 'no such file or directory' ] ],
    [ -12, [ 'ENOMEM', 'not enough memory' ] ],
    [ -64, [ 'ENONET', 'machine is not on the network' ] ],
    [ -92, [ 'ENOPROTOOPT', 'protocol not available' ] ],
    [ -28, [ 'ENOSPC', 'no space left on device' ] ],
    [ -38, [ 'ENOSYS', 'function not implemented' ] ],
    [ -107, [ 'ENOTCONN', 'socket is not connected' ] ],
    [ -20, [ 'ENOTDIR', 'not a directory' ] ],
    [ -39, [ 'ENOTEMPTY', 'directory not empty' ] ],
    [ -88, [ 'ENOTSOCK', 'socket operation on non-socket' ] ],
    [ -95, [ 'ENOTSUP', 'operation not supported on socket' ] ],
    [ -75, [ 'EOVERFLOW', 'value too large for defined data type' ] ],
    [ -1, [ 'EPERM', 'operation not permitted' ] ],
    [ -32, [ 'EPIPE', 'broken pipe' ] ],
    [ -71, [ 'EPROTO', 'protocol error' ] ],
    [ -93, [ 'EPROTONOSUPPORT', 'protocol not supported' ] ],
    [ -91, [ 'EPROTOTYPE', 'protocol wrong type for socket' ] ],
    [ -34, [ 'ERANGE', 'result too large' ] ],
    [ -30, [ 'EROFS', 'read-only file system' ] ],
    [ -108, [ 'ESHUTDOWN', 'cannot send after transport endpoint shutdown' ] ],
    [ -29, [ 'ESPIPE', 'invalid seek' ] ],
    [ -3, [ 'ESRCH', 'no such process' ] ],
    [ -110, [ 'ETIMEDOUT', 'connection timed out' ] ],
    [ -26, [ 'ETXTBSY', 'text file is busy' ] ],
    [ -18, [ 'EXDEV', 'cross-device link not permitted' ] ],
    [ -4094, [ 'UNKNOWN', 'unknown error' ] ],
    [ -4095, [ 'EOF', 'end of file' ] ],
    [ -6, [ 'ENXIO', 'no such device or address' ] ],
    [ -31, [ 'EMLINK', 'too many links' ] ],
    [ -112, [ 'EHOSTDOWN', 'host is down' ] ],
    [ -121, [ 'EREMOTEIO', 'remote I/O error' ] ],
    [ -25, [ 'ENOTTY', 'inappropriate ioctl for device' ] ],
    [ -4028, [ 'EFTYPE', 'inappropriate file type or format' ] ],
    [ -84, [ 'EILSEQ', 'illegal byte sequence' ] ],
    [ -94, [ 'ESOCKTNOSUPPORT', 'socket type not supported' ] ]
  ])
}
