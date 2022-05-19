# libudx

A compatibility module for using libudx with the [Socket SDK][0].

# Description

The JavaScript in `libudx` assumes `NAPI` bindings. While the system calls
performed by node may be async, v8 apis "block" JavaScript run-to-completion
semantics. This presents a problem for using libux in multi-process
architectures.

A simple solution, without involving complex tool chains, is to exploit the
blocking nature of synchronous XHR calls. No actual network i/o is performed.
Instead, synchronous XHRs become IPC calls.

# license

MIT

[0]:https://github.com/socketsupply/socket-sdk
