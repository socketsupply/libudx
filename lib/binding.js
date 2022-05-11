const syncBind = (name, opts) => {
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

class Binding {
  get sizeof_udx_napi_socket_t () {
    return syncBind('udx_sizeof_udx_napi_socket_t')
  }

  get sizeof_udx_napi_stream_t () {
    return syncBind('udx_sizeof_udx_napi_stream_t')
  }

  get sizeof_udx_socket_send_t () {
    return syncBind('udx_sizeof_udx_socket_send_t')
  }

  get offsetof_udx_stream_t_srtt () {
    return syncBind('udx_offsetof_udx_stream_t_srtt')
  }

  get offsetof_udx_stream_t_cwnd () {
    return syncBind('udx_offsetof_udx_stream_t_cwnd')
  }

  get offsetof_udx_stream_t_inflight () {
    return syncBind('udx_offsetof_udx_stream_t_inflight')
  }

  get sizeof_udx_stream_write_t () {
    return syncBind('udx_sizeof_udx_stream_write_t')
  }

  get sizeof_udx_stream_send_t () {
    return syncBind('udx_sizeof_udx_stream_send_t')
  }

  get sizeof_udx_t () {
    return syncBind('udx_sizeof_udx_t')
  }

  udx_napi_socket_init(
    udxHandle,
    handle,
    self,
    onsend,
    onmessage,
    onclose) {

    return syncBind('udx_napi_socket_init', {
      udxHandle,
      handle,
      self,
      onsend,
      onmessage,
      onclose
    })
  }

  udx_napi_init (handle) {
    return syncBind('udx_napi_init', {
      handle,
    })
  }

  udx_napi_socket_bind (handle, port, ip) {
    return syncBind('udx_napi_socket_bind', {
      handle,
      port,
      ip
    })
  }

  udx_napi_socket_close (handle) {
    return syncBind('udx_napi_socket_close', {
      handle
    })
  }

  udx_napi_socket_set_ttl (handle, ttl) {
    return syncBind('udx_napi_socket_set_ttl', {
      handle,
      ttl
    })
  }

  udx_napi_socket_recv_buffer_size (handle, size) {
    return syncBind('udx_napi_socket_recv_buffer_size', {
      handle,
      size
    })
  }

  udx_napi_socket_recv_buffer_size (handle, size) {
    return syncBind('udx_napi_socket_recv_buffer_size', {
      handle,
      size
    })
  }

  udx_napi_socket_send_buffer_size (handle, size) {
    return syncBind('udx_napi_socket_send_buffer_size', {
      handle,
      size
    })
  }

  udx_napi_socket_send_buffer_size (handle, size) {
    return syncBind('udx_napi_socket_send_buffer_size', {
      handle,
      size
    })
  }

  udx_napi_socket_send_ttl (handle, reqHandle, id, buffer, port, ip, ttl) {
    return syncBind('udx_napi_socket_send_ttl', {
      handle,
      reqHandle,
      id,
      buffer,
      port,
      ip,
      ttl
    })
  }

  udx_napi_stream_init(
    udxHandle,
    handle,
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
    return syncBind('udx_napi_socket_send_ttl', {
      udxHandle,
      handle,
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
    })
  }

  udx_napi_stream_recv_start (handle, readBuffer) {
    return syncBind('udx_napi_stream_recv_start', {
      handle,
      readBuffer
    })
  }

  udx_napi_stream_set_mode (handle, mode) {
    return syncBind('udx_napi_stream_set_mode', {
      handle,
      mode
    })
  }

  udx_napi_stream_connect (handle, socketHandle, remoteId, port, host) {
    return syncBind('udx_napi_stream_connect', {
      handle,
      socketHandle,
      remoteId,
      port,
      host
    })
  }

  udx_napi_stream_send (handle, reqHandle, id, buffer) {
    return syncBind('udx_napi_stream_send', {
      handle,
      reqHandle,
      id,
      buffer
    })
  }

  udx_napi_stream_destroy (handle) {
    return syncBind('udx_napi_stream_destroy', {
      handle
    })
  }

  udx_napi_stream_write (handle, reqHandle, id, reqBuffer) {
    return syncBind('udx_napi_stream_destroy', {
      handle,
      reqHandle,
      id,
      reqBuffer
    })
  }

  udx_napi_stream_write_end(handle, reqHandle, id, reqBuffer) {
    return syncBind('udx_napi_stream_destroy', {
      handle,
      reqHandle,
      id,
      reqBuffer
    })
  }
}

module.exports = new Binding()
