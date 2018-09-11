var offload = require('./index.js');

var offloadInstance = new offload();

console.log("started");

console.log(offloadInstance.getUrl());

offloadInstance.on("new-client", function (client) {
	console.log(offloadInstance.getClients().length);
	console.log("Func coming");
	offloadInstance.runFunc({
		code: function (arr) {
			return arr.map(function (num) {
				return num / 2;
			});
		},
		arguments: [[0, 1, 2, 3, 4]]
	}).then(function (result) {
		console.log("Here ya go: " + result);
	}).catch(function (err) {
		console.log("Here err: " + err.stack);
	});
});

offloadInstance.on("leave-client", function (client) {
	console.log(offloadInstance.getClients().length);
});
