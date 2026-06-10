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
        invalidate(key) {
          store.delete(String(key));
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
    function logCsvFetchFailure(kind, url, detail) {
      const msg = `[MMS] CSV fetch ${kind}${detail ? `: ${detail}` : ""}`;
      if (typeof console !== "undefined" && console.error) {
        console.error(msg, url);
      }
    }
    function csvFetchUserError(kind) {
      if (kind === "timeout") {
        return new Error(
          "League data took too long to load. Check your connection and try again."
        );
      }
      if (kind === "http") {
        return new Error("Could not load league data right now. Please try again in a moment.");
      }
      if (kind === "empty") {
        return new Error("Could not load league data. Please try again.");
      }
      return new Error("Could not load league data. Please try again.");
    }
    async function fetchUrlText(url) {
      const timeoutMs = csvFetchTimeoutMs();
      const opts = timeoutMs > 0 ? { signal: AbortSignal.timeout(timeoutMs) } : {};
      try {
        const res = await fetch(url, opts);
        if (!res.ok) {
          logCsvFetchFailure("HTTP", url, String(res.status));
          throw csvFetchUserError("http");
        }
        let text = await res.text();
        text = text.replace(/^\ufeff/, "");
        return text;
      } catch (err) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
          logCsvFetchFailure("timeout", url, `${timeoutMs / 1e3}s`);
          throw csvFetchUserError("timeout");
        }
        if (err.message && !/https?:\/\//i.test(err.message)) {
          throw err;
        }
        logCsvFetchFailure("error", url, err.message || err);
        throw csvFetchUserError("error");
      }
    }
    var BROWSER_CSV_STORAGE_PREFIX = "mms-csv:";
    var BROWSER_CSV_STORAGE_TTL_MS = Number("600000") || 10 * 60 * 1e3;
    function browserCsvStorageKey(url) {
      return BROWSER_CSV_STORAGE_PREFIX + url;
    }
    function readBrowserCsvCache(url) {
      if (typeof sessionStorage === "undefined") return null;
      try {
        const raw = sessionStorage.getItem(browserCsvStorageKey(url));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.text !== "string" || typeof parsed.expiresAt !== "number") {
          sessionStorage.removeItem(browserCsvStorageKey(url));
          return null;
        }
        if (Date.now() > parsed.expiresAt) {
          sessionStorage.removeItem(browserCsvStorageKey(url));
          return null;
        }
        return parsed.text;
      } catch {
        return null;
      }
    }
    function writeBrowserCsvCache(url, text) {
      if (typeof sessionStorage === "undefined") return;
      try {
        sessionStorage.setItem(
          browserCsvStorageKey(url),
          JSON.stringify({ text, expiresAt: Date.now() + BROWSER_CSV_STORAGE_TTL_MS })
        );
      } catch {
      }
    }
    async function fetchCsvText(url) {
      const safeUrl = (url || "").toString().trim();
      if (!safeUrl) {
        logCsvFetchFailure("empty-url", safeUrl);
        throw csvFetchUserError("empty");
      }
      if (fetchCsvTextOverride) {
        return fetchCsvTextOverride(safeUrl);
      }
      const browserCached = readBrowserCsvCache(safeUrl);
      if (browserCached) return browserCached;
      return csvTextCache.get(safeUrl, async () => {
        const text = await fetchUrlText(safeUrl);
        writeBrowserCsvCache(safeUrl, text);
        return text;
      });
    }
    module.exports = { fetchCsvText, csvTextCache, setFetchCsvTextOverride };
  }
});

// lib/metricsSourcesRegistry.js
var require_metricsSourcesRegistry = __commonJS({
  "lib/metricsSourcesRegistry.js"(exports, module) {
    "use strict";
    var Papa = require_papaparse_min();
    var { csvTextCache } = require_fetchCsvText();
    var { createMemoryCache } = require_memoryCache();
    var METRICS_SOURCES_SHEET_ID = "1ZHYmP92Gr5mM8jH6N3q0js3zbdNjb9gnB_29o7fBRd4";
    var METRICS_SOURCES_GID = "0";
    var SOURCE_KEYS2 = Object.freeze({
      schedule: "schedule",
      index: "index",
      rosters: "rosters",
      gamelogs2026: "gamelogs2026",
      stats2026: "stats2026",
      replacements: "replacements",
      captainMapping: "captainMapping"
    });
    var REQUIRED_KEYS = Object.freeze([
      SOURCE_KEYS2.schedule,
      SOURCE_KEYS2.index,
      SOURCE_KEYS2.rosters,
      SOURCE_KEYS2.gamelogs2026,
      SOURCE_KEYS2.stats2026,
      SOURCE_KEYS2.replacements,
      SOURCE_KEYS2.captainMapping
    ]);
    function safeText(value) {
      return (value || "").toString().trim();
    }
    function metricsSourcesRegistryCsvUrl() {
      const override = (process.env.METRICS_SOURCES_REGISTRY_CSV_URL || "").trim();
      if (override) return override;
      return `https://docs.google.com/spreadsheets/d/${METRICS_SOURCES_SHEET_ID}/export?format=csv&gid=${METRICS_SOURCES_GID}`;
    }
    function resolveSourceKey(name) {
      const n = safeText(name).toLowerCase();
      if (!n) return null;
      if (n === "schedule" || n.startsWith("schedule")) return SOURCE_KEYS2.schedule;
      if (n.includes("league index") || n.includes("week / date")) return SOURCE_KEYS2.index;
      if (n.includes("team rosters") || n === "rosters") return SOURCE_KEYS2.rosters;
      if (n.includes("game log") || n.includes("gamelog")) return SOURCE_KEYS2.gamelogs2026;
      if (n.includes("player / team stats") || n.includes("2026 player")) return SOURCE_KEYS2.stats2026;
      if (n.includes("replacement")) return SOURCE_KEYS2.replacements;
      if (n.includes("captain mapping") || n.includes("captain map")) return SOURCE_KEYS2.captainMapping;
      return null;
    }
    function browserUrlToCsvFetchUrl(input) {
      const url = safeText(input);
      if (!url) return "";
      if (/output=csv|format=csv/i.test(url)) return url;
      if (url.includes("/pubhtml")) {
        const gidMatch = url.match(/[?&]gid=(\d+)/);
        const gid = gidMatch ? gidMatch[1] : "0";
        return `${url.split("/pubhtml")[0]}/pub?gid=${gid}&single=true&output=csv`;
      }
      const editMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)\/edit/);
      if (editMatch) {
        const id = editMatch[1];
        const gidMatch = url.match(/[#?&]gid=(\d+)/);
        const gid = gidMatch ? gidMatch[1] : "0";
        return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
      }
      const pubMatch = url.match(/\/spreadsheets\/d\/(e\/[a-zA-Z0-9_-]+)/);
      if (pubMatch && !url.includes("/edit")) {
        const id = pubMatch[1];
        const gidMatch = url.match(/[?&]gid=(\d+)/);
        const gid = gidMatch ? gidMatch[1] : "0";
        return `https://docs.google.com/spreadsheets/d/${id}/pub?gid=${gid}&single=true&output=csv`;
      }
      return url;
    }
    function parseRegistryCsv(csvText) {
      const rows = Papa.parse(csvText).data;
      const out = {};
      for (let i = 1; i < rows.length; i += 1) {
        const name = safeText(rows[i][0]);
        const rawUrl = safeText(rows[i][1]);
        if (!name || !rawUrl) continue;
        if (rawUrl.includes("console.firebase.google.com")) continue;
        const key = resolveSourceKey(name);
        if (!key) continue;
        out[key] = browserUrlToCsvFetchUrl(rawUrl);
      }
      return out;
    }
    var REGISTRY_CACHE_TTL_MS = Number(process.env.METRICS_SOURCES_CACHE_TTL_MS) || 60 * 1e3;
    async function fetchRegistryCsvText() {
      const base = metricsSourcesRegistryCsvUrl();
      const url = `${base}${base.includes("?") ? "&" : "?"}_=${Date.now()}`;
      const timeoutMs = Number("90000") || 0;
      const opts = { cache: "no-store" };
      if (timeoutMs > 0) opts.signal = AbortSignal.timeout(timeoutMs);
      const res = await fetch(url, opts);
      if (!res.ok) {
        throw new Error(`Metrics sources registry fetch failed (${res.status})`);
      }
      return (await res.text()).replace(/^\ufeff/, "");
    }
    var registryCache = createMemoryCache(REGISTRY_CACHE_TTL_MS, "metrics-sources");
    async function loadMetricsSourcesRegistry(force = false) {
      if (force) registryCache.invalidate("registry");
      return registryCache.get("registry", async () => {
        const csvText = await fetchRegistryCsvText();
        const registry = parseRegistryCsv(csvText);
        for (const key of REQUIRED_KEYS) {
          if (!registry[key]) {
            throw new Error(`Metrics sources registry missing required row: ${key}`);
          }
        }
        return registry;
      });
    }
    function invalidateMetricsSourcesRegistry() {
      registryCache.invalidate("registry");
      csvTextCache.invalidate(metricsSourcesRegistryCsvUrl());
    }
    async function getMetricsSourceUrl(key) {
      const registry = await loadMetricsSourcesRegistry();
      const url = registry[key];
      if (!url) throw new Error(`Metrics sources registry missing URL for: ${key}`);
      return url;
    }
    module.exports = {
      SOURCE_KEYS: SOURCE_KEYS2,
      METRICS_SOURCES_SHEET_ID,
      metricsSourcesRegistryCsvUrl,
      browserUrlToCsvFetchUrl,
      loadMetricsSourcesRegistry,
      invalidateMetricsSourcesRegistry,
      getMetricsSourceUrl
    };
  }
});

// lib/sheetUrls.js
var require_sheetUrls = __commonJS({
  "lib/sheetUrls.js"(exports, module) {
    var { csvTextCache } = require_fetchCsvText();
    var {
      SOURCE_KEYS: SOURCE_KEYS2,
      getMetricsSourceUrl,
      invalidateMetricsSourcesRegistry,
      loadMetricsSourcesRegistry,
      browserUrlToCsvFetchUrl,
      metricsSourcesRegistryCsvUrl
    } = require_metricsSourcesRegistry();
    var HIST_2025_STATS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTj9_UhD3MyWbDfD3zlwO7mcOOjpcmSc2OrPYXa6UEeii422rpHFBBn2AXkf5KP_OKtJrcobvlT_J7d/pub?output=csv";
    async function getCaptainMappingCsvUrl() {
      const u = process.env.CAPTAIN_MAPPING_CSV_URL;
      if (u && u.trim()) return u.trim();
      return getMetricsSourceUrl(SOURCE_KEYS2.captainMapping);
    }
    var CAREER_CSV_PUBLIC_URL = "/data/csv/career.csv";
    var SCHEDULE_CALENDAR_YEAR = Number(process.env.SCHEDULE_CALENDAR_YEAR) || 2026;
    var careerCsvFilePath = null;
    function googleSheetCsvExportUrl(spreadsheetId, gid) {
      return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
    }
    async function getScheduleUrl() {
      return getMetricsSourceUrl(SOURCE_KEYS2.schedule);
    }
    async function getIndexUrl() {
      return getMetricsSourceUrl(SOURCE_KEYS2.index);
    }
    async function getRosterUrl() {
      return getMetricsSourceUrl(SOURCE_KEYS2.rosters);
    }
    async function getGamelogs2026CsvUrl() {
      return getMetricsSourceUrl(SOURCE_KEYS2.gamelogs2026);
    }
    async function getStats2026CsvUrl() {
      return getMetricsSourceUrl(SOURCE_KEYS2.stats2026);
    }
    async function getReplacementsCsvUrl() {
      return getMetricsSourceUrl(SOURCE_KEYS2.replacements);
    }
    function setCareerCsvFilePath(filePath) {
      careerCsvFilePath = filePath ? String(filePath) : null;
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
    async function invalidateSourceCsvCache2(sourceKey) {
      const registry = await loadMetricsSourcesRegistry();
      const url = registry[sourceKey];
      if (url) csvTextCache.invalidate(url);
    }
    async function invalidateLiveSourceCsvCache(sourceKey) {
      const registry = await loadMetricsSourcesRegistry();
      const url = registry[sourceKey];
      invalidateMetricsSourcesRegistry();
      if (url) csvTextCache.invalidate(url);
    }
    module.exports = {
      HIST_2025_STATS_URL,
      CAREER_CSV_PUBLIC_URL,
      SCHEDULE_CALENDAR_YEAR,
      SOURCE_KEYS: SOURCE_KEYS2,
      metricsSourcesRegistryCsvUrl,
      browserUrlToCsvFetchUrl,
      loadMetricsSourcesRegistry,
      invalidateMetricsSourcesRegistry,
      invalidateSourceCsvCache: invalidateSourceCsvCache2,
      invalidateLiveSourceCsvCache,
      getScheduleUrl,
      getIndexUrl,
      getRosterUrl,
      getGamelogs2026CsvUrl,
      getStats2026CsvUrl,
      getCaptainMappingCsvUrl,
      getReplacementsCsvUrl,
      googleSheetCsvExportUrl,
      setCareerCsvFilePath,
      getCareerCsvSource,
      resolveCareerCsvSource,
      configureCareerCsvForBrowser
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
    var DFS_DOUBLEHEADER_SALARY_BOOST = 1.18;
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
    function normalizePlayerName2(name) {
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
          const row = stats2026ByPlayer.get(normalizePlayerName2(name));
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
    var MAX_SLATE_GAMES_PER_TEAM = 2;
    function pushTeamSlateMatchup(matchupByTeam, teamId, matchup) {
      const tid = safeText(teamId);
      if (!tid) return;
      if (!matchupByTeam.has(tid)) matchupByTeam.set(tid, []);
      const list = matchupByTeam.get(tid);
      if (list.length >= MAX_SLATE_GAMES_PER_TEAM) return;
      list.push(matchup);
    }
    function formatDoubleheaderCellText(labels) {
      const slice = (labels || []).slice(0, MAX_SLATE_GAMES_PER_TEAM).map((l) => safeText(l) || "\u2014");
      if (!slice.length) return "";
      if (slice.length === 1) return slice[0];
      if (slice[0] === slice[1]) return slice[0];
      return `${slice[0]}
/
${slice[1]}`;
    }
    function formatVsOpponents(matchups, teams) {
      if (!matchups?.length) return "";
      const labels = matchups.map((m) => {
        const opp = teams.find((x) => safeText(x.teamId) === safeText(m.opponentId));
        return opp?.teamName || `Team ${m.opponentId}`;
      });
      return formatDoubleheaderCellText(labels);
    }
    function formatOpposingPitchers(matchups, teams) {
      if (!matchups?.length) return "\u2014";
      const labels = matchups.map((m) => {
        const pit = pitcherForTeamId(m.opponentId, teams);
        const name = pit?.primaryPitcher ? safeText(pit.primaryPitcher) : "";
        return name || "\u2014";
      });
      return formatDoubleheaderCellText(labels) || "\u2014";
    }
    function formatGameFieldsFromMatchups(matchups) {
      if (!matchups?.length) return "\u2014";
      const labels = matchups.map((m) => scheduleVenueFromGame(m?.game) || "\u2014");
      return formatDoubleheaderCellText(labels) || "\u2014";
    }
    function averageOpposingPitcherTooltip(matchups, teams) {
      const pits = matchups.slice(0, MAX_SLATE_GAMES_PER_TEAM).map((m) => pitcherForTeamId(m.opponentId, teams)).filter(Boolean);
      if (!pits.length) return { baa: null, runsG: null };
      const baa = pits.reduce((s, p) => s + toNumber(p.baa), 0) / pits.length;
      const runsG = pits.reduce((s, p) => s + toNumber(p.runsPerG), 0) / pits.length;
      return { baa: Math.round(baa * 1e3) / 1e3, runsG: Math.round(runsG * 100) / 100 };
    }
    function computePlayerSalaryForMatchups({
      offenseRating,
      matchups,
      teams,
      scheduleRunRates,
      leagueAvgRag
    }) {
      if (!matchups?.length) {
        return computePlayerSalary({
          offenseRating,
          opponentRunsAgainst: null,
          opponentPitcher: null,
          leagueAvgRag
        });
      }
      let compositeSum = 0;
      for (const m of matchups) {
        const oppId = m.opponentId;
        const oppRates = scheduleRunRates?.get?.(oppId);
        const oppPitcher = pitcherForTeamId(oppId, teams);
        compositeSum += computeSalaryComposite({
          offenseRating,
          opponentRunsAgainst: oppRates?.runsAgainstPerGame ?? null,
          opponentPitcher: oppPitcher,
          leagueAvgRag
        });
      }
      let composite = compositeSum / matchups.length;
      if (matchups.length >= 2) {
        composite = Math.min(1, composite * DFS_DOUBLEHEADER_SALARY_BOOST);
      }
      return salaryFromComposite(composite);
    }
    function averageFantasyPointsFromLogs(logs) {
      if (!logs.length) return { points: 0, games: 0 };
      const total = logs.reduce((sum, l) => sum + l.points, 0);
      return {
        points: Math.round(total / logs.length),
        games: logs.length
      };
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
          isLocked: !canEdit,
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
    function resolveMostRecentlyLockedSlateToken(schedulePayload, refIso, nowMs = Date.now()) {
      const options = buildDfsSlateOptions(schedulePayload, refIso, nowMs);
      const activeIdx = options.findIndex((o) => o.canEdit);
      if (activeIdx > 0) return options[activeIdx - 1].value;
      if (activeIdx === 0) return options[0].value;
      const locked = options.filter((o) => o.lineupDeadlinePassed);
      if (locked.length) return locked[locked.length - 1].value;
      return options.length ? options[options.length - 1].value : null;
    }
    function resolveNextUpcomingScheduleViewToken(schedulePayload, refIso) {
      const ref = safeText(refIso);
      if (!ref) return null;
      for (const o of schedulePayload?.scheduleOptions || []) {
        const value = safeText(o.value).toUpperCase();
        if (!/^(W\d+|D\d{8})$/.test(value)) continue;
        const firstIso = slateFirstIso(value, schedulePayload);
        if (firstIso && firstIso.localeCompare(ref) >= 0) return value;
      }
      return null;
    }
    function pickMatchupPredictorDefaultView(schedulePayload, refIso, nowMs = Date.now()) {
      const active = resolveActiveDfsSlateToken(schedulePayload, refIso, nowMs);
      if (active) return active;
      const upcoming = resolveNextUpcomingScheduleViewToken(schedulePayload, refIso);
      if (upcoming) return upcoming;
      const locked = resolveMostRecentlyLockedSlateToken(schedulePayload, refIso, nowMs);
      if (locked) return locked;
      const visible = filterVisibleDfsSlateOptions(
        buildDfsSlateOptions(schedulePayload, refIso, nowMs)
      );
      if (visible.length) return visible[visible.length - 1].value;
      const opts = schedulePayload?.scheduleOptions || [];
      return opts.length ? safeText(opts[opts.length - 1].value).toUpperCase() : "";
    }
    function buildMatchupPredictorSlateSets(schedulePayload, refIso, nowMs = Date.now()) {
      const past = /* @__PURE__ */ new Set();
      const future = /* @__PURE__ */ new Set();
      for (const o of buildDfsSlateOptions(schedulePayload, refIso, nowMs)) {
        if (o.lineupDeadlinePassed) past.add(o.value);
        else future.add(o.value);
      }
      return { past, future };
    }
    function filterScheduleOptionsForMatchupPredictorMode(scheduleOptions, schedulePayload, refIso, nowMs, mode) {
      const normalized = safeText(mode).toLowerCase() === "past" ? "past" : "future";
      const { past, future } = buildMatchupPredictorSlateSets(schedulePayload, refIso, nowMs);
      const allowed = normalized === "past" ? past : future;
      return (scheduleOptions || []).filter((o) => allowed.has(safeText(o.value).toUpperCase()));
    }
    function pickMatchupPredictorDefaultViewForMode(schedulePayload, refIso, nowMs, mode) {
      const normalized = safeText(mode).toLowerCase() === "past" ? "past" : "future";
      if (normalized === "past") {
        return resolveMostRecentlyLockedSlateToken(schedulePayload, refIso, nowMs) || "";
      }
      return pickMatchupPredictorDefaultView(schedulePayload, refIso, nowMs);
    }
    function filterScheduleOptionsForMatchupPredictor(scheduleOptions) {
      return scheduleOptions || [];
    }
    function filterScheduleOptionsToDfsVisibility(scheduleOptions, schedulePayload, refIso, nowMs = Date.now()) {
      const visible = new Set(
        filterVisibleDfsSlateOptions(buildDfsSlateOptions(schedulePayload, refIso, nowMs)).map(
          (o) => safeText(o.value).toUpperCase()
        )
      );
      return (scheduleOptions || []).filter((o) => visible.has(safeText(o.value).toUpperCase()));
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
      teamCodeById,
      replacementByOriginalNorm = null
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
      const matchupByTeam = /* @__PURE__ */ new Map();
      for (const g of slate.games) {
        const awayId = safeText(g.awayTeamId);
        const homeId = safeText(g.homeTeamId);
        pushTeamSlateMatchup(matchupByTeam, awayId, { opponentId: homeId, side: "away", game: g });
        pushTeamSlateMatchup(matchupByTeam, homeId, { opponentId: awayId, side: "home", game: g });
      }
      const pool = [];
      for (const t of teams) {
        const tid = safeText(t.teamId);
        if (!teamIds.has(tid)) continue;
        const matchups = matchupByTeam.get(tid) || [];
        const primary = matchups[0];
        const teamCode = teamCodeById.get(tid) || "";
        const gameField = formatGameFieldsFromMatchups(matchups);
        const opponentName = formatVsOpponents(matchups, teams);
        const opposingPitcher = formatOpposingPitchers(matchups, teams);
        const pitcherTooltip = averageOpposingPitcherTooltip(matchups, teams);
        const scheduledGames = matchups.length;
        const doubleHeader = scheduledGames >= 2;
        const gameLabel = matchups.map((m) => m.game ? `${m.game.away} @ ${m.game.home}` : "").filter(Boolean).join(" \xB7 ");
        for (const playerName of t.players || []) {
          const origNorm = normalizePlayerName2(playerName);
          const repl = replacementByOriginalNorm?.get(origNorm);
          const effectiveName = repl ? repl.replacement : playerName;
          const norm = repl ? repl.replacementNorm : origNorm;
          const rating = offenseRatingByNorm.get(norm) ?? 0;
          const row26 = stats2026ByPlayer.get(norm);
          const salary = computePlayerSalaryForMatchups({
            offenseRating: rating,
            matchups,
            teams,
            scheduleRunRates,
            leagueAvgRag
          });
          pool.push({
            norm,
            name: effectiveName,
            teamId: tid,
            teamName: t.teamName,
            teamCode,
            offenseRating: Math.round(rating * 100) / 100,
            salary,
            // raw; bottom tier adjusted below
            opponentId: primary?.opponentId || "",
            opponentName,
            opponentRunsAgainst: null,
            opposingPitcher,
            pitcherBaa: pitcherTooltip.baa,
            pitcherRunsG: pitcherTooltip.runsG,
            pa2026: row26 ? toNumber(row26.PA) : 0,
            gameField,
            gameLabel,
            scheduledGames,
            doubleHeader
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
    var EMPTY_GAMELOGS = { byNorm: /* @__PURE__ */ new Map(), bySlateKey: /* @__PURE__ */ new Map(), gameIsos: /* @__PURE__ */ new Set() };
    function parse2026GamelogsFromCsvText(text) {
      try {
        const parsed = Papa.parse(text, { skipEmptyLines: true });
        const rows = parsed.data || [];
        if (rows.length < 3) return EMPTY_GAMELOGS;
        const headerRow = rows.find(
          (r) => safeText(r[0]).replace(/^\ufeff/, "") === "Team" && safeText(r[1]) === "Date"
        );
        if (!headerRow) return EMPTY_GAMELOGS;
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
          const norm = normalizePlayerName2(player);
          const entry = {
            teamCode,
            iso,
            opponentCode: safeText(row[col("Opponent ID")]),
            gameId: safeText(row[col("Game ID")]),
            player,
            missedGame: (() => {
              const mgCol = col("MG");
              if (mgCol < 0) return false;
              const n = Number(String(row[mgCol] ?? "").trim());
              return Number.isFinite(n) && n === 1;
            })(),
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
        return EMPTY_GAMELOGS;
      }
    }
    async function load2026GamelogsByPlayer() {
      try {
        const text = await fetchCsvText(await getGamelogs2026CsvUrl());
        return parse2026GamelogsFromCsvText(text);
      } catch {
        return EMPTY_GAMELOGS;
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
        const { points: pts, games } = averageFantasyPointsFromLogs(relevant);
        total += pts;
        breakdown.push({
          norm,
          name: p?.name || norm,
          points: pts,
          games
        });
      }
      return { total: Math.round(total), breakdown };
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
        const { points: pts, games } = averageFantasyPointsFromLogs(logs);
        if (logs.length) hasStats = true;
        byNorm[p.norm] = {
          name: p.name,
          points: pts,
          games
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
      return { total: Math.round(total), breakdown };
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
    function defaultLeaderboardWeek(weekOptions, schedulePayload, refIso, nowMs = Date.now()) {
      if (schedulePayload && refIso) {
        const token = resolveMostRecentlyLockedSlateToken(schedulePayload, refIso, nowMs);
        if (token && (weekOptions || []).some((w) => w.value === token)) return token;
      }
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
      parse2026GamelogsFromCsvText,
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
      resolveMostRecentlyLockedSlateToken,
      resolveNextUpcomingScheduleViewToken,
      pickMatchupPredictorDefaultView,
      buildMatchupPredictorSlateSets,
      filterScheduleOptionsForMatchupPredictorMode,
      pickMatchupPredictorDefaultViewForMode,
      filterScheduleOptionsForMatchupPredictor,
      filterScheduleOptionsToDfsVisibility,
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
      normalizePlayerName: normalizePlayerName2
    };
  }
});

// lib/matchupPositions.js
var require_matchupPositions = __commonJS({
  "lib/matchupPositions.js"(exports, module) {
    "use strict";
    var POSITION_PDW = Object.freeze({
      SS: 1.35,
      C: 1.25,
      CF: 1.25,
      P: 1.15,
      "2B": 1.1,
      "3B": 1.05,
      LF: 1,
      "1B": 0.95,
      RF: 0.9,
      DH: 0.5
    });
    var DEFENSIVE_LOSS_SCALE = 10;
    var IRRELEVANT_POSITION_TOKENS = /* @__PURE__ */ new Set([
      "",
      "N/A",
      "NA",
      "NONE",
      "NO POSITION",
      "NO POS",
      "BENCH",
      "BN",
      "\u2014",
      "-"
    ]);
    function safeText(value) {
      return (value || "").toString().trim();
    }
    function normalizePositionCode(raw) {
      const s = safeText(raw).toUpperCase().replace(/\./g, "");
      if (!s || IRRELEVANT_POSITION_TOKENS.has(s)) return null;
      if (s === "SHORTSTOP") return "SS";
      if (s === "CATCHER") return "C";
      if (s === "CENTER" || s === "CENTERFIELD" || s === "CENTRE") return "CF";
      if (s === "PITCHER") return "P";
      if (s === "SECOND" || s === "SECONDBASE") return "2B";
      if (s === "THIRD" || s === "THIRDBASE") return "3B";
      if (s === "LEFT" || s === "LEFTFIELD") return "LF";
      if (s === "FIRST" || s === "FIRSTBASE") return "1B";
      if (s === "RIGHT" || s === "RIGHTFIELD") return "RF";
      if (s === "DESIGNATED" || s === "DESIGNATEDHITTER") return "DH";
      if (POSITION_PDW[s] != null) return s;
      return null;
    }
    function isRelevantDefensivePosition(positionCode) {
      return normalizePositionCode(positionCode) != null;
    }
    function positionPdw(rawPosition) {
      const code = normalizePositionCode(rawPosition);
      if (!code) return 1;
      return POSITION_PDW[code] ?? 1;
    }
    function countFieldingSlots(activeEntries) {
      const slots = /* @__PURE__ */ new Set();
      for (const e of activeEntries || []) {
        const code = normalizePositionCode(e.position);
        if (code) slots.add(code);
      }
      return slots.size;
    }
    function rosterHasPositionData(entries) {
      return (entries || []).some((e) => isRelevantDefensivePosition(e.position));
    }
    function averagePor(entries, offenseRatingByNorm) {
      let sum = 0;
      let n = 0;
      for (const e of entries || []) {
        const por = offenseRatingByNorm.get(e.norm);
        if (por != null && Number.isFinite(por)) {
          sum += por;
          n += 1;
        }
      }
      return n > 0 ? sum / n : 0;
    }
    function sumAbsenceDeltas(missing, allEntries, offenseRatingByNorm) {
      const teamAvgPor = averagePor(allEntries, offenseRatingByNorm);
      const lostPositions = /* @__PURE__ */ new Set();
      let total = 0;
      for (const m of missing || []) {
        const por = offenseRatingByNorm.get(m.norm);
        const porN = por != null && Number.isFinite(por) ? por : 0;
        const offensiveImpact = teamAvgPor - porN;
        let defensiveLoss = 0;
        const code = normalizePositionCode(m.position);
        if (code && !lostPositions.has(code)) {
          defensiveLoss = positionPdw(code) * DEFENSIVE_LOSS_SCALE;
          lostPositions.add(code);
        }
        total += -defensiveLoss + offensiveImpact;
      }
      return { total, teamAvgPor, lostPositions };
    }
    function multipliersFromAbsenceSum(absenceSum, missingCount) {
      if (!missingCount) {
        return {
          offense: 1,
          run: 1,
          defense: 1,
          runsAgainst: 1,
          regime: "full"
        };
      }
      const scaled = absenceSum / (12 + missingCount * 2.5);
      const offenseMult = Math.max(0.08, Math.min(1.45, Math.exp(scaled * 0.55)));
      const defenseMult = Math.max(0.12, Math.min(1.35, Math.exp(scaled * 0.42)));
      return {
        offense: offenseMult,
        run: offenseMult,
        defense: defenseMult,
        runsAgainst: 1,
        regime: "absence-engine"
      };
    }
    module.exports = {
      POSITION_PDW,
      DEFENSIVE_LOSS_SCALE,
      normalizePositionCode,
      isRelevantDefensivePosition,
      positionPdw,
      countFieldingSlots,
      rosterHasPositionData,
      sumAbsenceDeltas,
      multipliersFromAbsenceSum
    };
  }
});

// lib/playerReplacements.js
var require_playerReplacements = __commonJS({
  "lib/playerReplacements.js"(exports, module) {
    var Papa = require_papaparse_min();
    var { fetchCsvText } = require_fetchCsvText();
    var { getReplacementsCsvUrl } = require_sheetUrls();
    var { createMemoryCache } = require_memoryCache();
    var { normalizePlayerName: normalizePlayerName2 } = require_dfs();
    function safeText(value) {
      return (value || "").toString().trim();
    }
    function parseReplacementDateCell(cell) {
      let s = safeText(cell).replace(/^\ufeff/g, "");
      if (!s) return null;
      s = s.replace(/[\u00a0\u202f]/g, " ").trim().replace(/^["']+|["']+$/g, "");
      const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      const slashMatch = /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/.exec(s);
      if (!slashMatch) return null;
      const month = String(slashMatch[1]).padStart(2, "0");
      const day = String(slashMatch[2]).padStart(2, "0");
      let year = Number(slashMatch[3]);
      if (!Number.isFinite(year)) return null;
      if (year < 100) year += 2e3;
      return `${year}-${month}-${day}`;
    }
    function isReplacementActiveForDate(entry, gameIsoDate) {
      if (!entry) return false;
      if (!entry.replacementDateIso) return true;
      if (!gameIsoDate) return false;
      return safeText(gameIsoDate) >= entry.replacementDateIso;
    }
    function filterReplacementsForDate2(byOriginalNorm, gameIsoDate) {
      if (!byOriginalNorm?.size) return /* @__PURE__ */ new Map();
      if (!gameIsoDate) return /* @__PURE__ */ new Map();
      const filtered = /* @__PURE__ */ new Map();
      for (const [norm, entry] of byOriginalNorm.entries()) {
        if (isReplacementActiveForDate(entry, gameIsoDate)) filtered.set(norm, entry);
      }
      return filtered;
    }
    function parseReplacementsRows(rows) {
      const list = [];
      const byOriginalNorm = /* @__PURE__ */ new Map();
      const replacementNorms = /* @__PURE__ */ new Set();
      for (let i = 0; i < (rows || []).length; i += 1) {
        const row = rows[i];
        if (!row || !row.length) continue;
        const original = safeText(row[0]);
        const replacement = safeText(row[1]);
        const replacementDateRaw = safeText(row[2]);
        if (!original || !replacement) continue;
        if (i === 0 && /original/i.test(original) && (/new/i.test(replacement) || /replacement/i.test(replacement))) {
          continue;
        }
        const originalNorm = normalizePlayerName2(original);
        const replacementNorm = normalizePlayerName2(replacement);
        if (!originalNorm || !replacementNorm || originalNorm === replacementNorm) continue;
        const replacementDateIso = parseReplacementDateCell(replacementDateRaw);
        const entry = {
          original,
          replacement,
          originalNorm,
          replacementNorm,
          replacementDateIso,
          replacementDateRaw: replacementDateRaw || null
        };
        list.push(entry);
        byOriginalNorm.set(originalNorm, entry);
        replacementNorms.add(replacementNorm);
      }
      return { list, byOriginalNorm, replacementNorms };
    }
    function emptyReplacementContext() {
      return { list: [], byOriginalNorm: /* @__PURE__ */ new Map(), replacementNorms: /* @__PURE__ */ new Set() };
    }
    function resolveEffectivePlayer(originalName, byOriginalNorm) {
      const norm = normalizePlayerName2(originalName);
      const repl = byOriginalNorm?.get(norm);
      if (repl) {
        return {
          name: repl.replacement,
          norm: repl.replacementNorm,
          replacedName: repl.original,
          isReplacement: true
        };
      }
      return {
        name: String(originalName || "").trim(),
        norm,
        replacedName: null,
        isReplacement: false
      };
    }
    function applyReplacementsToPlayerNames2(playerNames, byOriginalNorm) {
      return (playerNames || []).map(
        (name) => resolveEffectivePlayer(name, byOriginalNorm).name
      );
    }
    function remapLineupNorms2(lineupNorms, byOriginalNorm) {
      return (lineupNorms || []).map((n) => {
        const norm = normalizePlayerName2(n);
        const repl = byOriginalNorm?.get(norm);
        return repl ? repl.replacementNorm : norm;
      }).filter(Boolean);
    }
    function positionFromMap(positionByNorm, norm) {
      if (!positionByNorm || norm == null) return null;
      if (positionByNorm instanceof Map) return positionByNorm.get(norm) || null;
      return positionByNorm[norm] || null;
    }
    function buildRosterEntriesWithReplacements2(playerNames, normalizeName = normalizePlayerName2, positionByNorm = null, byOriginalNorm = null) {
      return (playerNames || []).map((name, idx) => {
        const eff = resolveEffectivePlayer(name, byOriginalNorm);
        return {
          round: idx + 1,
          norm: eff.norm,
          name: eff.name,
          replacedName: eff.replacedName,
          isReplacement: eff.isReplacement,
          position: positionFromMap(positionByNorm, eff.norm)
        };
      });
    }
    async function loadPlayerReplacements() {
      try {
        const text = await fetchCsvText(await getReplacementsCsvUrl());
        const parsed = Papa.parse(text, { skipEmptyLines: true });
        return parseReplacementsRows(parsed.data || []);
      } catch (err) {
        console.error("Could not load player replacements sheet", err);
        return emptyReplacementContext();
      }
    }
    var replacementsCache = createMemoryCache(
      Number(process.env.REPLACEMENTS_CACHE_TTL_MS) || 5 * 60 * 1e3,
      "replacements"
    );
    function getCachedPlayerReplacements2() {
      return replacementsCache.get("player-replacements", loadPlayerReplacements);
    }
    function serializeReplacementsForClient2(byOriginalNorm) {
      const out = {};
      if (!byOriginalNorm) return out;
      for (const [norm, entry] of byOriginalNorm.entries()) {
        out[norm] = {
          original: entry.original,
          replacement: entry.replacement,
          originalNorm: entry.originalNorm,
          replacementNorm: entry.replacementNorm,
          replacementDateIso: entry.replacementDateIso || null
        };
      }
      return out;
    }
    module.exports = {
      parseReplacementDateCell,
      isReplacementActiveForDate,
      filterReplacementsForDate: filterReplacementsForDate2,
      parseReplacementsRows,
      resolveEffectivePlayer,
      applyReplacementsToPlayerNames: applyReplacementsToPlayerNames2,
      remapLineupNorms: remapLineupNorms2,
      buildRosterEntriesWithReplacements: buildRosterEntriesWithReplacements2,
      loadPlayerReplacements,
      getCachedPlayerReplacements: getCachedPlayerReplacements2,
      emptyReplacementContext,
      serializeReplacementsForClient: serializeReplacementsForClient2
    };
  }
});

// lib/matchupMissingPlayers.js
var require_matchupMissingPlayers = __commonJS({
  "lib/matchupMissingPlayers.js"(exports, module) {
    var {
      countFieldingSlots,
      rosterHasPositionData,
      sumAbsenceDeltas,
      multipliersFromAbsenceSum
    } = require_matchupPositions();
    var { buildRosterEntriesWithReplacements: buildRosterEntriesWithReplacements2 } = require_playerReplacements();
    var C_PLAYER_ROUNDS = Object.freeze([11, 12, 13]);
    var C_PLAYER_RULE_MIN_ACTIVE = 9;
    var B_PLAYER_ROUNDS = Object.freeze([8, 9, 10]);
    var FIELDING_SPOTS = 10;
    var ROSTER_FULL_SIZE = 13;
    var MIN_PLAYERS_TO_START = 8;
    var FORFEIT_PLAYER_COUNT = 7;
    var MIN_VIABLE_ACTIVE_PLAYERS = MIN_PLAYERS_TO_START;
    var MAX_WIN_FRACTION_CRITICAL_ROSTER = 0.099;
    function parseMissingNorms(param, normalizeName = (x) => String(x || "").trim().toLowerCase()) {
      const s = String(param || "").trim();
      if (!s) return /* @__PURE__ */ new Set();
      return new Set(
        s.split(/[,|]/).map((x) => normalizeName(x.trim())).filter(Boolean)
      );
    }
    function serializeMissingNorms(set) {
      if (!set || !set.size) return "";
      return [...set].join(",");
    }
    function positionFromMap(positionByNorm, norm) {
      if (!positionByNorm) return null;
      if (positionByNorm instanceof Map) return positionByNorm.get(norm) ?? null;
      if (typeof positionByNorm === "object") return positionByNorm[norm] ?? null;
      return null;
    }
    function rosterEntriesFromNames(playerNames, normalizeName = (x) => String(x || "").trim().toLowerCase(), positionByNorm = null) {
      return (playerNames || []).map((name, idx) => {
        const norm = normalizeName(name);
        return {
          round: idx + 1,
          norm,
          name: String(name || "").trim(),
          position: positionFromMap(positionByNorm, norm)
        };
      });
    }
    function fieldingPresentCount(activeEntries, allEntries) {
      if (rosterHasPositionData(allEntries)) {
        return countFieldingSlots(activeEntries);
      }
      return activeEntries.length;
    }
    function formatSignedNumber(n, decimals = 2) {
      if (n == null || !Number.isFinite(n)) return null;
      const s = n.toFixed(decimals);
      return n >= 0 ? `+${s}` : s;
    }
    function resolveCDoubleBatter(entries, missingSet, presentCount) {
      if (presentCount < C_PLAYER_RULE_MIN_ACTIVE) return null;
      const cSlots = entries.filter((e) => C_PLAYER_ROUNDS.includes(e.round));
      const cPresent = cSlots.filter((e) => !missingSet.has(e.norm));
      const cMissingCount = cSlots.length - cPresent.length;
      const player10 = entries.find((e) => e.round === 10);
      if (cMissingCount === 2 && cPresent.length === 1) {
        const c = cPresent[0];
        return {
          norm: c.norm,
          name: c.name,
          round: c.round,
          rule: "c-one-present",
          ruleLabel: "C-player bats twice",
          reason: "Two of three C-players (rounds 11\u201313) are missing. The remaining C-player bats twice and may pinch-run once."
        };
      }
      if (cMissingCount >= 3 && player10 && !missingSet.has(player10.norm)) {
        return {
          norm: player10.norm,
          name: player10.name,
          round: player10.round,
          rule: "c-all-out-round-10",
          ruleLabel: "Round 10 bats twice",
          reason: "All three C-players (rounds 11\u201313) are out. The round 10 pick bats twice and may pinch-run once."
        };
      }
      return null;
    }
    function resolveEleventhBatterMeanRule(entries, missingSet, missing) {
      const firstPresentFromRound = (fromRound, direction) => {
        if (direction === "up") {
          for (let r = fromRound; r <= ROSTER_FULL_SIZE; r += 1) {
            const slot2 = entries.find((e) => e.round === r);
            if (slot2 && !missingSet.has(slot2.norm)) return slot2;
          }
        } else {
          for (let r = fromRound; r >= 1; r -= 1) {
            const slot2 = entries.find((e) => e.round === r);
            if (slot2 && !missingSet.has(slot2.norm)) return slot2;
          }
        }
        return null;
      };
      const missingRounds = missing.map((m) => m.round);
      const total = missingRounds.reduce((s, r) => s + r, 0);
      const avg = total / missingRounds.length;
      const targetRound = Math.ceil(avg);
      const atTarget = entries.find((e) => e.round === targetRound);
      const slot = atTarget && !missingSet.has(atTarget.norm) ? atTarget : firstPresentFromRound(targetRound + 1, "up") || firstPresentFromRound(targetRound - 1, "down");
      if (!slot) return null;
      return {
        norm: slot.norm,
        name: slot.name,
        round: slot.round,
        rule: "11th-batter",
        ruleLabel: "11th spot \u2014 bats twice",
        reason: `Ten players are active with three missing (rounds ${missingRounds.join(", ")}). Average draft round ${avg.toFixed(2)} rounds up to slot ${targetRound}; ${slot.name} (round ${slot.round}) bats a second time for the full game.`,
        missingRounds,
        targetRound
      };
    }
    function resolveDoubleBatter(entries, missingSet) {
      const present = entries.filter((e) => !missingSet.has(e.norm));
      const missing = entries.filter((e) => missingSet.has(e.norm));
      const presentCount = present.length;
      if (presentCount >= C_PLAYER_RULE_MIN_ACTIVE) {
        const cRule = resolveCDoubleBatter(entries, missingSet, presentCount);
        if (cRule) return cRule;
      }
      if (presentCount === 10 && missing.length === 3) {
        return resolveEleventhBatterMeanRule(entries, missingSet, missing);
      }
      return null;
    }
    function playerRunProd2026(norm, stats2026ByPlayer) {
      const row = stats2026ByPlayer.get(norm);
      if (!row) return null;
      const pa = Number(row.PA);
      if (pa <= 0) return null;
      const rp = (Number(row.Runs) + Number(row.RBI)) / pa;
      return Number.isFinite(rp) ? rp : null;
    }
    function evaluateSecondTurnWeight(doubleBatter, missing, offenseRatingByNorm, stats2026ByPlayer) {
      if (!doubleBatter || !missing.length) {
        return {
          weight: 0,
          dbRating: null,
          replacementRating: null,
          replacementRunProd: null,
          gapRating: null,
          gapRunProd: null,
          verdict: "none",
          missingNames: []
        };
      }
      const dbRating = offenseRatingByNorm.get(doubleBatter.norm);
      const dbRatingN = dbRating != null && Number.isFinite(dbRating) ? dbRating : 0;
      const dbRun = playerRunProd2026(doubleBatter.norm, stats2026ByPlayer);
      let repNum = 0;
      let repDen = 0;
      let repRunNum = 0;
      let repRunDen = 0;
      for (const m of missing) {
        const w = draftRoundWeight(m.round);
        const r = offenseRatingByNorm.get(m.norm);
        if (r != null && Number.isFinite(r)) {
          repNum += r * w;
          repDen += w;
        }
        const rp = playerRunProd2026(m.norm, stats2026ByPlayer);
        if (rp != null) {
          repRunNum += rp * w;
          repRunDen += w;
        }
      }
      const replacementRating = repDen > 0 ? repNum / repDen : 0;
      const replacementRunProd = repRunDen > 0 ? repRunNum / repRunDen : null;
      const gapRating = dbRatingN - replacementRating;
      const gapRunProd = dbRun != null && replacementRunProd != null ? dbRun - replacementRunProd : null;
      let score = gapRating;
      if (gapRunProd != null) {
        score = 0.65 * gapRating + 0.35 * gapRunProd * 4;
      }
      const weight = Math.max(0, Math.min(1, 0.5 + 0.5 * Math.tanh(score * 1.75)));
      let verdict = "even";
      if (weight < 0.18) verdict = "much-weaker";
      else if (weight < 0.42) verdict = "weaker";
      else if (weight < 0.58) verdict = "even";
      else if (weight < 0.82) verdict = "better";
      else verdict = "much-better";
      return {
        weight,
        dbRating: dbRatingN,
        replacementRating,
        replacementRunProd,
        gapRating,
        gapRunProd,
        verdict,
        missingNames: missing.map((m) => m.name)
      };
    }
    function buildDoubleBatterImpact(doubleBatter, activeEntries, missing, offenseRatingByNorm, stats2026ByPlayer) {
      if (!doubleBatter || !activeEntries.length) return null;
      const norm = doubleBatter.norm;
      const rating = offenseRatingByNorm.get(norm);
      const runProd = playerRunProd2026(norm, stats2026ByPlayer);
      const secondTurn = evaluateSecondTurnWeight(
        doubleBatter,
        missing,
        offenseRatingByNorm,
        stats2026ByPlayer
      );
      const weights1x = activeFieldingWeights(activeEntries, offenseRatingByNorm, stats2026ByPlayer, null, 0);
      const weightsAdj = activeFieldingWeights(
        activeEntries,
        offenseRatingByNorm,
        stats2026ByPlayer,
        norm,
        secondTurn.weight
      );
      const off1 = paWeightedFromWeights(weights1x, (w) => offenseRatingByNorm.get(w.norm));
      const offAdj = paWeightedFromWeights(weightsAdj, (w) => offenseRatingByNorm.get(w.norm));
      const run1 = paWeightedFromWeights(weights1x, (w) => playerRunProd2026(w.norm, stats2026ByPlayer));
      const runAdj = paWeightedFromWeights(weightsAdj, (w) => playerRunProd2026(w.norm, stats2026ByPlayer));
      const totalPa1 = weights1x.reduce((s, w) => s + w.pa, 0);
      const totalPaAdj = weightsAdj.reduce((s, w) => s + w.pa, 0);
      const slot1 = weights1x.find((w) => w.norm === norm);
      const slotAdj = weightsAdj.find((w) => w.norm === norm);
      const share1 = slot1 && totalPa1 > 0 ? slot1.pa / totalPa1 * 100 : null;
      const shareAdj = slotAdj && totalPaAdj > 0 ? slotAdj.pa / totalPaAdj * 100 : null;
      const offenseBoost = off1 != null && offAdj != null && Number.isFinite(off1) && Number.isFinite(offAdj) ? offAdj - off1 : null;
      const runProdBoost = run1 != null && runAdj != null && Number.isFinite(run1) && Number.isFinite(runAdj) ? runAdj - run1 : null;
      const secondTurnPct = Math.round(secondTurn.weight * 100);
      return {
        offensiveRating: rating != null && Number.isFinite(rating) ? rating : null,
        offensiveRatingLabel: formatSignedNumber(rating),
        runProd2026: runProd,
        runProdLabel: runProd != null ? runProd.toFixed(3) : null,
        offenseRatingBoost: offenseBoost,
        offenseRatingBoostLabel: formatSignedNumber(offenseBoost),
        runProdBoost,
        runProdBoostLabel: runProdBoost != null ? formatSignedNumber(runProdBoost, 3) : null,
        lineupSharePctOneTurn: share1 != null ? Math.round(share1 * 10) / 10 : null,
        lineupSharePctTwoTurns: shareAdj != null ? Math.round(shareAdj * 10) / 10 : null,
        secondTurnWeight: secondTurn.weight,
        secondTurnPct,
        missingNames: secondTurn.missingNames,
        missingNamesLabel: secondTurn.missingNames.join(", "),
        replacementRating: secondTurn.replacementRating,
        replacementRatingLabel: formatSignedNumber(secondTurn.replacementRating),
        gapRating: secondTurn.gapRating,
        gapRatingLabel: formatSignedNumber(secondTurn.gapRating),
        comparisonVerdict: secondTurn.verdict
      };
    }
    function alertWithDoubleBatter(base, doubleBatter, impact) {
      if (!doubleBatter) return base;
      return {
        ...base,
        doubleBatter: {
          ...doubleBatter,
          impact
        }
      };
    }
    function enrichRosterForMatchupView(rosterEntry, offenseRatingByNorm, missingSet, normalizeName, stats2026ByPlayer = /* @__PURE__ */ new Map(), positionByNorm = null, byOriginalNorm = null) {
      if (!rosterEntry) return rosterEntry;
      const playerNames = rosterEntry.players || [];
      const entries = byOriginalNorm?.size ? buildRosterEntriesWithReplacements2(
        playerNames,
        normalizeName,
        positionByNorm,
        byOriginalNorm
      ) : rosterEntriesFromNames(playerNames, normalizeName, positionByNorm);
      const doubleBatter = resolveDoubleBatter(entries, missingSet);
      const activeEntries = entries.filter((e) => !missingSet.has(e.norm));
      const playersDetailed = entries.map((e) => ({
        ...e,
        rating: offenseRatingByNorm.get(e.norm) ?? null,
        missing: missingSet.has(e.norm),
        hitsTwice: doubleBatter != null && doubleBatter.norm === e.norm
      }));
      const active = playersDetailed.filter((p) => !p.missing);
      const bench = playersDetailed.filter((p) => p.missing);
      const lineupAlerts = evaluateMissingPlayerRules(
        entries,
        missingSet,
        offenseRatingByNorm,
        stats2026ByPlayer
      );
      return {
        ...rosterEntry,
        playersDetailed,
        bench,
        activeCount: active.length,
        lineupAlerts,
        doubleBatter
      };
    }
    function evaluateMissingPlayerRules(entries, missingSet, offenseRatingByNorm = /* @__PURE__ */ new Map(), stats2026ByPlayer = /* @__PURE__ */ new Map()) {
      const alerts = [];
      const present = entries.filter((e) => !missingSet.has(e.norm));
      const missing = entries.filter((e) => missingSet.has(e.norm));
      const presentCount = present.length;
      const fieldingCount = fieldingPresentCount(present, entries);
      const doubleBatter = resolveDoubleBatter(entries, missingSet);
      const impact = doubleBatter && offenseRatingByNorm.size ? buildDoubleBatterImpact(
        doubleBatter,
        present,
        missing,
        offenseRatingByNorm,
        stats2026ByPlayer
      ) : null;
      if (presentCount <= FORFEIT_PLAYER_COUNT) {
        alerts.push({
          severity: "critical",
          kind: "forfeit",
          title: "Forfeit",
          message: "MMS bylaws: a team reduced to 7 players shall forfeit. The model treats this roster as non-viable."
        });
      } else if (presentCount < MIN_PLAYERS_TO_START) {
        alerts.push({
          severity: "critical",
          kind: "below-minimum",
          title: "Below minimum to start",
          message: `Only ${presentCount} active players. MMS bylaws require at least ${MIN_PLAYERS_TO_START} to start a game.`
        });
      }
      if (presentCount < C_PLAYER_RULE_MIN_ACTIVE) {
        alerts.push({
          severity: "info",
          kind: "below-c-rule",
          title: "C-player rule not in effect",
          message: `MMS bylaws: the C-player missing rule applies only with ${C_PLAYER_RULE_MIN_ACTIVE} or more active players. With ${presentCount} active, no one bats twice under the C rule.`
        });
      }
      if (presentCount === 8) {
        alerts.push({
          severity: "info",
          kind: "eight-player",
          title: "Eight-player lineup",
          message: "MMS bylaws: when playing with 8 players, no player is required to bat twice."
        });
      }
      if (presentCount === 9) {
        alerts.push({
          severity: "info",
          kind: "nine-player",
          title: "Nine-player lineup",
          message: "MMS bylaws: the C-player missing rule applies to 9-player lineups (no 2026 11-batter mean rule)."
        });
      }
      if (presentCount === 10 && missing.length === 3) {
        alerts.push({
          severity: "rule",
          kind: "eleven-spots",
          title: "11 batting spots required",
          message: "MMS bylaws (2026): with 10 players present, the lineup must bat 11 spots (C-player rule or mean missing draft round)."
        });
      }
      if (doubleBatter) {
        alerts.push(
          alertWithDoubleBatter(
            {
              severity: "rule",
              kind: "double-batter",
              title: doubleBatter.ruleLabel,
              message: `${doubleBatter.name} (round ${doubleBatter.round}) takes the extra turn in the batting order.`
            },
            doubleBatter,
            impact
          )
        );
      } else if (presentCount === 10 && missing.length === 3) {
        alerts.push({
          severity: "warning",
          kind: "eleven-spots-unresolved",
          title: "11th batter not resolved",
          message: "Ten active with three bench players, but no double batter could be determined from the roster draft order."
        });
      }
      if (fieldingCount < FIELDING_SPOTS) {
        const detail = rosterHasPositionData(entries) ? `${fieldingCount} defensive position${fieldingCount === 1 ? "" : "s"} covered` : `${presentCount} players available`;
        alerts.push({
          severity: "warning",
          kind: "roster-warning",
          title: "Short-handed",
          message: `Only ${detail} (fewer than ${FIELDING_SPOTS} fielding spots). Defense weakens sharply and projected runs against this team rise exponentially for each missing fielder.`
        });
      }
      return alerts;
    }
    function paWeightedFromWeights(weights, valueFn) {
      let num = 0;
      let den = 0;
      for (const w of weights) {
        const v = valueFn(w);
        if (v == null || !Number.isFinite(v)) continue;
        num += v * w.pa;
        den += w.pa;
      }
      if (den <= 0) return null;
      return num / den;
    }
    function activeFieldingWeights(activeEntries, offenseRatingByNorm, stats2026ByPlayer, doubleBatterNorm = null, secondTurnWeight = 0) {
      let pool = activeEntries;
      if (pool.length > FIELDING_SPOTS) {
        pool = [...pool].sort(
          (a, b) => (offenseRatingByNorm.get(b.norm) ?? -999) - (offenseRatingByNorm.get(a.norm) ?? -999)
        ).slice(0, FIELDING_SPOTS);
      }
      const extra = secondTurnWeight > 0 && Number.isFinite(secondTurnWeight) ? Math.min(1, secondTurnWeight) : 0;
      return pool.map((e) => {
        const row = stats2026ByPlayer.get(e.norm);
        const paRaw = row ? Number(row.PA) : 0;
        let pa = paRaw > 0 ? paRaw : 1;
        if (doubleBatterNorm && e.norm === doubleBatterNorm && extra > 0) {
          pa *= 1 + extra;
        }
        return { norm: e.norm, name: e.name, pa, round: e.round };
      });
    }
    var DRAFT_ROUND_MEDIAN = 6.5;
    var SHORT_HANDED_DEFENSE_CRUSH_BASE = 0.38;
    var SHORT_HANDED_RUNS_AGAINST_BY_SLOTS = Object.freeze({
      1: 1.4,
      2: 2,
      3: 2.7,
      4: 3.5
    });
    function shortHandedRunsAgainstMultiplier(slotsShort) {
      if (slotsShort <= 0) return 1;
      if (slotsShort >= 4) return SHORT_HANDED_RUNS_AGAINST_BY_SLOTS[4];
      return SHORT_HANDED_RUNS_AGAINST_BY_SLOTS[slotsShort] ?? 3.5;
    }
    function draftRoundWeight(round) {
      return Math.max(0.06, (14 - round) / 13);
    }
    function averageMissingRound(missing) {
      if (!missing.length) return null;
      return missing.reduce((s, m) => s + m.round, 0) / missing.length;
    }
    function averageTeamOffenseRating(entries, offenseRatingByNorm) {
      if (!entries?.length) return 0;
      let sum = 0;
      let n = 0;
      for (const e of entries) {
        const r = offenseRatingByNorm.get(e.norm);
        if (r != null && Number.isFinite(r)) {
          sum += r;
          n += 1;
        }
      }
      return n > 0 ? sum / n : 0;
    }
    var BENCH_VS_AVG_SENSITIVITY = 0.68;
    function benchIdentityWeight(missingCount) {
      if (missingCount <= 0) return 0;
      if (missingCount === 1) return 0.42;
      return Math.min(0.92, 0.42 + 0.22 * (missingCount - 1));
    }
    function blendBenchIdentity(benchFactor, missingCount) {
      const w = benchIdentityWeight(missingCount);
      return 1 + (benchFactor - 1) * w;
    }
    function compoundBenchMultiplier(missing, offenseRatingByNorm, teamAvg) {
      let mult = 1;
      let starsBenched = 0;
      for (const m of missing) {
        const raw = offenseRatingByNorm.get(m.norm);
        const rating = raw != null && Number.isFinite(raw) ? raw : teamAvg;
        const gap = rating - teamAvg;
        if (gap > 0) {
          starsBenched += 1;
          const starEscalation = 1 + 0.58 * (starsBenched - 1);
          mult *= Math.exp(-gap * BENCH_VS_AVG_SENSITIVITY * starEscalation);
        } else if (gap < 0) {
          mult *= Math.exp(-gap * BENCH_VS_AVG_SENSITIVITY * 0.72);
        }
      }
      if (starsBenched >= 2) {
        mult *= Math.pow(0.87, starsBenched - 1);
      }
      return mult;
    }
    function playerTalentScore(m, offenseRatingByNorm) {
      const rating = offenseRatingByNorm.get(m.norm);
      const r = rating != null && Number.isFinite(rating) ? rating : 0;
      const roundScore = (DRAFT_ROUND_MEDIAN - m.round) / DRAFT_ROUND_MEDIAN;
      const ratingScore = r / 1.75;
      return 0.52 * ratingScore + 0.48 * roundScore;
    }
    function computeTeamMissingMultiplier(missing, activeEntries, offenseRatingByNorm, allEntries = null) {
      const entries = allEntries || [...activeEntries || [], ...missing || []];
      const fieldingPresent = fieldingPresentCount(activeEntries || [], entries);
      const teamAvg = averageTeamOffenseRating(entries, offenseRatingByNorm);
      if (!missing.length) {
        return {
          offense: 1,
          run: 1,
          defense: 1,
          runsAgainst: 1,
          regime: "full",
          avgMissingRound: null,
          roundGap: 0,
          slotsShort: 0
        };
      }
      const avgRound = averageMissingRound(missing);
      const roundGap = avgRound != null ? DRAFT_ROUND_MEDIAN - avgRound : 0;
      if (fieldingPresent >= FIELDING_SPOTS) {
        const mult = Math.max(0.38, Math.min(1.48, compoundBenchMultiplier(missing, offenseRatingByNorm, teamAvg)));
        return {
          offense: mult,
          run: mult,
          defense: mult,
          runsAgainst: 1,
          regime: "lineup-adjust",
          avgMissingRound: avgRound,
          roundGap,
          slotsShort: 0
        };
      }
      const slotsShort = FIELDING_SPOTS - fieldingPresent;
      const fielderBase = Math.pow(0.52, slotsShort);
      const qualityMod = Math.max(
        0.58,
        Math.min(1.55, compoundBenchMultiplier(missing, offenseRatingByNorm, teamAvg))
      );
      let offenseMult = fielderBase * qualityMod;
      offenseMult = Math.max(0.08, Math.min(0.88, offenseMult));
      const defenseMult = Math.max(
        0.04,
        Math.min(0.55, Math.pow(SHORT_HANDED_DEFENSE_CRUSH_BASE, slotsShort) * Math.pow(qualityMod, 0.85))
      );
      const runsAgainstMult = shortHandedRunsAgainstMultiplier(slotsShort);
      return {
        offense: offenseMult,
        run: offenseMult * 0.95,
        defense: defenseMult,
        runsAgainst: runsAgainstMult,
        regime: "short-handed",
        avgMissingRound: avgRound,
        roundGap,
        slotsShort
      };
    }
    function applyMissingPlayersToProfile2(baseProfile, rosterPlayerNames, missingSet, offenseRatingByNorm, stats2026ByPlayer, defenseZByNorm, normalizeName, positionByNorm = null) {
      const entries = rosterEntriesFromNames(rosterPlayerNames, normalizeName, positionByNorm);
      const active = entries.filter((e) => !missingSet.has(e.norm));
      const missing = entries.filter((e) => missingSet.has(e.norm));
      const presentCount = active.length;
      const fieldingPresent = fieldingPresentCount(active, entries);
      const doubleBatter = resolveDoubleBatter(entries, missingSet);
      const secondTurn = doubleBatter ? evaluateSecondTurnWeight(doubleBatter, missing, offenseRatingByNorm, stats2026ByPlayer) : { weight: 0 };
      const weights = activeFieldingWeights(
        active,
        offenseRatingByNorm,
        stats2026ByPlayer,
        doubleBatter ? doubleBatter.norm : null,
        secondTurn.weight
      );
      const offenseRating = paWeightedFromWeights(weights, (w) => offenseRatingByNorm.get(w.norm));
      const runProd2026 = paWeightedFromWeights(weights, (w) => {
        const row = stats2026ByPlayer.get(w.norm);
        const pa = row ? Number(row.PA) : 0;
        if (pa <= 0) return null;
        return (Number(row.Runs) + Number(row.RBI)) / pa;
      });
      const defenseZ = paWeightedFromWeights(weights, (w) => {
        const z = defenseZByNorm.get(w.norm);
        return z != null && Number.isFinite(z) ? z : null;
      });
      const teamMult = computeTeamMissingMultiplier(
        missing,
        active,
        offenseRatingByNorm,
        entries
      );
      const anchorOff = baseProfile.offenseRating != null && Number.isFinite(baseProfile.offenseRating) ? baseProfile.offenseRating : offenseRating ?? 0;
      const anchorRun = baseProfile.runProd2026 != null && Number.isFinite(baseProfile.runProd2026) ? baseProfile.runProd2026 : runProd2026 ?? 0;
      const anchorDef = baseProfile.defenseZ != null && Number.isFinite(baseProfile.defenseZ) ? baseProfile.defenseZ : defenseZ ?? 0;
      const rosterOff = offenseRating ?? anchorOff;
      const rosterRun = runProd2026 ?? anchorRun;
      const rosterDef = defenseZ ?? anchorDef;
      let lineupHoleDrag = 0;
      if (doubleBatter && missing.length > 0 && secondTurn.weight < 0.45) {
        lineupHoleDrag = (0.45 - secondTurn.weight) * 0.45 * Math.min(missing.length, 5);
      }
      const rosterOffFactor = anchorOff > 0 ? rosterOff / anchorOff : 1;
      const rosterRunFactor = anchorRun > 0 ? rosterRun / anchorRun : 1;
      const rosterDefFactor = anchorDef !== 0 ? rosterDef / anchorDef : 1;
      let offenseMult = teamMult.offense;
      let runMult = teamMult.run;
      if (teamMult.regime === "lineup-adjust") {
        const identityMult = blendBenchIdentity(teamMult.offense, missing.length);
        offenseMult = identityMult;
        runMult = identityMult;
      }
      const runScale = Math.pow(offenseMult, 0.9);
      const adjustedOffense = Math.max(
        -0.2,
        anchorOff * rosterOffFactor * offenseMult - lineupHoleDrag
      );
      const adjustedRunProd = anchorRun * rosterRunFactor * runMult;
      const adjustedDefense = teamMult.regime === "lineup-adjust" ? anchorDef * rosterDefFactor : rosterDef * teamMult.defense;
      const baseTeam = baseProfile.teamOverall;
      const adjustedTeamOverall = baseTeam != null && Number.isFinite(baseTeam) && anchorOff > 0 ? baseTeam * rosterOffFactor * offenseMult : baseTeam;
      const runsPerGame = baseProfile.runsPerGame != null && Number.isFinite(baseProfile.runsPerGame) ? baseProfile.runsPerGame * runScale : baseProfile.runsPerGame;
      const runsAgainstMult = teamMult.runsAgainst ?? 1;
      const runsAgainstPerGame = baseProfile.runsAgainstPerGame != null && Number.isFinite(baseProfile.runsAgainstPerGame) ? baseProfile.runsAgainstPerGame * runsAgainstMult : baseProfile.runsAgainstPerGame;
      const lineupAlerts = evaluateMissingPlayerRules(
        entries,
        missingSet,
        offenseRatingByNorm,
        stats2026ByPlayer
      );
      return {
        ...baseProfile,
        offenseRating: adjustedOffense,
        runProd2026: adjustedRunProd,
        defenseZ: adjustedDefense,
        runsPerGame,
        runsAgainstPerGame,
        teamOverall: adjustedTeamOverall,
        rosterPlayerRating: adjustedOffense,
        presentCount,
        fieldingPresentCount: fieldingPresent,
        missingCount: missing.length,
        lineupAlerts,
        teamMultiplier: anchorOff > 0 ? Math.max(0.01, adjustedOffense / anchorOff) : teamMult.offense,
        defenseMultiplier: teamMult.defense,
        runsAgainstMultiplier: runsAgainstMult,
        shortHandedSlots: teamMult.slotsShort ?? 0
      };
    }
    function presentCountForWinCap(profile) {
      const n = profile?.presentCount;
      if (n != null && Number.isFinite(n)) return n;
      return MIN_VIABLE_ACTIVE_PLAYERS;
    }
    function criticalRosterRunTargets(presentCount) {
      const slotsBelow = Math.max(0, MIN_VIABLE_ACTIVE_PLAYERS - presentCount);
      return {
        teamRuns: Math.max(2, 5.5 - slotsBelow * 1.25),
        allowRuns: Math.min(22, 15 + slotsBelow * 3.5)
      };
    }
    function applyCriticalRosterRunProjection(awayProfile, homeProfile, awayRuns, homeRuns) {
      const awayN = presentCountForWinCap(awayProfile);
      const homeN = presentCountForWinCap(homeProfile);
      const awayCritical = awayN < MIN_VIABLE_ACTIVE_PLAYERS;
      const homeCritical = homeN < MIN_VIABLE_ACTIVE_PLAYERS;
      if (!awayCritical && !homeCritical) {
        return { away: awayRuns, home: homeRuns };
      }
      function applyPair(criticalN, criticalSideRuns, healthySideRuns) {
        const { teamRuns, allowRuns } = criticalRosterRunTargets(criticalN);
        return {
          critical: Math.min(criticalSideRuns, teamRuns),
          healthy: Math.max(healthySideRuns, allowRuns)
        };
      }
      if (awayCritical && !homeCritical) {
        const p2 = applyPair(awayN, awayRuns, homeRuns);
        return { away: p2.critical, home: p2.healthy };
      }
      if (homeCritical && !awayCritical) {
        const p2 = applyPair(homeN, homeRuns, awayRuns);
        return { away: p2.healthy, home: p2.critical };
      }
      if (awayN < homeN) {
        const p2 = applyPair(awayN, awayRuns, homeRuns);
        return { away: p2.critical, home: p2.healthy };
      }
      if (homeN < awayN) {
        const p2 = applyPair(homeN, homeRuns, awayRuns);
        return { away: p2.healthy, home: p2.critical };
      }
      if (awayRuns <= homeRuns) {
        const p2 = applyPair(awayN, awayRuns, homeRuns);
        return { away: p2.critical, home: p2.healthy };
      }
      const p = applyPair(homeN, homeRuns, awayRuns);
      return { away: p.healthy, home: p.critical };
    }
    function applyCriticalRosterWinCap(awayProfile, homeProfile, pAway, pHome) {
      const awayN = presentCountForWinCap(awayProfile);
      const homeN = presentCountForWinCap(homeProfile);
      const awayCritical = awayN < MIN_VIABLE_ACTIVE_PLAYERS;
      const homeCritical = homeN < MIN_VIABLE_ACTIVE_PLAYERS;
      const cap = MAX_WIN_FRACTION_CRITICAL_ROSTER;
      const floor = 1 - cap;
      if (!awayCritical && !homeCritical) {
        return { away: pAway, home: pHome };
      }
      if (awayCritical && !homeCritical) {
        const away = Math.min(pAway, cap);
        return { away, home: 1 - away };
      }
      if (homeCritical && !awayCritical) {
        const home = Math.min(pHome, cap);
        return { away: 1 - home, home };
      }
      if (awayN < homeN) {
        return { away: cap, home: floor };
      }
      if (homeN < awayN) {
        return { away: floor, home: cap };
      }
      if (pAway <= pHome) {
        return { away: cap, home: floor };
      }
      return { away: floor, home: cap };
    }
    module.exports = {
      DRAFT_ROUND_MEDIAN,
      ROSTER_FULL_SIZE,
      MIN_PLAYERS_TO_START,
      FORFEIT_PLAYER_COUNT,
      B_PLAYER_ROUNDS,
      MIN_VIABLE_ACTIVE_PLAYERS,
      MAX_WIN_FRACTION_CRITICAL_ROSTER,
      applyCriticalRosterWinCap,
      applyCriticalRosterRunProjection,
      criticalRosterRunTargets,
      SHORT_HANDED_RUNS_AGAINST_BY_SLOTS,
      shortHandedRunsAgainstMultiplier,
      SHORT_HANDED_DEFENSE_CRUSH_BASE,
      playerTalentScore,
      computeTeamMissingMultiplier,
      C_PLAYER_ROUNDS,
      C_PLAYER_RULE_MIN_ACTIVE,
      FIELDING_SPOTS,
      parseMissingNorms,
      serializeMissingNorms,
      rosterEntriesFromNames,
      resolveDoubleBatter,
      evaluateSecondTurnWeight,
      buildDoubleBatterImpact,
      enrichRosterForMatchupView,
      evaluateMissingPlayerRules,
      applyMissingPlayersToProfile: applyMissingPlayersToProfile2,
      fieldingPresentCount,
      positionFromMap
    };
  }
});

// lib/matchupLineupClient.js
var require_matchupLineupClient = __commonJS({
  "lib/matchupLineupClient.js"(exports, module) {
    "use strict";
    var { normalizePlayerName: normalizePlayerName2 } = require_dfs();
    var { enrichRosterForMatchupView } = require_matchupMissingPlayers();
    function mapFromObject2(obj) {
      return new Map(Object.entries(obj || {}));
    }
    function buildSideLineupState(playersOriginal, teamName, benchNorms, ctxMaps, byOriginalNorm) {
      const missingSet = new Set(
        (benchNorms || []).map((n) => normalizePlayerName2(n)).filter(Boolean)
      );
      const rosterEntry = { players: playersOriginal || [], teamName: teamName || "" };
      return enrichRosterForMatchupView(
        rosterEntry,
        ctxMaps.offenseRatingByNorm,
        missingSet,
        normalizePlayerName2,
        ctxMaps.stats2026ByPlayer,
        ctxMaps.positionByNorm,
        byOriginalNorm
      );
    }
    function alertsForSide(roster, teamSide, teamName) {
      return (roster?.lineupAlerts || []).map((a) => ({
        ...a,
        teamSide,
        teamName: teamName || roster?.teamName || ""
      }));
    }
    function replacementMapFromCtx(ctx) {
      const raw = ctx?.replacementByOriginalNorm;
      if (!raw || typeof raw !== "object") return null;
      const map = /* @__PURE__ */ new Map();
      for (const [norm, entry] of Object.entries(raw)) {
        if (entry?.replacementNorm) map.set(norm, entry);
      }
      return map.size ? map : null;
    }
    function buildMatchupLineupEnrichment2(ctx, awayBenchNorms, homeBenchNorms) {
      const offenseRatingByNorm = mapFromObject2(ctx.offenseRatingByNorm);
      const stats2026ByPlayer = mapFromObject2(ctx.stats2026ByPlayer);
      const positionByNorm = mapFromObject2(ctx.positionByNorm);
      const maps = { offenseRatingByNorm, stats2026ByPlayer, positionByNorm };
      const awayName = ctx.awayLabel || "Away";
      const homeName = ctx.homeLabel || "Home";
      const byOriginalNorm = replacementMapFromCtx(ctx);
      const awayOriginal = ctx.awayPlayersOriginal || ctx.awayPlayers;
      const homeOriginal = ctx.homePlayersOriginal || ctx.homePlayers;
      const away = buildSideLineupState(awayOriginal, awayName, awayBenchNorms, maps, byOriginalNorm);
      const home = buildSideLineupState(homeOriginal, homeName, homeBenchNorms, maps, byOriginalNorm);
      const lineupRuleAlerts = [
        ...alertsForSide(away, "away", awayName),
        ...alertsForSide(home, "home", homeName)
      ];
      return { away, home, lineupRuleAlerts };
    }
    module.exports = {
      buildMatchupLineupEnrichment: buildMatchupLineupEnrichment2
    };
  }
});

// data/customRosters2026.js
var require_customRosters2026 = __commonJS({
  "data/customRosters2026.js"(exports, module) {
    var TEAM_ORDER = [12, 9, 4, 2, 7, 15, 1, 3, 5, 6, 8, 10, 11, 13, 14, 16, 17, 18];
    var RAW_PLAYERS = `
Anthony Dimarco
Darren Saler
Rich Acerra
Connor Schmidt
Evan Rosenthal
Andrew Bianchi
Zach Schmidt
Frank LaRocca
Aaron Williams
Zachary Kane
Mike Cornacchia
Mark Karp
Stephen Epstein
Martin Blackburn
Zack Derosa
Ronnie Carlin
Brad Goldstein
Eric Rosenstock
Brett Easton
Marc Carlin
Bob Bilodeau
Mike Rosenstock
Steven Oran
Shawn Adelsberg
Lenny Sarcona
Logan Fauci
Dennis Oconnor
Chris Baldino
Justin Bykofsky
Nick Dinapoli
Jason Feingold
Robbie Juergens
Chip Costa
Seamus Coyle
John Maguire
Carlo Tanzola
Ken Feingold
John Fisher
Darren Wald
Gregory Deluise
Mike Conti
Mat Manochio
Lucas Preiss
Nick Deluise
Dan Manochio Jr
Patrick Thomas
Stephen Milhaven
Dan Manochio Sr
Michael Podolla
Ryan Ramirez
Tom Bongiovani
Raymond Porzio
Phil Corde
Ed Fradkin
Patrick Brock
Joe Picarello
Rob Corde
Nolan Ruthberg
Gary Szemcsak
Cameron Gille
Dylan Jacoby
Pat Pingaro
Justin Jacoby
Marc Persily
Jonathan Okun
Steve Santigate
Kyle Dunleavy
Seth Drashinsky
Jared Koshefsky
Max Allegretti
Dan Drashinsky
Jordan Brent
Justin Krauss
Kurt Schmidt
Russ Krauss
Matthew Leiggi
David Drashinsky
John Tesoriero
Nick Martino
Phillip Kuhner
Joel Zaretsky
Mitch Pollock
Austin Silverberg
Edwin Valentin
Matt Pollock
Holden Silverberg
Bryan Thompson
Mike Ferrarese
Josh Garcia
Rob Rozencwaig
Steven Frey
David Vignapiano
Fred Lugos
Mark Magariello
Mike Brullo
Matt Granese
Billy Loschiavo
Dave Wagreich
Todd Wallman
Ryan Wallman
Mike Steinberg
Dhimant Balar
Sudipta Ray
Paul Steinberg
Vince Caputo
Peter Kwiecinski
Joe Peragine
Joe Caputo
Evan Abramson
Jeff Goddard
Mark Goddard
Lawrence Rubin
Michael Weitsen
Michael Cruz
Justin Randell
Bruce Cotter
Brad Randell
Tom Carroll
Aj Ortiz
Tony Roegiers
Justin Colarocco
Jake Woloshyn
Ian Mcdermott
Kevin Murch
Nick Lapetina
Chris Karulski
Jake Kroese
Doug Cohen
Mike Iorio
Jerry Tilker
Eric Bomenblit
Michael Bernstein
Joe Tracey
Richie Bomenblit
Steve Ushkowitz
Jeff Martinez
Jeff Friedman
Rick Schindelheim
Emile Rythmel
Josh Walker
Joe Demaio
Brian Walker
Paul Kamras
Pablo Gonzales
Matt Hill
Mark Yutko
Jon Hempstead
Aj Greenspan
Adam Greenspan
Evan Steinberg
Andy Kessler
Ben Kessler
Steve Messina
Marcus Baquero
Daniel Kessler
David Unterweiser
Michael Kleschinsky Jr
Nick Villani
Mike Klecko
Kevin Kleschinsky
Jeremy Levine
Pete Kokoszka
Mike Villani
Jim Lombardi
Michael Kleschinsky Sr
Will Perez
Anthony Fazzino
Paul Lombardi
Nick Kleschinsky
Jeremy Paster
Anthony Foster
Ronnie Pacheco
Jordan Rosenthal
Brandon Tornetta
Juan Gallardo
Mike Ballo
Glen Marrone
Shawon Danser
Jordan Krant
Steven Wallenstein
David Kiste
Gary Klein
Ryan Amato
Shawn Leonardi
Bryan Frank
Dom Defalco
Espartaco Gonzalez
Piero Vescio
Dave Meyer
Jeff Mendelson
Craig Tepper
Daniel Navatta
Anthony Galiano
Mike Amato
Brian Frueh
Mike Santaromita
Christian Gaglio
Dave Polzer
Joe Pargament
Ryan Cumber
Andy Pargament
Rich Allen
Jeff Arnold
Brock Hor
Joel Podos
Lou Baffuto
Ralph Calabro
Jay Podos
Cole Fluta
Eric Becker
Joe Mamone
Jeff Beja
Matt Whelen
Alex Goldfarb
James Pezzulo
Chris Curti
Jesse Panassidi
Rich Hartly
Bill Chiusano
Reid Goldfarb
Joe Olivencia
Nick Turano
Eddie Fausak
Andrew Rodriguez
Anthony Turano
Joe Joraskie
Mike Heitzner
Joseph Lewicki
Jorge Rivera
Jake Heitzner
Vinny Spitaletto
Frank Ermel
Justin Bickoff
Pat Ciaglia
`;
    var PLAYERS = RAW_PLAYERS.split("\n").map((name) => name.trim()).filter(Boolean);
    if (PLAYERS.length !== 234) {
      throw new Error(`Expected 234 players, found ${PLAYERS.length}`);
    }
    var canonicalRostersByTeamId = {};
    TEAM_ORDER.forEach((teamId, teamIndex) => {
      const start = teamIndex * 13;
      const end = start + 13;
      canonicalRostersByTeamId[String(teamId)] = PLAYERS.slice(start, end);
    });
    module.exports = {
      canonicalRostersByTeamId
    };
  }
});

// lib/teamRosters.js
var require_teamRosters = __commonJS({
  "lib/teamRosters.js"(exports, module) {
    var Papa = require_papaparse_min();
    var { canonicalRostersByTeamId } = require_customRosters2026();
    var { fetchCsvText } = require_fetchCsvText();
    var { getIndexUrl, getRosterUrl } = require_sheetUrls();
    function safeText(value) {
      return (value || "").toString().trim();
    }
    async function fetchCsvRows(url) {
      const csvText = await fetchCsvText(url);
      return Papa.parse(csvText).data;
    }
    function buildTeamMap(indexRows) {
      const teamMap = /* @__PURE__ */ new Map();
      for (let i = 1; i < indexRows.length; i += 1) {
        const row = indexRows[i];
        const teamId = safeText(row[4]);
        const captain = safeText(row[5]);
        const teamName = safeText(row[7]);
        const jerseyColor = safeText(row[10]) || "#1f2937";
        const numberColor = safeText(row[11]) || "#ffffff";
        if (!teamId || !captain) continue;
        teamMap.set(teamId, { teamId, captain, teamName, jerseyColor, numberColor });
      }
      return teamMap;
    }
    function buildRosterByCaptain(rosterRows) {
      const rosterMap = /* @__PURE__ */ new Map();
      function extractRosterRange(captainRowIndex, playerStartRowIndex, startCol, endCol) {
        for (let col = startCol; col <= endCol; col += 1) {
          const captain = safeText(rosterRows[captainRowIndex] && rosterRows[captainRowIndex][col]);
          if (!captain) continue;
          const players = [];
          for (let r = playerStartRowIndex; r < playerStartRowIndex + 13; r += 1) {
            const player = safeText(rosterRows[r] && rosterRows[r][col]);
            if (player) players.push(player);
          }
          rosterMap.set(captain, players);
        }
      }
      extractRosterRange(1, 3, 0, 18);
      extractRosterRange(16, 18, 0, 18);
      return rosterMap;
    }
    function normalizeScheduleTeamId(id) {
      const n = Number(safeText(id).replace(/\s+/g, ""));
      return Number.isInteger(n) && n >= 1 && n <= 18 ? String(n) : safeText(id);
    }
    function normalizeScheduleTeamLabel(value) {
      return safeText(value).toLowerCase().replace(/\s+/g, " ").trim();
    }
    function buildNameToTeamIdMap(teams) {
      const nameToTeamId = {};
      for (const t of teams) {
        const key = normalizeScheduleTeamLabel(t.teamName);
        if (key && nameToTeamId[key] === void 0) nameToTeamId[key] = t.teamId;
      }
      return nameToTeamId;
    }
    function buildRosterByTeamId(teams) {
      const rosterByTeamId = {};
      for (const t of teams) {
        const entry = {
          teamName: t.teamName,
          captain: t.captain || "",
          jerseyColor: t.jerseyColor,
          numberColor: t.numberColor,
          players: Array.isArray(t.players) ? t.players : []
        };
        rosterByTeamId[String(t.teamId)] = entry;
        rosterByTeamId[normalizeScheduleTeamId(t.teamId)] = entry;
      }
      return rosterByTeamId;
    }
    function pickRosterEntry(rosterByTeamId, nameToTeamId, teamId, displayName) {
      const id = safeText(teamId);
      let entry = id && rosterByTeamId[id] ? rosterByTeamId[id] : null;
      if (entry && Array.isArray(entry.players) && entry.players.length) {
        return { ...entry, teamId: id };
      }
      const altKey = normalizeScheduleTeamLabel(displayName);
      const altId = altKey ? nameToTeamId[altKey] : null;
      const altEntry = altId != null && altId !== "" ? rosterByTeamId[String(altId)] : null;
      if (altEntry && Array.isArray(altEntry.players) && altEntry.players.length) {
        return { ...altEntry, teamId: String(altId) };
      }
      if (entry) return { ...entry, teamId: id };
      if (altEntry) return { ...altEntry, teamId: String(altId) };
      return {
        teamId: id || String(altId || ""),
        teamName: safeText(displayName) || "Team",
        captain: "",
        jerseyColor: "",
        numberColor: "",
        players: []
      };
    }
    function resolveTeamCaptain(teamId, teamName, teams) {
      const rosterByTeamId = buildRosterByTeamId(teams);
      const nameToTeamId = buildNameToTeamIdMap(teams);
      return pickRosterEntry(rosterByTeamId, nameToTeamId, teamId, teamName).captain || "";
    }
    async function loadTeamRosterContext() {
      const [indexUrl, rosterUrl] = await Promise.all([getIndexUrl(), getRosterUrl()]);
      const [indexRows, rosterRows] = await Promise.all([
        fetchCsvRows(indexUrl),
        fetchCsvRows(rosterUrl)
      ]);
      const teamMap = buildTeamMap(indexRows);
      const rosterByCaptain = buildRosterByCaptain(rosterRows);
      const teams = [];
      for (let id = 1; id <= 18; id += 1) {
        const teamId = String(id);
        const teamMeta = teamMap.get(teamId) || { teamId, captain: "", teamName: `Team ${teamId}` };
        const players = canonicalRostersByTeamId[teamId] || rosterByCaptain.get(teamMeta.captain) || [];
        teams.push({ ...teamMeta, players });
      }
      return { teams, rosterByCaptain };
    }
    async function loadTeamRosters() {
      const { teams } = await loadTeamRosterContext();
      return teams;
    }
    module.exports = {
      buildTeamMap,
      buildRosterByCaptain,
      buildNameToTeamIdMap,
      buildRosterByTeamId,
      pickRosterEntry,
      resolveTeamCaptain,
      loadTeamRosterContext,
      loadTeamRosters,
      normalizeScheduleTeamId,
      normalizeScheduleTeamLabel
    };
  }
});

// lib/matchupPredict.js
var require_matchupPredict = __commonJS({
  "lib/matchupPredict.js"(exports, module) {
    "use strict";
    var { normalizePlayerName: normalizePlayerName2 } = require_dfs();
    function toNumber(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    var { normalizeScheduleTeamId } = require_teamRosters();
    var {
      applyCriticalRosterRunProjection,
      applyCriticalRosterWinCap
    } = require_matchupMissingPlayers();
    function safeText(value) {
      return (value || "").toString().trim();
    }
    function finishedScheduleGameDedupeKey(g) {
      const awayId = normalizeScheduleTeamId(g.awayId);
      const homeId = normalizeScheduleTeamId(g.homeId);
      const gid = safeText(g.gameId);
      if (gid) return `gid|${gid}`;
      return `m|${g.isoDate || ""}|${[awayId, homeId].sort().join("|")}`;
    }
    var MATCHUP_LOGIT_SCALE = 0.6;
    var MATCHUP_HOME_FIELD_LOGIT = 0.1;
    var MATCHUP_WIN_WEIGHT_FROM_RUNS = 0.5;
    var MATCHUP_WIN_WEIGHT_FROM_TALENT = 0.25;
    var MATCHUP_WIN_WEIGHT_FROM_RECORD = 0.15;
    var MATCHUP_WIN_WEIGHT_FROM_POWER = 0.1;
    var MATCHUP_RECORD_PRIOR_GAMES = 6;
    var MATCHUP_RECORD_LOGIT_SCALE = 2.5;
    var MATCHUP_POWER_RANK_LOGIT_SCALE = 0.55;
    var MATCHUP_RUN_MARGIN_LOGIT = 0.29;
    var MATCHUP_RUN_LINE_WIN_SCALE = 1.05;
    var MATCHUP_WIN_PROB_SHRINK = 0.5;
    var SEASON_PROJ_RUN_MARGIN_LOGIT = 0.34;
    var SEASON_PROJ_LOGIT_SCALE = 0.72;
    var SEASON_PROJ_WIN_WEIGHT_FROM_RUNS = 0.8;
    var SEASON_PROJ_WIN_WEIGHT_FROM_TALENT = 0.2;
    var SEASON_PROJ_WIN_PROB_SHRINK = 0.82;
    var MATCHUP_POWER_WEIGHT_OFFENSE = 0.26;
    var MATCHUP_POWER_WEIGHT_RUN_PROD = 0.08;
    var MATCHUP_POWER_WEIGHT_RUNS_FOR = 0.12;
    var MATCHUP_POWER_WEIGHT_RUNS_AGAINST = 0.11;
    var MATCHUP_POWER_WEIGHT_RUN_DIFF = 0.07;
    var MATCHUP_POWER_WEIGHT_DEFENSE_Z = 0.08;
    var MATCHUP_POWER_WEIGHT_TEAM_OVERALL = 0.28;
    var MATCHUP_POWER_WEIGHT_SOS = 0.05;
    var MATCHUP_RUN_OFF_Z_PCT = 0.1;
    var MATCHUP_RUN_DEF_Z_PCT = 0.12;
    var MATCHUP_SCHEDULE_RUNS_BLEND = 0.5;
    var MATCHUP_SCHEDULE_DEFENSE_BLEND = 0.45;
    var MATCHUP_OPP_RUNS_AGAINST_SCALE = 0.72;
    var MATCHUP_SHORT_HANDED_RA_SCALE_MAX = 1.05;
    var MATCHUP_SHORT_HANDED_DEF_Z_PCT_MAX = 0.16;
    var MATCHUP_SHORT_HANDED_SCHEDULE_BLEND_FLOOR = 0.08;
    var MATCHUP_AWAY_RUN_FACTOR = 0.97;
    var MATCHUP_HOME_RUN_FACTOR = 1.03;
    var DEFAULT_LEAGUE_RUNS_PER_TEAM = 11.5;
    function opponentShortHandedSlots(profile) {
      const slots = profile?.shortHandedSlots;
      if (slots != null && Number.isFinite(slots) && slots > 0) return slots;
      const raMult = profile?.runsAgainstMultiplier;
      if (raMult != null && raMult > 1.01) return 1;
      return 0;
    }
    function matchupScheduleBlendWeight(attackerProfile, defenderProfile) {
      const slotsShort = opponentShortHandedSlots(defenderProfile);
      if (slotsShort <= 0 || attackerProfile?.runsPerGame == null || (attackerProfile?.scheduleGames ?? 0) < 2) {
        return MATCHUP_SCHEDULE_RUNS_BLEND;
      }
      return Math.max(
        MATCHUP_SHORT_HANDED_SCHEDULE_BLEND_FLOOR,
        MATCHUP_SCHEDULE_RUNS_BLEND - 0.11 * slotsShort
      );
    }
    function matchupOpponentDefenseScales(defenderProfile) {
      const slotsShort = opponentShortHandedSlots(defenderProfile);
      const raMult = defenderProfile?.runsAgainstMultiplier ?? 1;
      if (slotsShort <= 0) {
        return {
          runsAgainstScale: MATCHUP_OPP_RUNS_AGAINST_SCALE,
          defenseZScale: MATCHUP_RUN_DEF_Z_PCT
        };
      }
      const severity = Math.min(1, (raMult - 1) / 2.5);
      return {
        runsAgainstScale: MATCHUP_OPP_RUNS_AGAINST_SCALE + (MATCHUP_SHORT_HANDED_RA_SCALE_MAX - MATCHUP_OPP_RUNS_AGAINST_SCALE) * severity,
        defenseZScale: MATCHUP_RUN_DEF_Z_PCT + (MATCHUP_SHORT_HANDED_DEF_Z_PCT_MAX - MATCHUP_RUN_DEF_Z_PCT) * Math.min(1, slotsShort / 4)
      };
    }
    function rosterStatWeights(playerNames, stats2026ByPlayer) {
      return (playerNames || []).map((name) => {
        const norm = normalizePlayerName2(name);
        const row = stats2026ByPlayer.get(norm);
        const pa = row ? toNumber(row.PA) : 0;
        return { norm, name, pa: pa > 0 ? pa : 1 };
      });
    }
    function paWeightedAverage(weights, valueFn) {
      let num = 0;
      let den = 0;
      for (const w of weights) {
        const v = valueFn(w);
        if (v == null || !Number.isFinite(v)) continue;
        num += v * w.pa;
        den += w.pa;
      }
      return den > 0 ? num / den : null;
    }
    function meanAndStd(values) {
      const xs = values.filter((v) => v != null && Number.isFinite(v));
      if (!xs.length) return { mean: 0, std: 1 };
      const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
      const variance = xs.reduce((s, v) => s + (v - mean) ** 2, 0) / xs.length;
      return { mean, std: Math.sqrt(Math.max(variance, 1e-10)) };
    }
    function zFrom(value, mean, std) {
      if (value == null || !Number.isFinite(value)) return 0;
      return (value - mean) / std;
    }
    function leagueRunScoringBaseline(parsedGames) {
      const seen = /* @__PURE__ */ new Set();
      let totalRuns = 0;
      let games = 0;
      for (const g of parsedGames) {
        if (!Number.isFinite(g.awayScore) || !Number.isFinite(g.homeScore)) continue;
        const key = finishedScheduleGameDedupeKey(g);
        if (seen.has(key)) continue;
        seen.add(key);
        totalRuns += g.awayScore + g.homeScore;
        games += 1;
      }
      const avgTotal = games > 0 ? totalRuns / games : DEFAULT_LEAGUE_RUNS_PER_TEAM * 2;
      const avgPerTeam = avgTotal / 2;
      return {
        gamesSampled: games,
        avgTotalRuns: avgTotal,
        avgRunsPerTeam: avgPerTeam,
        avgRunsAgainstPerGame: avgPerTeam
      };
    }
    function buildTeamScheduleRunRates(parsedGames, teams) {
      const rec = /* @__PURE__ */ new Map();
      for (const t of teams) {
        const id = normalizeScheduleTeamId(t.teamId);
        rec.set(id, { runsFor: 0, runsAgainst: 0, games: 0 });
      }
      const seen = /* @__PURE__ */ new Set();
      for (const g of parsedGames) {
        if (!Number.isFinite(g.awayScore) || !Number.isFinite(g.homeScore)) continue;
        const key = finishedScheduleGameDedupeKey(g);
        if (seen.has(key)) continue;
        seen.add(key);
        const awayId = normalizeScheduleTeamId(g.awayId);
        const homeId = normalizeScheduleTeamId(g.homeId);
        if (!rec.has(awayId) || !rec.has(homeId)) continue;
        rec.get(awayId).runsFor += g.awayScore;
        rec.get(awayId).runsAgainst += g.homeScore;
        rec.get(awayId).games += 1;
        rec.get(homeId).runsFor += g.homeScore;
        rec.get(homeId).runsAgainst += g.awayScore;
        rec.get(homeId).games += 1;
      }
      const rates = /* @__PURE__ */ new Map();
      for (const [id, r] of rec.entries()) {
        const g = r.games;
        rates.set(id, {
          gamesPlayed: g,
          runsFor: r.runsFor,
          runsAgainst: r.runsAgainst,
          runsPerGame: g > 0 ? r.runsFor / g : null,
          runsAgainstPerGame: g > 0 ? r.runsAgainst / g : null,
          runDiffPerGame: g > 0 ? (r.runsFor - r.runsAgainst) / g : null
        });
      }
      return rates;
    }
    function buildDefenseZByNorm(defenseMap, stats2026ByPlayer) {
      const raw = [];
      for (const [norm, def] of defenseMap.entries()) {
        if (Number.isFinite(def)) raw.push(def);
      }
      const { mean, std } = meanAndStd(raw);
      const zByNorm = /* @__PURE__ */ new Map();
      for (const [norm, def] of defenseMap.entries()) {
        if (!Number.isFinite(def)) continue;
        zByNorm.set(norm, zFrom(def, mean, std));
      }
      return { zByNorm, mean, std };
    }
    function buildTeamMatchupProfiles(teams, rosterByTeamId, offenseRatingByNorm, stats2026ByPlayer, defenseZByNorm, standingsMap, teamOverallById, scheduleRunRates) {
      const profiles = /* @__PURE__ */ new Map();
      for (const t of teams) {
        const sid = normalizeScheduleTeamId(t.teamId);
        const roster = rosterByTeamId[t.teamId] || rosterByTeamId[sid] || { players: t.players || [] };
        const weights = rosterStatWeights(roster.players || t.players, stats2026ByPlayer);
        const offenseRating = paWeightedAverage(weights, (w) => offenseRatingByNorm.get(w.norm));
        const runProd2026 = paWeightedAverage(weights, (w) => {
          const row = stats2026ByPlayer.get(w.norm);
          const pa = row ? toNumber(row.PA) : 0;
          if (pa <= 0) return null;
          return (toNumber(row.Runs) + toNumber(row.RBI)) / pa;
        });
        const defenseZ = paWeightedAverage(weights, (w) => {
          const z = defenseZByNorm.get(w.norm);
          return z != null && Number.isFinite(z) ? z : null;
        });
        const st = standingsMap?.get(sid);
        const overall = teamOverallById.get(sid) ?? teamOverallById.get(t.teamId);
        const rr = scheduleRunRates?.get(sid);
        profiles.set(sid, {
          teamId: sid,
          teamName: roster.teamName || t.teamName,
          offenseRating,
          runProd2026,
          defenseZ: defenseZ ?? 0,
          wins: st?.wins ?? 0,
          losses: st?.losses ?? 0,
          gamesPlayed: st?.gamesPlayed ?? 0,
          winPct: st?.winPct ?? null,
          sosOppWinPct: st?.sosOppWinPct ?? null,
          teamOverall: overall?.teamOffenseRating ?? null,
          rosterPlayerRating: offenseRating,
          scheduleGames: rr?.gamesPlayed ?? 0,
          runsPerGame: rr?.runsPerGame ?? null,
          runsAgainstPerGame: rr?.runsAgainstPerGame ?? null,
          runDiffPerGame: rr?.runDiffPerGame ?? null
        });
      }
      return profiles;
    }
    function buildMatchupLeagueNorms(profiles) {
      const list = [...profiles.values()];
      return {
        offense: meanAndStd(list.map((p) => p.offenseRating)),
        runProd: meanAndStd(list.map((p) => p.runProd2026)),
        runsPerGame: meanAndStd(list.map((p) => p.runsPerGame)),
        runsAgainstPerGame: meanAndStd(list.map((p) => p.runsAgainstPerGame)),
        teamOverall: meanAndStd(list.map((p) => p.teamOverall)),
        winPct: meanAndStd(list.map((p) => p.winPct)),
        sos: meanAndStd(list.map((p) => p.sosOppWinPct)),
        defenseZ: meanAndStd(list.map((p) => p.defenseZ)),
        runDiffPerGame: meanAndStd(list.map((p) => p.runDiffPerGame))
      };
    }
    function teamCompositePower(profile, norms, isHome) {
      const zOff = zFrom(profile.offenseRating, norms.offense.mean, norms.offense.std);
      const zRun = zFrom(profile.runProd2026, norms.runProd.mean, norms.runProd.std);
      const zRf = zFrom(profile.runsPerGame, norms.runsPerGame.mean, norms.runsPerGame.std);
      const zRa = zFrom(
        profile.runsAgainstPerGame != null ? -profile.runsAgainstPerGame : null,
        -norms.runsAgainstPerGame.mean,
        norms.runsAgainstPerGame.std
      );
      const zDef = zFrom(profile.defenseZ, norms.defenseZ.mean, norms.defenseZ.std);
      const zTeam = zFrom(profile.teamOverall, norms.teamOverall.mean, norms.teamOverall.std);
      const zSos = zFrom(profile.sosOppWinPct, norms.sos.mean, norms.sos.std);
      const zRd = zFrom(profile.runDiffPerGame, norms.runDiffPerGame.mean, norms.runDiffPerGame.std);
      let power = MATCHUP_POWER_WEIGHT_OFFENSE * zOff + MATCHUP_POWER_WEIGHT_RUN_PROD * zRun + MATCHUP_POWER_WEIGHT_RUNS_FOR * zRf + MATCHUP_POWER_WEIGHT_RUNS_AGAINST * zRa + MATCHUP_POWER_WEIGHT_RUN_DIFF * zRd + MATCHUP_POWER_WEIGHT_DEFENSE_Z * zDef + MATCHUP_POWER_WEIGHT_TEAM_OVERALL * zTeam + MATCHUP_POWER_WEIGHT_SOS * zSos;
      if (isHome) power += MATCHUP_HOME_FIELD_LOGIT / MATCHUP_LOGIT_SCALE;
      return {
        power,
        components: { zOff, zRun, zRf, zRa, zDef, zTeam, zSos }
      };
    }
    function regressedTeamWinPct(profile, priorGames = MATCHUP_RECORD_PRIOR_GAMES) {
      const gamesPlayed = Number(profile?.gamesPlayed) || 0;
      const wins = Number(profile?.wins) || 0;
      const losses = Number(profile?.losses) || 0;
      const decided = gamesPlayed > 0 ? gamesPlayed : wins + losses;
      if (decided <= 0) return 0.5;
      return (wins + priorGames * 0.5) / (decided + priorGames);
    }
    function recordSampleConfidence(profile, priorGames = MATCHUP_RECORD_PRIOR_GAMES) {
      const gamesPlayed = Number(profile?.gamesPlayed) || 0;
      const wins = Number(profile?.wins) || 0;
      const losses = Number(profile?.losses) || 0;
      const decided = gamesPlayed > 0 ? gamesPlayed : wins + losses;
      return decided / (decided + priorGames);
    }
    function winProbFromRecord(homeProfile, awayProfile, recordLogitScale = MATCHUP_RECORD_LOGIT_SCALE) {
      const homeRec = regressedTeamWinPct(homeProfile);
      const awayRec = regressedTeamWinPct(awayProfile);
      const diff = homeRec - awayRec;
      const pHomeRaw = 1 / (1 + Math.exp(-recordLogitScale * diff));
      const confidence = Math.min(
        recordSampleConfidence(homeProfile),
        recordSampleConfidence(awayProfile)
      );
      const pHome = 0.5 + confidence * (pHomeRaw - 0.5);
      return {
        home: pHome,
        away: 1 - pHome,
        homeRegressedWinPct: homeRec,
        awayRegressedWinPct: awayRec,
        confidence
      };
    }
    function winProbFromPowerRanking(homeProfile, awayProfile, norms, logitScale = MATCHUP_POWER_RANK_LOGIT_SCALE) {
      const zHome = zFrom(homeProfile.teamOverall, norms.teamOverall.mean, norms.teamOverall.std);
      const zAway = zFrom(awayProfile.teamOverall, norms.teamOverall.mean, norms.teamOverall.std);
      const diff = (zHome - zAway) * logitScale;
      const pHome = 1 / (1 + Math.exp(-diff));
      return { home: pHome, away: 1 - pHome };
    }
    function shrinkWinProbTowardEven(p, shrink = MATCHUP_WIN_PROB_SHRINK) {
      if (!Number.isFinite(p)) return 0.5;
      return 0.5 + shrink * (p - 0.5);
    }
    function logisticWinProb(homePower, awayPower, logitScale = MATCHUP_LOGIT_SCALE) {
      const diff = (homePower - awayPower) * logitScale;
      const pHome = 1 / (1 + Math.exp(-diff));
      return {
        home: pHome,
        away: 1 - pHome
      };
    }
    function winProbFromRunMargin(homeRuns, awayRuns, runMarginLogit = MATCHUP_RUN_MARGIN_LOGIT) {
      const margin = homeRuns - awayRuns;
      const pHome = 1 / (1 + Math.exp(-runMarginLogit * margin));
      return { home: pHome, away: 1 - pHome, margin };
    }
    function predictSeasonGameWinProbs(awayProfile, homeProfile, norms, runBase) {
      const awayPow = teamCompositePower(awayProfile, norms, false);
      const homePow = teamCompositePower(homeProfile, norms, true);
      const awayRuns = projectTeamRuns(
        awayProfile,
        homeProfile,
        norms,
        runBase,
        MATCHUP_AWAY_RUN_FACTOR
      );
      const homeRuns = projectTeamRuns(
        homeProfile,
        awayProfile,
        norms,
        runBase,
        MATCHUP_HOME_RUN_FACTOR
      );
      const winFromRuns = winProbFromRunMargin(homeRuns, awayRuns, SEASON_PROJ_RUN_MARGIN_LOGIT);
      const winFromTalent = logisticWinProb(homePow.power, awayPow.power, SEASON_PROJ_LOGIT_SCALE);
      const pHomeRaw = SEASON_PROJ_WIN_WEIGHT_FROM_RUNS * winFromRuns.home + SEASON_PROJ_WIN_WEIGHT_FROM_TALENT * winFromTalent.home;
      const pHome = shrinkWinProbTowardEven(pHomeRaw, SEASON_PROJ_WIN_PROB_SHRINK);
      return { away: 1 - pHome, home: pHome };
    }
    function projectRosterExpectedRuns(profile, opponentProfile, norms, runBase, venueFactor) {
      const zOff = zFrom(profile.offenseRating, norms.offense.mean, norms.offense.std);
      const zRun = zFrom(profile.runProd2026, norms.runProd.mean, norms.runProd.std);
      const zRf = zFrom(profile.runsPerGame, norms.runsPerGame.mean, norms.runsPerGame.std);
      const zRd = zFrom(profile.runDiffPerGame, norms.runDiffPerGame.mean, norms.runDiffPerGame.std);
      const attackBlend = 0.44 * zOff + 0.22 * zRun + 0.22 * zRf + 0.12 * zRd;
      const defOpp = opponentProfile.defenseZ ?? 0;
      const oppRa = opponentProfile.runsAgainstPerGame;
      const oppRd = opponentProfile.runDiffPerGame;
      const leagueRa = runBase.avgRunsAgainstPerGame || runBase.avgRunsPerTeam;
      const { runsAgainstScale, defenseZScale } = matchupOpponentDefenseScales(opponentProfile);
      const zRaOpp = zFrom(
        oppRa != null ? -oppRa : null,
        -norms.runsAgainstPerGame.mean,
        norms.runsAgainstPerGame.std
      );
      const zRdOpp = zFrom(oppRd, norms.runDiffPerGame.mean, norms.runDiffPerGame.std);
      const defBlend = 0.42 * zRaOpp + 0.28 * defOpp + 0.3 * zRdOpp;
      let mult = (1 + MATCHUP_RUN_OFF_Z_PCT * attackBlend) * (1 - defenseZScale * defBlend) * venueFactor;
      if (oppRa != null && leagueRa > 0) {
        const oppAllowFactor = oppRa / leagueRa;
        mult *= 1 + runsAgainstScale * (oppAllowFactor - 1);
      }
      return Math.max(2, runBase.avgRunsPerTeam * mult);
    }
    function scheduleMatchupRunsEstimate(profile, opponentProfile, runBase) {
      const leagueAvg = runBase.avgRunsPerTeam;
      const attack = profile.runsPerGame;
      const oppAllowed = opponentProfile.runsAgainstPerGame;
      if (attack == null && oppAllowed == null) return null;
      const attackEst = attack ?? leagueAvg;
      if (oppAllowed == null || oppAllowed <= 0 || leagueAvg <= 0) return attackEst;
      const defenseEst = leagueAvg * leagueAvg / oppAllowed;
      return (1 - MATCHUP_SCHEDULE_DEFENSE_BLEND) * attackEst + MATCHUP_SCHEDULE_DEFENSE_BLEND * defenseEst;
    }
    function projectTeamRuns(profile, opponentProfile, norms, runBase, venueFactor) {
      const rosterProj = projectRosterExpectedRuns(profile, opponentProfile, norms, runBase, venueFactor);
      const scheduleProj = scheduleMatchupRunsEstimate(profile, opponentProfile, runBase);
      const hasSched = scheduleProj != null && (profile.runsPerGame != null && profile.scheduleGames >= 2 || opponentProfile.runsAgainstPerGame != null && opponentProfile.scheduleGames >= 2);
      if (hasSched) {
        const w = matchupScheduleBlendWeight(profile, opponentProfile);
        return Math.max(2, w * scheduleProj + (1 - w) * rosterProj);
      }
      return rosterProj;
    }
    function roundMatchupN(n, dec = 1) {
      if (!Number.isFinite(n)) return null;
      const f = 10 ** dec;
      return Math.round(n * f) / f;
    }
    function roundToNearestHalf(n) {
      if (!Number.isFinite(n)) return null;
      return Math.round(n * 2) / 2;
    }
    function formatBettingLineNumber(n) {
      const v = roundToNearestHalf(n);
      if (v == null) return null;
      return Math.abs(v % 1) < 1e-9 ? String(Math.round(v)) : v.toFixed(1);
    }
    function formatRunLineSpread(marginHome) {
      if (marginHome == null || !Number.isFinite(marginHome)) return null;
      const label = formatBettingLineNumber(marginHome);
      if (label == null) return null;
      return marginHome > 0 ? `+${label}` : label;
    }
    function buildPredictedFinalScore(proj, homeWinProb = 0.5) {
      if (!proj) {
        return { winnerSide: null, score: null };
      }
      const margin = proj.marginHome;
      const homeWins = margin > 1e-9 || Math.abs(margin) <= 1e-9 && homeWinProb >= 0.5;
      return {
        winnerSide: homeWins ? "home" : "away",
        score: proj.impliedScore
      };
    }
    function alignProjectedRunsToWinFavorite(prediction) {
      if (!prediction?.projectedRuns || !prediction?.winPct) return prediction;
      const awayR = Number(prediction.projectedRuns.away);
      const homeR = Number(prediction.projectedRuns.home);
      if (!Number.isFinite(awayR) || !Number.isFinite(homeR)) return prediction;
      const homeFavoriteByWin = prediction.winPct.home >= prediction.winPct.away;
      const runsAligned = homeFavoriteByWin && homeR > awayR || !homeFavoriteByWin && awayR > homeR;
      if (runsAligned) return prediction;
      let newAway = awayR;
      let newHome = homeR;
      if (homeFavoriteByWin) newHome = awayR + 0.5;
      else newAway = homeR + 0.5;
      const runs = finalizeRunProjection(newAway, newHome);
      if (!runs) return prediction;
      prediction.projectedRuns = {
        away: runs.awayDisplay,
        home: runs.homeDisplay,
        total: runs.totalDisplay,
        marginHome: runs.marginDisplay
      };
      prediction.lines = prediction.lines || {};
      prediction.lines.overUnder = runs.overUnder;
      prediction.lines.impliedScore = runs.impliedScore;
      prediction.lines.finalScore = null;
      prediction.lines.runLine = null;
      return enrichMatchupPredictionLines2(prediction);
    }
    function enrichMatchupPredictionLines2(prediction) {
      if (!prediction?.projectedRuns || !prediction?.winPct) return prediction;
      const awayR = Number(prediction.projectedRuns.away);
      const homeR = Number(prediction.projectedRuns.home);
      if (!Number.isFinite(awayR) || !Number.isFinite(homeR)) return prediction;
      const pHome = prediction.winPct.home / 100;
      const runs = {
        away: awayR,
        home: homeR,
        marginHome: homeR - awayR,
        impliedScore: `${prediction.projectedRuns.away} \u2013 ${prediction.projectedRuns.home}`
      };
      prediction.lines = prediction.lines || {};
      if (!prediction.lines.finalScore?.winnerSide) {
        prediction.lines.finalScore = buildPredictedFinalScore(runs, pHome);
      }
      if (!prediction.lines.runLine?.value) {
        prediction.lines.runLine = buildFavoriteRunLine(runs, pHome);
      }
      const moneylines = americanMoneylineFromRunLine(prediction.lines.runLine);
      prediction.lines.moneylineAway = moneylines.away;
      prediction.lines.moneylineHome = moneylines.home;
      return prediction;
    }
    function matchupFavoriteSide(marginHome, homeWinProb = 0.5) {
      return marginHome > 1e-9 || Math.abs(marginHome) <= 1e-9 && homeWinProb >= 0.5 ? "home" : "away";
    }
    function favoriteRunMarginFromWinProb(favWinProb) {
      const p = Math.max(0.505, Math.min(0.85, favWinProb));
      return Math.log(p / (1 - p)) / MATCHUP_RUN_MARGIN_LOGIT;
    }
    function buildFavoriteRunLine(proj, homeWinProb = 0.5) {
      if (!proj || !Number.isFinite(proj.marginHome)) {
        return { side: null, value: null };
      }
      const margin = proj.marginHome;
      const homeFavorite = matchupFavoriteSide(margin, homeWinProb) === "home";
      const favWinProb = homeFavorite ? homeWinProb : 1 - homeWinProb;
      const marginFromProj = Math.abs(margin);
      const marginFromWin = favoriteRunMarginFromWinProb(favWinProb) * MATCHUP_RUN_LINE_WIN_SCALE;
      let magnitude = Math.max(marginFromProj, marginFromWin);
      if (magnitude < 1e-9) magnitude = 0.5;
      const label = formatBettingLineNumber(magnitude);
      if (label == null) return { side: null, value: null };
      return {
        side: homeFavorite ? "home" : "away",
        value: label
      };
    }
    function finalizeRunProjection(away, home) {
      if (away == null || home == null || !Number.isFinite(away) || !Number.isFinite(home)) {
        return null;
      }
      const marginHome = home - away;
      const total = away + home;
      return {
        away,
        home,
        total,
        marginHome,
        awayDisplay: formatBettingLineNumber(away),
        homeDisplay: formatBettingLineNumber(home),
        totalDisplay: formatBettingLineNumber(total),
        marginDisplay: formatRunLineSpread(marginHome),
        impliedScore: `${formatBettingLineNumber(away)} \u2013 ${formatBettingLineNumber(home)}`,
        overUnder: formatBettingLineNumber(total),
        runLineHome: formatRunLineSpread(marginHome)
      };
    }
    function buildRoundedRunProjection(awayRunsRaw, homeRunsRaw) {
      const away = roundToNearestHalf(awayRunsRaw);
      const home = roundToNearestHalf(homeRunsRaw);
      if (away == null || home == null) return null;
      return finalizeRunProjection(away, home);
    }
    function resolveTiedRunProjection(proj, homeIsFavorite) {
      if (!proj || Math.abs(proj.marginHome) > 1e-9) return proj;
      if (homeIsFavorite) {
        return finalizeRunProjection(proj.away, proj.home + 0.5);
      }
      return finalizeRunProjection(proj.away + 0.5, proj.home);
    }
    function predictMatchupGame2(awayProfile, homeProfile, norms, runBase) {
      const awayPow = teamCompositePower(awayProfile, norms, false);
      const homePow = teamCompositePower(homeProfile, norms, true);
      let awayRuns = projectTeamRuns(
        awayProfile,
        homeProfile,
        norms,
        runBase,
        MATCHUP_AWAY_RUN_FACTOR
      );
      let homeRuns = projectTeamRuns(
        homeProfile,
        awayProfile,
        norms,
        runBase,
        MATCHUP_HOME_RUN_FACTOR
      );
      ({ away: awayRuns, home: homeRuns } = applyCriticalRosterRunProjection(
        awayProfile,
        homeProfile,
        awayRuns,
        homeRuns
      ));
      let runs = buildRoundedRunProjection(awayRuns, homeRuns);
      if (!runs) {
        return {
          winPct: { away: 50, home: 50 },
          winPctFromRuns: { away: 50, home: 50 },
          projectedRuns: { away: "\u2014", home: "\u2014", total: "\u2014", marginHome: "\u2014" },
          scheduleRates: { away: {}, home: {} },
          lines: {
            overUnder: "\u2014",
            finalScore: { winnerSide: null, score: "\u2014" },
            runLine: { side: null, value: "\u2014" },
            impliedScore: "\u2014"
          },
          strength: { away: 0, home: 0 },
          runBaselineGames: runBase.gamesSampled,
          leagueAvgRunsPerTeam: roundMatchupN(runBase.avgRunsPerTeam, 1)
        };
      }
      const winFromTalent = logisticWinProb(homePow.power, awayPow.power);
      const winFromRecord = winProbFromRecord(homeProfile, awayProfile);
      const winFromPower = winProbFromPowerRanking(homeProfile, awayProfile, norms);
      let winFromRuns = winProbFromRunMargin(runs.home, runs.away);
      const pHomeRaw = MATCHUP_WIN_WEIGHT_FROM_RUNS * winFromRuns.home + MATCHUP_WIN_WEIGHT_FROM_TALENT * winFromTalent.home + MATCHUP_WIN_WEIGHT_FROM_RECORD * winFromRecord.home + MATCHUP_WIN_WEIGHT_FROM_POWER * winFromPower.home;
      let pHome = shrinkWinProbTowardEven(pHomeRaw);
      let pAway = 1 - pHome;
      ({ away: pAway, home: pHome } = applyCriticalRosterWinCap(
        awayProfile,
        homeProfile,
        pAway,
        pHome
      ));
      runs = resolveTiedRunProjection(runs, pHome >= pAway);
      winFromRuns = winProbFromRunMargin(runs.home, runs.away);
      return {
        winPct: {
          away: roundMatchupN(pAway * 100, 1),
          home: roundMatchupN(pHome * 100, 1)
        },
        winPctFromRuns: {
          away: roundMatchupN(winFromRuns.away * 100, 1),
          home: roundMatchupN(winFromRuns.home * 100, 1)
        },
        projectedRuns: {
          away: runs.awayDisplay,
          home: runs.homeDisplay,
          total: runs.totalDisplay,
          marginHome: runs.marginDisplay
        },
        scheduleRates: {
          away: {
            runsPerGame: roundMatchupN(awayProfile.runsPerGame, 1),
            runsAgainstPerGame: roundMatchupN(awayProfile.runsAgainstPerGame, 1)
          },
          home: {
            runsPerGame: roundMatchupN(homeProfile.runsPerGame, 1),
            runsAgainstPerGame: roundMatchupN(homeProfile.runsAgainstPerGame, 1)
          }
        },
        lines: {
          overUnder: runs.overUnder,
          finalScore: buildPredictedFinalScore(runs, pHome),
          runLine: buildFavoriteRunLine(runs, pHome),
          impliedScore: runs.impliedScore
        },
        strength: {
          away: roundMatchupN(awayPow.power, 2),
          home: roundMatchupN(homePow.power, 2)
        },
        runBaselineGames: runBase.gamesSampled,
        leagueAvgRunsPerTeam: roundMatchupN(runBase.avgRunsPerTeam, 1)
      };
    }
    var MONEYLINE_OVERROUND = 1.045;
    var MONEYLINE_STANDARD_FAVORITE = -110;
    var MONEYLINE_STANDARD_UNDERDOG = 100;
    var MONEYLINE_PICKEM_THRESHOLD = 0.025;
    function americanFromImpliedProb(implied) {
      const imp = Math.min(0.999, Math.max(1e-3, implied));
      if (imp >= 0.5) return -Math.round(100 * imp / (1 - imp));
      return Math.round(100 * (1 - imp) / imp);
    }
    function roundMoneylineAmerican(n) {
      const sign = n < 0 ? -1 : 1;
      let abs = Math.abs(n);
      if (abs >= 1e3) abs = Math.round(abs / 50) * 50;
      else if (abs >= 200) abs = Math.round(abs / 10) * 10;
      else abs = Math.round(abs / 5) * 5;
      abs = Math.max(abs, 100);
      return sign * abs;
    }
    function formatAmericanMoneyline(n) {
      return n < 0 ? String(n) : `+${n}`;
    }
    function enforceMoneylineHouseEdge(favoriteOdds, underdogOdds) {
      let fav = favoriteOdds < 0 ? favoriteOdds : MONEYLINE_STANDARD_FAVORITE;
      let dog = underdogOdds > 0 ? underdogOdds : MONEYLINE_STANDARD_UNDERDOG;
      if (fav > MONEYLINE_STANDARD_FAVORITE) fav = MONEYLINE_STANDARD_FAVORITE;
      fav = roundMoneylineAmerican(fav);
      dog = roundMoneylineAmerican(dog);
      while (Math.abs(fav) <= dog) {
        fav -= 5;
        if (dog > MONEYLINE_STANDARD_UNDERDOG) dog -= 5;
        else dog = MONEYLINE_STANDARD_UNDERDOG;
      }
      if (dog > MONEYLINE_STANDARD_UNDERDOG && Math.abs(fav) <= MONEYLINE_STANDARD_UNDERDOG) {
        dog = MONEYLINE_STANDARD_UNDERDOG;
        if (Math.abs(fav) <= dog) fav = MONEYLINE_STANDARD_FAVORITE;
      }
      return [fav, dog];
    }
    function parseRunLineMagnitude(value) {
      if (value == null) return null;
      const n = parseFloat(String(value).replace(/[^\d.+-]/g, ""));
      return Number.isFinite(n) ? Math.abs(n) : null;
    }
    function americanMoneylineFromRunLine(runLine) {
      const side = runLine?.side;
      if (!side) return { away: "\u2014", home: "\u2014" };
      let mag = parseRunLineMagnitude(runLine?.value);
      if (mag == null) mag = 0.5;
      mag = Math.max(0.5, mag);
      const halfSteps = Math.max(0, Math.round((mag - 0.5) / 0.5));
      let favOdds = MONEYLINE_STANDARD_FAVORITE - halfSteps * 15;
      let dogOdds = MONEYLINE_STANDARD_UNDERDOG + halfSteps * 10;
      [favOdds, dogOdds] = enforceMoneylineHouseEdge(favOdds, dogOdds);
      if (side === "away") {
        return {
          away: formatAmericanMoneyline(favOdds),
          home: formatAmericanMoneyline(dogOdds)
        };
      }
      return {
        away: formatAmericanMoneyline(dogOdds),
        home: formatAmericanMoneyline(favOdds)
      };
    }
    function americanMoneylinePair(probAway, probHome) {
      const sum = probAway + probHome;
      if (sum <= 0) return { away: "\u2014", home: "\u2014" };
      const qAway = probAway / sum;
      const qHome = probHome / sum;
      if (Math.abs(qAway - qHome) < MONEYLINE_PICKEM_THRESHOLD) {
        const [fav, dog] = enforceMoneylineHouseEdge(
          MONEYLINE_STANDARD_FAVORITE,
          MONEYLINE_STANDARD_UNDERDOG
        );
        return {
          away: formatAmericanMoneyline(dog),
          home: formatAmericanMoneyline(fav)
        };
      }
      const awayIsFav = qAway > qHome;
      const qFav = awayIsFav ? qAway : qHome;
      const minFavImp = 110 / 210;
      let impFav = Math.max(qFav * MONEYLINE_OVERROUND, minFavImp);
      impFav = Math.min(impFav, 0.95);
      let impDog = MONEYLINE_OVERROUND - impFav;
      if (impDog >= 0.5) {
        impDog = 0.495;
        impFav = MONEYLINE_OVERROUND - impDog;
      }
      let favAmerican = roundMoneylineAmerican(americanFromImpliedProb(impFav));
      let dogAmerican = roundMoneylineAmerican(americanFromImpliedProb(impDog));
      [favAmerican, dogAmerican] = enforceMoneylineHouseEdge(favAmerican, dogAmerican);
      if (awayIsFav) {
        return {
          away: formatAmericanMoneyline(favAmerican),
          home: formatAmericanMoneyline(dogAmerican)
        };
      }
      return {
        away: formatAmericanMoneyline(dogAmerican),
        home: formatAmericanMoneyline(favAmerican)
      };
    }
    module.exports = {
      leagueRunScoringBaseline,
      buildTeamScheduleRunRates,
      buildDefenseZByNorm,
      buildTeamMatchupProfiles,
      buildMatchupLeagueNorms,
      predictMatchupGame: predictMatchupGame2,
      predictSeasonGameWinProbs,
      enrichMatchupPredictionLines: enrichMatchupPredictionLines2,
      alignProjectedRunsToWinFavorite,
      americanMoneylinePair,
      americanMoneylineFromRunLine,
      roundMatchupN,
      finishedScheduleGameDedupeKey
    };
  }
});

// lib/stats2026Loader.js
var require_stats2026Loader = __commonJS({
  "lib/stats2026Loader.js"(exports, module) {
    var Papa = require_papaparse_min();
    var { fetchCsvText } = require_fetchCsvText();
    var { getStats2026CsvUrl } = require_sheetUrls();
    var { normalizePlayerName: normalizePlayerName2 } = require_dfs();
    function safeText(value) {
      return (value || "").toString().trim();
    }
    async function load2026StatsByPlayer() {
      const csvText = await fetchCsvText(await getStats2026CsvUrl());
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
        statsByPlayer.set(normalizePlayerName2(playerName), stats);
      }
      return statsByPlayer;
    }
    module.exports = { load2026StatsByPlayer };
  }
});

// lib/dfsLeaderboardScoringContext.js
var require_dfsLeaderboardScoringContext = __commonJS({
  "lib/dfsLeaderboardScoringContext.js"(exports, module) {
    var Papa = require_papaparse_min();
    var { fetchCsvText } = require_fetchCsvText();
    var { createMemoryCache } = require_memoryCache();
    var {
      buildTeamCodeById,
      load2026GamelogsByPlayer,
      normalizePlayerName: normalizePlayerName2,
      DFS_OFFENSE_RATING_WEIGHT_HISTORICAL,
      DFS_OFFENSE_RATING_WEIGHT_2026
    } = require_dfs();
    var {
      getScheduleUrl,
      HIST_2025_STATS_URL,
      SCHEDULE_CALENDAR_YEAR,
      resolveCareerCsvSource
    } = require_sheetUrls();
    var OFFENSE_RATING_WEIGHT_HISTORICAL = 0.7;
    var OFFENSE_RATING_WEIGHT_2026 = 0.3;
    var OFFENSE_METRIC_WEIGHTS = Object.freeze({
      ops: 0.52,
      iso: 0.16,
      tbPerPa: 0.26,
      runProd: 0.06
    });
    var OFFENSE_METRIC_KEYS = Object.keys(OFFENSE_METRIC_WEIGHTS);
    var nodeReadCareerCsv = null;
    function setNodeCareerReader(fn) {
      nodeReadCareerCsv = typeof fn === "function" ? fn : null;
    }
    function safeText(value) {
      return (value || "").toString().trim();
    }
    function toNumber(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    async function fetchCsvRows(url) {
      const csvText = await fetchCsvText(url);
      return Papa.parse(csvText).data;
    }
    var { loadTeamRosters } = require_teamRosters();
    var { getCachedPlayerReplacements: getCachedPlayerReplacements2 } = require_playerReplacements();
    function parseScheduleSheetDate(displayDate) {
      const s = safeText(displayDate);
      if (!s) return null;
      const match = /^([A-Za-z]{3}),\s*(\d{1,2})-([A-Za-z]{3})$/.exec(s);
      if (!match) return null;
      const monthAbbrToNum = {
        jan: 1,
        feb: 2,
        mar: 3,
        apr: 4,
        may: 5,
        jun: 6,
        jul: 7,
        aug: 8,
        sep: 9,
        oct: 10,
        nov: 11,
        dec: 12
      };
      const day = Number(match[2]);
      const monthNum = monthAbbrToNum[match[3].slice(0, 3).toLowerCase()];
      if (!monthNum || !Number.isFinite(day) || day < 1 || day > 31) return null;
      const dt = new Date(SCHEDULE_CALENDAR_YEAR, monthNum - 1, day);
      if (dt.getFullYear() !== SCHEDULE_CALENDAR_YEAR || dt.getMonth() !== monthNum - 1 || dt.getDate() !== day) {
        return null;
      }
      const iso = `${String(SCHEDULE_CALENDAR_YEAR)}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { iso, label: s };
    }
    function weekdayFromIso(iso) {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d, 12, 0, 0).getDay();
    }
    function scheduleIsoToCompactDigits(isoDate) {
      return safeText(isoDate).replace(/\D+/g, "");
    }
    function scheduleStartTimeSortKey(timeStr) {
      const compact = safeText(timeStr).toLowerCase().replace(/\./g, "").replace(/\s+/g, "").trim();
      if (!compact || compact === "-" || compact === "ppd" || compact === "tbd" || compact === "postponed") {
        return 1e9;
      }
      const m12 = compact.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
      if (m12) {
        let h = Number(m12[1]);
        const min = Number(m12[2]);
        if (m12[3] === "pm" && h < 12) h += 12;
        if (m12[3] === "am" && h === 12) h = 0;
        return h * 60 + min;
      }
      const m24 = compact.match(/^(\d{1,2}):(\d{2})$/);
      if (m24) {
        const h = Number(m24[1]);
        const min = Number(m24[2]);
        if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
      }
      return 1e9 - 1;
    }
    function sortScheduleGameRows(rows) {
      return rows.slice().sort((a, b) => {
        const ka = scheduleStartTimeSortKey(a.time);
        const kb = scheduleStartTimeSortKey(b.time);
        if (ka !== kb) return ka - kb;
        return safeText(a.home).localeCompare(safeText(b.home));
      });
    }
    function optionalScheduleScore(cell) {
      const t = safeText(cell);
      if (!t || /^#?n\/?a$/i.test(t) || /^ppd$/i.test(t)) return NaN;
      const n = Number(t);
      return Number.isFinite(n) ? n : NaN;
    }
    function formatFinishedScheduleResult(awayScore, homeScore, resultCell, winnerCell) {
      if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) return "";
      const rs = safeText(resultCell).trim();
      if (!/^#?n\/?a$/i.test(rs) && !/^-$/.test(rs) && rs) return rs;
      const w = safeText(winnerCell);
      if (!/^#?n\/?a$/i.test(w) && w !== "-") return `${awayScore}\u2013${homeScore} (${w})`;
      return `${awayScore}\u2013${homeScore}`;
    }
    function isValidScheduleTeamNumber(value) {
      const raw = safeText(value).replace(/\s+/g, "");
      if (/^n\/?a$/i.test(raw) || /^#+$/.test(raw)) return false;
      const n = Number(raw);
      return Number.isInteger(n) && n >= 1 && n <= 18;
    }
    function normalizeScheduleTeamId(id) {
      const n = Number(safeText(id).replace(/\s+/g, ""));
      return Number.isInteger(n) ? String(n) : safeText(id);
    }
    function scheduleHeaderRowNormalized(headers) {
      return (headers || []).map(
        (x) => safeText(x).replace(/^\ufeff/g, "").toLowerCase()
      );
    }
    function scheduleColumnFirstOf(normalizedHeaders, candidates) {
      const h = normalizedHeaders;
      for (const c of candidates) {
        const i = h.indexOf(c);
        if (i >= 0) return i;
      }
      return -1;
    }
    function buildScheduleDiamondLocationLabel(fieldMain, fieldShort) {
      const parts = [];
      for (const p of [fieldMain, fieldShort]) {
        const t = safeText(p);
        if (!t || t === "-") continue;
        if (parts.length && parts[parts.length - 1] === t) continue;
        parts.push(t);
      }
      return parts.join(" \xB7 ");
    }
    function scheduleCsvColumnIndex(headers) {
      const h = scheduleHeaderRowNormalized(headers);
      return {
        date: h.indexOf("date"),
        awayId: h.indexOf("away #"),
        awayTeam: h.indexOf("away team"),
        homeId: h.indexOf("home #"),
        homeTeam: h.indexOf("home team"),
        field: scheduleColumnFirstOf(h, ["field", "diamond"]),
        shortField: scheduleColumnFirstOf(h, ["short field"]),
        time: h.indexOf("time"),
        gameId: h.indexOf("gameid"),
        awayScore: h.indexOf("away score"),
        homeScore: h.indexOf("home score"),
        winner: h.indexOf("winner"),
        result: h.indexOf("result")
      };
    }
    function buildParsedScheduleGames(scheduleRows, teams) {
      const headers = (scheduleRows[0] || []).map((h) => safeText(h));
      const rows = scheduleRows.slice(1);
      const idx = scheduleCsvColumnIndex(headers);
      if (idx.date === -1 || idx.awayId === -1 || idx.homeId === -1) {
        throw new Error("Schedule CSV missing required columns.");
      }
      const teamNameById = new Map(
        teams.map((t) => [safeText(t.teamId), safeText(t.teamName) || `Team ${t.teamId}`])
      );
      const parsedGames = [];
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const awayId = safeText(row[idx.awayId]);
        const homeId = safeText(row[idx.homeId]);
        if (!isValidScheduleTeamNumber(awayId) || !isValidScheduleTeamNumber(homeId)) continue;
        const dateDisplay = safeText(row[idx.date]);
        const parsedDate = parseScheduleSheetDate(dateDisplay);
        if (!parsedDate) continue;
        const field = idx.field >= 0 ? safeText(row[idx.field]) : "";
        const fieldShort = idx.shortField >= 0 ? safeText(row[idx.shortField]) : "";
        parsedGames.push({
          awayId,
          homeId,
          awayName: safeText(row[idx.awayTeam]) || teamNameById.get(awayId) || `Team ${awayId}`,
          homeName: safeText(row[idx.homeTeam]) || teamNameById.get(homeId) || `Team ${homeId}`,
          dateDisplay,
          isoDate: parsedDate.iso,
          field,
          venueLabel: buildScheduleDiamondLocationLabel(field, fieldShort),
          time: idx.time >= 0 ? safeText(row[idx.time]) : "",
          gameId: idx.gameId >= 0 ? safeText(row[idx.gameId]) : "",
          rowIndex: i,
          awayScore: optionalScheduleScore(idx.awayScore >= 0 ? row[idx.awayScore] : ""),
          homeScore: optionalScheduleScore(idx.homeScore >= 0 ? row[idx.homeScore] : ""),
          winnerCsv: idx.winner >= 0 ? safeText(row[idx.winner]) : "",
          resultCsv: idx.result >= 0 ? safeText(row[idx.result]) : ""
        });
      }
      return parsedGames;
    }
    function finishedScheduleGameDedupeKey(g) {
      const awayId = normalizeScheduleTeamId(g.awayId);
      const homeId = normalizeScheduleTeamId(g.homeId);
      const gid = safeText(g.gameId);
      if (gid) return `gid|${gid}`;
      return `m|${g.isoDate || ""}|${[awayId, homeId].sort().join("|")}`;
    }
    function normalizeScheduleTeamLabel(value) {
      return safeText(value).toLowerCase().replace(/\s+/g, " ");
    }
    function buildScheduleRosterPayloadB64(rosterByTeamId, teams) {
      const nameToTeamId = {};
      for (const t of teams) {
        const key = normalizeScheduleTeamLabel(t.teamName);
        if (key && !nameToTeamId[key]) nameToTeamId[key] = t.teamId;
      }
      const body = JSON.stringify({ byTeamId: rosterByTeamId, nameToTeamId });
      if (typeof Buffer !== "undefined") {
        return Buffer.from(body, "utf8").toString("base64");
      }
      const bytes = new TextEncoder().encode(body);
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      return btoa(binary);
    }
    async function loadWeeklySchedule2() {
      const scheduleUrl = await getScheduleUrl();
      const [scheduleRows, teams] = await Promise.all([fetchCsvRows(scheduleUrl), loadTeamRosters()]);
      const parsedGames = buildParsedScheduleGames(scheduleRows, teams);
      const uniqueIsosSorted = Array.from(new Set(parsedGames.map((g) => g.isoDate))).sort(
        (a, b) => a.localeCompare(b)
      );
      const dateLabelByIso = /* @__PURE__ */ new Map();
      for (const g of parsedGames) {
        if (!dateLabelByIso.has(g.isoDate)) dateLabelByIso.set(g.isoDate, g.dateDisplay);
      }
      const seen = /* @__PURE__ */ new Set();
      const gamesByIso = /* @__PURE__ */ new Map();
      for (const g of parsedGames) {
        const wd = weekdayFromIso(g.isoDate);
        if (wd !== 0 && wd !== 3) continue;
        const matchupIds = [g.awayId, g.homeId].sort((a, b) => a.localeCompare(b));
        const dedupeKey = `${g.isoDate}|${matchupIds[0]}|${matchupIds[1]}|${g.time}|${g.field}|${g.venueLabel}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        const awayTeamId = String(Number(safeText(g.awayId).replace(/\s+/g, "")));
        const homeTeamId = String(Number(safeText(g.homeId).replace(/\s+/g, "")));
        const row = {
          home: g.homeName,
          away: g.awayName,
          awayTeamId,
          homeTeamId,
          location: g.venueLabel && g.venueLabel.trim() || g.field || "-",
          time: g.time || "-",
          date: g.dateDisplay || "",
          result: formatFinishedScheduleResult(g.awayScore, g.homeScore, g.resultCsv, g.winnerCsv),
          gameId: g.gameId,
          _iso: g.isoDate
        };
        if (!gamesByIso.has(g.isoDate)) gamesByIso.set(g.isoDate, []);
        gamesByIso.get(g.isoDate).push(row);
      }
      for (const iso of gamesByIso.keys()) {
        gamesByIso.set(iso, sortScheduleGameRows(gamesByIso.get(iso)));
      }
      const scheduleOptions = [];
      let sundayCounter = 0;
      for (const iso of uniqueIsosSorted) {
        const wd = weekdayFromIso(iso);
        const dl = dateLabelByIso.get(iso) || iso;
        if (wd === 0) {
          sundayCounter += 1;
          scheduleOptions.push({ value: `W${sundayCounter}`, label: `${dl} \u2022 Week ${sundayCounter}` });
        } else if (wd === 3) {
          scheduleOptions.push({
            value: `D${scheduleIsoToCompactDigits(iso)}`,
            label: dl
          });
        }
      }
      const rosterByTeamId = {};
      for (const t of teams) {
        rosterByTeamId[t.teamId] = {
          teamName: t.teamName,
          captain: t.captain,
          jerseyColor: t.jerseyColor,
          numberColor: t.numberColor,
          players: Array.isArray(t.players) ? t.players : []
        };
      }
      return {
        scheduleOptions,
        allScheduleViews: scheduleOptions.map((o) => o.value),
        gamesByIso,
        sundayIsosSorted: uniqueIsosSorted.filter((iso) => weekdayFromIso(iso) === 0),
        uniqueIsosSorted,
        dateLabelByIso,
        rosterByTeamId,
        scheduleRosterPayloadB64: buildScheduleRosterPayloadB64(rosterByTeamId, teams),
        parsedGames
      };
    }
    var { load2026StatsByPlayer } = require_stats2026Loader();
    async function load2025HistoricalByPlayer() {
      const rows = await fetchCsvRows(HIST_2025_STATS_URL);
      const headers = (rows[0] || []).map((h) => safeText(h));
      const dataRows = rows.slice(1);
      const nameIndex = headers.findIndex((h) => h.toLowerCase() === "player");
      if (nameIndex === -1) throw new Error("2025 historical CSV missing Player column.");
      const byPlayer = /* @__PURE__ */ new Map();
      for (const row of dataRows) {
        const playerName = safeText(row[nameIndex]);
        if (!playerName) continue;
        const singles = toNumber(row[6]);
        const doubles = toNumber(row[7]);
        const triples = toNumber(row[8]);
        const homers = toNumber(row[9]);
        const bb = toNumber(row[10]);
        const ab = toNumber(row[2]);
        byPlayer.set(normalizePlayerName2(playerName), {
          player: playerName,
          team: safeText(row[1]),
          pa: ab + bb,
          ab,
          h: toNumber(row[3]),
          r: toNumber(row[4]),
          rbi: toNumber(row[5]),
          bb,
          tb: singles + doubles * 2 + triples * 3 + homers * 4
        });
      }
      return byPlayer;
    }
    async function loadCareerByPlayer() {
      const src = resolveCareerCsvSource();
      let csvText;
      if (src.type === "file") {
        if (!nodeReadCareerCsv) {
          throw new Error("Career CSV file read is not configured (Node only).");
        }
        csvText = await nodeReadCareerCsv(src.path);
      } else {
        csvText = await fetchCsvText(src.url);
      }
      const rows = Papa.parse(csvText).data;
      const headers = (rows[0] || []).map((h) => safeText(h).toLowerCase());
      const dataRows = rows.slice(1);
      const idx = {
        name: headers.indexOf("player_name"),
        pa: headers.indexOf("pa"),
        ab: headers.indexOf("ab"),
        h: headers.indexOf("h"),
        r: headers.indexOf("r"),
        rbi: headers.indexOf("rbi"),
        bb: headers.indexOf("bb"),
        tb: headers.indexOf("tb")
      };
      if (idx.name === -1) throw new Error("Career CSV missing player_name column.");
      const byPlayer = /* @__PURE__ */ new Map();
      for (const row of dataRows) {
        const name = safeText(row[idx.name]);
        if (!name) continue;
        byPlayer.set(normalizePlayerName2(name), {
          player: name,
          pa: toNumber(row[idx.pa]),
          ab: toNumber(row[idx.ab]),
          h: toNumber(row[idx.h]),
          r: toNumber(row[idx.r]),
          rbi: toNumber(row[idx.rbi]),
          bb: toNumber(row[idx.bb]),
          tb: toNumber(row[idx.tb])
        });
      }
      return byPlayer;
    }
    function computeOffenseRateBundle(pa, ab, bb, h, tb, r, rbi) {
      const paN = toNumber(pa);
      if (paN <= 0) return null;
      const abN = toNumber(ab);
      const bbN = toNumber(bb);
      const hN = toNumber(h);
      const tbN = toNumber(tb);
      const rN = toNumber(r);
      const rbiN = toNumber(rbi);
      if (abN + bbN <= 0) return null;
      const slg = abN > 0 ? tbN / abN : 0;
      const avg = abN > 0 ? hN / abN : 0;
      const iso = slg - avg;
      const ops = avg + slg;
      const tbPerPa = tbN / paN;
      const runProd = (rN + rbiN) / paN;
      if (![ops, iso, tbPerPa, runProd].every((x) => Number.isFinite(x))) return null;
      return { ops, iso, tbPerPa, runProd };
    }
    function collectLeagueOffenseBundles(careerByPlayer, hist2025ByPlayer, stats2026ByPlayer) {
      const out = [];
      for (const [, c] of careerByPlayer.entries()) {
        const pa = toNumber(c.pa);
        const b = computeOffenseRateBundle(pa, c.ab, c.bb, c.h, c.tb, c.r, c.rbi);
        if (b) out.push({ pa, bundle: b });
      }
      for (const [, h] of hist2025ByPlayer.entries()) {
        const pa = toNumber(h.pa);
        const b = computeOffenseRateBundle(pa, h.ab, h.bb, h.h, h.tb, h.r, h.rbi);
        if (b) out.push({ pa, bundle: b });
      }
      for (const [, row] of stats2026ByPlayer.entries()) {
        const pa = toNumber(row.PA);
        const b = computeOffenseRateBundle(pa, row.AB, row.BB, row.Hits, row.TB, row.Runs, row.RBI);
        if (b) out.push({ pa, bundle: b });
      }
      return out;
    }
    function weightedMomentsPerMetric(observations) {
      const totPa = observations.reduce((s, o) => s + o.pa, 0);
      const moments = {};
      if (totPa <= 0) {
        for (const k of OFFENSE_METRIC_KEYS) moments[k] = { mu: 0, sigma: 1 };
        return { moments, totPa };
      }
      for (const key of OFFENSE_METRIC_KEYS) {
        const mu = observations.reduce((s, o) => s + o.pa * o.bundle[key], 0) / totPa;
        const variance = observations.reduce((s, o) => s + o.pa * (o.bundle[key] - mu) ** 2, 0) / totPa;
        moments[key] = { mu, sigma: Math.sqrt(Math.max(variance, 1e-10)) };
      }
      return { moments, totPa };
    }
    function zScoresFromBundle(bundle, moments) {
      const z = {};
      for (const key of OFFENSE_METRIC_KEYS) {
        const { mu, sigma } = moments[key];
        z[key] = (bundle[key] - mu) / sigma;
      }
      return z;
    }
    function compositeZFromZScores(zObj) {
      let s = 0;
      for (const key of OFFENSE_METRIC_KEYS) {
        s += OFFENSE_METRIC_WEIGHTS[key] * zObj[key];
      }
      return s;
    }
    function historicalPaAndBundleForPlayer(normalizedKey, careerByPlayer, hist2025ByPlayer) {
      const c = careerByPlayer.get(normalizedKey);
      if (c && toNumber(c.pa) > 0) {
        const pa = toNumber(c.pa);
        const bundle = computeOffenseRateBundle(pa, c.ab, c.bb, c.h, c.tb, c.r, c.rbi);
        if (bundle) return { pa, bundle };
      }
      const h25 = hist2025ByPlayer.get(normalizedKey);
      if (h25 && toNumber(h25.pa) > 0) {
        const pa = toNumber(h25.pa);
        const bundle = computeOffenseRateBundle(pa, h25.ab, h25.bb, h25.h, h25.tb, h25.r, h25.rbi);
        if (bundle) return { pa, bundle };
      }
      return null;
    }
    function bundle2026FromRow(row2026) {
      const pa = toNumber(row2026.PA);
      if (pa <= 0) return null;
      return computeOffenseRateBundle(
        pa,
        row2026.AB,
        row2026.BB,
        row2026.Hits,
        row2026.TB,
        row2026.Runs,
        row2026.RBI
      );
    }
    function blendedOffenseRating(composite26, compositeHist, has26, hasHist, blendWeights) {
      const wHist = blendWeights?.historical ?? OFFENSE_RATING_WEIGHT_HISTORICAL;
      const w26 = blendWeights?.y2026 ?? OFFENSE_RATING_WEIGHT_2026;
      if (has26 && hasHist) {
        return wHist * compositeHist + w26 * composite26;
      }
      if (has26) return composite26;
      if (hasHist) return compositeHist;
      return 0;
    }
    var DFS_SALARY_RATING_BLEND = Object.freeze({
      historical: DFS_OFFENSE_RATING_WEIGHT_HISTORICAL,
      y2026: DFS_OFFENSE_RATING_WEIGHT_2026
    });
    function buildOffensivePlayerRows(teams, careerByPlayer, hist2025ByPlayer, stats2026ByPlayer, moments, blendWeights) {
      const rows = [];
      for (const team of teams) {
        for (const playerName of team.players) {
          const norm = normalizePlayerName2(playerName);
          const row2026 = stats2026ByPlayer.get(norm);
          const pa26 = row2026 ? toNumber(row2026.PA) : 0;
          const raw26 = row2026 && pa26 > 0 ? bundle2026FromRow(row2026) : null;
          const z26 = raw26 ? zScoresFromBundle(raw26, moments) : null;
          const composite26 = z26 ? compositeZFromZScores(z26) : 0;
          const has26 = z26 != null;
          const histSample = historicalPaAndBundleForPlayer(norm, careerByPlayer, hist2025ByPlayer);
          const rawHist = histSample?.bundle ?? null;
          const zHist = rawHist ? zScoresFromBundle(rawHist, moments) : null;
          const compositeHist = zHist ? compositeZFromZScores(zHist) : null;
          const hasHist = zHist != null;
          const ratingRaw = blendedOffenseRating(composite26, compositeHist ?? 0, has26, hasHist);
          rows.push({
            norm,
            rating: Number.isFinite(ratingRaw) ? Math.round(ratingRaw * 100) / 100 : 0
          });
        }
      }
      return rows;
    }
    function buildTeamScheduleRunRates(parsedGames, teams) {
      const rec = /* @__PURE__ */ new Map();
      for (const t of teams) {
        const id = normalizeScheduleTeamId(t.teamId);
        rec.set(id, { runsFor: 0, runsAgainst: 0, games: 0 });
      }
      const seen = /* @__PURE__ */ new Set();
      for (const g of parsedGames) {
        if (!Number.isFinite(g.awayScore) || !Number.isFinite(g.homeScore)) continue;
        const key = finishedScheduleGameDedupeKey(g);
        if (seen.has(key)) continue;
        seen.add(key);
        const awayId = normalizeScheduleTeamId(g.awayId);
        const homeId = normalizeScheduleTeamId(g.homeId);
        if (!rec.has(awayId) || !rec.has(homeId)) continue;
        rec.get(awayId).runsFor += g.awayScore;
        rec.get(awayId).runsAgainst += g.homeScore;
        rec.get(awayId).games += 1;
        rec.get(homeId).runsFor += g.homeScore;
        rec.get(homeId).runsAgainst += g.awayScore;
        rec.get(homeId).games += 1;
      }
      const rates = /* @__PURE__ */ new Map();
      for (const [id, r] of rec.entries()) {
        const g = r.games;
        rates.set(id, {
          gamesPlayed: g,
          runsFor: r.runsFor,
          runsAgainst: r.runsAgainst,
          runsPerGame: g > 0 ? r.runsFor / g : null,
          runsAgainstPerGame: g > 0 ? r.runsAgainst / g : null
        });
      }
      return rates;
    }
    async function loadDfsLeaderboardScoringContext() {
      const [
        teams,
        careerByPlayer,
        hist2025ByPlayer,
        stats2026ByPlayer,
        schedulePayload,
        gamelogs,
        replacements
      ] = await Promise.all([
        loadTeamRosters(),
        loadCareerByPlayer(),
        load2025HistoricalByPlayer(),
        load2026StatsByPlayer(),
        loadWeeklySchedule2(),
        load2026GamelogsByPlayer(),
        getCachedPlayerReplacements2()
      ]);
      const parsedScheduleGames = schedulePayload.parsedGames || [];
      const scheduleRunRates = buildTeamScheduleRunRates(parsedScheduleGames, teams);
      const bundles = collectLeagueOffenseBundles(careerByPlayer, hist2025ByPlayer, stats2026ByPlayer);
      const { moments } = weightedMomentsPerMetric(bundles);
      const leagueRows = buildOffensivePlayerRows(
        teams,
        careerByPlayer,
        hist2025ByPlayer,
        stats2026ByPlayer,
        moments,
        DFS_SALARY_RATING_BLEND
      );
      const offenseRatingByNorm = new Map(leagueRows.map((r) => [r.norm, r.rating]));
      const teamCodeById = buildTeamCodeById(teams, stats2026ByPlayer);
      const { parsedGames: _pg, ...scheduleForClient } = schedulePayload;
      return {
        schedulePayload: scheduleForClient,
        gamelogs,
        scoringDeps: {
          teams,
          offenseRatingByNorm,
          scheduleRunRates,
          stats2026ByPlayer,
          teamCodeById,
          gamelogs,
          replacementByOriginalNorm: replacements.byOriginalNorm
        }
      };
    }
    var dfsScoringContextCache = createMemoryCache(
      Number(process.env.DFS_SCORING_CACHE_TTL_MS) || 10 * 60 * 1e3,
      "dfs-scoring"
    );
    function getCachedDfsLeaderboardScoringContext2() {
      return dfsScoringContextCache.get("leaderboard-scoring", loadDfsLeaderboardScoringContext);
    }
    module.exports = {
      loadDfsLeaderboardScoringContext,
      getCachedDfsLeaderboardScoringContext: getCachedDfsLeaderboardScoringContext2,
      loadWeeklySchedule: loadWeeklySchedule2,
      setNodeCareerReader,
      loadCareerByPlayer,
      load2025HistoricalByPlayer,
      buildParsedScheduleGames,
      fetchCsvRows
    };
  }
});

// lib/matchupGameResult.js
var require_matchupGameResult = __commonJS({
  "lib/matchupGameResult.js"(exports, module) {
    "use strict";
    var { normalizeScheduleTeamId } = require_teamRosters();
    var { enrichMatchupPredictionLines: enrichMatchupPredictionLines2 } = require_matchupPredict();
    function safeText(value) {
      return (value || "").toString().trim();
    }
    function parseLineNumber(value) {
      const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    function isParsedGameFinished2(game) {
      return game != null && Number.isFinite(game.awayScore) && Number.isFinite(game.homeScore);
    }
    function findParsedGameForMatchup2(parsedGames, selectedGame, viewIso = null) {
      if (!selectedGame || !parsedGames?.length) return null;
      const awayId = normalizeScheduleTeamId(selectedGame.awayTeamId);
      const homeId = normalizeScheduleTeamId(selectedGame.homeTeamId);
      const gameId = safeText(selectedGame.gameId);
      const iso = safeText(selectedGame.isoDate || viewIso);
      const matchesTeams = (g) => normalizeScheduleTeamId(g.awayId) === awayId && normalizeScheduleTeamId(g.homeId) === homeId;
      if (gameId) {
        const byId = parsedGames.find((g) => safeText(g.gameId) === gameId && matchesTeams(g));
        if (byId) return byId;
      }
      if (iso) {
        const byIso = parsedGames.find((g) => matchesTeams(g) && g.isoDate === iso);
        if (byIso) return byIso;
      }
      const sameTeams = parsedGames.filter(matchesTeams);
      if (sameTeams.length === 1) return sameTeams[0];
      return null;
    }
    function betStatusFromCompare(actual, line, pickHigher) {
      if (actual == null || line == null) return null;
      if (Math.abs(actual - line) < 1e-9) return "push";
      if (pickHigher) return actual > line ? "hit" : "miss";
      return actual < line ? "hit" : "miss";
    }
    function gradeRunLine(actualMarginForFavorite, spread) {
      if (actualMarginForFavorite == null || spread == null) return null;
      if (Math.abs(actualMarginForFavorite - spread) < 1e-9) return "push";
      return actualMarginForFavorite > spread ? "hit" : "miss";
    }
    function gradeMatchupModelBets2(parsedGame, prediction, awayLabel, homeLabel) {
      if (!isParsedGameFinished2(parsedGame) || !prediction) return null;
      enrichMatchupPredictionLines2(prediction);
      const awayScore = parsedGame.awayScore;
      const homeScore = parsedGame.homeScore;
      const actualTotal = awayScore + homeScore;
      const marginHome = homeScore - awayScore;
      const marginAway = awayScore - homeScore;
      let winnerSide = null;
      if (awayScore > homeScore) winnerSide = "away";
      else if (homeScore > awayScore) winnerSide = "home";
      else winnerSide = "tie";
      const awayWinPct = Number(prediction.winPct?.away);
      const homeWinPct = Number(prediction.winPct?.home);
      const mlFavoriteSide = prediction.favoriteSide || (awayWinPct > homeWinPct ? "away" : homeWinPct > awayWinPct ? "home" : null);
      const ouLine = parseLineNumber(prediction.lines?.overUnder);
      const projectedTotal = parseLineNumber(prediction.projectedRuns?.total);
      const ouPick = ouLine != null && projectedTotal != null ? projectedTotal > ouLine ? "over" : projectedTotal < ouLine ? "under" : "push" : null;
      let ouStatus = null;
      if (ouLine != null && ouPick && ouPick !== "push") {
        ouStatus = ouPick === "over" ? betStatusFromCompare(actualTotal, ouLine, true) : betStatusFromCompare(actualTotal, ouLine, false);
      } else if (ouLine != null && actualTotal === ouLine) {
        ouStatus = "push";
      }
      let ouActualSide = null;
      if (ouLine != null && Number.isFinite(actualTotal)) {
        if (actualTotal > ouLine) ouActualSide = "over";
        else if (actualTotal < ouLine) ouActualSide = "under";
        else ouActualSide = "push";
      }
      const runLine = prediction.lines?.runLine || {};
      const runLineSide = runLine.side;
      const runLineSpread = parseLineNumber(runLine.value);
      let runLineStatus = null;
      if (runLineSide && runLineSpread != null) {
        const favMargin = runLineSide === "home" ? marginHome : marginAway;
        runLineStatus = gradeRunLine(favMargin, runLineSpread);
      }
      const moneylineAwayStatus = winnerSide === "tie" ? "push" : winnerSide === "away" ? "hit" : winnerSide ? "miss" : null;
      const moneylineHomeStatus = winnerSide === "tie" ? "push" : winnerSide === "home" ? "hit" : winnerSide ? "miss" : null;
      const modelMoneylineStatus = mlFavoriteSide === "away" ? moneylineAwayStatus : mlFavoriteSide === "home" ? moneylineHomeStatus : null;
      return {
        awayScore,
        homeScore,
        total: actualTotal,
        winnerSide,
        winnerLabel: winnerSide === "away" ? awayLabel : winnerSide === "home" ? homeLabel : "Tie",
        awayLabel,
        homeLabel,
        bets: {
          overUnder: {
            line: prediction.lines?.overUnder ?? "\u2014",
            pick: ouPick,
            actualTotal,
            actualSide: ouActualSide,
            status: ouStatus
          },
          runLine: {
            side: runLineSide,
            line: runLine.value ?? "\u2014",
            status: runLineStatus
          },
          moneyline: {
            favoriteSide: mlFavoriteSide,
            status: modelMoneylineStatus
          },
          moneylineAway: { status: moneylineAwayStatus },
          moneylineHome: { status: moneylineHomeStatus }
        },
        modelPrediction: prediction
      };
    }
    module.exports = {
      isParsedGameFinished: isParsedGameFinished2,
      findParsedGameForMatchup: findParsedGameForMatchup2,
      gradeMatchupModelBets: gradeMatchupModelBets2
    };
  }
});

// client/matchup-predictor-entry.mjs
var import_dfs = __toESM(require_dfs(), 1);
var import_matchupMissingPlayers = __toESM(require_matchupMissingPlayers(), 1);
var import_matchupLineupClient = __toESM(require_matchupLineupClient(), 1);
var import_matchupPredict = __toESM(require_matchupPredict(), 1);
var import_playerReplacements = __toESM(require_playerReplacements(), 1);
var import_dfsLeaderboardScoringContext = __toESM(require_dfsLeaderboardScoringContext(), 1);
var import_matchupGameResult = __toESM(require_matchupGameResult(), 1);
var import_sheetUrls = __toESM(require_sheetUrls(), 1);
function mapFromObject(obj) {
  return new Map(Object.entries(obj || {}));
}
function mapToObject(map) {
  const out = {};
  if (!map) return out;
  for (const [k, v] of map.entries()) out[k] = v;
  return out;
}
function mergeNormSubsetIntoObject(target, map, norms) {
  if (!map || !target) return;
  for (const norm of norms) {
    if (map.has(norm)) target[norm] = map.get(norm);
  }
}
function statsRowForNorm(statsMap, norm) {
  const row = statsMap?.get(norm);
  if (!row) return null;
  return { PA: row.PA, Runs: row.Runs, RBI: row.RBI };
}
function deserializeReplacementMap(obj) {
  const byOriginalNorm = /* @__PURE__ */ new Map();
  for (const [norm, entry] of Object.entries(obj || {})) {
    if (!entry?.replacementNorm) continue;
    byOriginalNorm.set(norm, entry);
  }
  return byOriginalNorm;
}
function effectiveNormsFromCtx(ctx) {
  const norms = /* @__PURE__ */ new Set();
  for (const name of [...ctx.awayPlayers || [], ...ctx.homePlayers || []]) {
    const n = (0, import_dfs.normalizePlayerName)(name);
    if (n) norms.add(n);
  }
  return norms;
}
async function hydrateMatchupReplacements(ctx) {
  if (!ctx) return ctx;
  const [replacements, scoring] = await Promise.all([
    (0, import_playerReplacements.getCachedPlayerReplacements)(),
    (0, import_dfsLeaderboardScoringContext.getCachedDfsLeaderboardScoringContext)()
  ]);
  const { byOriginalNorm } = replacements;
  const gameIsoDate = ctx.gameIsoDate || null;
  const activeReplacements = (0, import_playerReplacements.filterReplacementsForDate)(byOriginalNorm, gameIsoDate);
  const origAway = ctx.awayPlayersOriginal || ctx.awayPlayers || [];
  const origHome = ctx.homePlayersOriginal || ctx.homePlayers || [];
  ctx.awayPlayersOriginal = [...origAway];
  ctx.homePlayersOriginal = [...origHome];
  ctx.awayPlayers = (0, import_playerReplacements.applyReplacementsToPlayerNames)(origAway, activeReplacements);
  ctx.homePlayers = (0, import_playerReplacements.applyReplacementsToPlayerNames)(origHome, activeReplacements);
  ctx.replacementByOriginalNorm = (0, import_playerReplacements.serializeReplacementsForClient)(activeReplacements);
  const norms = effectiveNormsFromCtx(ctx);
  const { offenseRatingByNorm, stats2026ByPlayer } = scoring.scoringDeps || {};
  ctx.offenseRatingByNorm = ctx.offenseRatingByNorm || {};
  ctx.stats2026ByPlayer = ctx.stats2026ByPlayer || {};
  mergeNormSubsetIntoObject(ctx.offenseRatingByNorm, offenseRatingByNorm, norms);
  for (const norm of norms) {
    const row = statsRowForNorm(stats2026ByPlayer, norm);
    if (row) ctx.stats2026ByPlayer[norm] = row;
  }
  const positionByNorm = mapFromObject(ctx.positionByNorm);
  for (const sidePlayers of [origAway, origHome]) {
    const entries = (0, import_playerReplacements.buildRosterEntriesWithReplacements)(
      sidePlayers,
      import_dfs.normalizePlayerName,
      positionByNorm,
      activeReplacements
    );
    for (const e of entries) {
      if (e.position) positionByNorm.set(e.norm, e.position);
    }
  }
  ctx.positionByNorm = mapToObject(positionByNorm);
  return ctx;
}
function predictFromPayload(ctx, awayMissingList, homeMissingList) {
  const byOriginalNorm = deserializeReplacementMap(ctx.replacementByOriginalNorm);
  const awayBench = (0, import_playerReplacements.remapLineupNorms)(awayMissingList, byOriginalNorm);
  const homeBench = (0, import_playerReplacements.remapLineupNorms)(homeMissingList, byOriginalNorm);
  const awayMissing = new Set(awayBench.map((n) => (0, import_dfs.normalizePlayerName)(n)).filter(Boolean));
  const homeMissing = new Set(homeBench.map((n) => (0, import_dfs.normalizePlayerName)(n)).filter(Boolean));
  const offenseRatingByNorm = mapFromObject(ctx.offenseRatingByNorm);
  const stats2026ByPlayer = mapFromObject(ctx.stats2026ByPlayer);
  const defenseZByNorm = mapFromObject(ctx.defenseZByNorm);
  const positionByNorm = mapFromObject(ctx.positionByNorm);
  let awayProfile = (0, import_matchupMissingPlayers.applyMissingPlayersToProfile)(
    ctx.awayBaseProfile,
    ctx.awayPlayers,
    awayMissing,
    offenseRatingByNorm,
    stats2026ByPlayer,
    defenseZByNorm,
    import_dfs.normalizePlayerName,
    positionByNorm
  );
  let homeProfile = (0, import_matchupMissingPlayers.applyMissingPlayersToProfile)(
    ctx.homeBaseProfile,
    ctx.homePlayers,
    homeMissing,
    offenseRatingByNorm,
    stats2026ByPlayer,
    defenseZByNorm,
    import_dfs.normalizePlayerName,
    positionByNorm
  );
  const prediction = (0, import_matchupPredict.predictMatchupGame)(awayProfile, homeProfile, ctx.leagueNorms, ctx.runBase);
  (0, import_matchupPredict.enrichMatchupPredictionLines)(prediction);
  prediction.awayLabel = ctx.awayLabel;
  prediction.homeLabel = ctx.homeLabel;
  return prediction;
}
var DEFAULT_SCORE_POLL_MS = Number("90000") || 9e4;
function selectedGameFromCtx(ctx) {
  if (!ctx) return null;
  return {
    awayTeamId: ctx.awayBaseProfile?.teamId,
    homeTeamId: ctx.homeBaseProfile?.teamId,
    isoDate: ctx.gameIsoDate,
    gameId: ctx.gameId || ""
  };
}
function watchMatchupLiveScores({ ctx, getPrediction, onFinished, pollMs = DEFAULT_SCORE_POLL_MS }) {
  if (!ctx || ctx.isFinishedGame) return () => {
  };
  let stopped = false;
  let timer = null;
  async function check() {
    if (stopped || ctx.isFinishedGame) return;
    try {
      await (0, import_sheetUrls.invalidateSourceCsvCache)(import_sheetUrls.SOURCE_KEYS.schedule);
      const schedule = await (0, import_dfsLeaderboardScoringContext.loadWeeklySchedule)();
      const parsedGame = (0, import_matchupGameResult.findParsedGameForMatchup)(
        schedule.parsedGames,
        selectedGameFromCtx(ctx),
        ctx.gameIsoDate
      );
      if (!(0, import_matchupGameResult.isParsedGameFinished)(parsedGame)) return;
      const prediction = typeof getPrediction === "function" ? getPrediction() : ctx.gameResult?.modelPrediction;
      if (!prediction) return;
      const gameResult = (0, import_matchupGameResult.gradeMatchupModelBets)(
        parsedGame,
        prediction,
        ctx.awayLabel,
        ctx.homeLabel
      );
      if (!gameResult) return;
      ctx.isFinishedGame = true;
      ctx.gameResult = gameResult;
      stopped = true;
      if (timer) clearInterval(timer);
      if (typeof onFinished === "function") onFinished(gameResult);
    } catch (err) {
      console.error("Matchup score poll failed", err);
    }
  }
  void check();
  timer = window.setInterval(() => {
    void check();
  }, Math.max(3e4, Number(pollMs) || DEFAULT_SCORE_POLL_MS));
  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };
}
var scoreWatchStop = null;
function benchNormsFromForm() {
  function parseList(value) {
    return String(value || "").split(",").map((s) => s.trim()).filter(Boolean);
  }
  const awayInput = document.getElementById("awayMissing");
  const homeInput = document.getElementById("homeMissing");
  return {
    away: parseList(awayInput?.value),
    home: parseList(homeInput?.value)
  };
}
function autoStartScoreWatcher() {
  if (scoreWatchStop) return;
  const ctx = typeof window !== "undefined" ? window.__MATCHUP_CLIENT__ : null;
  if (!ctx || ctx.isFinishedGame) return;
  if (!document.querySelector(".matchup-prediction:not(.matchup-prediction--final)")) return;
  scoreWatchStop = watchMatchupLiveScores({
    ctx,
    getPrediction: () => {
      const { away, home } = benchNormsFromForm();
      return predictFromPayload(ctx, away, home);
    },
    onFinished: (gameResult) => {
      window.MmsMatchupPredictorUi?.renderGameResultUi?.(gameResult);
      window.MmsMatchupPredictorLive?.refreshSeasonRecord?.({ force: true });
      window.MmsMatchupPredictorLive?.refreshLiveGamelogMissing?.(ctx);
    }
  });
}
if (typeof window !== "undefined") {
  window.MmsMatchupPredictor = {
    predictFromPayload,
    buildLineupEnrichment: import_matchupLineupClient.buildMatchupLineupEnrichment,
    hydrateMatchupReplacements,
    watchMatchupLiveScores
  };
  const kickScoreWatch = () => window.setTimeout(autoStartScoreWatcher, 1500);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kickScoreWatch);
  } else {
    kickScoreWatch();
  }
}
var export_buildMatchupLineupEnrichment = import_matchupLineupClient.buildMatchupLineupEnrichment;
export {
  export_buildMatchupLineupEnrichment as buildMatchupLineupEnrichment,
  hydrateMatchupReplacements,
  predictFromPayload,
  watchMatchupLiveScores
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
