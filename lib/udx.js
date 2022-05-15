const Binding = require('./binding')
const Socket = require('./socket')
const Stream = require('./stream')

module.exports = class UDX {
  constructor () {
    this._handle = new Binding()
  }

  createSocket () {
    return new Socket(this._handle)
  }

  createStream (id, opts) {
    return new Stream(this._handle, id, opts)
  }
}
