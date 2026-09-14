var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// react-native/index.tsx
var index_exports = {};
__export(index_exports, {
  MagicEditBubble: () => MagicEditBubble,
  isMagicEditBubbleDrag: () => isMagicEditBubbleDrag,
  magicEditBubblePosition: () => magicEditBubblePosition,
  magicEditRecipientThreadIds: () => magicEditRecipientThreadIds
});
module.exports = __toCommonJS(index_exports);
var import_react = __toESM(require("react"), 1);
var import_react_native = require("react-native");

// src/diagnostics/normalize.ts
function tag(type, values = {}) {
  return { $magicEditType: type, ...values };
}
function objectName(value) {
  try {
    return value.constructor?.name || "Object";
  } catch {
    return "Object";
  }
}
function bytesFromView(value) {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return Array.from(bytes);
}
function normalizeDiagnosticValue(value) {
  const ancestors = /* @__PURE__ */ new WeakMap();
  const visit = (candidate, path) => {
    if (candidate === null || typeof candidate === "string" || typeof candidate === "boolean") {
      return candidate;
    }
    if (typeof candidate === "number") {
      return Number.isFinite(candidate) ? candidate : tag("number", { value: String(candidate) });
    }
    if (typeof candidate === "undefined") return tag("undefined");
    if (typeof candidate === "bigint") return tag("bigint", { value: candidate.toString() });
    if (typeof candidate === "symbol") return tag("symbol", { value: candidate.description ?? "" });
    if (typeof candidate === "function") {
      return tag("function", { name: candidate.name || "", source: String(candidate) });
    }
    if (typeof candidate !== "object") return tag(typeof candidate, { value: String(candidate) });
    const previousPath = ancestors.get(candidate);
    if (previousPath) return tag("circular", { path: previousPath });
    ancestors.set(candidate, path);
    try {
      if (candidate instanceof Date) {
        return tag("date", { value: Number.isNaN(candidate.getTime()) ? "Invalid Date" : candidate.toISOString() });
      }
      if (candidate instanceof Error) {
        const normalized2 = {
          name: candidate.name,
          message: candidate.message,
          stack: candidate.stack ?? null
        };
        for (const key of Object.keys(candidate)) {
          try {
            normalized2[key] = visit(candidate[key], `${path}.${key}`);
          } catch (error) {
            normalized2[key] = tag("property-error", { error: String(error) });
          }
        }
        return tag("error", normalized2);
      }
      if (candidate instanceof Map) {
        return tag("map", {
          entries: Array.from(candidate.entries(), ([key, entry], index) => [
            visit(key, `${path}.mapKey[${index}]`),
            visit(entry, `${path}.mapValue[${index}]`)
          ])
        });
      }
      if (candidate instanceof Set) {
        return tag("set", {
          values: Array.from(candidate.values(), (entry, index) => visit(entry, `${path}.set[${index}]`))
        });
      }
      if (candidate instanceof ArrayBuffer || ArrayBuffer.isView(candidate)) {
        return tag(objectName(candidate), { bytes: bytesFromView(candidate) });
      }
      if (Array.isArray(candidate)) {
        return candidate.map((entry, index) => visit(entry, `${path}[${index}]`));
      }
      const normalized = {};
      const prototypeName = objectName(candidate);
      if (prototypeName !== "Object") normalized.$magicEditPrototype = prototypeName;
      for (const key of Object.keys(candidate)) {
        try {
          Object.defineProperty(normalized, key, {
            configurable: true,
            enumerable: true,
            writable: true,
            value: visit(candidate[key], `${path}.${key}`)
          });
        } catch (error) {
          Object.defineProperty(normalized, key, {
            configurable: true,
            enumerable: true,
            writable: true,
            value: tag("property-error", { error: String(error) })
          });
        }
      }
      return normalized;
    } finally {
      ancestors.delete(candidate);
    }
  };
  return visit(value, "$");
}
function utf8ByteLength(value) {
  const Encoder = globalThis.TextEncoder;
  if (Encoder) return new Encoder().encode(value).byteLength;
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 128) bytes += 1;
    else if (code < 2048) bytes += 2;
    else if (code >= 55296 && code <= 56319 && index + 1 < value.length) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

// src/diagnostics/network.ts
var INSTALLATION_KEY = Symbol.for("@djson9/magic-edit/network-installation/v1");
var XHR_RECORD_KEY = Symbol.for("@djson9/magic-edit/xhr-record/v1");
function headersRecord(headers) {
  const result = {};
  if (!headers) return result;
  try {
    if (typeof headers.forEach === "function") {
      ;
      headers.forEach((value, key) => {
        result[String(key)] = String(value);
      });
      return result;
    }
    if (Array.isArray(headers)) {
      for (const entry of headers) {
        if (Array.isArray(entry) && entry.length >= 2) result[String(entry[0])] = String(entry[1]);
      }
      return result;
    }
    if (typeof headers === "object") {
      for (const [key, value] of Object.entries(headers)) {
        result[key] = Array.isArray(value) ? value.map(String).join(", ") : String(value);
      }
    }
  } catch {
    return result;
  }
  return result;
}
function internalUpload(headers) {
  return Object.entries(headers).some(([key, value]) => key.toLowerCase() === "x-magic-edit-internal" && value === "capture-upload");
}
function bodyBytes(body) {
  if (typeof body === "string") return utf8ByteLength(body);
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return utf8ByteLength(body.toString());
  }
  if (typeof Blob !== "undefined" && body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  return null;
}
function requestDetails(input, init) {
  const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
  const initHeaders = headersRecord(init?.headers);
  const requestHeaders = Object.keys(initHeaders).length ? initHeaders : headersRecord(request?.headers);
  return {
    method: String(init?.method || request?.method || "GET").toUpperCase(),
    url: String(request?.url || input),
    requestHeaders,
    requestBytes: bodyBytes(init?.body)
  };
}
function responseBytes(response) {
  const contentLength = response.headers?.get?.("content-length");
  if (contentLength && /^\d+$/.test(contentLength)) return Number(contentLength);
  return null;
}
function responseOutcome(response) {
  return response.status >= 400 ? "http_error" : "success";
}
function errorOutcome(error) {
  const name = error && typeof error === "object" ? String(error.name ?? "") : "";
  return name === "AbortError" ? "aborted" : name === "TimeoutError" ? "timeout" : "network_error";
}
function xhrResponseHeaders(xhr) {
  const result = {};
  try {
    const raw = xhr.getAllResponseHeaders?.() || "";
    for (const line of raw.trim().split(/[\r\n]+/)) {
      const separator = line.indexOf(":");
      if (separator > 0) result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
  } catch {
    return result;
  }
  return result;
}
function xhrResponseBytes(xhr) {
  const headers = xhrResponseHeaders(xhr);
  const length = Object.entries(headers).find(([key]) => key.toLowerCase() === "content-length")?.[1];
  if (length && /^\d+$/.test(length)) return Number(length);
  try {
    if (xhr.responseType === "" || xhr.responseType === "text") return utf8ByteLength(xhr.responseText || "");
    if (xhr.response instanceof ArrayBuffer) return xhr.response.byteLength;
    if (typeof Blob !== "undefined" && xhr.response instanceof Blob) return xhr.response.size;
  } catch {
    return null;
  }
  return null;
}
function installNetworkRecorder(runtime) {
  const root = globalThis;
  if (root[INSTALLATION_KEY]) return;
  const installation = {};
  if (typeof root.fetch === "function") {
    const originalFetch = root.fetch;
    installation.fetch = originalFetch;
    root.fetch = function magicEditFetch(...args) {
      const [input, init] = args;
      const details = requestDetails(input, init);
      if (internalUpload(details.requestHeaders)) return originalFetch.apply(this, args);
      const sequence = runtime.beginNetwork({ transport: "fetch", ...details });
      let request;
      try {
        request = originalFetch.apply(this, args);
      } catch (error) {
        runtime.completeNetwork(sequence, { outcome: errorOutcome(error), error });
        throw error;
      }
      return request.then((response) => {
        runtime.completeNetwork(sequence, {
          status: response.status,
          outcome: responseOutcome(response),
          responseHeaders: headersRecord(response.headers),
          responseBytes: responseBytes(response)
        });
        return response;
      }, (error) => {
        runtime.completeNetwork(sequence, { outcome: errorOutcome(error), error });
        throw error;
      });
    };
  }
  const XHR = root.XMLHttpRequest;
  if (typeof XHR === "function" && XHR.prototype) {
    const prototype = XHR.prototype;
    const originalOpen = prototype.open;
    const originalSend = prototype.send;
    const originalSetRequestHeader = prototype.setRequestHeader;
    installation.xhrOpen = originalOpen;
    installation.xhrSend = originalSend;
    installation.xhrSetRequestHeader = originalSetRequestHeader;
    prototype.open = function magicEditOpen(method, url, ...rest) {
      ;
      this[XHR_RECORD_KEY] = {
        method: String(method).toUpperCase(),
        url: String(url),
        requestHeaders: {}
      };
      return originalOpen.apply(this, [method, url, ...rest]);
    };
    prototype.setRequestHeader = function magicEditSetRequestHeader(name, value) {
      const metadata = this[XHR_RECORD_KEY];
      const headers = metadata?.requestHeaders;
      if (headers) headers[name] = headers[name] ? `${headers[name]}, ${value}` : String(value);
      return originalSetRequestHeader.apply(this, [name, value]);
    };
    prototype.send = function magicEditSend(body) {
      const metadata = this[XHR_RECORD_KEY];
      const requestHeaders = headersRecord(metadata?.requestHeaders);
      if (!metadata || internalUpload(requestHeaders)) return originalSend.apply(this, [body]);
      const xhr = this;
      const sequence = runtime.beginNetwork({
        transport: "xhr",
        method: metadata.method,
        url: metadata.url,
        requestHeaders,
        requestBytes: bodyBytes(body)
      });
      let settled = false;
      let forcedOutcome = null;
      const settle = () => {
        if (settled) return;
        settled = true;
        const status = Number(xhr.status) || 0;
        runtime.completeNetwork(sequence, {
          status,
          outcome: forcedOutcome || (status === 0 ? "network_error" : status >= 400 ? "http_error" : "success"),
          responseHeaders: xhrResponseHeaders(xhr),
          responseBytes: xhrResponseBytes(xhr)
        });
      };
      xhr.addEventListener("abort", () => {
        forcedOutcome = "aborted";
      });
      xhr.addEventListener("timeout", () => {
        forcedOutcome = "timeout";
      });
      xhr.addEventListener("error", () => {
        forcedOutcome = "network_error";
      });
      xhr.addEventListener("loadend", settle);
      try {
        return originalSend.apply(this, [body]);
      } catch (error) {
        forcedOutcome = errorOutcome(error);
        settle();
        throw error;
      }
    };
  }
  root[INSTALLATION_KEY] = installation;
}
function restoreNetworkRecorderForTests() {
  const root = globalThis;
  const installation = root[INSTALLATION_KEY];
  if (!installation) return;
  if (installation.fetch) root.fetch = installation.fetch;
  const XHR = root.XMLHttpRequest;
  if (typeof XHR === "function" && XHR.prototype) {
    if (installation.xhrOpen) XHR.prototype.open = installation.xhrOpen;
    if (installation.xhrSend) XHR.prototype.send = installation.xhrSend;
    if (installation.xhrSetRequestHeader) {
      XHR.prototype.setRequestHeader = installation.xhrSetRequestHeader;
    }
  }
  delete root[INSTALLATION_KEY];
}

// src/diagnostics/runtime.ts
var DEFAULT_CLOCK = {
  now: () => Date.now(),
  monotonicNow: () => {
    const candidate = globalThis.performance;
    return typeof candidate?.now === "function" ? candidate.now() : Date.now();
  }
};
var GLOBAL_KEY = Symbol.for("@djson9/magic-edit/diagnostics/v1");
function iso(milliseconds) {
  return new Date(milliseconds).toISOString();
}
function recordObject(value) {
  return value && typeof value === "object" ? value : {};
}
function actionType(action) {
  const type = recordObject(action).type;
  return typeof type === "string" ? type : String(type ?? "<unknown>");
}
function topLevelChanges(before, after) {
  if (before === after) return [];
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return ["$root"];
  const left = before;
  const right = after;
  return Array.from(/* @__PURE__ */ new Set([...Object.keys(left), ...Object.keys(right)])).filter((key) => left[key] !== right[key]);
}
function operationDetails(action) {
  const record = recordObject(action);
  const meta = recordObject(record.meta);
  const requestId = typeof meta.requestId === "string" ? meta.requestId : null;
  const explicitStatus = typeof meta.requestStatus === "string" ? meta.requestStatus : null;
  const type = actionType(action);
  const suffix = type.match(/\/(pending|fulfilled|rejected)$/)?.[1] ?? null;
  const status = explicitStatus || suffix;
  if (!requestId || !["pending", "fulfilled", "rejected"].includes(status ?? "")) return null;
  return {
    requestId,
    status,
    operation: suffix ? type.slice(0, -(suffix.length + 1)) : type,
    aborted: meta.aborted === true,
    condition: meta.condition === true
  };
}
function actionStormCount(transitions) {
  let storms = 0;
  let start = 0;
  let insideStorm = false;
  for (let end = 0; end < transitions.length; end += 1) {
    const endTransition = transitions[end];
    if (!endTransition) continue;
    const endAt = Number(endTransition.wallTimeMs);
    while (start < end) {
      const startTransition = transitions[start];
      if (!startTransition || endAt - Number(startTransition.wallTimeMs) <= 1e3) break;
      start += 1;
    }
    const isStorm = end - start + 1 >= 20;
    if (isStorm && !insideStorm) storms += 1;
    insideStorm = isStorm;
  }
  return storms;
}
var MagicEditDiagnosticRuntime = class {
  clock = DEFAULT_CLOCK;
  nextStoreNumber = 1;
  globalSequence = 0;
  nextNetworkSequence = 1;
  stores = /* @__PURE__ */ new Map();
  storeStates = /* @__PURE__ */ new Map();
  pendingOperations = /* @__PURE__ */ new Map();
  settledOperations = [];
  networkRequests = [];
  activeNetwork = /* @__PURE__ */ new Map();
  runtimeEvents = [];
  recorderErrors = [];
  listeners = /* @__PURE__ */ new Set();
  appMetadata = (() => {
    const environment = globalThis;
    return {
      id: environment.location?.host || "unknown-app",
      platform: environment.navigator?.platform || "unknown"
    };
  })();
  networkInstalled = false;
  stallTimer = null;
  setClockForTests(clock) {
    this.clock = clock;
  }
  time() {
    return { now: this.clock.now(), monotonicNow: this.clock.monotonicNow() };
  }
  attachStore(store, initialState) {
    const existing = this.stores.get(store);
    if (existing) return existing.storeId;
    const state = {
      storeId: `store-${this.nextStoreNumber++}`,
      lastActionAt: null,
      currentState: normalizeDiagnosticValue(initialState),
      transitions: []
    };
    this.stores.set(store, state);
    this.storeStates.set(state.storeId, state);
    if (!this.networkInstalled) {
      this.networkInstalled = true;
      try {
        installNetworkRecorder(this);
      } catch (error) {
        this.recordError("network_install_failed", error);
      }
      this.installStallSampler();
    }
    this.emit();
    return state.storeId;
  }
  hasAttachedStore() {
    return this.storeStates.size > 0;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  currentReduxSequence() {
    return this.globalSequence;
  }
  recordAction(storeId, action, before, after, startedAt, startedMonotonicAtMs, completedMonotonicAtMs, didThrow, thrown) {
    const store = this.storeStates.get(storeId);
    if (!store) return;
    try {
      const sequence = ++this.globalSequence;
      const changedSlices = topLevelChanges(before, after);
      const transition = {
        sequence,
        storeId,
        type: actionType(action),
        at: iso(startedAt),
        wallTimeMs: startedAt,
        monotonicAtMs: startedMonotonicAtMs,
        dispatchDurationMs: Math.max(0, completedMonotonicAtMs - startedMonotonicAtMs),
        sincePreviousActionMs: store.lastActionAt === null ? null : Math.max(0, startedAt - store.lastActionAt),
        changedSlices,
        noOp: before === after,
        action: normalizeDiagnosticValue(action),
        resultingState: normalizeDiagnosticValue(after),
        ...didThrow ? { threw: normalizeDiagnosticValue(thrown) } : {}
      };
      store.lastActionAt = startedAt;
      store.currentState = transition.resultingState;
      store.transitions.push(transition);
      this.correlateOperation(storeId, action, transition);
    } catch (error) {
      this.recordError("redux_record_failed", error);
    }
  }
  registerAppMetadata(metadata) {
    try {
      this.appMetadata = recordObject(normalizeDiagnosticValue({ ...this.appMetadata, ...metadata }));
      this.recordRuntimeEvent("app_metadata_registered", this.appMetadata);
    } catch (error) {
      this.recordError("app_metadata_failed", error);
    }
  }
  recordRuntimeEvent(type, details = {}) {
    try {
      const now = this.clock.now();
      this.runtimeEvents.push({
        type,
        at: iso(now),
        wallTimeMs: now,
        monotonicAtMs: this.clock.monotonicNow(),
        details: normalizeDiagnosticValue(details)
      });
    } catch (error) {
      this.recordError("runtime_event_failed", error);
    }
  }
  beginNetwork(details) {
    const sequence = this.nextNetworkSequence++;
    const now = this.clock.now();
    const normalizedDetails = recordObject(normalizeDiagnosticValue(details));
    const record = {
      sequence,
      ...normalizedDetails,
      startedAt: iso(now),
      wallTimeMs: now,
      monotonicAtMs: this.clock.monotonicNow(),
      concurrencyAtStart: this.activeNetwork.size + 1,
      reduxSequenceAtStart: this.globalSequence,
      outcome: "in_flight",
      completedAt: null,
      durationMs: null,
      status: null,
      reduxSequenceAtEnd: null,
      retryOfSequence: this.retryCandidate(details)
    };
    this.activeNetwork.set(sequence, record);
    this.networkRequests.push(record);
    return sequence;
  }
  completeNetwork(sequence, details) {
    const record = this.activeNetwork.get(sequence);
    if (!record) return;
    const now = this.clock.now();
    const monotonic = this.clock.monotonicNow();
    Object.assign(record, recordObject(normalizeDiagnosticValue(details)), {
      completedAt: iso(now),
      completedWallTimeMs: now,
      durationMs: Math.max(0, monotonic - Number(record.monotonicAtMs)),
      reduxSequenceAtEnd: this.globalSequence
    });
    this.activeNetwork.delete(sequence);
  }
  recordError(code, error) {
    const now = this.clock.now();
    this.recorderErrors.push({
      code,
      at: iso(now),
      wallTimeMs: now,
      error: normalizeDiagnosticValue(error)
    });
  }
  snapshot() {
    const now = this.clock.now();
    const monotonic = this.clock.monotonicNow();
    const stores = Array.from(this.storeStates.values(), (store) => ({
      storeId: store.storeId,
      currentState: store.currentState,
      transitions: store.transitions
    }));
    const transitions = stores.flatMap((store) => store.transitions);
    transitions.sort((left, right) => Number(left.sequence) - Number(right.sequence));
    const pending = Array.from(this.pendingOperations.values(), (operation) => ({
      ...operation,
      startedAt: iso(operation.startedAt),
      outcome: "pending",
      settledSequence: null,
      durationMs: Math.max(0, monotonic - operation.startedMonotonicAtMs),
      cancelled: false,
      conditionRejected: false
    }));
    const sliceCounts = /* @__PURE__ */ new Map();
    for (const transition of transitions) {
      for (const slice of transition.changedSlices) {
        sliceCounts.set(slice, (sliceCounts.get(slice) ?? 0) + 1);
      }
    }
    const mostChangedSlice = Array.from(sliceCounts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
    const gaps = transitions.map((transition) => transition.sincePreviousActionMs).filter((value) => typeof value === "number");
    return {
      schemaVersion: 1,
      capture: { createdAt: iso(now), monotonicAtMs: monotonic },
      app: this.appMetadata,
      redux: {
        stores,
        asyncOperations: [...this.settledOperations, ...pending]
      },
      network: { requests: this.networkRequests },
      runtimeEvents: this.runtimeEvents,
      recorderErrors: this.recorderErrors,
      summary: {
        actions: transitions.length,
        stores: stores.length,
        slowDispatches: transitions.filter((entry) => Number(entry.dispatchDurationMs) > 16).length,
        noOpActions: transitions.filter((entry) => entry.noOp === true).length,
        actionStorms: actionStormCount(transitions),
        rejectedOperations: this.settledOperations.filter((entry) => entry.outcome === "rejected").length,
        pendingOperations: pending.length,
        mostChangedSlice,
        largestInterActionGapMs: gaps.length ? Math.max(...gaps) : null,
        networkRequests: this.networkRequests.length,
        inFlightRequests: this.activeNetwork.size,
        peakNetworkConcurrency: this.networkRequests.reduce(
          (peak, request) => Math.max(peak, Number(request.concurrencyAtStart) || 0),
          0
        ),
        recorderErrors: this.recorderErrors.length
      }
    };
  }
  resetForTests() {
    if (this.stallTimer) clearInterval(this.stallTimer);
    this.stallTimer = null;
    this.clock = DEFAULT_CLOCK;
    this.nextStoreNumber = 1;
    this.globalSequence = 0;
    this.nextNetworkSequence = 1;
    this.stores = /* @__PURE__ */ new Map();
    this.storeStates = /* @__PURE__ */ new Map();
    this.pendingOperations = /* @__PURE__ */ new Map();
    this.settledOperations = [];
    this.networkRequests = [];
    this.activeNetwork = /* @__PURE__ */ new Map();
    this.runtimeEvents = [];
    this.recorderErrors = [];
    this.appMetadata = { id: "unknown-app", platform: "unknown" };
    this.networkInstalled = false;
    restoreNetworkRecorderForTests();
    this.emit();
  }
  correlateOperation(storeId, action, transition) {
    const details = operationDetails(action);
    if (!details) return;
    const key = `${storeId}\0${details.requestId}`;
    if (details.status === "pending") {
      this.pendingOperations.set(key, {
        storeId,
        requestId: details.requestId,
        operation: details.operation,
        startedAt: Number(transition.wallTimeMs),
        startedMonotonicAtMs: Number(transition.monotonicAtMs),
        startedSequence: Number(transition.sequence),
        action: transition.action
      });
      return;
    }
    const pending = this.pendingOperations.get(key);
    const startedAt = pending?.startedAt ?? Number(transition.wallTimeMs);
    const startedMonotonicAtMs = pending?.startedMonotonicAtMs ?? Number(transition.monotonicAtMs);
    this.settledOperations.push({
      storeId,
      requestId: details.requestId,
      operation: pending?.operation ?? details.operation,
      outcome: details.status,
      startedAt: iso(startedAt),
      settledAt: transition.at,
      startedSequence: pending?.startedSequence ?? transition.sequence,
      settledSequence: transition.sequence,
      durationMs: Math.max(0, Number(transition.monotonicAtMs) - startedMonotonicAtMs),
      cancelled: details.aborted,
      conditionRejected: details.condition,
      pendingAction: pending?.action ?? null,
      settledAction: transition.action
    });
    this.pendingOperations.delete(key);
  }
  retryCandidate(details) {
    const method = details.method;
    const url = details.url;
    for (let index = this.networkRequests.length - 1; index >= 0; index -= 1) {
      const previous = this.networkRequests[index];
      if (!previous) continue;
      if (previous.method !== method || previous.url !== url) continue;
      const outcome = previous.outcome;
      const status = Number(previous.status);
      if (outcome === "network_error" || outcome === "timeout" || outcome === "aborted" || status >= 400) {
        return previous.sequence;
      }
      return null;
    }
    return null;
  }
  installStallSampler() {
    if (typeof setInterval !== "function" || this.stallTimer) return;
    let expected = this.clock.monotonicNow() + 250;
    this.stallTimer = setInterval(() => {
      const observed = this.clock.monotonicNow();
      const drift = observed - expected;
      expected = observed + 250;
      if (drift > 50) this.recordRuntimeEvent("javascript_event_loop_stall", { durationMs: drift });
    }, 250);
    const timer = this.stallTimer;
    timer.unref?.();
  }
  emit() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
      }
    }
  }
};
function diagnosticRuntime() {
  const root = globalThis;
  if (!root[GLOBAL_KEY]) root[GLOBAL_KEY] = new MagicEditDiagnosticRuntime();
  return root[GLOBAL_KEY];
}

// src/diagnostics/capture-client.ts
var MAGIC_EDIT_CAPTURE_ENDPOINT = "https://magicedit.dev/api/v1/captures";
function receipt(value) {
  if (!value || typeof value !== "object") throw new Error("Magic Edit returned an invalid capture receipt.");
  const candidate = value;
  if (candidate.ok !== true || typeof candidate.captureId !== "string" || typeof candidate.captureUrl !== "string" || typeof candidate.latestUrl !== "string" || typeof candidate.storedAt !== "string" || typeof candidate.byteSize !== "number") throw new Error("Magic Edit returned an invalid capture receipt.");
  return candidate;
}
function monotonicNow() {
  const candidate = globalThis.performance;
  return typeof candidate?.now === "function" ? candidate.now() : Date.now();
}
async function uploadMagicEditCapture(fetcher = fetch) {
  const runtime = diagnosticRuntime();
  runtime.recordRuntimeEvent("capture_upload_started");
  const snapshot = runtime.snapshot();
  const body = JSON.stringify(snapshot);
  const appId = typeof snapshot.app.id === "string" && snapshot.app.id.trim() ? snapshot.app.id.trim() : "unknown-app";
  const started = monotonicNow();
  try {
    const response = await fetcher(MAGIC_EDIT_CAPTURE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Magic-Edit-App-Id": appId,
        "X-Magic-Edit-Internal": "capture-upload",
        "X-Magic-Edit-Schema-Version": "1"
      },
      body
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = payload && typeof payload === "object" && typeof payload.error === "string" ? payload.error : `HTTP ${response.status}`;
      throw new Error(`Magic Edit capture failed: ${code}`);
    }
    const result = receipt(payload);
    runtime.recordRuntimeEvent("capture_upload_succeeded", {
      captureId: result.captureId,
      byteSize: utf8ByteLength(body),
      durationMs: monotonicNow() - started
    });
    return result;
  } catch (error) {
    runtime.recordRuntimeEvent("capture_upload_failed", {
      error,
      byteSize: utf8ByteLength(body),
      durationMs: monotonicNow() - started
    });
    throw error;
  }
}

// react-native/index.tsx
var BUBBLE_SIZE = 60;
var BUBBLE_MARGIN = 8;
var DRAG_ACTIVATION_DISTANCE = 6;
var THREAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var NativeMagicEditBubble = import_react_native.Platform.OS === "ios" ? (0, import_react_native.requireNativeComponent)("MagicEditBubble") : null;
function MagicEditBubbleVisual({
  bottomInset,
  dragging,
  onNativeDragEnd,
  onNativeTap,
  phase,
  pressed
}) {
  const active = phase === "inspecting" || phase === "comment";
  const checking = phase === "checking" || phase === "sending";
  const accessibilityLabel = checking ? "Checking Magic Edit" : active ? "Close Magic Edit" : "Magic Edit";
  if (NativeMagicEditBubble) {
    return /* @__PURE__ */ import_react.default.createElement(
      NativeMagicEditBubble,
      {
        accessible: false,
        active,
        bottomInset,
        checking,
        dragging,
        onNativeDragEnd,
        onNativeTap,
        overlayAccessibilityLabel: accessibilityLabel,
        overlayAccessibilityValue: phase,
        pointerEvents: "none",
        pressed,
        style: styles.bubble,
        testID: "magic_edit_bubble"
      }
    );
  }
  return /* @__PURE__ */ import_react.default.createElement(
    import_react_native.View,
    {
      accessible: false,
      pointerEvents: "none",
      style: [styles.bubble, styles.fallback],
      testID: "magic_edit_bubble"
    },
    /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: styles.fallbackGlyph }, active ? "\xD7" : "\u2726")
  );
}
function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}
function magicEditBubblePosition(position, layout, bottomInset) {
  const maximumX = Math.max(BUBBLE_MARGIN, layout.width - BUBBLE_SIZE - BUBBLE_MARGIN);
  const maximumY = Math.max(BUBBLE_MARGIN, layout.height - BUBBLE_SIZE - bottomInset);
  if (!position) return { x: maximumX, y: maximumY };
  return {
    x: clamp(position.x, BUBBLE_MARGIN, maximumX),
    y: clamp(position.y, BUBBLE_MARGIN, maximumY)
  };
}
function isMagicEditBubbleDrag(dx, dy) {
  return Math.abs(dx) > DRAG_ACTIVATION_DISTANCE || Math.abs(dy) > DRAG_ACTIVATION_DISTANCE;
}
function magicEditRecipientThreadIds(threadId, threadIds) {
  const candidates = threadIds?.length ? threadIds : threadId ? [threadId] : [];
  return candidates.reduce((result, candidate) => {
    const normalized = typeof candidate === "string" ? candidate.trim().toLowerCase() : "";
    if (normalized && !result.includes(normalized)) result.push(normalized);
    return result;
  }, []);
}
function selectorModule() {
  return import_react_native.NativeModules.MagicEditSelectorModule;
}
async function responsePayload(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : `ACP Web returned ${response.status}`);
  }
  return payload;
}
function normalizedSelection(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.label !== "string" || typeof value.selector !== "string" || typeof value.screen !== "string") return null;
  const kind = ["ios", "react-native", "web", "webview"].includes(value.kind) ? value.kind : "ios";
  return {
    kind,
    label: value.label.trim().slice(0, 240) || "Unnamed component",
    screen: value.screen.trim().slice(0, 240) || "iOS",
    selector: value.selector.trim().slice(0, 500) || "ios:unknown"
  };
}
function normalizedTargetThread(value, expectedThreadId) {
  if (!value || typeof value !== "object") {
    throw new Error("The destination thread could not be verified.");
  }
  const candidate = value;
  const id = typeof candidate.id === "string" ? candidate.id.trim().toLowerCase() : "";
  if (id !== expectedThreadId) {
    throw new Error("The destination thread could not be verified.");
  }
  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
  return {
    id,
    title: title || `ACP thread ${id.slice(0, 8)}`,
    ...url ? { url } : {}
  };
}
async function postMagicEditComment(apiRoot, threadId, selection, comment) {
  const message = [
    comment,
    "",
    `Selected element: ${selection.label}`,
    `Selector: ${selection.selector}`,
    `Screen: ${selection.screen}`,
    `Platform: ${selection.kind}`
  ].join("\n");
  const response = await fetch(`${apiRoot}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message, threadId })
  });
  await responsePayload(response);
}
function MagicEditBubble({
  apiRoot,
  bottomInset = BUBBLE_MARGIN,
  threadId,
  threadIds,
  threadLinkTarget = "app",
  visible = true
}) {
  const [phase, setPhase] = (0, import_react.useState)("idle");
  const [selection, setSelection] = (0, import_react.useState)(null);
  const [targetThreads, setTargetThreads] = (0, import_react.useState)([]);
  const [activeThreadId, setActiveThreadId] = (0, import_react.useState)(null);
  const [comment, setComment] = (0, import_react.useState)("");
  const [position, setPosition] = (0, import_react.useState)(null);
  const [dragging, setDragging] = (0, import_react.useState)(false);
  const [pressed, setPressed] = (0, import_react.useState)(false);
  const runtime = diagnosticRuntime();
  const [diagnosticsAvailable, setDiagnosticsAvailable] = (0, import_react.useState)(
    runtime.hasAttachedStore()
  );
  const [backgroundUpdates, setBackgroundUpdates] = (0, import_react.useState)(null);
  const layoutRef = (0, import_react.useRef)({ width: 0, height: 0 });
  const positionRef = (0, import_react.useRef)(null);
  const dragOriginRef = (0, import_react.useRef)({ x: 0, y: 0 });
  const gestureWasDragRef = (0, import_react.useRef)(false);
  const bottomInsetRef = (0, import_react.useRef)(bottomInset);
  const launchGenerationRef = (0, import_react.useRef)(0);
  const phaseRef = (0, import_react.useRef)(phase);
  const visibleRef = (0, import_react.useRef)(visible);
  bottomInsetRef.current = bottomInset;
  phaseRef.current = phase;
  visibleRef.current = visible;
  (0, import_react.useEffect)(() => runtime.subscribe(() => {
    setDiagnosticsAvailable(runtime.hasAttachedStore());
  }), [runtime]);
  (0, import_react.useEffect)(() => {
    const nativeSelector = selectorModule();
    runtime.registerAppMetadata({
      platform: import_react_native.Platform.OS,
      osVersion: String(import_react_native.Platform.Version)
    });
    nativeSelector?.appMetadata?.().then(
      (metadata) => runtime.registerAppMetadata(metadata),
      (error) => runtime.recordError("native_app_metadata_failed", error)
    );
    nativeSelector?.backgroundUpdatesStatus?.().then(
      (status) => {
        setBackgroundUpdates(status);
        runtime.recordRuntimeEvent("background_updates_status", status);
      },
      (error) => runtime.recordError("background_updates_status_failed", error)
    );
    runtime.recordRuntimeEvent("app_state_changed", { state: import_react_native.AppState.currentState });
    const subscription = import_react_native.AppState.addEventListener("change", (state) => {
      runtime.recordRuntimeEvent("app_state_changed", { state });
      nativeSelector?.backgroundUpdatesStatus?.().then(
        (status) => setBackgroundUpdates(status),
        (error) => runtime.recordError("background_updates_status_failed", error)
      );
    });
    return () => subscription.remove();
  }, [runtime]);
  const recipientThreadIds = (0, import_react.useMemo)(
    () => magicEditRecipientThreadIds(threadId, threadIds),
    [threadId, threadIds]
  );
  const targetThread = targetThreads.find((target) => target.id === activeThreadId) || targetThreads[0] || null;
  (0, import_react.useEffect)(() => {
    if (activeThreadId && recipientThreadIds.includes(activeThreadId)) return;
    setActiveThreadId(recipientThreadIds[0] || null);
  }, [activeThreadId, recipientThreadIds]);
  const launch = (0, import_react.useCallback)(async () => {
    if (phaseRef.current !== "idle") return;
    const launchGeneration = ++launchGenerationRef.current;
    if (!recipientThreadIds.length || recipientThreadIds.some((id) => !THREAD_ID_PATTERN.test(id))) {
      import_react_native.Alert.alert("Magic Edit", "threadId and every threadIds entry must be a UUID.");
      return;
    }
    const nativeSelector = selectorModule();
    if (!nativeSelector?.select) {
      import_react_native.Alert.alert("Magic Edit", "Native component selection is unavailable in this build.");
      return;
    }
    import_react_native.Keyboard.dismiss();
    setPhase("checking");
    try {
      const verifiedThreads = await Promise.all(recipientThreadIds.map(async (recipientThreadId) => {
        const query = encodeURIComponent(recipientThreadId);
        const response = await fetch(`${apiRoot.replace(/\/+$/, "")}/thread?threadId=${query}`);
        const payload = await responsePayload(response);
        if (payload.ok !== true) throw new Error("A destination thread could not be verified.");
        return normalizedTargetThread(payload.thread, recipientThreadId);
      }));
      if (launchGeneration !== launchGenerationRef.current) return;
      if (threadLinkTarget === "web" && verifiedThreads.some((target) => !target.url)) {
        throw new Error("A destination thread does not provide an ACP Web URL.");
      }
      const selectedThreadId = verifiedThreads.some((target) => target.id === activeThreadId) ? activeThreadId : verifiedThreads[0].id;
      setActiveThreadId(selectedThreadId);
      setTargetThreads(verifiedThreads);
      setPhase("inspecting");
      const nativeSelection = await nativeSelector.select(
        verifiedThreads,
        selectedThreadId,
        threadLinkTarget
      );
      const selected = normalizedSelection(nativeSelection);
      if (launchGeneration !== launchGenerationRef.current) return;
      if (!selected) {
        setTargetThreads([]);
        setPhase("idle");
        return;
      }
      const selectionThreadId = nativeSelection?.recipientThreadId;
      const selectedRecipientId = verifiedThreads.some((target) => target.id === selectionThreadId) ? selectionThreadId : selectedThreadId;
      setActiveThreadId(selectedRecipientId);
      if (nativeSelector.composeComment) {
        setPhase("comment");
        const nativeCommentResult = await nativeSelector.composeComment(
          selected,
          verifiedThreads,
          selectedRecipientId,
          threadLinkTarget
        );
        if (launchGeneration !== launchGenerationRef.current) return;
        const text = typeof nativeCommentResult?.comment === "string" ? nativeCommentResult.comment.trim() : "";
        if (!text) {
          setTargetThreads([]);
          setPhase("idle");
          return;
        }
        const commentThreadId = verifiedThreads.some(
          (target) => target.id === nativeCommentResult?.recipientThreadId
        ) ? nativeCommentResult.recipientThreadId : selectedRecipientId;
        setActiveThreadId(commentThreadId);
        setPhase("sending");
        try {
          await postMagicEditComment(apiRoot.replace(/\/+$/, ""), commentThreadId, selected, text);
          if (launchGeneration !== launchGenerationRef.current) return;
          setTargetThreads([]);
          setPhase("idle");
        } catch (error) {
          if (launchGeneration !== launchGenerationRef.current) return;
          setSelection(selected);
          setComment(text);
          setPhase("comment");
          import_react_native.Alert.alert(
            "Could not send comment",
            error instanceof Error ? error.message : "Please try again."
          );
        }
        return;
      }
      setSelection(selected);
      setComment("");
      setPhase("comment");
    } catch (error) {
      if (launchGeneration !== launchGenerationRef.current) return;
      setTargetThreads([]);
      setPhase("idle");
      import_react_native.Alert.alert("Magic Edit", error instanceof Error ? error.message : "Selection could not start.");
    }
  }, [activeThreadId, apiRoot, recipientThreadIds, threadLinkTarget]);
  (0, import_react.useEffect)(() => () => {
    launchGenerationRef.current += 1;
    if (phaseRef.current === "inspecting" || phaseRef.current === "comment") {
      selectorModule()?.cancel?.();
    }
  }, []);
  const submitComment = (0, import_react.useCallback)(async () => {
    const text = comment.trim();
    if (!selection || !text || phase === "sending") return;
    setPhase("sending");
    try {
      if (!targetThread) throw new Error("Choose a destination thread.");
      await postMagicEditComment(apiRoot.replace(/\/+$/, ""), targetThread.id, selection, text);
      setSelection(null);
      setTargetThreads([]);
      setComment("");
      setPhase("idle");
    } catch (error) {
      setPhase("comment");
      import_react_native.Alert.alert("Could not send comment", error instanceof Error ? error.message : "Please try again.");
    }
  }, [apiRoot, comment, phase, selection, targetThread]);
  const updatePosition = (0, import_react.useCallback)((candidate) => {
    const next = magicEditBubblePosition(candidate, layoutRef.current, bottomInsetRef.current);
    positionRef.current = next;
    setPosition(next);
  }, []);
  (0, import_react.useEffect)(() => {
    if (layoutRef.current.width <= 0 || layoutRef.current.height <= 0) return;
    updatePosition(positionRef.current || magicEditBubblePosition(
      null,
      layoutRef.current,
      bottomInsetRef.current
    ));
  }, [bottomInset, updatePosition]);
  const launchRef = (0, import_react.useRef)(launch);
  launchRef.current = launch;
  const saveDebugMetadata = (0, import_react.useCallback)(async () => {
    setPhase("checking");
    try {
      const capture = await uploadMagicEditCapture();
      import_react_native.Alert.alert(
        "Magic Edit capture saved",
        `Capture ${capture.captureId}
${capture.captureUrl}`
      );
    } catch (error) {
      import_react_native.Alert.alert(
        "Could not save debug metadata",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setPhase("idle");
    }
  }, []);
  const toggleBackgroundUpdates = (0, import_react.useCallback)(async () => {
    const nativeSelector = selectorModule();
    if (!backgroundUpdates || !nativeSelector?.setBackgroundUpdatesEnabled) return;
    setPhase("checking");
    try {
      const status = await nativeSelector.setBackgroundUpdatesEnabled(
        !backgroundUpdates.enabled
      );
      setBackgroundUpdates(status);
      runtime.recordRuntimeEvent("background_updates_changed", status);
      import_react_native.Alert.alert(
        "Magic Edit",
        status.enabled ? "Background updates are active for this development app. Force quitting the app still stops them." : "Background updates are off."
      );
    } catch (error) {
      runtime.recordError("background_updates_change_failed", error);
      import_react_native.Alert.alert(
        "Could not change background updates",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setPhase("idle");
    }
  }, [backgroundUpdates, runtime]);
  const activate = (0, import_react.useCallback)(() => {
    if (!diagnosticsAvailable && backgroundUpdates?.supported !== true) {
      launchRef.current().catch(() => {
      });
      return;
    }
    import_react_native.Keyboard.dismiss();
    const actions = recipientThreadIds.length ? [
      {
        text: "Select interface element",
        onPress: () => launchRef.current().catch(() => {
        })
      },
      ...diagnosticsAvailable ? [{
        text: "Save debug metadata",
        onPress: () => {
          saveDebugMetadata().catch(() => {
          });
        }
      }] : [],
      ...backgroundUpdates?.supported ? [{
        text: backgroundUpdates.enabled ? "Stop background updates" : "Keep updates active in background",
        onPress: () => {
          toggleBackgroundUpdates().catch(() => {
          });
        }
      }] : [],
      { text: "Cancel", style: "cancel" }
    ] : [
      ...diagnosticsAvailable ? [{
        text: "Save debug metadata",
        onPress: () => {
          saveDebugMetadata().catch(() => {
          });
        }
      }] : [],
      ...backgroundUpdates?.supported ? [{
        text: backgroundUpdates.enabled ? "Stop background updates" : "Keep updates active in background",
        onPress: () => {
          toggleBackgroundUpdates().catch(() => {
          });
        }
      }] : [],
      { text: "Cancel", style: "cancel" }
    ];
    import_react_native.Alert.alert("Magic Edit", "Choose what you want to do.", actions);
  }, [
    backgroundUpdates,
    diagnosticsAvailable,
    recipientThreadIds.length,
    saveDebugMetadata,
    toggleBackgroundUpdates
  ]);
  const activateRef = (0, import_react.useRef)(activate);
  activateRef.current = activate;
  const handleNativeTap = (0, import_react.useCallback)(() => {
    const currentPhase = phaseRef.current;
    if (currentPhase === "idle") {
      activateRef.current();
      return;
    }
    if (currentPhase === "sending") return;
    launchGenerationRef.current += 1;
    selectorModule()?.cancel?.();
    setSelection(null);
    setTargetThreads([]);
    setComment("");
    setPhase("idle");
  }, []);
  const handleNativeDragEnd = (0, import_react.useCallback)(({ nativeEvent }) => {
    updatePosition(nativeEvent);
  }, [updatePosition]);
  const panResponder = (0, import_react.useMemo)(() => import_react_native.PanResponder.create({
    onStartShouldSetPanResponder: () => visibleRef.current,
    onPanResponderGrant: () => {
      dragOriginRef.current = positionRef.current || magicEditBubblePosition(
        null,
        layoutRef.current,
        bottomInsetRef.current
      );
      gestureWasDragRef.current = false;
      setPressed(true);
    },
    onPanResponderMove: (_event, gesture) => {
      if (!gestureWasDragRef.current && isMagicEditBubbleDrag(gesture.dx, gesture.dy)) {
        gestureWasDragRef.current = true;
        setPressed(false);
        setDragging(true);
      }
      if (!gestureWasDragRef.current) return;
      updatePosition({
        x: dragOriginRef.current.x + gesture.dx,
        y: dragOriginRef.current.y + gesture.dy
      });
    },
    onPanResponderRelease: () => {
      const shouldLaunch = !gestureWasDragRef.current && phaseRef.current === "idle";
      setPressed(false);
      setDragging(false);
      gestureWasDragRef.current = false;
      if (shouldLaunch) activateRef.current();
    },
    onPanResponderTerminate: () => {
      gestureWasDragRef.current = false;
      setPressed(false);
      setDragging(false);
    },
    onPanResponderTerminationRequest: () => true,
    onShouldBlockNativeResponder: () => true
  }), [updatePosition]);
  const handleLayout = (0, import_react.useCallback)(({ nativeEvent }) => {
    const nextLayout = {
      width: nativeEvent.layout.width,
      height: nativeEvent.layout.height
    };
    layoutRef.current = nextLayout;
    const next = magicEditBubblePosition(positionRef.current, nextLayout, bottomInsetRef.current);
    positionRef.current = next;
    setPosition(next);
  }, []);
  const shown = visible;
  return /* @__PURE__ */ import_react.default.createElement(
    import_react_native.View,
    {
      onLayout: handleLayout,
      pointerEvents: shown ? "box-none" : "none",
      style: styles.dragLayer,
      testID: "magic_edit_drag_layer"
    },
    shown ? /* @__PURE__ */ import_react.default.createElement(
      import_react_native.View,
      {
        ...panResponder.panHandlers,
        accessible: import_react_native.Platform.OS !== "ios",
        accessibilityElementsHidden: import_react_native.Platform.OS === "ios",
        accessibilityHint: "Select an iOS, React Native, or web component. Drag to move.",
        accessibilityLabel: phase === "checking" ? "Checking Magic Edit" : phase === "inspecting" ? "Selecting component" : "Magic Edit",
        accessibilityRole: "button",
        accessibilityState: { disabled: phase !== "idle" },
        collapsable: false,
        onAccessibilityTap: () => {
          if (phase === "idle") activateRef.current();
        },
        style: [
          styles.dragHandle,
          position ? { left: position.x, top: position.y } : { right: BUBBLE_MARGIN, bottom: bottomInset }
        ],
        testID: "magic_edit_drag_handle"
      },
      /* @__PURE__ */ import_react.default.createElement(
        MagicEditBubbleVisual,
        {
          bottomInset,
          dragging,
          onNativeDragEnd: handleNativeDragEnd,
          onNativeTap: handleNativeTap,
          phase,
          pressed
        }
      )
    ) : null,
    /* @__PURE__ */ import_react.default.createElement(
      import_react_native.Modal,
      {
        animationType: "slide",
        onRequestClose: () => {
          if (phase !== "sending") {
            setSelection(null);
            setTargetThreads([]);
            setPhase("idle");
          }
        },
        presentationStyle: "pageSheet",
        visible: selection != null
      },
      /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: styles.commentSheet, testID: "magic_edit_comment_sheet" }, targetThread ? /* @__PURE__ */ import_react.default.createElement(
        import_react_native.Pressable,
        {
          accessibilityLabel: `Sending to ${targetThread.title}`,
          accessibilityHint: targetThreads.length > 1 ? "Switches to the next recipient thread" : void 0,
          onPress: () => {
            if (targetThreads.length < 2) return;
            const currentIndex = targetThreads.findIndex((target) => target.id === targetThread.id);
            setActiveThreadId(targetThreads[(currentIndex + 1) % targetThreads.length].id);
          },
          style: styles.targetThread,
          testID: "magic_edit_target_thread"
        },
        /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: styles.targetThreadEyebrow }, "SENDING TO ACP THREAD"),
        /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { numberOfLines: 2, style: styles.targetThreadTitle }, targetThread.title),
        /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { numberOfLines: 1, style: styles.targetThreadId }, targetThread.id)
      ) : null, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: styles.commentHeader }, /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: styles.commentHeadingCopy }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: styles.commentEyebrow }, "SELECTED ", selection?.kind.toUpperCase()), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: styles.commentHeading }, "Add a comment")), /* @__PURE__ */ import_react.default.createElement(
        import_react_native.Pressable,
        {
          accessibilityLabel: "Close comment",
          disabled: phase === "sending",
          onPress: () => {
            setSelection(null);
            setTargetThreads([]);
            setPhase("idle");
          },
          style: styles.closeButton,
          testID: "magic_edit_close_comment"
        },
        /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: styles.closeButtonText }, "\xD7")
      )), /* @__PURE__ */ import_react.default.createElement(import_react_native.View, { style: styles.selectionContext }, /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { numberOfLines: 1, style: styles.selectionLabel }, selection?.label), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { numberOfLines: 2, style: styles.selectionSelector }, selection?.selector)), /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: styles.inputLabel }, "What should change?"), /* @__PURE__ */ import_react.default.createElement(
        import_react_native.TextInput,
        {
          autoFocus: true,
          editable: phase !== "sending",
          multiline: true,
          onChangeText: setComment,
          placeholder: "Describe the change you want\u2026",
          placeholderTextColor: "#77737f",
          style: styles.commentInput,
          testID: "magic_edit_comment_input",
          value: comment
        }
      ), /* @__PURE__ */ import_react.default.createElement(
        import_react_native.Pressable,
        {
          accessibilityRole: "button",
          disabled: !comment.trim() || phase === "sending",
          onPress: () => submitComment().catch(() => {
          }),
          style: ({ pressed: submitPressed }) => [
            styles.submitButton,
            (!comment.trim() || phase === "sending") && styles.submitButtonDisabled,
            submitPressed && styles.submitButtonPressed
          ],
          testID: "magic_edit_submit_comment"
        },
        phase === "sending" ? /* @__PURE__ */ import_react.default.createElement(import_react_native.ActivityIndicator, { color: "#ffffff" }) : /* @__PURE__ */ import_react.default.createElement(import_react_native.Text, { style: styles.submitButtonText }, "Send to ACP thread \u2192")
      ))
    )
  );
}
var styles = import_react_native.StyleSheet.create({
  bubble: { width: BUBBLE_SIZE, height: BUBBLE_SIZE },
  dragLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 30
  },
  dragHandle: { position: "absolute", width: BUBBLE_SIZE, height: BUBBLE_SIZE },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#a78bfa",
    backgroundColor: "rgba(44, 38, 64, 0.94)"
  },
  fallbackGlyph: { color: "#c4b5fd", fontSize: 26, fontWeight: "700" },
  commentSheet: { flex: 1, padding: 20, backgroundColor: "#1a1a1f" },
  targetThread: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3f3955",
    backgroundColor: "#24222c"
  },
  targetThreadEyebrow: {
    color: "#9d8cff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7
  },
  targetThreadTitle: { marginTop: 4, color: "#f1eef8", fontSize: 16, fontWeight: "700" },
  targetThreadId: { marginTop: 4, color: "#8f899b", fontSize: 10 },
  commentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  commentHeadingCopy: { flex: 1 },
  commentEyebrow: { color: "#9f91ff", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  commentHeading: { marginTop: 4, color: "#f3f1f6", fontSize: 25, fontWeight: "700" },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#29282e"
  },
  closeButtonText: { color: "#aaa5b4", fontSize: 26, lineHeight: 28 },
  selectionContext: {
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    borderWidth: import_react_native.StyleSheet.hairlineWidth,
    borderColor: "#403b49",
    backgroundColor: "#151519"
  },
  selectionLabel: { color: "#d4d0db", fontSize: 14, fontWeight: "700" },
  selectionSelector: { marginTop: 5, color: "#827c8d", fontSize: 12 },
  inputLabel: {
    marginTop: 20,
    marginBottom: 8,
    color: "#c2bdc9",
    fontSize: 14,
    fontWeight: "700"
  },
  commentInput: {
    minHeight: 140,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4c4655",
    color: "#f0eef3",
    backgroundColor: "#111114",
    fontSize: 17,
    textAlignVertical: "top"
  },
  submitButton: {
    minHeight: 50,
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#7666df"
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonPressed: { transform: [{ scale: 0.98 }] },
  submitButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "800" }
});
