# libudx

A compatibility module for using libudx with the [Socket SDK][0].

# Description

The JavaScript in libudx assumes NAPI bindings. While async, they "block"
JavaScript run-to-completion semantics. This presents a problem for using
libux with a Webview, which only provides a single, simple asynchronous api.

A simple solution, without involving complex tool chains, is to intercept
synchronous XHR calls. No actual network i/o is performed, sync instead XHRs
become IPC calls.

# license

MIT

[0]:https://github.com/socketsupply/socket-sdk
