var WebSocket = require('ws');
var http = require('http');
var fs = require('fs');
var now = require('performance-now');
var ip = require('ip');
var PSON = require('pson');
var readMultipleFiles = require('read-files-promise');
var path = require('path');
var fileType = require('file-type');
var rrDir = require('recursive-readdir');

var offload = function (options) {
	var self = this;
	options = options || {};
	this.port = options.port || 1234;
	this.passedOptions = options;
	this.eventCallbacks = {};
	this.runningCodes = [];
	this.currentConnections = [];
	this.url = ip.address() + ":" + this.port;
	this.serverFiles = {};
	this.cachedFuncs = [];
	var pathToGetFiles = path.join(__dirname, "server");
	rrDir(pathToGetFiles).then(function (files) {
		files.forEach(function (filePath) {
			var serverPath = filePath.replace(pathToGetFiles, "").replace(/\\/g, "/");
			console.log(serverPath);
			self.serverFiles[serverPath] = fs.readFileSync(filePath);
		})
		self._startServer();
	}).catch(function (err) {
		console.log("Necessary static files cannot be found in path /server/. please check your 'offload' instance", err);
	});
};
var oP = offload.prototype;

oP.getClients = function () {
	return this.currentConnections;
};

oP.getThreadCount = function () {
	var totalthreads = 0;
	this.currentConnections.forEach(function (connection) {
		totalthreads += connection.cores;
	});
	return totalthreads;
};

oP.getRunningThreadCount = function () {
	var totalrunningthreads = 0;
	this.currentConnections.forEach(function (connection) {
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
					// this is the one
					var codeId = uuidv4();
					self.runningCodes[codeId] = {
						resolve: resolve,
						reject: reject
					};
					var dataToSend = {};
					dataToSend.code = isString(options.code) ? options.code : options.code.toString();
					if (self.cachedFuncs.indexOf(dataToSend.code) !== -1) {
						// it was cached
						dataToSend.code = self.cachedFuncs.indexOf(dataToSend.code);
					} else {
						// it was not cached
						self.cachedFuncs.push(dataToSend.code);
					}
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
					// break out of for-loop
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

oP._startServer = function () {
	var self = this;
	var server = http.createServer(function (req, res) {
		console.log(req.url);
		if (self.serverFiles[req.url]) {
			res.writeHead(200, {
				"Content-Type": fileType(self.serverFiles[req.url]).mime,
				"Content-Length": self.serverFiles[req.url].byteLength,
				"Cache-Control": "no-cache, no-store, must-revalidate",
				"Pragma": "no-cache",
				"Expires": "0"
			});
			res.write(self.serverFiles[req.url]);
			res.end();
		} else {
			/*
			res.writeHead(404, {
				'Content-Type': 'text/plain'
			});
			res.write("That file don't exist, you dumb");
			res.end();
			*/
			// do absolutely nothing
		}
	});
	var wss = new WebSocket.Server({
		server: server
	});
	wss.on("connection", function (ws) {
		var thisSocket;
		var start = now();
		// send beginning socket to get data
		ws.send(JSON.stringify({
			flag: "getInfo",
			data: (new Array(1025)).join("a") // generates exactly one kilobyte of data
		}));
		ws.on("message", function (message) {
			var data = unSerializeObject(message);
			if (data.flag === "hardwareInfo") {
				// recieve hardware info from client
				data.networkSpeed = Number((now() - start).toFixed(3));
				data.socket = ws;
				data.coresRunning = 0;
				data.id = uuidv4();
				data.cachedFuncs = []; // cache functions
				self.currentConnections.push(data); // add socket to list
				// sort from high score to low
				self.currentConnections.sort(function (a, b) {
					return b.octaneScore - a.octaneScore;
				});
				// this is the first client
				if (self.currentConnections.length === 1) {
					self.emit("first-client", data);
				}
				// callback for a new client
				self.emit("new-client", data);
				thisSocket = data;
			} else if (data.flag === "close") {
				// client is closing
				// remove client from list
				removeElementWithProp(self.currentConnections, "id", thisSocket.id); // works with undefined
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
