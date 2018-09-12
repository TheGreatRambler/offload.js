var WebSocket = require('ws');
var http = require('http');
var fs = require('fs');
var now = require('performance-now');
var ip = require('ip');
var PSON = require('pson');
var readMultipleFiles = require('read-files-promise');
var path = require('path');

var offload = function (options) {
	var self = this;
	if (!options) {
		options = {};
	}
	this.port = options.port || 1234;
	this.passedOptions = options;
	this.eventCallbacks = {};
	this.runningCodes = [];
	this.currentConnections = [];
	this.url = ip.address() + ":" + options.port;
	this.serverFiles = {};
	var filesToLoad = fs.readdirSync(__dirname + "/server/"); // hardcoded
	readMultipleFiles(filesToLoad, "utf8").then(function(fileBuffers) {
		fileBuffers.forEach(function(buffer, index) {
			this.serverFiles[path.basename(filesToLoad[index])] = buffer.toString("utf8");
		});
		this._startServer();
	}, function(err) {
		console.log("Necessary static files cannot be found in path /server/. please check your 'offload' instance");
	});
};
var oP = offload.prototype;

oP.getClients = function () {
	return this.currentConnections;
};

oP.getThreadCount = function() {
	var totalthreads = 0;
	this.currentConnections.forEach(function(connection) {
		totalthreads += connection.cores;
	});
	return totalthreads;
};

oP.getRunningThreadCount = function() {
	var totalrunningthreads = 0;
	this.currentConnections.forEach(function(connection) {
		totalrunningthreads += connection.coresRunning;
	});
	return totalrunningthreads;
};

oP.getUrl = function () {
	return this.url;
};

oP.on = function (event, cb) {
	this.eventCallbacks[event] = cb;
}

oP.calculateScore = function (hardwareData) {
	var networkScore = (100 / hardwareData.networkSpeed) * 10; // 1 second = one point, 1/2 second = 5 points
	var coreScore = hardwareData.cores * 10;
	var memoryScore = (hardwareData.memory / 1e+9) * 2; // 1 gigabyte = 2 points
	var computerTypeScore = hardwareData.type === "desktop" ? 10 : hardwareData.type === "laptop" ? 5 : 1;
	var pixelScore = hardwareData.pixels / 400000;
	var webGlScore = hardwareData.webGl ? 20 : 1;
	return networkScore + coreScore + memoryScore + computerTypeScore + pixelScore + webGlScore;
};

oP.runFunc = function (options) {
	// options.code = [func], options.arguments = [args]
	var self = this;
	return new Promise(function (resolve, reject) {
		if (self.currentConnections.length === 0) {
			reject(new Error("No clients to offload to. Try using `.on('first-client',...` to run when first client connects."));
		} else {
			for (var i = 0; i < self.currentConnections.length; i++) {
				var currentSocket = self.currentConnections[i];
				if (currentSocket.coresRunning < currentSocket.cores) {
					var codeId = uuidv4();
					self.runningCodes[codeId] = {
						resolve: resolve,
						reject: reject
					};
					var dataToSend = {};
					dataToSend.code = isString(options.code) ? options.code : options.code.toString();
					dataToSend.arguments = serializeObject(options.arguments);
					currentSocket.coresRunning += 1;
					var scripts;
					if (options.scripts) {
						scripts = [];
						options.scripts.forEach(function (item) {
							if (item.type === "scriptFile") {
								if (item.content instanceof Buffer) {
									scripts.push({
										type: "scriptString",
										content: item.content.toString("utf8")
									});
								}
								try {
									scripts.push({
										type: "scriptString",
										content: fs.readFileSync(item.content, "utf8")
									});
								} catch (e) {
									reject(e);
									return;
								}
							} else if (item.type === "scriptString") {
								scripts.push({
									type: "scriptString",
									content: item.content
								});
							} else if (item.type === "scriptUrl") {
								scripts.push({
									type: "scriptUrl",
									content: item.content
								});
							} else {
								reject(new Error("Incorrect script type + " + item.type));
								return;
							}
						});
					}
					currentSocket.socket.send(serializeObject({
						flag: "newCode",
						data: dataToSend,
						id: codeId,
						socketId: currentSocket.id,
						scripts: scripts
					}));
					break;
				} else if (i === self.currentConnections.length - 1) {
					reject(new Error("All clients are running"));
				}
			}
		}
	});
};

oP.emit = function (func, data) {
	if (this.eventCallbacks[func]) {
		this.eventCallbacks[func](data);
	}
};

oP._startServer = function() {
	var server = http.createServer(function (req, res) {
			res.writeHead(200, {
				"Content-Type": "text/html",
				"Content-Length": htmlfile.length,
				"Cache-Control": "no-cache, no-store, must-revalidate",
				"Pragma": "no-cache",
				"Expires": "0"
			});
			//res.write(htmlfile); <-- this needs to be added
			res.end();
		});
		var wss = new WebSocket.Server({
			server: server
		});
		wss.on("connection", function (ws) {
			var id;
			var start = now();
			// send beginning socket to get data
			ws.send(JSON.stringify({
				flag: "getInfo",
				data: (new Array(1025)).join("a") // generates exactly one kilobyte of data
			}));
			ws.on("message", function (message) {
				var data = JSON.parse(message);
				if (data.flag === "hardwareInfo") {
					// recieve hardware info from client
					data.networkSpeed = Number((now() - start).toFixed(3));
					data.score = self.calculateScore(data);
					data.socket = ws;
					data.coresRunning = 0;
					data.id = id = uuidv4();
					self.currentConnections.push(data); // add socket to list
					// sort from high score to low
					self.currentConnections.sort(function (a, b) {
						return b.score - a.score;
					});
					// this is the first client
					if (self.currentConnections.length === 1) {
						self.emit("first-client", data);
					}
					// callback for a new client
					self.emit("new-client", data);
				} else if (data.flag === "close") {
					// client is closing
					if (typeof id !== "undefined") {
						// remove client from list
						removeElementWithProp(self.currentConnections, "id", id);
					}
					ws.close();
					// callback for client leaving
					self.emit("leave-client", data);
				} else if (data.flag === "codeBack") {
					// code is coming back
					getObjectByProp(self.currentConnections, "id", data.socketId).coresRunning -= 1;
					if (!data.error) {
						self.runningCodes[data.id].resolve(unSerializeObject(data.serialized));
					} else {
						self.runningCodes[data.id].reject(unSerializeObject(data.serialized));
					}
					delete self.runningCodes[data.id];
				}
			});
		});
		server.listen(this.port);
};

/*
function bufferToArrayBuffer(buf) {
	var ab = new ArrayBuffer(buf.length);
	var view = new Uint8Array(ab);
	for (var i = 0; i < buf.length; ++i) {
		view[i] = buf[i];
	}
	return ab;
}

function arrayBufferToBuffer(ab) {
	var buf = new Buffer(ab.byteLength);
	var view = new Uint8Array(ab);
	for (var i = 0; i < buf.length; ++i) {
		buf[i] = view[i];
	}
	return buf;
}
*/

function uuidv4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0,
			v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

function removeElementWithProp(array, prop, val) {
	for (var i = array.length - 1; i >= 0; --i) {
		if (array[i][prop] === val) {
			array.splice(i, 1);
		}
	}
}

function isString(x) {
	return Object.prototype.toString.call(x) === "[object String]";
}

function getObjectByProp(arr, prop, value) {
	var result;
	arr.forEach(function (o) {
		if (o[prop] == value) result = o;
	});
	return result || undefined;
}

/*
function stringifyError(err) {
	return JSON.stringify(err, Object.getOwnPropertyNames(err));
}
*/

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

module.exports = offload;
