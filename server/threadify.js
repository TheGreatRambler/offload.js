/*threadify.js*/!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{("undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this).threadify=e()}}(function(){return function i(o,s,f){function u(r,e){if(!s[r]){if(!o[r]){var t="function"==typeof require&&require;if(!e&&t)return t(r,!0);if(l)return l(r,!0);var n=new Error("Cannot find module '"+r+"'");throw n.code="MODULE_NOT_FOUND",n}var a=s[r]={exports:{}};o[r][0].call(a.exports,function(e){return u(o[r][1][e]||e)},a,a.exports,i,o,s,f)}return s[r].exports}for(var l="function"==typeof require&&require,e=0;e<f.length;e++)u(f[e]);return u}({1:[function(e,r,t){r.exports={serializeArgs:function(e){"use strict";for(var r=["Int8Array","Uint8Array","Uint8ClampedArray","Int16Array","Uint16Array","Int32Array","Uint32Array","Float32Array","Float64Array"],t=[],n=[],a=0;a<e.length;a++)if(e[a]instanceof Error){for(var i={type:"Error",value:{name:e[a].name}},o=Object.getOwnPropertyNames(e[a]),s=0;s<o.length;s++)i.value[o[s]]=e[a][o[s]];t.push(i)}else if(e[a]instanceof DataView)n.push(e[a].buffer),t.push({type:"DataView",value:e[a].buffer});else{if(e[a]instanceof ArrayBuffer)n.push(e[a]);else if("ImageData"in window&&e[a]instanceof ImageData)n.push(e[a].data.buffer);else for(var f=0;f<r.length;f++)if(e[a]instanceof window[r[f]]){n.push(e[a].buffer);break}t.push({type:"arg",value:e[a]})}return{args:t,transferable:n}},unserializeArgs:function(e){"use strict";for(var r=[],t=0;t<e.length;t++)switch(e[t].type){case"arg":r.push(e[t].value);break;case"Error":var n=new Error;for(var a in e[t].value)n[a]=e[t].value[a];r.push(n);break;case"DataView":r.push(new DataView(e[t].value))}return r}}},{}],2:[function(e,r,t){"use strict";var d=e("./helpers.js");r.exports=function(e,r){var t,n,a,i,o=this,s=new Worker(e),f={done:null,failed:null,terminated:null},u={done:null,failed:null,terminated:null};function l(){for(var e in f)f[e]&&u[e]&&(f[e].apply(o,u[e]),u[e]=null)}function c(){s.terminate(),u.terminated=[],l()}Object.defineProperty(this,"done",{get:function(){return f.done},set:function(e){f.done=e,l()},enumerable:!0,configurable:!1}),Object.defineProperty(this,"failed",{get:function(){return f.failed},set:function(e){f.failed=e,l()},enumerable:!0,configurable:!1}),Object.defineProperty(this,"terminated",{get:function(){return f.terminated},set:function(e){f.terminated=e,l()},enumerable:!0,configurable:!1}),this.terminate=c,s.addEventListener("message",function(e){var r=e.data||{},t=d.unserializeArgs(r.args||[]);switch(r.name){case"threadify-return":u.done=t;break;case"threadify-error":u.failed=t;break;case"threadify-terminated":u.terminated=[]}l()}.bind(this),!1),s.addEventListener("error",function(e){u.failed=[e],l(),c()}.bind(this),!1),t="threadify-start",n=r,a=d.serializeArgs(n||[]),i={name:t,args:a.args},s.postMessage(i,a.transferable)}},{"./helpers.js":1}],3:[function(e,r,t){"use strict";var n=e("./helpers.js"),a=e("./job.js"),i=e("./workercode.js");r.exports=function(e){var r=new Blob(["var window=this;var global=this;(",i.toString(),")(",e.toString(),",",n.serializeArgs.toString(),",",n.unserializeArgs.toString(),");"],{type:"application/javascript"}),t=URL.createObjectURL(r);return function(){for(var e=[],r=0;r<arguments.length;r++)e.push(arguments[r]);return new a(t,e)}}},{"./helpers.js":1,"./job.js":2,"./workercode.js":4}],4:[function(e,r,t){r.exports=function(a,i,o){"use strict";function s(e,r){var t=i(r||[]),n={name:e,args:t.args};postMessage(n,t.transferable)}var f={terminate:function(){s("threadify-terminated",[]),close()},error:function(){s("threadify-error",arguments)},return:function(){s("threadify-return",arguments),f.terminate()}};addEventListener("message",function(e){var r=e.data||{},t=o(r.args||[]);switch(r.name){case"threadify-start":var n;try{n=a.apply(f,t)}catch(e){f.error(e),f.terminate()}void 0!==n&&(s("threadify-return",[n]),f.terminate())}},!1)}},{}]},{},[3])(3)});
