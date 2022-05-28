// @ts-check
'use strict'

//
// This isn't actually network i/o. It's intercepted by the webview api
// so worst case performance it's an ipc call.
//
const syncIPC = (name, opts) => {
  const r = new XMLHttpRequest()

  opts = opts ? { ...opts } : {}
  opts.seq = window._ipc.nextSeq++
  const params = new URLSearchParams(opts).toString()
  const url = `ipc://${name}?${params}`
  console.log('about to syncIPC()', url)
  r.open('GET', url, false)
  r.send(null)

  console.log('syncIPC yields', r.status)
  if (r.status === 200) {
    return r.responseText
  }

  throw new Error(r.responseText)
}

const rand64 = () => {
  const method = globalThis.crypto
    ? globalThis.crypto
    : _require('crypto').webcrypto
  return method.getRandomValues(new BigUint64Array(1))[0]
}

class Binding {
  constructor (callbacks) {
    this.id = rand64()
    this.callbacks = callbacks

    window.addEventListener('callback', (e) => {
      // id is arbitrary, may be a socketId, streamId, etc.
      const fns = this.callbacks[e.detail.id]
      if (!fns) return

      const fn = fns[e.detail.name]
      if (!fn) return

      e.detail.arguments = e.detail.arguments.map(arg => {
        return (typeof arg === 'object' && arg !== null) ? this : arg
      });

      fn(...e.detail.arguments)
    })
  }

  static get sizeof_udx_t () {
    return 0 // we allocate on the other side of the bridge
  }

  static get sizeof_udx_napi_socket_t () {
    return 0
  }

  static get sizeof_udx_napi_stream_t () {
    return 0
  }

  static get sizeof_udx_socket_send_t () {
    return 0
  }

  static get offsetof_udx_stream_t_srtt () {
    return syncIPC('udx_offsetof_udx_stream_t_srtt')
  }

  static get offsetof_udx_stream_t_cwnd () {
    return syncIPC('udx_offsetof_udx_stream_t_cwnd')
  }

  static get offsetof_udx_stream_t_inflight () {
    return syncIPC('udx_offsetof_udx_stream_t_inflight')
  }

  static get sizeof_udx_stream_write_t () {
    return syncIPC('udx_sizeof_udx_stream_write_t')
  }

  static get sizeof_udx_stream_send_t () {
    return syncIPC('udx_sizeof_udx_stream_send_t')
  }

  static udx_napi_socket_init(
    _udxHandle,
    _handle,
    self,
    onsend,
    onmessage,
    onclose) {

    self._handle = new Binding({
      onsend,
      onmessage,
      onclose
    })

    self.parent = _udxHandle

    //
    // `seq` helps for debugging but isn't necessary for resolving
    // since future i/o will be done by calling these callbacks
    // via a global "callback" events.
    //
    const params = {
      socketId: self._handle.id,
      udxId: _udxHandle.id,
      seq: window._ipc.nextSeq++
    }

    const query = new URLSearchParams(params).toString()
    window.external.invoke(`ipc://udxSocketInit?${query}`)
  }

  static udx_napi_init (_handle) {
    return syncIPC('udxInit', {
      udxId: _handle.id
    })
  }

  static udx_napi_socket_bind (handle, port, ip) {
    return syncIPC('udxSocketBind', {
      socketId: handle.id,
      port,
      ip
    })
  }

  static udx_napi_socket_close (handle) {
    return syncIPC('udxSocketClose', {
      socketId: handle.id
    })
  }

  static udx_napi_socket_set_ttl (handle, ttl) {
    return syncIPC('udxSocketSetTTL', {
      socketId: handle.id,
      ttl
    })
  }

  static udx_napi_socket_recv_buffer_size (handle, size) {
    return syncIPC('udxSocketRecvBufferSize', {
      socketId: handle.id,
      size
    })
  }

  static udx_napi_socket_send_buffer_size (handle, size) {
    return syncIPC('udxSocketSendBufferSize', {
      socketId: handle.id,
      size
    })
  }

  static udx_napi_socket_send_ttl (handle, reqHandle, id, buffer, port, ip, ttl) {
    if (!reqHandle.__id) reqHandle.__id = rand64()
    buffer = buffer.toString()

    return syncIPC('udxSocketSendTTL', {
      socketId: handle.id,
      requestId: reqHandle.__id,
      id,
      buffer,
      port,
      ip,
      ttl
    })
  }

  static udx_napi_stream_init(
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

    self._handle = new Binding({
      ondata,
      onend,
      ondrain,
      onack,
      onsend,
      onmessage,
      onclose,
      onfirewall
    })

    self.parent = _udxHandle

    const params = {
      udxId: _udxHandle.id,
      streamId: self._handle.id,
      seq: window._ipc.nextSeq++,
      id
    }

    const query = new URLSearchParams(params).toString()
    window.external.invoke(`ipc://udxStreamInit?${query}`)
  }

  static udx_napi_stream_recv_start (handle, readBuffer) {
    return syncIPC('udxStreamRecvStart', {
      streamId: handle.id,
      readBuffer
    })
  }

  static udx_napi_stream_set_mode (handle, mode) {
    return syncIPC('udxStreamSetMode', {
      streamId: handle.id,
      mode
    })
  }

  static udx_napi_stream_connect (handle, socketHandle, remoteId, port, host) {
    return syncIPC('udxStreamConnect', {
      streamId: handle._streamId,
      socketId: socketHandle.id,
      remoteId,
      port,
      host
    })
  }

  static udx_napi_stream_send (handle, reqHandle, id, buffer) {
    if (!reqHandle.__id) reqHandle.__id = rand64()
    buffer = buffer.toString()

    return syncIPC('udxStreamSend', {
      streamId: handle.id,
      requestId: reqHandle.__id,
      id,
      buffer
    })
  }

  static udx_napi_stream_destroy (handle) {
    return syncIPC('udxStreamDestroy', {
      streamId: handle.id
    })
  }

  static udx_napi_stream_write (handle, reqHandle, id, reqBuffer) {
    reqBuffer = reqBuffer.toString()

    return syncIPC('udxStreamWrite', {
      streamId: handle.id,
      requestId: reqHandle.__id,
      id,
      reqBuffer
    })
  }

  static udx_napi_stream_write_end (handle, reqHandle, id, reqBuffer) {
    reqBuffer = reqBuffer.toString()

    return syncIPC('udxStreamWriteEnd', {
      streamId: handle.id,
      requestId: reqHandle.__id,
      id,
      reqBuffer
    })
  }
}

module.exports = Binding
