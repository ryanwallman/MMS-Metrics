var process={env:{}};
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/papaparse/papaparse.min.js
var require_papaparse_min = __commonJS({
  "node_modules/papaparse/papaparse.min.js"(exports, module) {
    ((e, t) => {
      "function" == typeof define && define.amd ? define([], t) : "object" == typeof module && "undefined" != typeof exports ? module.exports = t() : e.Papa = t();
    })(exports, function r() {
      var n = "undefined" != typeof self ? self : "undefined" != typeof window ? window : void 0 !== n ? n : {};
      var d, s = !n.document && !!n.postMessage, a = n.IS_PAPA_WORKER || false, o = {}, h = 0, v = {};
      function u(e) {
        this._handle = null, this._finished = false, this._completed = false, this._halted = false, this._input = null, this._baseIndex = 0, this._partialLine = "", this._rowCount = 0, this._start = 0, this._nextChunk = null, this.isFirstChunk = true, this._completeResults = { data: [], errors: [], meta: {} }, function(e2) {
          var t = b(e2);
          t.chunkSize = parseInt(t.chunkSize), e2.step || e2.chunk || (t.chunkSize = null);
          this._handle = new i(t), (this._handle.streamer = this)._config = t;
        }.call(this, e), this.parseChunk = function(t, e2) {
          var i2 = parseInt(this._config.skipFirstNLines) || 0;
          if (this.isFirstChunk && 0 < i2) {
            let e3 = this._config.newline;
            e3 || (r2 = this._config.quoteChar || '"', e3 = this._handle.guessLineEndings(t, r2)), t = [...t.split(e3).slice(i2)].join(e3);
          }
          this.isFirstChunk && U(this._config.beforeFirstChunk) && void 0 !== (r2 = this._config.beforeFirstChunk(t)) && (t = r2), this.isFirstChunk = false, this._halted = false;
          var i2 = this._partialLine + t, r2 = (this._partialLine = "", this._handle.parse(i2, this._baseIndex, !this._finished));
          if (!this._handle.paused() && !this._handle.aborted()) {
            t = r2.meta.cursor, i2 = (this._finished || (this._partialLine = i2.substring(t - this._baseIndex), this._baseIndex = t), r2 && r2.data && (this._rowCount += r2.data.length), this._finished || this._config.preview && this._rowCount >= this._config.preview);
            if (a) n.postMessage({ results: r2, workerId: v.WORKER_ID, finished: i2 });
            else if (U(this._config.chunk) && !e2) {
              if (this._config.chunk(r2, this._handle), this._handle.paused() || this._handle.aborted()) return void (this._halted = true);
              this._completeResults = r2 = void 0;
            }
            return this._config.step || this._config.chunk || (this._completeResults.data = this._completeResults.data.concat(r2.data), this._completeResults.errors = this._completeResults.errors.concat(r2.errors), this._completeResults.meta = r2.meta), this._completed || !i2 || !U(this._config.complete) || r2 && r2.meta.aborted || (this._config.complete(this._completeResults, this._input), this._completed = true), i2 || r2 && r2.meta.paused || this._nextChunk(), r2;
          }
          this._halted = true;
        }, this._sendError = function(e2) {
          U(this._config.error) ? this._config.error(e2) : a && this._config.error && n.postMessage({ workerId: v.WORKER_ID, error: e2, finished: false });
        };
      }
      function f(e) {
        var r2;
        (e = e || {}).chunkSize || (e.chunkSize = v.RemoteChunkSize), u.call(this, e), this._nextChunk = s ? function() {
          this._readChunk(), this._chunkLoaded();
        } : function() {
          this._readChunk();
        }, this.stream = function(e2) {
          this._input = e2, this._nextChunk();
        }, this._readChunk = function() {
          if (this._finished) this._chunkLoaded();
          else {
            if (r2 = new XMLHttpRequest(), this._config.withCredentials && (r2.withCredentials = this._config.withCredentials), s || (r2.onload = y(this._chunkLoaded, this), r2.onerror = y(this._chunkError, this)), r2.open(this._config.downloadRequestBody ? "POST" : "GET", this._input, !s), this._config.downloadRequestHeaders) {
              var e2, t = this._config.downloadRequestHeaders;
              for (e2 in t) r2.setRequestHeader(e2, t[e2]);
            }
            var i2;
            this._config.chunkSize && (i2 = this._start + this._config.chunkSize - 1, r2.setRequestHeader("Range", "bytes=" + this._start + "-" + i2));
            try {
              r2.send(this._config.downloadRequestBody);
            } catch (e3) {
              this._chunkError(e3.message);
            }
            s && 0 === r2.status && this._chunkError();
          }
        }, this._chunkLoaded = function() {
          4 === r2.readyState && (r2.status < 200 || 400 <= r2.status ? this._chunkError() : (this._start += this._config.chunkSize || r2.responseText.length, this._finished = !this._config.chunkSize || this._start >= ((e2) => null !== (e2 = e2.getResponseHeader("Content-Range")) ? parseInt(e2.substring(e2.lastIndexOf("/") + 1)) : -1)(r2), this.parseChunk(r2.responseText)));
        }, this._chunkError = function(e2) {
          e2 = r2.statusText || e2;
          this._sendError(new Error(e2));
        };
      }
      function l(e) {
        (e = e || {}).chunkSize || (e.chunkSize = v.LocalChunkSize), u.call(this, e);
        var i2, r2, n2 = "undefined" != typeof FileReader;
        this.stream = function(e2) {
          this._input = e2, r2 = e2.slice || e2.webkitSlice || e2.mozSlice, n2 ? ((i2 = new FileReader()).onload = y(this._chunkLoaded, this), i2.onerror = y(this._chunkError, this)) : i2 = new FileReaderSync(), this._nextChunk();
        }, this._nextChunk = function() {
          this._finished || this._config.preview && !(this._rowCount < this._config.preview) || this._readChunk();
        }, this._readChunk = function() {
          var e2 = this._input, t = (this._config.chunkSize && (t = Math.min(this._start + this._config.chunkSize, this._input.size), e2 = r2.call(e2, this._start, t)), i2.readAsText(e2, this._config.encoding));
          n2 || this._chunkLoaded({ target: { result: t } });
        }, this._chunkLoaded = function(e2) {
          this._start += this._config.chunkSize, this._finished = !this._config.chunkSize || this._start >= this._input.size, this.parseChunk(e2.target.result);
        }, this._chunkError = function() {
          this._sendError(i2.error);
        };
      }
      function c(e) {
        var i2;
        u.call(this, e = e || {}), this.stream = function(e2) {
          return i2 = e2, this._nextChunk();
        }, this._nextChunk = function() {
          var e2, t;
          if (!this._finished) return e2 = this._config.chunkSize, i2 = e2 ? (t = i2.substring(0, e2), i2.substring(e2)) : (t = i2, ""), this._finished = !i2, this.parseChunk(t);
        };
      }
      function p(e) {
        u.call(this, e = e || {});
        var t = [], i2 = true, r2 = false;
        this.pause = function() {
          u.prototype.pause.apply(this, arguments), this._input.pause();
        }, this.resume = function() {
          u.prototype.resume.apply(this, arguments), this._input.resume();
        }, this.stream = function(e2) {
          this._input = e2, this._input.on("data", this._streamData), this._input.on("end", this._streamEnd), this._input.on("error", this._streamError);
        }, this._checkIsFinished = function() {
          r2 && 1 === t.length && (this._finished = true);
        }, this._nextChunk = function() {
          this._checkIsFinished(), t.length ? this.parseChunk(t.shift()) : i2 = true;
        }, this._streamData = y(function(e2) {
          try {
            t.push("string" == typeof e2 ? e2 : e2.toString(this._config.encoding)), i2 && (i2 = false, this._checkIsFinished(), this.parseChunk(t.shift()));
          } catch (e3) {
            this._streamError(e3);
          }
        }, this), this._streamError = y(function(e2) {
          this._streamCleanUp(), this._sendError(e2);
        }, this), this._streamEnd = y(function() {
          this._streamCleanUp(), r2 = true, this._streamData("");
        }, this), this._streamCleanUp = y(function() {
          this._input.removeListener("data", this._streamData), this._input.removeListener("end", this._streamEnd), this._input.removeListener("error", this._streamError);
        }, this);
      }
      function i(m2) {
        var n2, s2, a2, t, o2 = Math.pow(2, 53), h2 = -o2, u2 = /^\s*-?(\d+\.?|\.\d+|\d+\.\d+)([eE][-+]?\d+)?\s*$/, d2 = /^((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)))$/, i2 = this, r2 = 0, f2 = 0, l2 = false, e = false, c2 = [], p2 = { data: [], errors: [], meta: {} };
        function y2(e2) {
          return "greedy" === m2.skipEmptyLines ? "" === e2.join("").trim() : 1 === e2.length && 0 === e2[0].length;
        }
        function g2() {
          if (p2 && a2 && (k("Delimiter", "UndetectableDelimiter", "Unable to auto-detect delimiting character; defaulted to '" + v.DefaultDelimiter + "'"), a2 = false), m2.skipEmptyLines && (p2.data = p2.data.filter(function(e3) {
            return !y2(e3);
          })), _2()) {
            let t3 = function(e3, t4) {
              U(m2.transformHeader) && (e3 = m2.transformHeader(e3, t4)), c2.push(e3);
            };
            var t2 = t3;
            if (p2) if (Array.isArray(p2.data[0])) {
              for (var e2 = 0; _2() && e2 < p2.data.length; e2++) p2.data[e2].forEach(t3);
              p2.data.splice(0, 1);
            } else p2.data.forEach(t3);
          }
          function i3(e3, t3) {
            for (var i4 = m2.header ? {} : [], r4 = 0; r4 < e3.length; r4++) {
              var n3 = r4, s3 = e3[r4], s3 = ((e4, t4) => ((e5) => (m2.dynamicTypingFunction && void 0 === m2.dynamicTyping[e5] && (m2.dynamicTyping[e5] = m2.dynamicTypingFunction(e5)), true === (m2.dynamicTyping[e5] || m2.dynamicTyping)))(e4) ? "true" === t4 || "TRUE" === t4 || "false" !== t4 && "FALSE" !== t4 && (((e5) => {
                if (u2.test(e5)) {
                  e5 = parseFloat(e5);
                  if (h2 < e5 && e5 < o2) return 1;
                }
              })(t4) ? parseFloat(t4) : d2.test(t4) ? new Date(t4) : "" === t4 ? null : t4) : t4)(n3 = m2.header ? r4 >= c2.length ? "__parsed_extra" : c2[r4] : n3, s3 = m2.transform ? m2.transform(s3, n3) : s3);
              "__parsed_extra" === n3 ? (i4[n3] = i4[n3] || [], i4[n3].push(s3)) : i4[n3] = s3;
            }
            return m2.header && (r4 > c2.length ? k("FieldMismatch", "TooManyFields", "Too many fields: expected " + c2.length + " fields but parsed " + r4, f2 + t3) : r4 < c2.length && k("FieldMismatch", "TooFewFields", "Too few fields: expected " + c2.length + " fields but parsed " + r4, f2 + t3)), i4;
          }
          var r3;
          p2 && (m2.header || m2.dynamicTyping || m2.transform) && (r3 = 1, !p2.data.length || Array.isArray(p2.data[0]) ? (p2.data = p2.data.map(i3), r3 = p2.data.length) : p2.data = i3(p2.data, 0), m2.header && p2.meta && (p2.meta.fields = c2), f2 += r3);
        }
        function _2() {
          return m2.header && 0 === c2.length;
        }
        function k(e2, t2, i3, r3) {
          e2 = { type: e2, code: t2, message: i3 };
          void 0 !== r3 && (e2.row = r3), p2.errors.push(e2);
        }
        U(m2.step) && (t = m2.step, m2.step = function(e2) {
          p2 = e2, _2() ? g2() : (g2(), 0 !== p2.data.length && (r2 += e2.data.length, m2.preview && r2 > m2.preview ? s2.abort() : (p2.data = p2.data[0], t(p2, i2))));
        }), this.parse = function(e2, t2, i3) {
          var r3 = m2.quoteChar || '"', r3 = (m2.newline || (m2.newline = this.guessLineEndings(e2, r3)), a2 = false, m2.delimiter ? U(m2.delimiter) && (m2.delimiter = m2.delimiter(e2), p2.meta.delimiter = m2.delimiter) : ((r3 = ((e3, t3, i4, r4, n3) => {
            var s3, a3, o3, h3;
            n3 = n3 || [",", "	", "|", ";", v.RECORD_SEP, v.UNIT_SEP];
            for (var u3 = 0; u3 < n3.length; u3++) {
              for (var d3, f3 = n3[u3], l3 = 0, c3 = 0, p3 = 0, g3 = (o3 = void 0, new E({ comments: r4, delimiter: f3, newline: t3, preview: 10 }).parse(e3)), _3 = 0; _3 < g3.data.length; _3++) i4 && y2(g3.data[_3]) ? p3++ : (d3 = g3.data[_3].length, c3 += d3, void 0 === o3 ? o3 = d3 : 0 < d3 && (l3 += Math.abs(d3 - o3), o3 = d3));
              0 < g3.data.length && (c3 /= g3.data.length - p3), (void 0 === a3 || l3 <= a3) && (void 0 === h3 || h3 < c3) && 1.99 < c3 && (a3 = l3, s3 = f3, h3 = c3);
            }
            return { successful: !!(m2.delimiter = s3), bestDelimiter: s3 };
          })(e2, m2.newline, m2.skipEmptyLines, m2.comments, m2.delimitersToGuess)).successful ? m2.delimiter = r3.bestDelimiter : (a2 = true, m2.delimiter = v.DefaultDelimiter), p2.meta.delimiter = m2.delimiter), b(m2));
          return m2.preview && m2.header && r3.preview++, n2 = e2, s2 = new E(r3), p2 = s2.parse(n2, t2, i3), g2(), l2 ? { meta: { paused: true } } : p2 || { meta: { paused: false } };
        }, this.paused = function() {
          return l2;
        }, this.pause = function() {
          l2 = true, s2.abort(), n2 = U(m2.chunk) ? "" : n2.substring(s2.getCharIndex());
        }, this.resume = function() {
          i2.streamer._halted ? (l2 = false, i2.streamer.parseChunk(n2, true)) : setTimeout(i2.resume, 3);
        }, this.aborted = function() {
          return e;
        }, this.abort = function() {
          e = true, s2.abort(), p2.meta.aborted = true, U(m2.complete) && m2.complete(p2), n2 = "";
        }, this.guessLineEndings = function(e2, t2) {
          e2 = e2.substring(0, 1048576);
          var t2 = new RegExp(P(t2) + "([^]*?)" + P(t2), "gm"), i3 = (e2 = e2.replace(t2, "")).split("\r"), t2 = e2.split("\n"), e2 = 1 < t2.length && t2[0].length < i3[0].length;
          if (1 === i3.length || e2) return "\n";
          for (var r3 = 0, n3 = 0; n3 < i3.length; n3++) "\n" === i3[n3][0] && r3++;
          return r3 >= i3.length / 2 ? "\r\n" : "\r";
        };
      }
      function P(e) {
        return e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
      function E(C) {
        var S = (C = C || {}).delimiter, O = C.newline, x = C.comments, I = C.step, A = C.preview, T = C.fastMode, D = null, L = false, F = null == C.quoteChar ? '"' : C.quoteChar, j = F;
        if (void 0 !== C.escapeChar && (j = C.escapeChar), ("string" != typeof S || -1 < v.BAD_DELIMITERS.indexOf(S)) && (S = ","), x === S) throw new Error("Comment character same as delimiter");
        true === x ? x = "#" : ("string" != typeof x || -1 < v.BAD_DELIMITERS.indexOf(x)) && (x = false), "\n" !== O && "\r" !== O && "\r\n" !== O && (O = "\n");
        var z = 0, M = false;
        this.parse = function(i2, t, r2) {
          if ("string" != typeof i2) throw new Error("Input must be a string");
          var n2 = i2.length, e = S.length, s2 = O.length, a2 = x.length, o2 = U(I), h2 = [], u2 = [], d2 = [], f2 = z = 0;
          if (!i2) return w();
          if (T || false !== T && -1 === i2.indexOf(F)) {
            for (var l2 = i2.split(O), c2 = 0; c2 < l2.length; c2++) {
              if (d2 = l2[c2], z += d2.length, c2 !== l2.length - 1) z += O.length;
              else if (r2) return w();
              if (!x || d2.substring(0, a2) !== x) {
                if (o2) {
                  if (h2 = [], k(d2.split(S)), R(), M) return w();
                } else k(d2.split(S));
                if (A && A <= c2) return h2 = h2.slice(0, A), w(true);
              }
            }
            return w();
          }
          for (var p2 = i2.indexOf(S, z), g2 = i2.indexOf(O, z), _2 = new RegExp(P(j) + P(F), "g"), m2 = i2.indexOf(F, z); ; ) if (i2[z] === F) for (m2 = z, z++; ; ) {
            if (-1 === (m2 = i2.indexOf(F, m2 + 1))) return r2 || u2.push({ type: "Quotes", code: "MissingQuotes", message: "Quoted field unterminated", row: h2.length, index: z }), E2();
            if (m2 === n2 - 1) return E2(i2.substring(z, m2).replace(_2, F));
            if (F === j && i2[m2 + 1] === j) m2++;
            else if (F === j || 0 === m2 || i2[m2 - 1] !== j) {
              -1 !== p2 && p2 < m2 + 1 && (p2 = i2.indexOf(S, m2 + 1));
              var y2 = v2(-1 === (g2 = -1 !== g2 && g2 < m2 + 1 ? i2.indexOf(O, m2 + 1) : g2) ? p2 : Math.min(p2, g2));
              if (i2.substr(m2 + 1 + y2, e) === S) {
                d2.push(i2.substring(z, m2).replace(_2, F)), i2[z = m2 + 1 + y2 + e] !== F && (m2 = i2.indexOf(F, z)), p2 = i2.indexOf(S, z), g2 = i2.indexOf(O, z);
                break;
              }
              y2 = v2(g2);
              if (i2.substring(m2 + 1 + y2, m2 + 1 + y2 + s2) === O) {
                if (d2.push(i2.substring(z, m2).replace(_2, F)), b2(m2 + 1 + y2 + s2), p2 = i2.indexOf(S, z), m2 = i2.indexOf(F, z), o2 && (R(), M)) return w();
                if (A && h2.length >= A) return w(true);
                break;
              }
              u2.push({ type: "Quotes", code: "InvalidQuotes", message: "Trailing quote on quoted field is malformed", row: h2.length, index: z }), m2++;
            }
          }
          else if (x && 0 === d2.length && i2.substring(z, z + a2) === x) {
            if (-1 === g2) return w();
            z = g2 + s2, g2 = i2.indexOf(O, z), p2 = i2.indexOf(S, z);
          } else if (-1 !== p2 && (p2 < g2 || -1 === g2)) d2.push(i2.substring(z, p2)), z = p2 + e, p2 = i2.indexOf(S, z);
          else {
            if (-1 === g2) break;
            if (d2.push(i2.substring(z, g2)), b2(g2 + s2), o2 && (R(), M)) return w();
            if (A && h2.length >= A) return w(true);
          }
          return E2();
          function k(e2) {
            h2.push(e2), f2 = z;
          }
          function v2(e2) {
            var t2 = 0;
            return t2 = -1 !== e2 && (e2 = i2.substring(m2 + 1, e2)) && "" === e2.trim() ? e2.length : t2;
          }
          function E2(e2) {
            return r2 || (void 0 === e2 && (e2 = i2.substring(z)), d2.push(e2), z = n2, k(d2), o2 && R()), w();
          }
          function b2(e2) {
            z = e2, k(d2), d2 = [], g2 = i2.indexOf(O, z);
          }
          function w(e2) {
            if (C.header && !t && h2.length && !L) {
              var s3 = h2[0], a3 = /* @__PURE__ */ Object.create(null), o3 = new Set(s3);
              let n3 = false;
              for (let r3 = 0; r3 < s3.length; r3++) {
                let i3 = s3[r3];
                if (a3[i3 = U(C.transformHeader) ? C.transformHeader(i3, r3) : i3]) {
                  let e3, t2 = a3[i3];
                  for (; e3 = i3 + "_" + t2, t2++, o3.has(e3); ) ;
                  o3.add(e3), s3[r3] = e3, a3[i3]++, n3 = true, (D = null === D ? {} : D)[e3] = i3;
                } else a3[i3] = 1, s3[r3] = i3;
                o3.add(i3);
              }
              n3 && console.warn("Duplicate headers found and renamed."), L = true;
            }
            return { data: h2, errors: u2, meta: { delimiter: S, linebreak: O, aborted: M, truncated: !!e2, cursor: f2 + (t || 0), renamedHeaders: D } };
          }
          function R() {
            I(w()), h2 = [], u2 = [];
          }
        }, this.abort = function() {
          M = true;
        }, this.getCharIndex = function() {
          return z;
        };
      }
      function g(e) {
        var t = e.data, i2 = o[t.workerId], r2 = false;
        if (t.error) i2.userError(t.error, t.file);
        else if (t.results && t.results.data) {
          var n2 = { abort: function() {
            r2 = true, _(t.workerId, { data: [], errors: [], meta: { aborted: true } });
          }, pause: m, resume: m };
          if (U(i2.userStep)) {
            for (var s2 = 0; s2 < t.results.data.length && (i2.userStep({ data: t.results.data[s2], errors: t.results.errors, meta: t.results.meta }, n2), !r2); s2++) ;
            delete t.results;
          } else U(i2.userChunk) && (i2.userChunk(t.results, n2, t.file), delete t.results);
        }
        t.finished && !r2 && _(t.workerId, t.results);
      }
      function _(e, t) {
        var i2 = o[e];
        U(i2.userComplete) && i2.userComplete(t), i2.terminate(), delete o[e];
      }
      function m() {
        throw new Error("Not implemented.");
      }
      function b(e) {
        if ("object" != typeof e || null === e) return e;
        var t, i2 = Array.isArray(e) ? [] : {};
        for (t in e) i2[t] = b(e[t]);
        return i2;
      }
      function y(e, t) {
        return function() {
          e.apply(t, arguments);
        };
      }
      function U(e) {
        return "function" == typeof e;
      }
      return v.parse = function(e, t) {
        var i2 = (t = t || {}).dynamicTyping || false;
        U(i2) && (t.dynamicTypingFunction = i2, i2 = {});
        if (t.dynamicTyping = i2, t.transform = !!U(t.transform) && t.transform, !t.worker || !v.WORKERS_SUPPORTED) return i2 = null, v.NODE_STREAM_INPUT, "string" == typeof e ? (e = ((e2) => 65279 !== e2.charCodeAt(0) ? e2 : e2.slice(1))(e), i2 = new (t.download ? f : c)(t)) : true === e.readable && U(e.read) && U(e.on) ? i2 = new p(t) : (n.File && e instanceof File || e instanceof Object) && (i2 = new l(t)), i2.stream(e);
        (i2 = (() => {
          var e2;
          return !!v.WORKERS_SUPPORTED && (e2 = (() => {
            var e3 = n.URL || n.webkitURL || null, t2 = r.toString();
            return v.BLOB_URL || (v.BLOB_URL = e3.createObjectURL(new Blob(["var global = (function() { if (typeof self !== 'undefined') { return self; } if (typeof window !== 'undefined') { return window; } if (typeof global !== 'undefined') { return global; } return {}; })(); global.IS_PAPA_WORKER=true; ", "(", t2, ")();"], { type: "text/javascript" })));
          })(), (e2 = new n.Worker(e2)).onmessage = g, e2.id = h++, o[e2.id] = e2);
        })()).userStep = t.step, i2.userChunk = t.chunk, i2.userComplete = t.complete, i2.userError = t.error, t.step = U(t.step), t.chunk = U(t.chunk), t.complete = U(t.complete), t.error = U(t.error), delete t.worker, i2.postMessage({ input: e, config: t, workerId: i2.id });
      }, v.unparse = function(e, t) {
        var n2 = false, _2 = true, m2 = ",", y2 = "\r\n", s2 = '"', a2 = s2 + s2, i2 = false, r2 = null, o2 = false, h2 = ((() => {
          if ("object" == typeof t) {
            if ("string" != typeof t.delimiter || v.BAD_DELIMITERS.filter(function(e2) {
              return -1 !== t.delimiter.indexOf(e2);
            }).length || (m2 = t.delimiter), "boolean" != typeof t.quotes && "function" != typeof t.quotes && !Array.isArray(t.quotes) || (n2 = t.quotes), "boolean" != typeof t.skipEmptyLines && "string" != typeof t.skipEmptyLines || (i2 = t.skipEmptyLines), "string" == typeof t.newline && (y2 = t.newline), "string" == typeof t.quoteChar && (s2 = t.quoteChar), "boolean" == typeof t.header && (_2 = t.header), Array.isArray(t.columns)) {
              if (0 === t.columns.length) throw new Error("Option columns is empty");
              r2 = t.columns;
            }
            void 0 !== t.escapeChar && (a2 = t.escapeChar + s2), t.escapeFormulae instanceof RegExp ? o2 = t.escapeFormulae : "boolean" == typeof t.escapeFormulae && t.escapeFormulae && (o2 = /^[=+\-@\t\r].*$/);
          }
        })(), new RegExp(P(s2), "g"));
        "string" == typeof e && (e = JSON.parse(e));
        if (Array.isArray(e)) {
          if (!e.length || Array.isArray(e[0])) return u2(null, e, i2);
          if ("object" == typeof e[0]) return u2(r2 || Object.keys(e[0]), e, i2);
        } else if ("object" == typeof e) return "string" == typeof e.data && (e.data = JSON.parse(e.data)), Array.isArray(e.data) && (e.fields || (e.fields = e.meta && e.meta.fields || r2), e.fields || (e.fields = Array.isArray(e.data[0]) ? e.fields : "object" == typeof e.data[0] ? Object.keys(e.data[0]) : []), Array.isArray(e.data[0]) || "object" == typeof e.data[0] || (e.data = [e.data])), u2(e.fields || [], e.data || [], i2);
        throw new Error("Unable to serialize unrecognized input");
        function u2(e2, t2, i3) {
          var r3 = "", n3 = ("string" == typeof e2 && (e2 = JSON.parse(e2)), "string" == typeof t2 && (t2 = JSON.parse(t2)), Array.isArray(e2) && 0 < e2.length), s3 = !Array.isArray(t2[0]);
          if (n3 && _2) {
            for (var a3 = 0; a3 < e2.length; a3++) 0 < a3 && (r3 += m2), r3 += k(e2[a3], a3);
            0 < t2.length && (r3 += y2);
          }
          for (var o3 = 0; o3 < t2.length; o3++) {
            var h3 = (n3 ? e2 : t2[o3]).length, u3 = false, d2 = n3 ? 0 === Object.keys(t2[o3]).length : 0 === t2[o3].length;
            if (i3 && !n3 && (u3 = "greedy" === i3 ? "" === t2[o3].join("").trim() : 1 === t2[o3].length && 0 === t2[o3][0].length), "greedy" === i3 && n3) {
              for (var f2 = [], l2 = 0; l2 < h3; l2++) {
                var c2 = s3 ? e2[l2] : l2;
                f2.push(t2[o3][c2]);
              }
              u3 = "" === f2.join("").trim();
            }
            if (!u3) {
              for (var p2 = 0; p2 < h3; p2++) {
                0 < p2 && !d2 && (r3 += m2);
                var g2 = n3 && s3 ? e2[p2] : p2;
                r3 += k(t2[o3][g2], p2);
              }
              o3 < t2.length - 1 && (!i3 || 0 < h3 && !d2) && (r3 += y2);
            }
          }
          return r3;
        }
        function k(e2, t2) {
          var i3, r3;
          return null == e2 ? "" : e2.constructor === Date ? JSON.stringify(e2).slice(1, 25) : (r3 = false, o2 && "string" == typeof e2 && o2.test(e2) && (e2 = "'" + e2, r3 = true), i3 = e2.toString().replace(h2, a2), (r3 = r3 || true === n2 || "function" == typeof n2 && n2(e2, t2) || Array.isArray(n2) && n2[t2] || ((e3, t3) => {
            for (var i4 = 0; i4 < t3.length; i4++) if (-1 < e3.indexOf(t3[i4])) return true;
            return false;
          })(i3, v.BAD_DELIMITERS) || -1 < i3.indexOf(m2) || " " === i3.charAt(0) || " " === i3.charAt(i3.length - 1)) ? s2 + i3 + s2 : i3);
        }
      }, v.RECORD_SEP = String.fromCharCode(30), v.UNIT_SEP = String.fromCharCode(31), v.BYTE_ORDER_MARK = "\uFEFF", v.BAD_DELIMITERS = ["\r", "\n", '"', v.BYTE_ORDER_MARK], v.WORKERS_SUPPORTED = !s && !!n.Worker, v.NODE_STREAM_INPUT = 1, v.LocalChunkSize = 10485760, v.RemoteChunkSize = 5242880, v.DefaultDelimiter = ",", v.Parser = E, v.ParserHandle = i, v.NetworkStreamer = f, v.FileStreamer = l, v.StringStreamer = c, v.ReadableStreamStreamer = p, n.jQuery && ((d = n.jQuery).fn.parse = function(o2) {
        var i2 = o2.config || {}, h2 = [];
        return this.each(function(e2) {
          if (!("INPUT" === d(this).prop("tagName").toUpperCase() && "file" === d(this).attr("type").toLowerCase() && n.FileReader) || !this.files || 0 === this.files.length) return true;
          for (var t = 0; t < this.files.length; t++) h2.push({ file: this.files[t], inputElem: this, instanceConfig: d.extend({}, i2) });
        }), e(), this;
        function e() {
          if (0 === h2.length) U(o2.complete) && o2.complete();
          else {
            var e2, t, i3, r2, n2 = h2[0];
            if (U(o2.before)) {
              var s2 = o2.before(n2.file, n2.inputElem);
              if ("object" == typeof s2) {
                if ("abort" === s2.action) return e2 = "AbortError", t = n2.file, i3 = n2.inputElem, r2 = s2.reason, void (U(o2.error) && o2.error({ name: e2 }, t, i3, r2));
                if ("skip" === s2.action) return void u2();
                "object" == typeof s2.config && (n2.instanceConfig = d.extend(n2.instanceConfig, s2.config));
              } else if ("skip" === s2) return void u2();
            }
            var a2 = n2.instanceConfig.complete;
            n2.instanceConfig.complete = function(e3) {
              U(a2) && a2(e3, n2.file, n2.inputElem), u2();
            }, v.parse(n2.file, n2.instanceConfig);
          }
        }
        function u2() {
          h2.splice(0, 1), e();
        }
      }), a && (n.onmessage = function(e) {
        e = e.data;
        void 0 === v.WORKER_ID && e && (v.WORKER_ID = e.workerId);
        "string" == typeof e.input ? n.postMessage({ workerId: v.WORKER_ID, results: v.parse(e.input, e.config), finished: true }) : (n.File && e.input instanceof File || e.input instanceof Object) && (e = v.parse(e.input, e.config)) && n.postMessage({ workerId: v.WORKER_ID, results: e, finished: true });
      }), (f.prototype = Object.create(u.prototype)).constructor = f, (l.prototype = Object.create(u.prototype)).constructor = l, (c.prototype = Object.create(c.prototype)).constructor = c, (p.prototype = Object.create(u.prototype)).constructor = p, v;
    });
  }
});

// lib/memoryCache.js
var require_memoryCache = __commonJS({
  "lib/memoryCache.js"(exports, module) {
    function createMemoryCache(ttlMs, label = "cache") {
      const store = /* @__PURE__ */ new Map();
      const ttl = Math.max(1e3, Number(ttlMs) || 6e4);
      return {
        async get(key, loader) {
          const k = String(key);
          const hit = store.get(k);
          if (hit && Date.now() < hit.expiresAt) {
            return hit.value;
          }
          const value = await loader();
          store.set(k, { value, expiresAt: Date.now() + ttl });
          return value;
        },
        clear() {
          store.clear();
        },
        stats() {
          return { label, entries: store.size, ttlMs: ttl };
        }
      };
    }
    module.exports = { createMemoryCache };
  }
});

// lib/fetchCsvText.js
var require_fetchCsvText = __commonJS({
  "lib/fetchCsvText.js"(exports, module) {
    var { createMemoryCache } = require_memoryCache();
    var csvTextCache = createMemoryCache(
      Number("600000") || 10 * 60 * 1e3,
      "csv-text"
    );
    var fetchCsvTextOverride = null;
    function setFetchCsvTextOverride(fn) {
      fetchCsvTextOverride = typeof fn === "function" ? fn : null;
    }
    function csvFetchTimeoutMs() {
      const fromEnv = Number("90000");
      if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
      if (true) return 9e4;
      return 0;
    }
    async function fetchUrlText(url) {
      const timeoutMs = csvFetchTimeoutMs();
      const opts = timeoutMs > 0 ? { signal: AbortSignal.timeout(timeoutMs) } : {};
      try {
        const res = await fetch(url, opts);
        if (!res.ok) {
          throw new Error(`Failed to load CSV (${res.status}) from ${url}`);
        }
        let text = await res.text();
        text = text.replace(/^\ufeff/, "");
        return text;
      } catch (err) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
          throw new Error(`Timed out loading CSV after ${timeoutMs / 1e3}s: ${url}`);
        }
        throw err;
      }
    }
    async function fetchCsvText(url) {
      const safeUrl = (url || "").toString().trim();
      if (!safeUrl) throw new Error("CSV URL is empty.");
      if (fetchCsvTextOverride) {
        return fetchCsvTextOverride(safeUrl);
      }
      return csvTextCache.get(safeUrl, () => fetchUrlText(safeUrl));
    }
    module.exports = { fetchCsvText, csvTextCache, setFetchCsvTextOverride };
  }
});

// lib/sheetUrls.js
var require_sheetUrls = __commonJS({
  "lib/sheetUrls.js"(exports, module) {
    var INDEX_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4gZ_lSTJs9QfCC-FCDFLCSX8q88t6txvtDgKFinSQJqX0seyYhK5wHr0WwwjRaA1mxZdETC0CGNMz/pub?gid=1191877237&single=true&output=csv";
    var SCHEDULE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4gZ_lSTJs9QfCC-FCDFLCSX8q88t6txvtDgKFinSQJqX0seyYhK5wHr0WwwjRaA1mxZdETC0CGNMz/pub?gid=0&single=true&output=csv";
    var ROSTER_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFhhdnzm2I_PVTkR4FDL-pbBhf_K53gMj6Pk5u8vtfYTXN9569QbdTRG9pZBuIFpQuWIpT9tJMbLY1/pub?gid=1722495492&single=true&output=csv";
    var HIST_2025_STATS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj9_UhD3MyWbDfD3zlwO7mcOOjpcmSc2OrPYXa6UEeii422rpHFBBn2AXkf5KP_OKtJrcobvlT_J7d/pub?output=csv";
    var SHEET_2026_GAMELOGS_ID = "1QGoXil2fphTqS-SlapUNgAOIDoI8uaQNXooW9h_oH2w";
    var SHEET_2026_GAMELOGS_GID = "1060099039";
    var SHEET_2026_STATS_ID = "1v1d1lfel2GYuaocKQubLSk4Yd7VeTTLDlLMU-HNnc7Q";
    var SHEET_2026_STATS_GID = "1197022486";
    var CAPTAIN_MAPPING_SHEET_ID = "1xIQsuZQI5skEQ_KEic6cXDOaFDdX4oHXVtl9FBov0-o";
    var CAPTAIN_MAPPING_GID = "0";
    var CAREER_CSV_PUBLIC_URL = "/data/csv/career.csv";
    var SCHEDULE_CALENDAR_YEAR = Number(process.env.SCHEDULE_CALENDAR_YEAR) || 2026;
    var careerCsvFilePath = null;
    function setCareerCsvFilePath(filePath) {
      careerCsvFilePath = filePath ? String(filePath) : null;
    }
    function googleSheetCsvExportUrl(spreadsheetId, gid) {
      return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
    }
    function getGamelogs2026CsvUrl() {
      const u = process.env.GAMELOGS_2026_CSV_URL;
      if (u && u.trim()) return u.trim();
      return googleSheetCsvExportUrl(SHEET_2026_GAMELOGS_ID, SHEET_2026_GAMELOGS_GID);
    }
    function getStats2026CsvUrl() {
      const u = process.env.STATS_2026_CSV_URL;
      if (u && u.trim()) return u.trim();
      return googleSheetCsvExportUrl(SHEET_2026_STATS_ID, SHEET_2026_STATS_GID);
    }
    function getCaptainMappingCsvUrl() {
      const u = process.env.CAPTAIN_MAPPING_CSV_URL;
      if (u && u.trim()) return u.trim();
      return googleSheetCsvExportUrl(CAPTAIN_MAPPING_SHEET_ID, CAPTAIN_MAPPING_GID);
    }
    function getCareerCsvSource() {
      const url = (process.env.CAREER_CSV_URL || "").trim();
      if (url) return { type: "url", url };
      if (careerCsvFilePath) return { type: "file", path: careerCsvFilePath };
      return { type: "url", url: CAREER_CSV_PUBLIC_URL };
    }
    function configureCareerCsvForBrowser(publicUrl = CAREER_CSV_PUBLIC_URL) {
      if (typeof globalThis !== "undefined") {
        globalThis.__MMS_CAREER_CSV_URL__ = publicUrl;
      }
    }
    function resolveCareerCsvSource() {
      const override = typeof globalThis !== "undefined" && globalThis.__MMS_CAREER_CSV_URL__ ? String(globalThis.__MMS_CAREER_CSV_URL__).trim() : "";
      if (override) return { type: "url", url: override };
      return getCareerCsvSource();
    }
    module.exports = {
      INDEX_URL,
      SCHEDULE_URL,
      ROSTER_URL,
      HIST_2025_STATS_URL,
      CAREER_CSV_PUBLIC_URL,
      SCHEDULE_CALENDAR_YEAR,
      getGamelogs2026CsvUrl,
      getStats2026CsvUrl,
      getCaptainMappingCsvUrl,
      CAPTAIN_MAPPING_SHEET_ID,
      CAPTAIN_MAPPING_GID,
      googleSheetCsvExportUrl,
      setCareerCsvFilePath,
      getCareerCsvSource,
      resolveCareerCsvSource,
      configureCareerCsvForBrowser
    };
  }
});

// data/pitcherStats2026.js
var require_pitcherStats2026 = __commonJS({
  "data/pitcherStats2026.js"(exports, module) {
    var PITCHER_STATS_BY_TEAM_KEY = Object.freeze({
      DRASHINSKY: {
        primaryPitcher: "Dave Drashinsky",
        gp: 4,
        ip: 34,
        baa: 0.375,
        whip: 1.88,
        runsPerG: 7.3,
        hitsPerG: 13.5,
        bbPerG: 2.5
      },
      WALLMAN: {
        primaryPitcher: "Lugos",
        gp: 4,
        ip: 35,
        baa: 0.366,
        whip: 2.34,
        runsPerG: 9,
        hitsPerG: 14.8,
        bbPerG: 5.8
      },
      GODDARD: {
        primaryPitcher: "J Goddard",
        gp: 3,
        ip: 26,
        baa: 0.377,
        whip: 1.85,
        runsPerG: 7,
        hitsPerG: 14.3,
        bbPerG: 1.7
      },
      CARROLL: {
        primaryPitcher: "Ortiz",
        gp: 3,
        ip: 27,
        baa: 0.384,
        whip: 2.07,
        runsPerG: 10,
        hitsPerG: 17.7,
        bbPerG: 1
      },
      GOLDFARB: {
        primaryPitcher: "Becker",
        gp: 3,
        ip: 27,
        baa: 0.39,
        whip: 2.07,
        runsPerG: 10,
        hitsPerG: 16,
        bbPerG: 2.7
      },
      POLLOCK: {
        primaryPitcher: "MA Pollock",
        gp: 3,
        ip: 27,
        baa: 0.392,
        whip: 2.11,
        runsPerG: 10,
        hitsPerG: 16.3,
        bbPerG: 2.7
      },
      PINGARO: {
        primaryPitcher: "Fradkin",
        gp: 4,
        ip: 36,
        baa: 0.395,
        whip: 1.94,
        runsPerG: 8.8,
        hitsPerG: 16,
        bbPerG: 1.5
      },
      LAROCCA: {
        primaryPitcher: "LaRocca",
        gp: 3,
        ip: 25,
        baa: 0.402,
        whip: 2.16,
        runsPerG: 9.3,
        hitsPerG: 16.3,
        bbPerG: 1.7
      },
      MARRONE: {
        primaryPitcher: "Marrone",
        gp: 4,
        ip: 36,
        baa: 0.402,
        whip: 2.14,
        runsPerG: 8.8,
        hitsPerG: 17.5,
        bbPerG: 1.8
      },
      TURANO: {
        primaryPitcher: "Joraskie",
        gp: 2,
        ip: 18,
        baa: 0.41,
        whip: 2.11,
        runsPerG: 7.5,
        hitsPerG: 17,
        bbPerG: 2
      },
      ROSENSTOCK: {
        primaryPitcher: "R Carlin",
        gp: 4,
        ip: 36,
        baa: 0.418,
        whip: 2.25,
        runsPerG: 11,
        hitsPerG: 17.8,
        bbPerG: 2.5
      },
      CONTI: {
        primaryPitcher: "G Deluise",
        gp: 3,
        ip: 27,
        baa: 0.423,
        whip: 2.52,
        runsPerG: 13,
        hitsPerG: 19.3,
        bbPerG: 3.3
      },
      BOMENBLIT: {
        primaryPitcher: "J Walker",
        gp: 3,
        ip: 27,
        baa: 0.433,
        whip: 2.15,
        runsPerG: 11,
        hitsPerG: 18.3,
        bbPerG: 1
      },
      BYKOFSKY: {
        primaryPitcher: "Dinapoli",
        gp: 3,
        ip: 27,
        baa: 0.448,
        whip: 2.52,
        runsPerG: 12,
        hitsPerG: 21.3,
        bbPerG: 1.3
      },
      KESSLER: {
        primaryPitcher: "A Kessler",
        gp: 4,
        ip: 36,
        baa: 0.451,
        whip: 2.33,
        runsPerG: 12.3,
        hitsPerG: 18.5,
        bbPerG: 2.5
      },
      MEYER: {
        primaryPitcher: "Defalco",
        gp: 4,
        ip: 36,
        baa: 0.467,
        whip: 2.67,
        runsPerG: 14.3,
        hitsPerG: 23,
        bbPerG: 1
      },
      POLZER: {
        primaryPitcher: "Polzer",
        gp: 4,
        ip: 34,
        baa: 0.503,
        whip: 3,
        runsPerG: 16.8,
        hitsPerG: 23.5,
        bbPerG: 2
      },
      LOMBARDI: {
        primaryPitcher: "J Lombardi",
        gp: 3,
        ip: 25,
        baa: 0.521,
        whip: 3.32,
        runsPerG: 16.7,
        hitsPerG: 25,
        bbPerG: 2.7
      }
    });
    var PITCHER_LEAGUE_AVG = Object.freeze({
      baa: 0.41,
      whip: 2.2,
      runsPerG: 10.5
    });
    module.exports = {
      PITCHER_STATS_BY_TEAM_KEY,
      PITCHER_LEAGUE_AVG
    };
  }
});

// lib/dfs.js
var require_dfs = __commonJS({
  "lib/dfs.js"(exports, module) {
    var Papa = require_papaparse_min();
    var {
      PITCHER_STATS_BY_TEAM_KEY,
      PITCHER_LEAGUE_AVG
    } = require_pitcherStats2026();
    var { getGamelogs2026CsvUrl } = require_sheetUrls();
    var { fetchCsvText } = require_fetchCsvText();
    var DFS_LINEUP_SIZE = 8;
    var DFS_SALARY_CAP = 6e4;
    var DFS_SALARY_MIN = 5e3;
    var DFS_SALARY_NON_BOTTOM_MIN = 5100;
    var DFS_SALARY_MAX = 12e3;
    var DFS_SALARY_STEP = 100;
    var DFS_SALARY_TIERS = 14;
    var DFS_BOTTOM_TIER_PCT = 0.2;
    var DFS_SALARY_INTERNAL_MIN = 3e3;
    var OFFENSE_SALARY_WEIGHT = 0.8;
    var OPP_RUNS_SALARY_WEIGHT = 0.12;
    var PITCHER_SALARY_WEIGHT = 0.08;
    var DFS_OFFENSE_RATING_WEIGHT_HISTORICAL = 0.85;
    var DFS_OFFENSE_RATING_WEIGHT_2026 = 0.15;
    var DFS_SCORING = Object.freeze({
      single: 3,
      double: 5,
      triple: 8,
      hr: 10,
      rbi: 2,
      run: 2,
      walk: 2
    });
    function safeText(value) {
      return (value || "").toString().trim();
    }
    function normalizePlayerName(name) {
      let s = safeText(name).toLowerCase().replace(/[.'’]/g, "");
      s = s.replace(/\s+/g, " ").trim();
      return s;
    }
    function toNumber(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    function clamp(n, lo, hi) {
      return Math.max(lo, Math.min(hi, n));
    }
    function roundSalary(n) {
      const stepped = Math.round(n / DFS_SALARY_STEP) * DFS_SALARY_STEP;
      return clamp(stepped, 0, DFS_SALARY_MAX);
    }
    function applyDfsSalaryPricing(pool, bottomPct = DFS_BOTTOM_TIER_PCT) {
      if (!pool.length) return pool;
      for (const p of pool) {
        p.rawSalary = p.salary;
      }
      const byRaw = pool.slice().sort((a, b) => a.rawSalary - b.rawSalary);
      const bottomCount = Math.max(1, Math.ceil(pool.length * bottomPct));
      const cutoffRaw = byRaw[bottomCount - 1].rawSalary;
      const bottomNorms = /* @__PURE__ */ new Set();
      for (const p of pool) {
        if (p.rawSalary <= cutoffRaw) {
          bottomNorms.add(p.norm);
          p.salary = DFS_SALARY_MIN;
        }
      }
      const rest = pool.filter((p) => !bottomNorms.has(p.norm)).sort((a, b) => {
        if (b.offenseRating !== a.offenseRating) return b.offenseRating - a.offenseRating;
        return a.name.localeCompare(b.name, void 0, { sensitivity: "base" });
      });
      const minR = DFS_SALARY_NON_BOTTOM_MIN;
      const maxR = DFS_SALARY_MAX;
      const n = rest.length;
      for (let i = 0; i < n; i += 1) {
        const t = n === 1 ? 0 : i / (n - 1);
        const raw = maxR - t * (maxR - minR);
        rest[i].salary = roundSalary(raw);
      }
      for (const p of pool) {
        p.salary = Math.max(roundSalary(p.salary), DFS_SALARY_MIN);
        delete p.rawSalary;
      }
      return pool;
    }
    function sortDfsPlayerPool(pool) {
      pool.sort((a, b) => {
        if (b.salary !== a.salary) return b.salary - a.salary;
        return a.name.localeCompare(b.name, void 0, { sensitivity: "base" });
      });
      return pool;
    }
    function captainLastName(captain) {
      const parts = safeText(captain).split(/\s+/).filter(Boolean);
      return parts.length ? parts[parts.length - 1].toUpperCase() : "";
    }
    function weekdayFromIso(iso) {
      const [y, m, d] = safeText(iso).split("-").map(Number);
      if (!y || !m || !d) return -1;
      return new Date(y, m - 1, d, 12, 0, 0).getDay();
    }
    function dfsScoringIsoDatesForToken(viewToken, schedulePayload) {
      const v = safeText(viewToken).toUpperCase();
      const out = /* @__PURE__ */ new Set();
      if (/^W\d+$/.test(v)) {
        const wn = Number(v.slice(1));
        const sunIso = schedulePayload.sundayIsosSorted?.[wn - 1];
        if (sunIso) out.add(safeText(sunIso));
        const chunk = schedulePayload.gamesByIso?.get(sunIso) || [];
        for (const g of chunk) {
          if (g._iso) out.add(safeText(g._iso));
        }
      } else if (/^D\d{8}$/.test(v)) {
        const digits = v.replace(/^D/, "");
        const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
        out.add(iso);
        const chunk = schedulePayload.gamesByIso?.get(iso) || [];
        for (const g of chunk) {
          if (g._iso) out.add(safeText(g._iso));
        }
      }
      if (out.size === 0) {
        const games = resolveGamesForViewToken(v, schedulePayload);
        for (const g of games) {
          if (g._iso) out.add(safeText(g._iso));
        }
      }
      return [...out].filter(Boolean).sort((a, b) => a.localeCompare(b));
    }
    function buildTeamCodeById(teams, stats2026ByPlayer) {
      const votes = /* @__PURE__ */ new Map();
      for (const t of teams) {
        const id = safeText(t.teamId);
        const tally = /* @__PURE__ */ new Map();
        for (const name of t.players || []) {
          const row = stats2026ByPlayer.get(normalizePlayerName(name));
          const code = row ? safeText(row.Team) : "";
          if (!code) continue;
          tally.set(code, (tally.get(code) || 0) + 1);
        }
        let best = "";
        let bestN = 0;
        for (const [code, n] of tally.entries()) {
          if (n > bestN) {
            best = code;
            bestN = n;
          }
        }
        if (best) votes.set(id, safeText(best).toUpperCase());
      }
      return votes;
    }
    function buildCodeToTeamId(teamCodeById) {
      const map = /* @__PURE__ */ new Map();
      for (const [id, code] of teamCodeById.entries()) {
        if (code) map.set(code, id);
      }
      return map;
    }
    function pitcherForTeamId(teamId, teams) {
      const t = teams.find((x) => safeText(x.teamId) === safeText(teamId));
      if (!t) return null;
      const key = captainLastName(t.captain);
      return PITCHER_STATS_BY_TEAM_KEY[key] || null;
    }
    function scheduleVenueFromGame(game) {
      const g = game || {};
      const loc = safeText(g.location);
      if (loc && loc !== "-") return loc;
      return safeText(g.field) || "";
    }
    function normalizeOffenseRating(rating) {
      return clamp((toNumber(rating) + 2.5) / 5.5, 0, 1);
    }
    function normalizeRunsAgainst(rag, leagueAvg) {
      if (rag == null || !Number.isFinite(rag)) return 0.5;
      return clamp((rag - (leagueAvg - 3)) / 8, 0, 1);
    }
    function normalizePitcherEase(pitcher) {
      if (!pitcher) return 0.5;
      const baaEase = clamp((toNumber(pitcher.baa) - PITCHER_LEAGUE_AVG.baa) / 0.12, 0, 1);
      const runsEase = clamp(
        (toNumber(pitcher.runsPerG) - PITCHER_LEAGUE_AVG.runsPerG) / 6,
        0,
        1
      );
      return 0.55 * baaEase + 0.45 * runsEase;
    }
    function computeSalaryComposite({
      offenseRating,
      opponentRunsAgainst,
      opponentPitcher,
      leagueAvgRag
    }) {
      const off = normalizeOffenseRating(offenseRating);
      const opp = normalizeRunsAgainst(opponentRunsAgainst, leagueAvgRag);
      const pit = normalizePitcherEase(opponentPitcher);
      return OFFENSE_SALARY_WEIGHT * off + OPP_RUNS_SALARY_WEIGHT * opp + PITCHER_SALARY_WEIGHT * pit;
    }
    function quantizeSalaryComposite(composite) {
      const c = clamp(composite, 0, 1);
      const tiers = Math.max(2, DFS_SALARY_TIERS);
      const tier = Math.round(c * (tiers - 1));
      return tier / (tiers - 1);
    }
    function salaryFromComposite(composite) {
      const q = quantizeSalaryComposite(composite);
      const raw = DFS_SALARY_INTERNAL_MIN + q * (DFS_SALARY_MAX - DFS_SALARY_INTERNAL_MIN);
      return roundSalary(raw);
    }
    function computePlayerSalary({ offenseRating, opponentRunsAgainst, opponentPitcher, leagueAvgRag }) {
      const composite = computeSalaryComposite({
        offenseRating,
        opponentRunsAgainst,
        opponentPitcher,
        leagueAvgRag
      });
      return salaryFromComposite(composite);
    }
    function applyOffenseRatingSalaryBands(pool, bandWidth = DFS_OFFENSE_RATING_BAND) {
      if (!pool.length || bandWidth <= 0) return pool;
      const groups = /* @__PURE__ */ new Map();
      for (const p of pool) {
        const band = Math.round(toNumber(p.offenseRating) / bandWidth) * bandWidth;
        const key = String(Math.round(band * 100) / 100);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(p);
      }
      for (const group of groups.values()) {
        const salaries = group.map((p) => p.salary).sort((a, b) => a - b);
        const mid = salaries[Math.floor(salaries.length / 2)];
        const unified = roundSalary(mid);
        for (const p of group) p.salary = unified;
      }
      return pool;
    }
    function resolveUpcomingDfsSlate(referenceIso, schedulePayload, pickDefaultViewFn) {
      const viewToken = pickDefaultViewFn(referenceIso, schedulePayload);
      if (!viewToken) {
        return {
          viewToken: "",
          slateType: null,
          games: [],
          teamIds: /* @__PURE__ */ new Set(),
          isoDates: [],
          label: "No upcoming slate on the schedule.",
          isPast: false
        };
      }
      const games = resolveGamesForViewToken(viewToken, schedulePayload);
      const teamIds = /* @__PURE__ */ new Set();
      const isoDates = /* @__PURE__ */ new Set();
      for (const g of games) {
        if (g.awayTeamId) teamIds.add(safeText(g.awayTeamId));
        if (g.homeTeamId) teamIds.add(safeText(g.homeTeamId));
        if (g._iso) isoDates.add(safeText(g._iso));
      }
      for (const iso of dfsScoringIsoDatesForToken(viewToken, schedulePayload)) {
        isoDates.add(iso);
      }
      const isWeek = /^W\d+$/i.test(viewToken);
      const slateType = isWeek ? "sunday" : "wednesday";
      const wn = isWeek ? Number(viewToken.slice(1)) : null;
      const sunIso = isWeek ? schedulePayload.sundayIsosSorted[wn - 1] : null;
      const firstIso = isWeek ? sunIso : [...isoDates][0];
      const ref = safeText(referenceIso);
      const isPast = firstIso && ref && firstIso < ref;
      let label = schedulePayload.dateLabelByIso?.get?.(firstIso) || firstIso || viewToken;
      if (isWeek) {
        label = `Week ${wn} \u2014 ${label} (full slate, ${teamIds.size} teams)`;
      } else {
        label = `${label} \u2014 Wednesday (${teamIds.size} teams, ${games.length} games)`;
      }
      return {
        viewToken,
        slateType,
        games,
        teamIds,
        isoDates: [...isoDates].sort((a, b) => a.localeCompare(b)),
        label,
        isPast,
        weekNumber: wn
      };
    }
    function slateFirstIso(viewToken, schedulePayload) {
      const v = safeText(viewToken).toUpperCase();
      if (/^W\d+$/.test(v)) {
        const wn = Number(v.slice(1));
        return schedulePayload.sundayIsosSorted?.[wn - 1] || null;
      }
      if (/^D\d{8}$/.test(v)) {
        const digits = v.replace(/^D/, "");
        return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
      }
      return null;
    }
    function nyCalendarIsoDate(ms) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(new Date(ms));
      const get = (t) => parts.find((p) => p.type === t)?.value || "";
      return `${get("year")}-${get("month")}-${get("day")}`;
    }
    function nyCalendarDayNumber(ms) {
      const iso = nyCalendarIsoDate(ms);
      const [y, m, d] = iso.split("-").map(Number);
      return y * 1e4 + m * 100 + d;
    }
    function startOfNyCalendarDayUtcMs(isoDate) {
      const [y, mo, da] = safeText(isoDate).split("-").map(Number);
      if (!y || !mo || !da) return NaN;
      const target = y * 1e4 + mo * 100 + da;
      let lo = Date.UTC(y, mo - 1, da - 1, 12, 0, 0, 0);
      let hi = Date.UTC(y, mo - 1, da + 1, 12, 0, 0, 0);
      while (nyCalendarDayNumber(lo) >= target) lo -= 36e5;
      while (nyCalendarDayNumber(hi) < target) hi += 36e5;
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (nyCalendarDayNumber(mid) >= target) hi = mid;
        else lo = mid;
      }
      return hi;
    }
    function lineupLockDeadlineMsFromFirstGameIso(firstIso) {
      const iso = safeText(firstIso);
      if (!iso) return null;
      const gameDayStartMs = startOfNyCalendarDayUtcMs(iso);
      if (!Number.isFinite(gameDayStartMs)) return null;
      return gameDayStartMs - 1;
    }
    function instantAtNyLocalTime(isoDate, hour24, minute = 0) {
      const iso = safeText(isoDate);
      if (!iso) return NaN;
      const [y, mo, da] = iso.split("-").map(Number);
      if (!y || !mo || !da) return NaN;
      const targetDay = y * 1e4 + mo * 100 + da;
      const targetMins = hour24 * 60 + minute;
      function nyDayAndMinutes(ms) {
        const dayNum = nyCalendarDayNumber(ms);
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          hour: "numeric",
          minute: "numeric",
          hour12: false
        }).formatToParts(new Date(ms));
        const h = Number(parts.find((p) => p.type === "hour")?.value || 0);
        const m = Number(parts.find((p) => p.type === "minute")?.value || 0);
        return { dayNum, mins: h * 60 + m };
      }
      let lo = Date.UTC(y, mo - 1, da - 1, 12, 0, 0, 0);
      let hi = Date.UTC(y, mo - 1, da + 1, 12, 0, 0, 0);
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        const { dayNum, mins } = nyDayAndMinutes(mid);
        if (dayNum < targetDay || dayNum === targetDay && mins < targetMins) lo = mid;
        else hi = mid;
      }
      return hi;
    }
    function lineupLockDeadlineMsForSlate(viewToken, firstIso) {
      const v = safeText(viewToken).toUpperCase();
      const iso = safeText(firstIso);
      if (!iso) return null;
      if (/^D\d{8}$/.test(v)) {
        const atEightPm = instantAtNyLocalTime(iso, 20, 0);
        return Number.isFinite(atEightPm) ? atEightPm - 1 : null;
      }
      return lineupLockDeadlineMsFromFirstGameIso(iso);
    }
    function formatLineupLockDeadlineEst(lockMs, viewToken) {
      if (lockMs == null || !Number.isFinite(lockMs)) return "";
      const v = safeText(viewToken).toUpperCase();
      const displayMs = /^D\d{8}$/.test(v) ? lockMs + 1 : lockMs;
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short"
      }).format(new Date(displayMs));
    }
    function resolveNextLineupLockDeadline(slateOptions, slate, nowMs = Date.now()) {
      if (typeof slate === "number" && Number.isFinite(slate)) {
        nowMs = slate;
        slate = null;
      }
      const options = slateOptions || [];
      const editable = options.find((o) => o.canEdit);
      let deadlineMs = null;
      if (editable?.lineupLockDeadlineMs != null && Number.isFinite(editable.lineupLockDeadlineMs)) {
        deadlineMs = editable.lineupLockDeadlineMs;
      } else if (slate?.canEdit && slate.lineupLockDeadlineMs != null && Number.isFinite(slate.lineupLockDeadlineMs)) {
        deadlineMs = slate.lineupLockDeadlineMs;
      } else {
        deadlineMs = options.map((o) => o.lineupLockDeadlineMs).filter((ms) => ms != null && Number.isFinite(ms) && ms > nowMs).sort((a, b) => a - b)[0] ?? null;
      }
      if (deadlineMs == null || !Number.isFinite(deadlineMs)) {
        return { deadlineMs: null, deadlineLabel: "" };
      }
      return {
        deadlineMs,
        deadlineLabel: formatLineupLockDeadlineEst(
          deadlineMs,
          editable?.value || slate?.viewToken || ""
        )
      };
    }
    function buildDfsSlateOptions(schedulePayload, refIso, nowMs = Date.now()) {
      const raw = (schedulePayload.scheduleOptions || []).filter(
        (o) => /^(W\d+|D\d{8})$/i.test(o.value)
      );
      const enriched = raw.map((o) => {
        const value = safeText(o.value).toUpperCase();
        const firstIso = slateFirstIso(value, schedulePayload);
        const lineupLockDeadlineMs = lineupLockDeadlineMsForSlate(value, firstIso);
        const deadlinePassed = lineupLockDeadlineMs != null ? nowMs > lineupLockDeadlineMs : true;
        return {
          value,
          label: o.label,
          firstIso,
          lineupLockDeadlineMs,
          lineupDeadlinePassed: deadlinePassed,
          /** Calendar “today” vs game day — informational only */
          gameDayPassedByCalendar: !!(firstIso && safeText(refIso) && firstIso < safeText(refIso)),
          slateKind: /^W\d+$/.test(value) ? "week" : "wednesday"
        };
      });
      let activeEditableIndex = -1;
      for (let i = 0; i < enriched.length; i += 1) {
        const d = enriched[i].lineupLockDeadlineMs;
        if (d != null && nowMs <= d) {
          activeEditableIndex = i;
          break;
        }
      }
      return enriched.map((o, i) => {
        const canEdit = activeEditableIndex >= 0 && i === activeEditableIndex;
        const isVisibleInPicker = activeEditableIndex < 0 ? true : i <= activeEditableIndex;
        return {
          ...o,
          activeEditableIndex,
          canEdit,
          isPast: o.lineupDeadlinePassed,
          isActive: canEdit,
          isFuture: false,
          isViewOnly: !canEdit,
          isLocked: false,
          isVisibleInPicker,
          lineupLockDeadlineLabel: formatLineupLockDeadlineEst(o.lineupLockDeadlineMs, o.value)
        };
      });
    }
    function filterVisibleDfsSlateOptions(options) {
      return (options || []).filter((o) => o.isVisibleInPicker);
    }
    function resolveActiveDfsSlateToken(schedulePayload, refIso, nowMs = Date.now()) {
      return buildDfsSlateOptions(schedulePayload, refIso, nowMs).find((o) => o.canEdit)?.value || null;
    }
    function buildSlateFromToken(viewToken, schedulePayload, refIso, slateOptions, nowMs = Date.now()) {
      const v = safeText(viewToken).toUpperCase();
      if (!v) return null;
      const opt = (slateOptions || []).find((o) => o.value === v);
      const games = resolveGamesForViewToken(v, schedulePayload);
      const teamIds = /* @__PURE__ */ new Set();
      const isoDates = /* @__PURE__ */ new Set();
      for (const g of games) {
        if (g.awayTeamId) teamIds.add(safeText(g.awayTeamId));
        if (g.homeTeamId) teamIds.add(safeText(g.homeTeamId));
        if (g._iso) isoDates.add(safeText(g._iso));
      }
      for (const iso of dfsScoringIsoDatesForToken(v, schedulePayload)) {
        isoDates.add(iso);
      }
      const isWeek = /^W\d+$/.test(v);
      const wn = isWeek ? Number(v.slice(1)) : null;
      const firstIso = slateFirstIso(v, schedulePayload) || [...isoDates][0] || null;
      const ref = safeText(refIso);
      const lineupLockDeadlineMs = lineupLockDeadlineMsForSlate(v, firstIso);
      const lineupDeadlinePassedFallback = lineupLockDeadlineMs != null ? nowMs > lineupLockDeadlineMs : true;
      const gameDayPassedByCalendar = !!(firstIso && ref && firstIso < ref);
      let label = schedulePayload.dateLabelByIso?.get?.(firstIso) || firstIso || v;
      if (isWeek) {
        label = `Week ${wn} \u2014 ${label} (full slate, ${teamIds.size} teams)`;
      } else if (/^D\d{8}$/.test(v)) {
        label = `${label} \u2014 Wednesday (${teamIds.size} teams, ${games.length} games)`;
      }
      const canEdit = opt?.canEdit ?? false;
      return {
        viewToken: v,
        slateType: isWeek ? "sunday" : "wednesday",
        games,
        teamIds,
        isoDates: [...isoDates].sort((a, b) => a.localeCompare(b)),
        label: opt?.label || label,
        firstIso,
        lineupLockDeadlineMs: opt?.lineupLockDeadlineMs ?? lineupLockDeadlineMs,
        lineupLockDeadlineLabel: opt?.lineupLockDeadlineLabel ?? formatLineupLockDeadlineEst(lineupLockDeadlineMs, v),
        lineupDeadlinePassed: opt?.lineupDeadlinePassed ?? lineupDeadlinePassedFallback,
        /** Legacy field: locked after lineup deadline (not necessarily gamelog-complete). */
        isPast: opt?.isPast ?? lineupDeadlinePassedFallback,
        gameDayPassedByCalendar,
        weekNumber: wn,
        canEdit,
        isViewOnly: opt?.isViewOnly ?? !canEdit,
        isFuture: opt?.isFuture ?? false,
        isLocked: opt?.isLocked ?? false,
        isActive: opt?.isActive ?? false
      };
    }
    function resolveGamesForViewToken(viewToken, payload) {
      const v = safeText(viewToken);
      if (/^W\d+$/i.test(v)) {
        const wn = Number(v.slice(1));
        const sunIso = payload.sundayIsosSorted[wn - 1];
        const chunk = payload.gamesByIso.get(sunIso) || [];
        return chunk.map(({ _iso, ...rest }) => ({ ...rest, _iso }));
      }
      if (/^D\d{8}$/i.test(v)) {
        const digits = v.toUpperCase().replace(/^D/, "");
        const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
        if (weekdayFromIso(iso) !== 3) return [];
        const chunk = payload.gamesByIso.get(iso) || [];
        return chunk.map(({ _iso, ...rest }) => ({ ...rest, _iso }));
      }
      return [];
    }
    function buildDfsPlayerPool({
      teams,
      slate,
      offenseRatingByNorm,
      scheduleRunRates,
      stats2026ByPlayer,
      teamCodeById
    }) {
      const teamIds = slate.teamIds;
      if (!teamIds.size) return [];
      const ragValues = [];
      for (const [, rr] of scheduleRunRates || []) {
        if (rr?.runsAgainstPerGame != null && Number.isFinite(rr.runsAgainstPerGame)) {
          ragValues.push(rr.runsAgainstPerGame);
        }
      }
      const leagueAvgRag = ragValues.length > 0 ? ragValues.reduce((a, b) => a + b, 0) / ragValues.length : 12;
      const venueByTeam = /* @__PURE__ */ new Map();
      for (const g of slate.games) {
        const label = scheduleVenueFromGame(g);
        if (!label) continue;
        for (const tid of [safeText(g.awayTeamId), safeText(g.homeTeamId)]) {
          if (!tid) continue;
          if (!venueByTeam.has(tid)) venueByTeam.set(tid, /* @__PURE__ */ new Set());
          venueByTeam.get(tid).add(label);
        }
      }
      const matchupByTeam = /* @__PURE__ */ new Map();
      for (const g of slate.games) {
        const awayId = safeText(g.awayTeamId);
        const homeId = safeText(g.homeTeamId);
        matchupByTeam.set(awayId, { opponentId: homeId, side: "away", game: g });
        matchupByTeam.set(homeId, { opponentId: awayId, side: "home", game: g });
      }
      const pool = [];
      for (const t of teams) {
        const tid = safeText(t.teamId);
        if (!teamIds.has(tid)) continue;
        const match = matchupByTeam.get(tid);
        const oppId = match?.opponentId || "";
        const oppRates = scheduleRunRates?.get?.(oppId);
        const oppPitcher = pitcherForTeamId(oppId, teams);
        const oppTeam = teams.find((x) => safeText(x.teamId) === oppId);
        const teamCode = teamCodeById.get(tid) || "";
        const venueSet = venueByTeam.get(tid);
        const venueJoined = venueSet && venueSet.size ? [...venueSet].join(" \xB7 ") : scheduleVenueFromGame(match?.game);
        for (const playerName of t.players || []) {
          const norm = normalizePlayerName(playerName);
          const rating = offenseRatingByNorm.get(norm) ?? 0;
          const row26 = stats2026ByPlayer.get(norm);
          const salary = computePlayerSalary({
            offenseRating: rating,
            opponentRunsAgainst: oppRates?.runsAgainstPerGame ?? null,
            opponentPitcher: oppPitcher,
            leagueAvgRag
          });
          pool.push({
            norm,
            name: playerName,
            teamId: tid,
            teamName: t.teamName,
            teamCode,
            offenseRating: Math.round(rating * 100) / 100,
            salary,
            // raw; bottom tier adjusted below
            opponentId: oppId,
            opponentName: oppTeam?.teamName || `Team ${oppId}`,
            opponentRunsAgainst: oppRates?.runsAgainstPerGame ?? null,
            opposingPitcher: oppPitcher?.primaryPitcher || "\u2014",
            pitcherBaa: oppPitcher?.baa ?? null,
            pitcherRunsG: oppPitcher?.runsPerG ?? null,
            pa2026: row26 ? toNumber(row26.PA) : 0,
            gameField: venueJoined || "\u2014",
            gameLabel: match?.game ? `${match.game.away} @ ${match.game.home}` : ""
          });
        }
      }
      applyDfsSalaryPricing(pool);
      sortDfsPlayerPool(pool);
      return pool;
    }
    function parseGamelogDateCell(cell) {
      let s = safeText(cell).replace(/^\ufeff/g, "");
      if (!s) return null;
      s = s.replace(/[\u00a0\u202f]/g, " ").trim().replace(/^["']+|["']+$/g, "");
      const m = /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/.exec(s);
      if (!m) return null;
      const month = String(m[1]).padStart(2, "0");
      const day = String(m[2]).padStart(2, "0");
      return `${m[3]}-${month}-${day}`;
    }
    async function load2026GamelogsByPlayer() {
      try {
        let text = await fetchCsvText(getGamelogs2026CsvUrl());
        const parsed = Papa.parse(text, { skipEmptyLines: true });
        const rows = parsed.data || [];
        if (rows.length < 3) return { byNorm: /* @__PURE__ */ new Map(), bySlateKey: /* @__PURE__ */ new Map(), gameIsos: /* @__PURE__ */ new Set() };
        const headerRow = rows.find(
          (r) => safeText(r[0]).replace(/^\ufeff/, "") === "Team" && safeText(r[1]) === "Date"
        );
        if (!headerRow) return { byNorm: /* @__PURE__ */ new Map(), bySlateKey: /* @__PURE__ */ new Map(), gameIsos: /* @__PURE__ */ new Set() };
        const headerIdx = rows.indexOf(headerRow);
        const h = headerRow.map((x) => safeText(x));
        const col = (name) => h.indexOf(name);
        const byNorm = /* @__PURE__ */ new Map();
        const bySlateKey = /* @__PURE__ */ new Map();
        const gameIsos = /* @__PURE__ */ new Set();
        for (let i = headerIdx + 1; i < rows.length; i += 1) {
          const row = rows[i];
          const teamCode = safeText(row[col("Team")]).toUpperCase();
          const iso = parseGamelogDateCell(row[col("Date")]);
          const player = safeText(row[col("Player")]);
          if (!teamCode || !iso || !player) continue;
          gameIsos.add(iso);
          const norm = normalizePlayerName(player);
          const entry = {
            teamCode,
            iso,
            opponentCode: safeText(row[col("Opponent ID")]),
            gameId: safeText(row[col("Game ID")]),
            pa: toNumber(row[col("PA")]),
            ab: toNumber(row[col("AB")]),
            hits: toNumber(row[col("Hits")]),
            runs: toNumber(row[col("Runs")]),
            rbi: toNumber(row[col("RBI")]),
            bb: toNumber(row[col("BB")]),
            singles: toNumber(row[col("1B")]),
            doubles: toNumber(row[col("2B")]),
            triples: toNumber(row[col("3B")]),
            hr: toNumber(row[col("HR")]),
            tb: toNumber(row[col("TB")])
          };
          entry.points = fantasyPointsFromLog(entry);
          if (!byNorm.has(norm)) byNorm.set(norm, []);
          byNorm.get(norm).push(entry);
          const slateKey = `${iso}|${teamCode}`;
          if (!bySlateKey.has(slateKey)) bySlateKey.set(slateKey, []);
          bySlateKey.get(slateKey).push({ norm, ...entry });
        }
        return { byNorm, bySlateKey, gameIsos };
      } catch {
        return { byNorm: /* @__PURE__ */ new Map(), bySlateKey: /* @__PURE__ */ new Map(), gameIsos: /* @__PURE__ */ new Set() };
      }
    }
    function slateHasGamelogDates(slate, gamelogs) {
      const dates = gamelogs?.gameIsos;
      if (!(dates instanceof Set) || dates.size === 0) return false;
      const slateDates = slate?.isoDates;
      if (!Array.isArray(slateDates) || !slateDates.length) return false;
      return slateDates.some((iso) => dates.has(iso));
    }
    function fantasyPointsFromLog(log) {
      const s = DFS_SCORING;
      return log.singles * s.single + log.doubles * s.double + log.triples * s.triple + log.hr * s.hr + log.rbi * s.rbi + log.runs * s.run + log.bb * s.walk;
    }
    function scoreLineupForSlate(lineupNorms, poolByNorm, slate, teamCodeById, gamelogs) {
      const isoSet = new Set(slate.isoDates || []);
      let total = 0;
      const breakdown = [];
      for (const norm of lineupNorms) {
        const p = poolByNorm.get(norm);
        const logs = gamelogs.byNorm.get(norm) || [];
        const code = safeText(p?.teamCode).toUpperCase();
        const relevant = logs.filter(
          (l) => isoSet.has(l.iso) && safeText(l.teamCode).toUpperCase() === code
        );
        const pts = relevant.reduce((sum, l) => sum + l.points, 0);
        total += pts;
        breakdown.push({
          norm,
          name: p?.name || norm,
          points: Math.round(pts * 10) / 10,
          games: relevant.length
        });
      }
      return { total: Math.round(total * 10) / 10, breakdown };
    }
    function resolvePreviousDfsSlate(currentViewToken, schedulePayload) {
      const v = safeText(currentViewToken).toUpperCase();
      if (!/^W\d+$/.test(v)) return null;
      const weekOptions = (schedulePayload.scheduleOptions || []).filter(
        (o) => /^W\d+$/i.test(o.value)
      );
      const ix = weekOptions.findIndex((o) => o.value.toUpperCase() === v);
      if (ix <= 0) return null;
      const prev = weekOptions[ix - 1];
      const games = resolveGamesForViewToken(prev.value, schedulePayload);
      const isoDates = dfsScoringIsoDatesForToken(prev.value, schedulePayload);
      const wn = Number(prev.value.slice(1));
      return {
        viewToken: prev.value,
        label: prev.label || `Week ${wn}`,
        weekNumber: wn,
        isoDates,
        games
      };
    }
    function buildSlatePointsByNorm(playerPool, slate, gamelogs) {
      if (!slate?.isoDates?.length) {
        return { byNorm: {}, hasStats: false };
      }
      const isoSet = new Set(slate.isoDates);
      const byNorm = {};
      let hasStats = false;
      for (const p of playerPool) {
        const code = safeText(p.teamCode).toUpperCase();
        const logs = (gamelogs.byNorm.get(p.norm) || []).filter(
          (l) => isoSet.has(l.iso) && safeText(l.teamCode).toUpperCase() === code
        );
        const pts = logs.reduce((sum, l) => sum + l.points, 0);
        if (logs.length) hasStats = true;
        byNorm[p.norm] = {
          name: p.name,
          points: Math.round(pts * 10) / 10,
          games: logs.length
        };
      }
      return { byNorm, hasStats };
    }
    function buildLastWeekPointsByNorm(playerPool, prevSlate, gamelogs) {
      return buildSlatePointsByNorm(playerPool, prevSlate, gamelogs);
    }
    function scoreLineupFromPointsMap(lineupNorms, poolByNorm, pointsByNorm) {
      let total = 0;
      const breakdown = [];
      for (const norm of lineupNorms) {
        const p = poolByNorm.get(norm);
        const row = pointsByNorm[norm] || { points: 0, games: 0, name: "" };
        total += row.points;
        breakdown.push({
          norm,
          name: p?.name || row.name || norm,
          points: row.points,
          games: row.games
        });
      }
      return { total: Math.round(total * 10) / 10, breakdown };
    }
    function referenceIsoForScheduleYear(calendarYear) {
      const now = /* @__PURE__ */ new Date();
      const y = calendarYear || now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    function listWeekSlateOptions(schedulePayload, refIso) {
      return (schedulePayload.scheduleOptions || []).filter((o) => /^W\d+$/i.test(o.value)).map((o) => {
        const value = safeText(o.value).toUpperCase();
        const weekNumber = Number(value.slice(1));
        const sunIso = schedulePayload.sundayIsosSorted[weekNumber - 1];
        const isPast = !!(sunIso && refIso && sunIso < refIso);
        return {
          value,
          label: o.label || `Week ${weekNumber}`,
          weekNumber,
          sunIso: sunIso || null,
          isPast
        };
      });
    }
    function defaultLeaderboardWeek(weekOptions) {
      const past = (weekOptions || []).filter((w) => w.isPast);
      if (past.length) return past[past.length - 1].value;
      const all = weekOptions || [];
      return all.length ? all[all.length - 1].value : "";
    }
    function buildWeekSlateFromToken(viewToken, schedulePayload, refIso) {
      const v = safeText(viewToken).toUpperCase();
      if (!/^W\d+$/.test(v)) return null;
      const games = resolveGamesForViewToken(v, schedulePayload);
      const teamIds = /* @__PURE__ */ new Set();
      const isoDates = /* @__PURE__ */ new Set();
      for (const g of games) {
        if (g.awayTeamId) teamIds.add(safeText(g.awayTeamId));
        if (g.homeTeamId) teamIds.add(safeText(g.homeTeamId));
        if (g._iso) isoDates.add(safeText(g._iso));
      }
      for (const iso of dfsScoringIsoDatesForToken(v, schedulePayload)) {
        isoDates.add(iso);
      }
      const weekNumber = Number(v.slice(1));
      const firstIso = schedulePayload.sundayIsosSorted[weekNumber - 1];
      const opt = (schedulePayload.scheduleOptions || []).find(
        (o) => safeText(o.value).toUpperCase() === v
      );
      return {
        viewToken: v,
        slateType: "sunday",
        games,
        teamIds,
        isoDates: [...isoDates].sort((a, b) => a.localeCompare(b)),
        label: opt?.label || `Week ${weekNumber}`,
        isPast: !!(firstIso && refIso && firstIso < refIso),
        weekNumber
      };
    }
    function buildLeaderboardSlateFromToken(viewToken, schedulePayload, refIso, nowMs = Date.now()) {
      const v = safeText(viewToken).toUpperCase();
      if (!/^(W\d+|D\d{8})$/i.test(v)) return null;
      const slateOptions = buildDfsSlateOptions(schedulePayload, refIso, nowMs);
      return buildSlateFromToken(v, schedulePayload, refIso, slateOptions, nowMs);
    }
    function listLeaderboardSlateOptions(schedulePayload, refIso, nowMs = Date.now()) {
      return (schedulePayload.scheduleOptions || []).filter((o) => /^(W\d+|D\d{8})$/i.test(o.value)).map((o) => {
        const value = safeText(o.value).toUpperCase();
        const isWeek = /^W\d+$/.test(value);
        const weekNumber = isWeek ? Number(value.slice(1)) : null;
        const sunIso = isWeek ? schedulePayload.sundayIsosSorted?.[weekNumber - 1] || null : null;
        const slate = buildLeaderboardSlateFromToken(value, schedulePayload, refIso, nowMs);
        return {
          value,
          label: o.label || slate?.label || value,
          weekNumber,
          sunIso,
          firstIso: slateFirstIso(value, schedulePayload),
          isPast: !!(slate && slate.isPast),
          slateKind: isWeek ? "week" : "wednesday"
        };
      });
    }
    module.exports = {
      DFS_LINEUP_SIZE,
      DFS_SALARY_CAP,
      DFS_SCORING,
      OFFENSE_SALARY_WEIGHT,
      OPP_RUNS_SALARY_WEIGHT,
      PITCHER_SALARY_WEIGHT,
      DFS_OFFENSE_RATING_WEIGHT_HISTORICAL,
      DFS_OFFENSE_RATING_WEIGHT_2026,
      buildTeamCodeById,
      buildCodeToTeamId,
      resolveUpcomingDfsSlate,
      resolvePreviousDfsSlate,
      resolveGamesForViewToken,
      buildDfsPlayerPool,
      load2026GamelogsByPlayer,
      buildSlatePointsByNorm,
      buildLastWeekPointsByNorm,
      scoreLineupForSlate,
      scoreLineupFromPointsMap,
      referenceIsoForScheduleYear,
      listWeekSlateOptions,
      listLeaderboardSlateOptions,
      defaultLeaderboardWeek,
      buildWeekSlateFromToken,
      buildLeaderboardSlateFromToken,
      slateFirstIso,
      buildDfsSlateOptions,
      filterVisibleDfsSlateOptions,
      resolveActiveDfsSlateToken,
      resolveNextLineupLockDeadline,
      buildSlateFromToken,
      computePlayerSalary,
      computeSalaryComposite,
      applyDfsSalaryPricing,
      applyOffenseRatingSalaryBands,
      DFS_SALARY_MIN,
      DFS_SALARY_NON_BOTTOM_MIN,
      DFS_BOTTOM_TIER_PCT,
      captainLastName,
      slateHasGamelogDates,
      normalizePlayerName
    };
  }
});

// lib/stats2026Loader.js
var require_stats2026Loader = __commonJS({
  "lib/stats2026Loader.js"(exports, module) {
    var Papa = require_papaparse_min();
    var { fetchCsvText } = require_fetchCsvText();
    var { getStats2026CsvUrl } = require_sheetUrls();
    var { normalizePlayerName } = require_dfs();
    function safeText(value) {
      return (value || "").toString().trim();
    }
    async function load2026StatsByPlayer2() {
      const csvText = await fetchCsvText(getStats2026CsvUrl());
      const rows = Papa.parse(csvText).data;
      const headers = (rows[1] || []).map((h) => safeText(h));
      const dataRows = rows.slice(2);
      const nameIndex = headers.findIndex((h) => h.toLowerCase() === "player");
      if (nameIndex === -1) {
        throw new Error("2026 stats CSV missing Player column.");
      }
      const statsByPlayer = /* @__PURE__ */ new Map();
      for (const row of dataRows) {
        const playerName = safeText(row[nameIndex]);
        if (!playerName) continue;
        const stats = {};
        for (let i = 0; i < headers.length; i += 1) {
          stats[headers[i]] = safeText(row[i]);
        }
        statsByPlayer.set(normalizePlayerName(playerName), stats);
      }
      return statsByPlayer;
    }
    module.exports = { load2026StatsByPlayer: load2026StatsByPlayer2 };
  }
});

// lib/leagueLeaders.js
var require_leagueLeaders = __commonJS({
  "lib/leagueLeaders.js"(exports, module) {
    function safeText(value) {
      return (value || "").toString().trim();
    }
    function toNumber(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    function isTruthyRookie(value) {
      const text = safeText(value).toLowerCase();
      return text === "y" || text === "yes" || text === "true" || text === "1";
    }
    function buildLeagueLeaders2(players) {
      const topN = (items, field, n = 5, minAB = 0) => items.filter((p) => toNumber(p.AB) >= minAB).slice().sort((a, b) => toNumber(b[field]) - toNumber(a[field])).slice(0, n);
      const leaders = [
        { title: "OPS", field: "OPS", minAB: 0 },
        { title: "AVG", field: "AVG", minAB: 0 },
        { title: "OBP", field: "OBP", minAB: 0 },
        { title: "SLG", field: "SLG", minAB: 0 },
        { title: "Hits", field: "Hits", minAB: 0 },
        { title: "Runs", field: "Runs", minAB: 0 },
        { title: "RBI", field: "RBI", minAB: 0 },
        { title: "HR", field: "HR", minAB: 0 }
      ].map((category) => ({
        ...category,
        players: topN(players, category.field, 5, category.minAB)
      }));
      const topRookies = players.filter((p) => isTruthyRookie(p.IsRookie)).slice().sort((a, b) => toNumber(b.AVG) - toNumber(a.AVG)).slice(0, 5);
      return { leaders, topRookies };
    }
    module.exports = { buildLeagueLeaders: buildLeagueLeaders2, isTruthyRookie };
  }
});

// client/league-leaders-entry.mjs
var import_stats2026Loader = __toESM(require_stats2026Loader(), 1);
var import_leagueLeaders = __toESM(require_leagueLeaders(), 1);
async function fetchLeagueLeadersData() {
  const stats2026ByPlayer = await (0, import_stats2026Loader.load2026StatsByPlayer)();
  const players2026 = Array.from(stats2026ByPlayer.values());
  const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
  return { ...(0, import_leagueLeaders.buildLeagueLeaders)(players2026), fetchedAt };
}
if (typeof window !== "undefined") {
  window.MmsLeagueLeaders = { fetchLeagueLeadersData };
}
export {
  fetchLeagueLeadersData
};
/*! Bundled license information:

papaparse/papaparse.min.js:
  (* @license
  Papa Parse
  v5.5.3
  https://github.com/mholt/PapaParse
  License: MIT
  *)
*/
