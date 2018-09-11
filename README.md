# Offload.js

Offload.js is a npm package for running programs on web clients... instead of on the server!

  - Run cpu-intensive functions on your clients
  - Distributed computing can now be achieved with browsers as well!
  - GPUs are supported if you use [gpu.js](http://gpu.rocks/) (check the examples at the github to see how to use)

## Get started

```javascript
var Offload = require('offload');
var offload = new Offload({
    port: 1234
});
console.log(offload.getUrl());
offload.on("new-client", function() {
    offload.runFunc({
        code: function(arr) {
            return arr.map(function(num) {
                return num * 10;
            });
        },
        arguments: [[0, 1, 2, 3, 4]]
    }).then(function(result) {
        console.log(result);
    }).catch(function(err) {
        console.log(err);
    });
});
```

## API

### constructor

```javascript
var Offload = require('offload');
var offload = new Offload({
    port: 1234
});
```

Currently the only option is `port`, used to change the port that the webpage appears at.

### methods

```javascript
console.log(offload.getUrl());
// 192.168.1.134:1234
```

Get the url where the client page appears.

```javascript
console.log(offload.getClients());
/*
[{
cores: 4,
...
}, {
cores: 2,
...
}]
*/
```

Get all clients connected as a array. The properties avaliable are:

  - cores: Number of cores avaliable in the machine
  - coresRunning: Number of cores running currently
  - socket: The `ws` websocket connected to the client
  - networkSpeed: Speed of the socket network
  - score: Score of the client hardware (the performance)
  - id: Id of the client

```javascript
console.log(offload.getThreadCount());
// 10
```

The number of total threads in all clients.

```javascript
console.log(offload.getRunningThreadCount());
// 3
```

The number of running threads in all clients.

```javascript
offload.on("new-client", function(client) {
    console.log(client);
});
```

Events are emitted by this function. The events emitted are as follows:

  - new-client: emitted on new client
  - leave-client: emitted when a client leaves
  - first-client: emitted on the first client
  - 
  
The number of running threads in all clients.

```javascript
offload.runFunc({
    code: function(arr) {
        return arr.map(function(num) {
            return num * 10;
        });
    },
    arguments: [[0, 1, 2, 3, 4]]
}).then(function(result) {
    console.log(result);
}).catch(function(err) {
    console.log(err);
});
```

Run a function on a open thread on a client, sorted by fastest clients first. Supported vales passed includes:

  - Array
  - Function
  - Object
  - Null
  - Undefined
  - Number
  - Boolean
  - RegExp
  - String
  - [all typed arrays]*
  - Error

*Buffers are not supported. To support passing buffers to the web client, convert it to a typed array like `UInt8Array`.
Functions run on [threadify.js](https://github.com/flozz/threadify). This javascript library also allows you to return a value from a promise, for example:

```javascript
offload.runFunc({
    code: function(arr) {
    var self = this;
        return arr.map(function(num) {
            self.return(num * 10);
        });
    },
    arguments: [[0, 1, 2, 3, 4]]
}).then(function(result) {
    console.log(result);
}).catch(function(err) {
    console.log(err);
});
```

You can check the docs of [threadify.js](https://github.com/flozz/threadify) for more options. Scripts are also supported:

```javascript
offload.runFunc({
    code: function(arr) {
    var self = this;
        return arr.map(function(num) {
            return mul(num , 10);
        });
    },
    arguments: [[0, 1, 2, 3, 4]],
    scripts: [{
        type: "scriptString",
        content: "function mul(num1,num2){return num1*num2}"
    }]
}).then(function(result) {
    console.log(result);
}).catch(function(err) {
    console.log(err);
});
```

Scripts are included in the order of the array. Remember, the scripts must support web workers (`window` cannot be used, `canvas` not supported, etc...). Types of scripts that are supported are:

  - scriptString: A raw string (like the one above)
  - scriptFile: The buffer of a file or the path of a file
  - scriptUrl: The url of the file, like one referenced at a cdn
  - 
  ## License

MIT, everybody's favorite open-source software license
