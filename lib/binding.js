//
// This isn't actually network i/o. It's intercepted by the webview api
// so worst case performance it's an ipc call.
//
const syncIPC = (name, opts) => {
  const r = new XMLHttpRequest()
  const params = new URLSearchParams(opts).toString()
  params.seq = window._ipc.nextSeq++

  r.open('GET', `ipc://${name}?${params}`, false)
  r.send(null)

  if (r.status === 200) {
    return r.responseText
  }

  throw new Error(r.responseText)
}

const rand64 = () => {
  const method = globalThis.crypto ? globalThis.crypto : _require('crypto').webcrypto
  return method.getRandomValues(new BigUint64Array(1))[0]
}

class Binding {
  constructor () {
    this.socketId = null
    this.streamId = null
    this.callbacks = {}

    window.addEventListener('callback', e => {
      // id is arbitrary, may be a socketId, streamId, etc.
      const fns = this.callbacks[e.detail.id]
      if (!fns) return

      const fn = fns[e.detail.name]
      if (!fn) return

      fn(e.detail.value)
    })
  }

  get sizeof_udx_t () {
    return 0 // we allocate on the other side of the bridge
  }

  get sizeof_udx_napi_socket_t () {
    return 0
  }

  get sizeof_udx_napi_stream_t () {
    return 0
  }

  get sizeof_udx_socket_send_t () {
    return 0
  }

  get offsetof_udx_stream_t_srtt () {
    return syncIPC('udx_offsetof_udx_stream_t_srtt')
  }

  get offsetof_udx_stream_t_cwnd () {
    return syncIPC('udx_offsetof_udx_stream_t_cwnd')
  }

  get offsetof_udx_stream_t_inflight () {
    return syncIPC('udx_offsetof_udx_stream_t_inflight')
  }

  get sizeof_udx_stream_write_t () {
    return syncIPC('udx_sizeof_udx_stream_write_t')
  }

  get sizeof_udx_stream_send_t () {
    return syncIPC('udx_sizeof_udx_stream_send_t')
  }

  udx_napi_socket_init(
    _udxHandle,
    _handle,
    self,
    onsend,
    onmessage,
    onclose) {

    // this is how we identify which socket's callbacks to call
    self._socketId = rand64()
    self._callbacks = self._callbacks || {}
    self._handle = self // reassign handle handle as a self ref

    // register the callbacks for this socket
    self._callbacks[self._socketId] = {
      onsend,
      onmessage,
      onclose
    }

    //
    // `seq` helps for debugging but isn't necessary for resolving
    // since future i/o will be done by calling these callbacks
    // via a global "callback" events.
    //
    const params = {
      socketId: self._socketId,
      seq: window._ipc.nextSeq++
    }

    window.external.invoke(`ipc://udx_napi_socket_init?${params}`)
  }

  udx_napi_init (_handle) {
    // noop, see the diff between upstream and master in ./udx.js
  }

  udx_napi_socket_bind (handle, port, ip) {
    return syncIPC('udx_napi_socket_bind', {
      socketId: handle.socketId,
      port,
      ip
    })
  }

  udx_napi_socket_close (handle) {
    return syncIPC('udx_napi_socket_close', {
      socketId: handle._socketId
    })
  }

  udx_napi_socket_set_ttl (handle, ttl) {
    return syncIPC('udx_napi_socket_set_ttl', {
      socketId: handle._socketId,
      ttl
    })
  }

  udx_napi_socket_recv_buffer_size (handle, size) {
    return syncIPC('udx_napi_socket_recv_buffer_size', {
      socketId: handle._socketId,
      size
    })
  }

  udx_napi_socket_recv_buffer_size (handle, size) {
    return syncIPC('udx_napi_socket_recv_buffer_size', {
      socketId: handle._socketId,
      size
    })
  }

  udx_napi_socket_send_buffer_size (handle, size) {
    return syncIPC('udx_napi_socket_send_buffer_size', {
      socketId: handle._socketId,
      size
    })
  }

  udx_napi_socket_send_buffer_size (handle, size) {
    return syncIPC('udx_napi_socket_send_buffer_size', {
      socketId: handle._socketId,
      size
    })
  }

  udx_napi_socket_send_ttl (handle, reqHandle, id, buffer, port, ip, ttl) {
    if (!reqHandle._requestId) reqHandle._requestId = rand64()
    buffer = buffer.toString()

    return syncIPC('udx_napi_socket_send_ttl', {
      socketId: handle._socketId,
      requestId: reqHandle._requestId,
      id,
      buffer,
      port,
      ip,
      ttl
    })
  }

  udx_napi_stream_init(
    _udxHandle,
    _handle,
    id,
    self,
    ondata,
    onend,
    ondrain,
    onack,
    onsend,
    onmessage,
    onclose,
    onfirewall
  ) {

    // this is how we identify which socket's callbacks to call
    self._streamId = rand64()
    self._callbacks = self._callbacks || {}
    self._handle = self // reassign handle handle as a self ref

    // register the callbacks for this socket
    self._callbacks[self._streamId] = {
      ondata,
      onend,
      ondrain,
      onack,
      onsend,
      onmessage,
      onclose,
      onfirewall
    }

    const params = {
      streamId: self._streamId,
      seq: window._ipc.nextSeq++,
      id
    }

    window.external.invoke(`ipc://udx_napi_stream_init?${params}`)
  }

  udx_napi_stream_recv_start (handle, readBuffer) {
    return syncIPC('udx_napi_stream_recv_start', {
      streamId: handle._streamId,
      readBuffer
    })
  }

  udx_napi_stream_set_mode (handle, mode) {
    return syncIPC('udx_napi_stream_set_mode', {
      streamId: handle._streamId,
      mode
    })
  }

  udx_napi_stream_connect (handle, socketHandle, remoteId, port, host) {
    return syncIPC('udx_napi_stream_connect', {
      streamId: handle._streamId,
      socketId: socketHandle._socketId,
      remoteId,
      port,
      host
    })
  }

  udx_napi_stream_send (handle, reqHandle, id, buffer) {
    buffer = buffer.toString()

    return syncIPC('udx_napi_stream_send', {
      streamId: handle._streamId,
      requestId: reqHandle._requestId,
      id,
      buffer
    })
  }

  udx_napi_stream_destroy (handle) {
    return syncIPC('udx_napi_stream_destroy', {
      streamId: handle._streamId
    })
  }

  udx_napi_stream_write (handle, reqHandle, id, reqBuffer) {
    reqBuffer = reqBuffer.toString()

    return syncIPC('udx_napi_stream_destroy', {
      streamId: handle._streamId,
      requestId: reqHandle._requestId,
      id,
      reqBuffer
    })
  }

  udx_napi_stream_write_end (handle, reqHandle, id, reqBuffer) {
    reqBuffer = reqBuffer.toString()

    return syncIPC('udx_napi_stream_destroy', {
      streamId: handle._streamId,
      requestId: reqHandle._requestId,
      id,
      reqBuffer
    })
  }
}

module.exports = new Binding()
