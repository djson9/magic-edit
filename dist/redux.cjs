var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// redux/index.ts
var index_exports = {};
__export(index_exports, {
  magicEditMiddleware: () => magicEditMiddleware
});
module.exports = __toCommonJS(index_exports);

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
  const seen = /* @__PURE__ */ new WeakMap();
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
    const previousPath = seen.get(candidate);
    if (previousPath) return tag("circular", { path: previousPath });
    seen.set(candidate, path);
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
  };
  return visit(value, "$");
}
function utf8ByteLength(value) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).byteLength;
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
    root.fetch = function magicEditFetch(input, init) {
      const details = requestDetails(input, init);
      if (internalUpload(details.requestHeaders)) return originalFetch.apply(this, [input, init]);
      const sequence = runtime.beginNetwork({ transport: "fetch", ...details });
      let request;
      try {
        request = originalFetch.apply(this, [input, init]);
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
  monotonicNow: () => typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()
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
    const endAt = Number(transitions[end].wallTimeMs);
    while (start < end && endAt - Number(transitions[start].wallTimeMs) > 1e3) start += 1;
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
  appMetadata = {
    id: typeof location !== "undefined" && location.host ? location.host : "unknown-app",
    platform: typeof navigator !== "undefined" ? navigator.platform || "unknown" : "unknown"
  };
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

// redux/index.ts
var magicEditMiddleware = (store) => {
  const runtime = diagnosticRuntime();
  const storeId = runtime.attachStore(store, store.getState());
  return (next) => (action) => {
    const before = store.getState();
    const started = runtime.time();
    let result;
    let thrown;
    let didThrow = false;
    try {
      result = next(action);
    } catch (error) {
      didThrow = true;
      thrown = error;
    }
    const completed = runtime.time();
    runtime.recordAction(
      storeId,
      action,
      before,
      store.getState(),
      started.now,
      started.monotonicNow,
      completed.monotonicNow,
      didThrow,
      thrown
    );
    if (didThrow) throw thrown;
    return result;
  };
};
