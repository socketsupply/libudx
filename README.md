# libudx

A compatibility module for using libudx with the [Socket SDK][0].

# description

The JavaScript in libudx assumes NAPI bindings. This
requires significant tooling to target other platforms. In
some cases like React Native, it's easier for the developer
to generate bindings from NAPI, but this just pushes the
complexity and maintainence to a 3rd party.

# license

MIT

[0]:https://github.com/socketsupply/socket-sdk
