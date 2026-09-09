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
  const handleNativeTap = (0, import_react.useCallback)(() => {
    const currentPhase = phaseRef.current;
    if (currentPhase === "idle") {
      launchRef.current().catch(() => {
      });
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
      if (shouldLaunch) launchRef.current().catch(() => {
      });
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
          if (phase === "idle") launch().catch(() => {
          });
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
