import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Keyboard,
  type LayoutChangeEvent,
  Modal,
  NativeModules,
  type NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  requireNativeComponent,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewProps,
} from 'react-native';
import { uploadMagicEditCapture } from '../src/diagnostics/capture-client';
import { diagnosticRuntime } from '../src/diagnostics/runtime';

type MagicEditPhase = 'idle' | 'checking' | 'inspecting' | 'comment' | 'sending';
type Point = { x: number; y: number };
type Size = { width: number; height: number };
type NativeSelection = {
  kind: 'ios' | 'react-native' | 'web' | 'webview';
  label: string;
  screen: string;
  selector: string;
};
type MagicEditTargetThread = {
  id: string;
  title: string;
  url?: string;
};
type NativeSelectionResult = NativeSelection & { recipientThreadId?: string };
type NativeCommentResult = { comment?: string; recipientThreadId?: string };
export type MagicEditThreadLinkTarget = 'app' | 'web';
type MagicEditSelectorModule = {
  appMetadata?(): Promise<Record<string, unknown>>;
  cancel?(): void;
  composeComment?(
    selection: NativeSelection,
    targetThreads: MagicEditTargetThread[],
    selectedThreadId: string,
    threadLinkTarget: MagicEditThreadLinkTarget,
  ): Promise<NativeCommentResult | null>;
  select(
    targetThreads: MagicEditTargetThread[],
    selectedThreadId: string,
    threadLinkTarget: MagicEditThreadLinkTarget,
  ): Promise<NativeSelectionResult | null>;
};
type NativeMagicEditBubbleProps = ViewProps & {
  active: boolean;
  bottomInset: number;
  checking: boolean;
  dragging: boolean;
  onNativeDragEnd(event: NativeSyntheticEvent<Point>): void;
  onNativeTap(): void;
  overlayAccessibilityLabel: string;
  overlayAccessibilityValue: string;
  pressed: boolean;
};

export type MagicEditBubbleProps = {
  apiRoot: string;
  bottomInset?: number;
  threadId?: string;
  threadIds?: readonly string[];
  threadLinkTarget?: MagicEditThreadLinkTarget;
  visible?: boolean;
};

const BUBBLE_SIZE = 60;
const BUBBLE_MARGIN = 8;
const DRAG_ACTIVATION_DISTANCE = 6;
const THREAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NativeMagicEditBubble = Platform.OS === 'ios'
  ? requireNativeComponent<NativeMagicEditBubbleProps>('MagicEditBubble')
  : null;

function MagicEditBubbleVisual({
  bottomInset,
  dragging,
  onNativeDragEnd,
  onNativeTap,
  phase,
  pressed,
}: {
  bottomInset: number;
  dragging: boolean;
  onNativeDragEnd(event: NativeSyntheticEvent<Point>): void;
  onNativeTap(): void;
  phase: MagicEditPhase;
  pressed: boolean;
}) {
  const active = phase === 'inspecting' || phase === 'comment';
  const checking = phase === 'checking' || phase === 'sending';
  const accessibilityLabel = checking
    ? 'Checking Magic Edit'
    : active ? 'Close Magic Edit' : 'Magic Edit';

  if (NativeMagicEditBubble) {
    return (
      <NativeMagicEditBubble
        accessible={false}
        active={active}
        bottomInset={bottomInset}
        checking={checking}
        dragging={dragging}
        onNativeDragEnd={onNativeDragEnd}
        onNativeTap={onNativeTap}
        overlayAccessibilityLabel={accessibilityLabel}
        overlayAccessibilityValue={phase}
        pointerEvents="none"
        pressed={pressed}
        style={styles.bubble}
        testID="magic_edit_bubble"
      />
    );
  }

  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={[styles.bubble, styles.fallback]}
      testID="magic_edit_bubble">
      <Text style={styles.fallbackGlyph}>{active ? '×' : '✦'}</Text>
    </View>
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function magicEditBubblePosition(
  position: Point | null,
  layout: Size,
  bottomInset: number,
): Point {
  const maximumX = Math.max(BUBBLE_MARGIN, layout.width - BUBBLE_SIZE - BUBBLE_MARGIN);
  const maximumY = Math.max(BUBBLE_MARGIN, layout.height - BUBBLE_SIZE - bottomInset);
  if (!position) return { x: maximumX, y: maximumY };
  return {
    x: clamp(position.x, BUBBLE_MARGIN, maximumX),
    y: clamp(position.y, BUBBLE_MARGIN, maximumY),
  };
}

export function isMagicEditBubbleDrag(dx: number, dy: number) {
  return Math.abs(dx) > DRAG_ACTIVATION_DISTANCE || Math.abs(dy) > DRAG_ACTIVATION_DISTANCE;
}

export function magicEditRecipientThreadIds(
  threadId?: string,
  threadIds?: readonly string[],
) {
  const candidates = threadIds?.length ? threadIds : threadId ? [threadId] : [];
  return candidates.reduce<string[]>((result, candidate) => {
    const normalized = typeof candidate === 'string' ? candidate.trim().toLowerCase() : '';
    if (normalized && !result.includes(normalized)) result.push(normalized);
    return result;
  }, []);
}

function selectorModule() {
  return NativeModules.MagicEditSelectorModule as MagicEditSelectorModule | undefined;
}

async function responsePayload(response: Response) {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : `ACP Web returned ${response.status}`);
  }
  return payload;
}

function normalizedSelection(value: NativeSelection | null): NativeSelection | null {
  if (!value || typeof value !== 'object') return null;
  if (
    typeof value.label !== 'string' ||
    typeof value.selector !== 'string' ||
    typeof value.screen !== 'string'
  ) return null;
  const kind = ['ios', 'react-native', 'web', 'webview'].includes(value.kind)
    ? value.kind
    : 'ios';
  return {
    kind,
    label: value.label.trim().slice(0, 240) || 'Unnamed component',
    screen: value.screen.trim().slice(0, 240) || 'iOS',
    selector: value.selector.trim().slice(0, 500) || 'ios:unknown',
  };
}

function normalizedTargetThread(
  value: unknown,
  expectedThreadId: string,
): MagicEditTargetThread {
  if (!value || typeof value !== 'object') {
    throw new Error('The destination thread could not be verified.');
  }
  const candidate = value as Record<string, unknown>;
  const id = typeof candidate.id === 'string' ? candidate.id.trim().toLowerCase() : '';
  if (id !== expectedThreadId) {
    throw new Error('The destination thread could not be verified.');
  }
  const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
  const url = typeof candidate.url === 'string' ? candidate.url.trim() : '';
  return {
    id,
    title: title || `ACP thread ${id.slice(0, 8)}`,
    ...(url ? { url } : {}),
  };
}

async function postMagicEditComment(
  apiRoot: string,
  threadId: string,
  selection: NativeSelection,
  comment: string,
) {
  const message = [
    comment,
    '',
    `Selected element: ${selection.label}`,
    `Selector: ${selection.selector}`,
    `Screen: ${selection.screen}`,
    `Platform: ${selection.kind}`,
  ].join('\n');
  const response = await fetch(`${apiRoot}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message, threadId }),
  });
  await responsePayload(response);
}

export function MagicEditBubble({
  apiRoot,
  bottomInset = BUBBLE_MARGIN,
  threadId,
  threadIds,
  threadLinkTarget = 'app',
  visible = true,
}: MagicEditBubbleProps) {
  const [phase, setPhase] = useState<MagicEditPhase>('idle');
  const [selection, setSelection] = useState<NativeSelection | null>(null);
  const [targetThreads, setTargetThreads] = useState<MagicEditTargetThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [position, setPosition] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pressed, setPressed] = useState(false);
  const runtime = diagnosticRuntime();
  const [diagnosticsAvailable, setDiagnosticsAvailable] = useState(
    runtime.hasAttachedStore(),
  );
  const layoutRef = useRef<Size>({ width: 0, height: 0 });
  const positionRef = useRef<Point | null>(null);
  const dragOriginRef = useRef<Point>({ x: 0, y: 0 });
  const gestureWasDragRef = useRef(false);
  const bottomInsetRef = useRef(bottomInset);
  const launchGenerationRef = useRef(0);
  const phaseRef = useRef(phase);
  const visibleRef = useRef(visible);
  bottomInsetRef.current = bottomInset;
  phaseRef.current = phase;
  visibleRef.current = visible;

  useEffect(() => runtime.subscribe(() => {
    setDiagnosticsAvailable(runtime.hasAttachedStore());
  }), [runtime]);

  useEffect(() => {
    const nativeSelector = selectorModule();
    runtime.registerAppMetadata({
      platform: Platform.OS,
      osVersion: String(Platform.Version),
    });
    nativeSelector?.appMetadata?.().then(
      metadata => runtime.registerAppMetadata(metadata),
      error => runtime.recordError('native_app_metadata_failed', error),
    );
    runtime.recordRuntimeEvent('app_state_changed', { state: AppState.currentState });
    const subscription = AppState.addEventListener('change', state => {
      runtime.recordRuntimeEvent('app_state_changed', { state });
    });
    return () => subscription.remove();
  }, [runtime]);

  const recipientThreadIds = useMemo(
    () => magicEditRecipientThreadIds(threadId, threadIds),
    [threadId, threadIds],
  );
  const targetThread = targetThreads.find(target => target.id === activeThreadId)
    || targetThreads[0]
    || null;

  useEffect(() => {
    if (activeThreadId && recipientThreadIds.includes(activeThreadId)) return;
    setActiveThreadId(recipientThreadIds[0] || null);
  }, [activeThreadId, recipientThreadIds]);

  const launch = useCallback(async () => {
    if (phaseRef.current !== 'idle') return;
    const launchGeneration = ++launchGenerationRef.current;
    if (!recipientThreadIds.length || recipientThreadIds.some(id => !THREAD_ID_PATTERN.test(id))) {
      Alert.alert('Magic Edit', 'threadId and every threadIds entry must be a UUID.');
      return;
    }
    const nativeSelector = selectorModule();
    if (!nativeSelector?.select) {
      Alert.alert('Magic Edit', 'Native component selection is unavailable in this build.');
      return;
    }

    Keyboard.dismiss();
    setPhase('checking');
    try {
      const verifiedThreads = await Promise.all(recipientThreadIds.map(async recipientThreadId => {
        const query = encodeURIComponent(recipientThreadId);
        const response = await fetch(`${apiRoot.replace(/\/+$/, '')}/thread?threadId=${query}`);
        const payload = await responsePayload(response);
        if (payload.ok !== true) throw new Error('A destination thread could not be verified.');
        return normalizedTargetThread(payload.thread, recipientThreadId);
      }));
      if (launchGeneration !== launchGenerationRef.current) return;
      if (threadLinkTarget === 'web' && verifiedThreads.some(target => !target.url)) {
        throw new Error('A destination thread does not provide an ACP Web URL.');
      }
      const selectedThreadId = verifiedThreads.some(target => target.id === activeThreadId)
        ? activeThreadId as string
        : verifiedThreads[0]!.id;
      setActiveThreadId(selectedThreadId);
      setTargetThreads(verifiedThreads);
      setPhase('inspecting');
      const nativeSelection = await nativeSelector.select(
        verifiedThreads,
        selectedThreadId,
        threadLinkTarget,
      );
      const selected = normalizedSelection(nativeSelection);
      if (launchGeneration !== launchGenerationRef.current) return;
      if (!selected) {
        setTargetThreads([]);
        setPhase('idle');
        return;
      }
      const selectionThreadId = nativeSelection?.recipientThreadId;
      const selectedRecipientId = verifiedThreads.some(target => target.id === selectionThreadId)
        ? selectionThreadId as string
        : selectedThreadId;
      setActiveThreadId(selectedRecipientId);
      if (nativeSelector.composeComment) {
        setPhase('comment');
        const nativeCommentResult = await nativeSelector.composeComment(
          selected,
          verifiedThreads,
          selectedRecipientId,
          threadLinkTarget,
        );
        if (launchGeneration !== launchGenerationRef.current) return;
        const text = typeof nativeCommentResult?.comment === 'string'
          ? nativeCommentResult.comment.trim()
          : '';
        if (!text) {
          setTargetThreads([]);
          setPhase('idle');
          return;
        }
        const commentThreadId = verifiedThreads.some(
          target => target.id === nativeCommentResult?.recipientThreadId,
        ) ? nativeCommentResult!.recipientThreadId as string : selectedRecipientId;
        setActiveThreadId(commentThreadId);
        setPhase('sending');
        try {
          await postMagicEditComment(apiRoot.replace(/\/+$/, ''), commentThreadId, selected, text);
          if (launchGeneration !== launchGenerationRef.current) return;
          setTargetThreads([]);
          setPhase('idle');
        } catch (error) {
          if (launchGeneration !== launchGenerationRef.current) return;
          setSelection(selected);
          setComment(text);
          setPhase('comment');
          Alert.alert(
            'Could not send comment',
            error instanceof Error ? error.message : 'Please try again.',
          );
        }
        return;
      }
      setSelection(selected);
      setComment('');
      setPhase('comment');
    } catch (error) {
      if (launchGeneration !== launchGenerationRef.current) return;
      setTargetThreads([]);
      setPhase('idle');
      Alert.alert('Magic Edit', error instanceof Error ? error.message : 'Selection could not start.');
    }
  }, [activeThreadId, apiRoot, recipientThreadIds, threadLinkTarget]);

  useEffect(() => () => {
    launchGenerationRef.current += 1;
    if (phaseRef.current === 'inspecting' || phaseRef.current === 'comment') {
      selectorModule()?.cancel?.();
    }
  }, []);

  const submitComment = useCallback(async () => {
    const text = comment.trim();
    if (!selection || !text || phase === 'sending') return;
    setPhase('sending');
    try {
      if (!targetThread) throw new Error('Choose a destination thread.');
      await postMagicEditComment(apiRoot.replace(/\/+$/, ''), targetThread.id, selection, text);
      setSelection(null);
      setTargetThreads([]);
      setComment('');
      setPhase('idle');
    } catch (error) {
      setPhase('comment');
      Alert.alert('Could not send comment', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [apiRoot, comment, phase, selection, targetThread]);

  const updatePosition = useCallback((candidate: Point) => {
    const next = magicEditBubblePosition(candidate, layoutRef.current, bottomInsetRef.current);
    positionRef.current = next;
    setPosition(next);
  }, []);

  useEffect(() => {
    if (layoutRef.current.width <= 0 || layoutRef.current.height <= 0) return;
    updatePosition(positionRef.current || magicEditBubblePosition(
      null,
      layoutRef.current,
      bottomInsetRef.current,
    ));
  }, [bottomInset, updatePosition]);

  const launchRef = useRef(launch);
  launchRef.current = launch;
  const saveDebugMetadata = useCallback(async () => {
    setPhase('checking');
    try {
      const capture = await uploadMagicEditCapture();
      Alert.alert(
        'Magic Edit capture saved',
        `Capture ${capture.captureId}\n${capture.captureUrl}`,
      );
    } catch (error) {
      Alert.alert(
        'Could not save debug metadata',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setPhase('idle');
    }
  }, []);
  const activate = useCallback(() => {
    if (!diagnosticsAvailable) {
      launchRef.current().catch(() => {});
      return;
    }
    Keyboard.dismiss();
    const actions = recipientThreadIds.length ? [
      {
        text: 'Select interface element',
        onPress: () => launchRef.current().catch(() => {}),
      },
      {
        text: 'Save debug metadata',
        onPress: () => { saveDebugMetadata().catch(() => {}); },
      },
      { text: 'Cancel', style: 'cancel' as const },
    ] : [
      {
        text: 'Save debug metadata',
        onPress: () => { saveDebugMetadata().catch(() => {}); },
      },
      { text: 'Cancel', style: 'cancel' as const },
    ];
    Alert.alert('Magic Edit', 'Choose what you want to do.', actions);
  }, [diagnosticsAvailable, recipientThreadIds.length, saveDebugMetadata]);
  const activateRef = useRef(activate);
  activateRef.current = activate;
  const handleNativeTap = useCallback(() => {
    const currentPhase = phaseRef.current;
    if (currentPhase === 'idle') {
      activateRef.current();
      return;
    }
    if (currentPhase === 'sending') return;
    launchGenerationRef.current += 1;
    selectorModule()?.cancel?.();
    setSelection(null);
    setTargetThreads([]);
    setComment('');
    setPhase('idle');
  }, []);
  const handleNativeDragEnd = useCallback(({ nativeEvent }: NativeSyntheticEvent<Point>) => {
    updatePosition(nativeEvent);
  }, [updatePosition]);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => visibleRef.current,
    onPanResponderGrant: () => {
      dragOriginRef.current = positionRef.current || magicEditBubblePosition(
        null,
        layoutRef.current,
        bottomInsetRef.current,
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
        y: dragOriginRef.current.y + gesture.dy,
      });
    },
    onPanResponderRelease: () => {
      const shouldLaunch = !gestureWasDragRef.current && phaseRef.current === 'idle';
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
    onShouldBlockNativeResponder: () => true,
  }), [updatePosition]);

  const handleLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    const nextLayout = {
      width: nativeEvent.layout.width,
      height: nativeEvent.layout.height,
    };
    layoutRef.current = nextLayout;
    const next = magicEditBubblePosition(positionRef.current, nextLayout, bottomInsetRef.current);
    positionRef.current = next;
    setPosition(next);
  }, []);

  const shown = visible;
  return (
    <View
      onLayout={handleLayout}
      pointerEvents={shown ? 'box-none' : 'none'}
      style={styles.dragLayer}
      testID="magic_edit_drag_layer">
      {shown ? (
        <View
          {...panResponder.panHandlers}
          accessible={Platform.OS !== 'ios'}
          accessibilityElementsHidden={Platform.OS === 'ios'}
          accessibilityHint="Select an iOS, React Native, or web component. Drag to move."
          accessibilityLabel={phase === 'checking'
            ? 'Checking Magic Edit'
            : phase === 'inspecting' ? 'Selecting component' : 'Magic Edit'}
          accessibilityRole="button"
          accessibilityState={{ disabled: phase !== 'idle' }}
          collapsable={false}
          onAccessibilityTap={() => {
            if (phase === 'idle') activateRef.current();
          }}
          style={[
            styles.dragHandle,
            position
              ? { left: position.x, top: position.y }
              : { right: BUBBLE_MARGIN, bottom: bottomInset },
          ]}
          testID="magic_edit_drag_handle">
          <MagicEditBubbleVisual
            bottomInset={bottomInset}
            dragging={dragging}
            onNativeDragEnd={handleNativeDragEnd}
            onNativeTap={handleNativeTap}
            phase={phase}
            pressed={pressed}
          />
        </View>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() => {
          if (phase !== 'sending') {
            setSelection(null);
            setTargetThreads([]);
            setPhase('idle');
          }
        }}
        presentationStyle="pageSheet"
        visible={selection != null}>
        <View style={styles.commentSheet} testID="magic_edit_comment_sheet">
          {targetThread ? (
            <Pressable
              accessibilityLabel={`Sending to ${targetThread.title}`}
              accessibilityHint={targetThreads.length > 1 ? 'Switches to the next recipient thread' : undefined}
              onPress={() => {
                if (targetThreads.length < 2) return;
                const currentIndex = targetThreads.findIndex(target => target.id === targetThread.id);
                setActiveThreadId(targetThreads[(currentIndex + 1) % targetThreads.length]!.id);
              }}
              style={styles.targetThread}
              testID="magic_edit_target_thread">
              <Text style={styles.targetThreadEyebrow}>SENDING TO ACP THREAD</Text>
              <Text numberOfLines={2} style={styles.targetThreadTitle}>{targetThread.title}</Text>
              <Text numberOfLines={1} style={styles.targetThreadId}>{targetThread.id}</Text>
            </Pressable>
          ) : null}
          <View style={styles.commentHeader}>
            <View style={styles.commentHeadingCopy}>
              <Text style={styles.commentEyebrow}>SELECTED {selection?.kind.toUpperCase()}</Text>
              <Text style={styles.commentHeading}>Add a comment</Text>
            </View>
            <Pressable
              accessibilityLabel="Close comment"
              disabled={phase === 'sending'}
              onPress={() => {
                setSelection(null);
                setTargetThreads([]);
                setPhase('idle');
              }}
              style={styles.closeButton}
              testID="magic_edit_close_comment">
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>
          <View style={styles.selectionContext}>
            <Text numberOfLines={1} style={styles.selectionLabel}>{selection?.label}</Text>
            <Text numberOfLines={2} style={styles.selectionSelector}>{selection?.selector}</Text>
          </View>
          <Text style={styles.inputLabel}>What should change?</Text>
          <TextInput
            autoFocus
            editable={phase !== 'sending'}
            multiline
            onChangeText={setComment}
            placeholder="Describe the change you want…"
            placeholderTextColor="#77737f"
            style={styles.commentInput}
            testID="magic_edit_comment_input"
            value={comment}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!comment.trim() || phase === 'sending'}
            onPress={() => submitComment().catch(() => {})}
            style={({ pressed: submitPressed }) => [
              styles.submitButton,
              (!comment.trim() || phase === 'sending') && styles.submitButtonDisabled,
              submitPressed && styles.submitButtonPressed,
            ]}
            testID="magic_edit_submit_comment">
            {phase === 'sending' ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Send to ACP thread →</Text>
            )}
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { width: BUBBLE_SIZE, height: BUBBLE_SIZE },
  dragLayer: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 30,
  },
  dragHandle: { position: 'absolute', width: BUBBLE_SIZE, height: BUBBLE_SIZE },
  fallback: {
    alignItems: 'center', justifyContent: 'center', borderRadius: 30, borderWidth: 1,
    borderColor: '#a78bfa', backgroundColor: 'rgba(44, 38, 64, 0.94)',
  },
  fallbackGlyph: { color: '#c4b5fd', fontSize: 26, fontWeight: '700' },
  commentSheet: { flex: 1, padding: 20, backgroundColor: '#1a1a1f' },
  targetThread: {
    marginBottom: 16, padding: 12, borderRadius: 12, borderWidth: 1,
    borderColor: '#3f3955', backgroundColor: '#24222c',
  },
  targetThreadEyebrow: {
    color: '#9d8cff', fontSize: 10, fontWeight: '800', letterSpacing: 0.7,
  },
  targetThreadTitle: { marginTop: 4, color: '#f1eef8', fontSize: 16, fontWeight: '700' },
  targetThreadId: { marginTop: 4, color: '#8f899b', fontSize: 10 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  commentHeadingCopy: { flex: 1 },
  commentEyebrow: { color: '#9f91ff', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  commentHeading: { marginTop: 4, color: '#f3f1f6', fontSize: 25, fontWeight: '700' },
  closeButton: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, backgroundColor: '#29282e',
  },
  closeButtonText: { color: '#aaa5b4', fontSize: 26, lineHeight: 28 },
  selectionContext: {
    marginTop: 18, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#403b49', backgroundColor: '#151519',
  },
  selectionLabel: { color: '#d4d0db', fontSize: 14, fontWeight: '700' },
  selectionSelector: { marginTop: 5, color: '#827c8d', fontSize: 12 },
  inputLabel: {
    marginTop: 20, marginBottom: 8, color: '#c2bdc9', fontSize: 14, fontWeight: '700',
  },
  commentInput: {
    minHeight: 140, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#4c4655',
    color: '#f0eef3', backgroundColor: '#111114', fontSize: 17, textAlignVertical: 'top',
  },
  submitButton: {
    minHeight: 50, marginTop: 16, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, backgroundColor: '#7666df',
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonPressed: { transform: [{ scale: 0.98 }] },
  submitButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
