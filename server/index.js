var url = window.location.hostname + ":" + window.location.port;
var socket = new WebSocket("ws://" + url);
var threads = navigator.hardwareConcurrency || 4;
var threadsopen = 0;
var codesRecieved = [];
socket.onopen = function () {
	socket.onmessage = function (e) {
		var data = unSerializeObject(e.data);
		if (data.flag === "getInfo") {
			getBenchmarkData().then(function (score) {
				socket.send(serializeObject({
					flag: "hardwareInfo",
					octaneScore: score
				}));
			});
		} else if (data.flag === "newCode") {
			threadsopen++;
			var funcRegex = /function\s*\(.*\)\s*\{/g;
			var scriptFunc = function (scripts) {
				for (var i = 0; i < scripts.length; i++) {
					var script = scripts[i];
					if (script.type === "scriptString") {
						importScripts(URL.createObjectURL(new Blob([script.content])));
					} else if (script.type === "scriptUrl") {
						importScripts(script.content);
					}
				}
			};
			var code;
			if (Number.isNaN(Number(data.data.code))) { // number is not a number
				var scriptPart = "(" + scriptFunc.toString() + ")(" + (JSON.stringify(data.scripts) || "[]") + ");";
				var functionPart = funcRegex.exec(data.data.code)[0];
				code = "return " + functionPart + scriptPart + data.data.code.replace(functionPart, "");
				codesRecieved.push(code); // add function to cache
			} else {
				code = codesRecieved[Number(data.data.code)]; // cached code, saves bandwidth
			}
			var funcToRun = threadify((new Function(code))()); // way to return the func
			var args = unSerializeObject(data.data.arguments);
			var job = funcToRun.apply(null, args);
			job.done = function (result) {
				socket.send(serializeObject({
					flag: "codeBack",
					error: false,
					serialized: serializeObject(result),
					id: data.id,
					socketId: data.socketId
				}));
			};
			job.failed = function (result) {
				//job.terminate();
				socket.send(serializeObject({
					flag: "codeBack",
					error: true,
					serialized: serializeObject(result),
					id: data.id,
					socketId: data.socketId
				}));
			};
		}
	};

	window.onbeforeunload = function () {
		socket.send(JSON.stringify({
			flag: "close"
		}));
	};
};

function serializeObject(obj) {
	var psonPair = new PSON.StaticPair();
	var encodedArraybuffer = psonPair.toArrayBuffer(obj);
	return encodedArraybuffer;
}

function unSerializeObject(aB) {
	var psonPair = new PSON.StaticPair();
	var decodedObj = psonPair.decode(aB);
	return decodedObj;
}

function getBenchmarkData() {
	new Promise(function (resolve, reject) {
		function emptyFunc() {
			// nothing
		}
		BenchmarkSuite.RunSuites({
			NotifyStart: emptyFunc,
			NotifyError: emptyFunc,
			NotifyResult: emptyFunc,
			NotifyScore: function (score) {
				resolve(score);
			}
		}, []); // empty array is benchmarks to skip
	});
}
