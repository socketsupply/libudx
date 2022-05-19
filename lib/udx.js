const Binding = require('./binding')
const Socket = require('./socket')
const Stream = require('./stream')

module.exports = class UDX {
  constructor () {
    this._handle = new Binding()
    binding.udx_napi_init(this._handle)
  }

  createSocket () {
    return new Socket(this._handle)
  }

  createStream (id, opts) {
    return new Stream(this._handle, id, opts)
  }
}
