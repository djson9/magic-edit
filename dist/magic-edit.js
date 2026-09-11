/* @djson9/magic-edit v0.5.1 | https://github.com/djson9/magic-edit */
(() => {
  if (document.getElementById('magic-edit-styles')) return
  const style = document.createElement('style')
  style.id = 'magic-edit-styles'
  style.textContent = ".rrc-ui, .rrc-ui * { box-sizing: border-box; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", sans-serif; }\n.rrc-ui[hidden], .rrc-ui [hidden] { display: none !important; }\n.rrc-launcher { position: fixed; z-index: 2147483600; left: 50%; bottom: max(12px, env(safe-area-inset-bottom)); display: flex; gap: 5px; padding: 5px; transform: translateX(-50%); border: 1px solid #4a4658; border-radius: 13px; background: rgba(28,28,33,.96); box-shadow: 0 13px 38px rgba(0,0,0,.46); backdrop-filter: blur(16px); }\n.rrc-launcher button { min-height: 39px; display: inline-flex; align-items: center; gap: 7px; padding: 0 13px; border: 0; border-radius: 8px; color: white; background: #7666df; font-size: 11px; font-weight: 750; cursor: pointer; }\n.rrc-launcher button:hover { background: #8979ec; }\n.rrc-launcher button:disabled { opacity: .65; cursor: wait; }\n.rrc-thread-destination { position: fixed; z-index: 2147483606; top: max(10px, env(safe-area-inset-top)); left: 50%; max-width: calc(100vw - 20px); min-height: 34px; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 5px 6px 5px 11px; transform: translateX(-50%); overflow: hidden; border: 1px solid rgba(151,137,224,.38); border-radius: 999px; color: #b9b4c7; background: rgba(28,27,34,.94); box-shadow: 0 8px 24px rgba(0,0,0,.34); backdrop-filter: blur(14px); font-size: 10px; font-weight: 650; line-height: 1; white-space: nowrap; }\n.rrc-thread-copy { min-width: 0; display: flex; align-items: center; overflow: hidden; }\n.rrc-thread-destination a { min-width: 0; overflow: hidden; color: #b7a9ff; font: inherit; text-decoration: underline; text-decoration-color: rgba(183,169,255,.45); text-overflow: ellipsis; white-space: nowrap; }\n.rrc-thread-destination .rrc-help-link { flex: none; min-height: 24px; display: inline-flex; align-items: center; padding: 0 9px; border: 1px solid rgba(183,169,255,.26); border-radius: 999px; color: #d4ccff; background: rgba(112,103,200,.14); text-decoration: none; }\n.rrc-thread-destination .rrc-help-link:hover { background: rgba(112,103,200,.24); }\n.rrc-thread-destination a:focus-visible { outline: 2px solid rgba(183,169,255,.65); outline-offset: 2px; border-radius: 3px; }\n\n.rrc-inspector-surface { position: fixed; z-index: 2147483500; inset: 0; touch-action: none; user-select: none; cursor: none; }\n.rrc-target-highlight { position: fixed; z-index: 2147483501; pointer-events: none; border: 2px solid #9a86ff; border-radius: 5px; background: rgba(130,104,246,.1); box-shadow: 0 0 0 1px rgba(17,17,20,.68); }\n.rrc-target-highlight span { position: absolute; left: -2px; bottom: calc(100% + 4px); max-width: min(330px, 82vw); padding: 4px 7px; overflow: hidden; border-radius: 5px; color: white; background: #7c69e7; font-size: 9px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }\n.rrc-target-highlight span.rrc-inside { top: 4px; bottom: auto; }\n.rrc-virtual-cursor { position: fixed; z-index: 2147483503; width: 28px; height: 32px; pointer-events: none; transform: translate(-3px,-3px); filter: drop-shadow(0 2px 1px #000) drop-shadow(0 0 4px #000); }\n.rrc-virtual-cursor::before { content: ''; display: block; width: 22px; height: 27px; background: #fff; clip-path: polygon(0 0, 88% 69%, 55% 72%, 73% 96%, 58% 100%, 40% 77%, 0 100%); }\n.rrc-virtual-cursor.rrc-dragging { transform: translate(-3px,-3px) scale(1.08); filter: drop-shadow(0 2px 1px #000) drop-shadow(0 0 8px #907bff); }\n.rrc-inspector-dock { position: fixed; z-index: 2147483504; left: 50%; bottom: max(67px, calc(env(safe-area-inset-bottom) + 55px)); width: min(470px, calc(100vw - 18px)); min-height: 48px; display: flex; align-items: center; gap: 9px; padding: 6px 7px 6px 11px; transform: translateX(-50%); border: 1px solid #575069; border-radius: 10px; color: #e5e0f1; background: rgba(34,32,41,.98); box-shadow: 0 12px 35px rgba(0,0,0,.48); }\n.rrc-inspector-target { min-width: 0; flex: 1; overflow: hidden; font-size: 10px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }\n.rrc-inspector-target small { display: block; margin-bottom: 2px; color: #8c879a; font-size: 7.5px; letter-spacing: .08em; }\n.rrc-inspector-dock button { min-height: 35px; display: inline-flex; align-items: center; gap: 5px; padding: 0 12px; border: 0; border-radius: 7px; color: white; background: #7666df; font-size: 10px; font-weight: 800; cursor: pointer; }\n.rrc-inspector-dock button:disabled { opacity: .4; }\nbody.rrc-inspecting * { cursor: none !important; }\nbody.rrc-inspecting .rrc-ui, body.rrc-inspecting .rrc-ui * { cursor: initial !important; }\nbody.rrc-inspecting .rrc-ui button { cursor: pointer !important; }\nbody.rrc-inspecting .rrc-inspector-surface { cursor: none !important; }\n\n.rrc-overlay { position: fixed; z-index: 2147483610; inset: 0; display: grid; align-items: end; background: rgba(7,7,10,.5); backdrop-filter: blur(4px); }\n.rrc-sheet { width: min(520px, calc(100% - 18px)); max-height: min(680px, calc(100dvh - 28px)); margin: 0 auto 9px; padding: 17px; overflow-y: auto; border: 1px solid #46424f; border-radius: 18px; color: #e8e6ec; background: #1a1a1f; box-shadow: 0 24px 70px rgba(0,0,0,.62); }\n.rrc-sheet-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }\n.rrc-sheet-head small { color: #8d80e9; font-size: 8px; font-weight: 850; letter-spacing: .1em; }\n.rrc-sheet-head h2 { margin: 4px 0 0; color: #e8e6ec; font-size: 19px; letter-spacing: -.025em; }\n.rrc-icon-button { width: 34px; height: 34px; display: grid; place-items: center; flex: none; border: 0; border-radius: 8px; color: #98959f; background: #29282e; font-size: 18px; cursor: pointer; }\n.rrc-element-context { margin-top: 14px; padding: 10px; border: 1px solid #383440; border-radius: 10px; color: #aaa5b4; background: #151519; font-size: 9px; line-height: 1.45; }\n.rrc-element-context strong { display: block; margin-bottom: 3px; overflow: hidden; color: #d4d0db; text-overflow: ellipsis; white-space: nowrap; }\n.rrc-element-context code { display: block; overflow: hidden; color: #706b79; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }\n.rrc-composer-label { display: block; margin: 15px 0 7px; color: #b7b3bd; font-size: 10px; font-weight: 700; }\n.rrc-comment-input { width: 100%; min-height: 112px; resize: vertical; padding: 12px; border: 1px solid #47434f; border-radius: 10px; outline: 0; color: #f0eef3; background: #111114; font-size: 14px; line-height: 1.5; }\n.rrc-comment-input:focus { border-color: #7666df; box-shadow: 0 0 0 3px rgba(118,102,223,.15); }\n.rrc-sheet-actions { margin-top: 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }\n.rrc-sheet-actions span { color: #6e6b76; font-size: 8.5px; }\n.rrc-primary { min-height: 40px; padding: 0 14px; border: 0; border-radius: 9px; color: white; background: #7666df; font-size: 10px; font-weight: 800; cursor: pointer; }\n.rrc-primary:disabled { opacity: .4; cursor: default; }\n.rrc-error-copy { margin: 15px 0 0; color: #c4c0ca; font-size: 12px; line-height: 1.55; }\n.rrc-error-help { margin: 8px 0 0; color: #77737f; font-size: 9px; line-height: 1.45; }\n.rrc-sent-toast { position: fixed; z-index: 2147483620; left: 50%; bottom: max(22px, env(safe-area-inset-bottom)); min-height: 42px; display: flex; align-items: center; gap: 7px; padding: 0 15px; transform: translateX(-50%); border: 1px solid rgba(145,235,174,.34); border-radius: 11px; color: #f4fff7; background: rgba(30,126,66,.97); box-shadow: 0 12px 34px rgba(13,76,37,.38); font-size: 12px; font-weight: 800; }\n.rrc-sent-toast span { width: 19px; height: 19px; display: grid; place-items: center; border-radius: 50%; color: #1e7e42; background: #e6ffed; font-size: 11px; }\n\n@media (max-width: 760px) {\n  .rrc-launcher button { min-height: 44px; font-size: 13px; }\n  .rrc-thread-destination { min-height: 38px; font-size: 11px; }\n  .rrc-inspector-dock { bottom: max(69px, calc(env(safe-area-inset-bottom) + 57px)); min-height: 53px; }\n  .rrc-inspector-target { font-size: 11px; }\n  .rrc-inspector-dock button { min-height: 39px; font-size: 12px; }\n  .rrc-sheet { width: calc(100% - 14px); margin-bottom: max(7px, env(safe-area-inset-bottom)); padding: 16px; }\n  .rrc-sheet-head h2 { font-size: 22px; }\n  .rrc-comment-input { font-size: 16px; }\n  .rrc-primary { min-height: 44px; font-size: 12px; }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .rrc-ui, .rrc-ui * { transition-duration: .01ms !important; animation-duration: .01ms !important; }\n}\n"
  document.head.append(style)
})();
(() => {
  'use strict'

  if (window.__reviewRoomCommentInstalled || document.querySelector('#comment-launcher')) return

  const magicEditSelector = 'magic-edit, review-room-magic-edit'
  const magicEdit = document.querySelector(magicEditSelector)
  if (magicEdit?.hasAttribute('external-controller')) return
  const configuredThreadId = magicEdit?.getAttribute('thread-id')?.trim() || null
  const configuredHelpThreadId = magicEdit?.getAttribute('help-thread-id')?.trim() || null
  const configuredHelpThreadUrl = magicEdit?.getAttribute('help-thread-url')?.trim() || null
  const metaId = document.querySelector('meta[name="review-room-mockup-id"]')?.content
  const queryId = new URLSearchParams(location.search).get('preview')
  const configuredReviewId = magicEdit?.getAttribute('review-id')?.trim() || null
  const configuredApiRoot = magicEdit?.getAttribute('api-root')?.trim().replace(/\/+$/, '') || null
  const endpoint = magicEdit?.getAttribute('endpoint')?.trim().replace(/\/+$/, '') || '/api/reviews'
  const reviewId = configuredReviewId || metaId || queryId || (configuredThreadId ? 'standalone' : null)
  if (!configuredApiRoot && (!reviewId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reviewId))) return
  window.__reviewRoomCommentInstalled = true

  const apiRoot = configuredApiRoot || `${endpoint}/${encodeURIComponent(reviewId)}`
  const state = {
    inspecting: false,
    checkingThread: false,
    cursor: null,
    cursorTarget: null,
    drag: null,
    selection: null,
    threadId: configuredThreadId,
    helpThreadId: configuredHelpThreadId,
    helpThreadUrl: configuredHelpThreadUrl,
    thread: null,
  }
  let sentToastTimer = null

  const root = document.createElement('div')
  root.id = 'review-room-comment-tool'
  root.innerHTML = `
    <div class="rrc-launcher rrc-ui" data-review-comment-ui>
      <button id="rrc-comment-button" type="button"><span>⌁</span><span id="rrc-comment-button-label">Comment on UI</span></button>
    </div>
    <div class="rrc-thread-destination rrc-ui" id="rrc-thread-destination" data-review-comment-ui aria-live="polite" hidden><span class="rrc-thread-copy">Sending to “<a id="rrc-thread-link"></a>”</span><a class="rrc-help-link" id="rrc-help-link" hidden>Help</a></div>
    <div class="rrc-inspector-surface rrc-ui" id="rrc-inspector-surface" data-review-comment-ui hidden aria-hidden="true"></div>
    <div class="rrc-target-highlight rrc-ui" id="rrc-target-highlight" data-review-comment-ui hidden aria-hidden="true"><span id="rrc-highlight-label"></span></div>
    <div class="rrc-virtual-cursor rrc-ui" id="rrc-virtual-cursor" data-review-comment-ui hidden aria-hidden="true"></div>
    <div class="rrc-inspector-dock rrc-ui" id="rrc-inspector-dock" data-review-comment-ui hidden>
      <div class="rrc-inspector-target"><small>DRAG ANYWHERE TO AIM</small><span id="rrc-inspector-target-label">Move the cursor over an element</span></div>
      <button id="rrc-select-element" type="button" disabled>✓ Select</button>
    </div>
    <div class="rrc-overlay rrc-ui" id="rrc-comment-overlay" data-review-comment-ui hidden>
      <section class="rrc-sheet" role="dialog" aria-modal="true" aria-labelledby="rrc-comment-heading">
        <header class="rrc-sheet-head"><div><small>SELECTED ELEMENT</small><h2 id="rrc-comment-heading">Add a comment</h2></div><button class="rrc-icon-button" id="rrc-close-comment" type="button" aria-label="Close comment">×</button></header>
        <div class="rrc-element-context"><strong id="rrc-comment-element-label"></strong><code id="rrc-comment-selector"></code></div>
        <form id="rrc-comment-form">
          <label class="rrc-composer-label" for="rrc-comment-text">What should change?</label>
          <textarea class="rrc-comment-input" id="rrc-comment-text" placeholder="Describe the change you want…"></textarea>
          <div class="rrc-sheet-actions"><span>Element context travels inside the message</span><button class="rrc-primary" id="rrc-continue-to-thread" type="submit" disabled>Send to ACP thread →</button></div>
        </form>
      </section>
    </div>
    <div class="rrc-overlay rrc-ui" id="rrc-error-overlay" data-review-comment-ui hidden>
      <section class="rrc-sheet" role="alertdialog" aria-modal="true" aria-labelledby="rrc-error-heading">
        <header class="rrc-sheet-head"><div><small>REVIEW CONNECTION</small><h2 id="rrc-error-heading">ACP thread not wired</h2></div><button class="rrc-icon-button" id="rrc-close-error" type="button" aria-label="Dismiss error">×</button></header>
        <p class="rrc-error-copy" id="rrc-error-copy"></p>
        <p class="rrc-error-help">Connect this mockup to a review thread before sending UI feedback.</p>
        <div class="rrc-sheet-actions"><span></span><button class="rrc-primary" id="rrc-dismiss-error" type="button">Dismiss</button></div>
      </section>
    </div>
    <div class="rrc-sent-toast rrc-ui" id="rrc-sent-toast" data-review-comment-ui role="status" aria-live="polite" hidden><span>✓</span> Sent</div>`
  document.body.append(root)

  const $ = (selector) => root.querySelector(selector)
  const elements = {
    launcher: $('.rrc-launcher'),
    commentButton: $('#rrc-comment-button'),
    commentButtonLabel: $('#rrc-comment-button-label'),
    threadDestination: $('#rrc-thread-destination'),
    threadLink: $('#rrc-thread-link'),
    helpLink: $('#rrc-help-link'),
    surface: $('#rrc-inspector-surface'),
    highlight: $('#rrc-target-highlight'),
    highlightLabel: $('#rrc-highlight-label'),
    cursor: $('#rrc-virtual-cursor'),
    dock: $('#rrc-inspector-dock'),
    targetLabel: $('#rrc-inspector-target-label'),
    selectElement: $('#rrc-select-element'),
    commentOverlay: $('#rrc-comment-overlay'),
    commentLabel: $('#rrc-comment-element-label'),
    commentSelector: $('#rrc-comment-selector'),
    commentText: $('#rrc-comment-text'),
    continueButton: $('#rrc-continue-to-thread'),
    errorOverlay: $('#rrc-error-overlay'),
    errorHeading: $('#rrc-error-heading'),
    errorCopy: $('#rrc-error-copy'),
    sentToast: $('#rrc-sent-toast'),
  }

  function syncMagicEditState() {
    window.dispatchEvent(new CustomEvent('review-room:selection-state', {
      detail: { active: state.inspecting, checking: state.checkingThread },
    }))
  }

  function useMagicEditLauncher() {
    elements.launcher.hidden = Boolean(document.querySelector(magicEditSelector))
  }

  useMagicEditLauncher()

  const cssString = (value) => String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')

  function targetLabel(target) {
    const explicit = target.getAttribute('aria-label') || target.getAttribute('placeholder') || target.getAttribute('title')
    const value = 'value' in target && typeof target.value === 'string' ? target.value : ''
    const label = explicit || target.textContent || value || target.dataset.inspectId || target.tagName
    return label.replace(/\s+/g, ' ').trim().slice(0, 240)
  }

  function targetSelector(target) {
    if (target.dataset.inspectId) return `[data-inspect-id="${cssString(target.dataset.inspectId)}"]`
    if (target.id && !target.id.startsWith('rrc-')) return `[id="${cssString(target.id)}"]`
    const parts = []
    let current = target
    while (current && current !== document.body && parts.length < 4) {
      const tag = current.tagName.toLowerCase()
      const siblings = current.parentElement ? [...current.parentElement.children].filter((item) => item.tagName === current.tagName) : []
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(current) + 1})` : tag)
      current = current.parentElement
    }
    return parts.join(' > ') || target.tagName.toLowerCase()
  }

  function selectableTarget(raw) {
    if (!raw || raw === root || root.contains(raw) || raw.closest?.('[data-review-comment-ui]')) return null

    const annotated = raw.closest?.('[data-inspect-id]')
    if (annotated && !root.contains(annotated)) return annotated

    const interactive = raw.closest?.('button, a, input, textarea, select, label, summary, [role="button"], [role="link"]')
    if (interactive && !root.contains(interactive)) return interactive

    if (raw === document.documentElement || raw === document.body) return null
    return raw
  }

  function targetFromPoint(x, y) {
    const stack = document.elementsFromPoint?.(x, y) || []
    for (const raw of stack) {
      const target = selectableTarget(raw)
      if (target) return target
    }

    // Mobile Safari can omit elements underneath a full-screen pointer surface
    // from elementsFromPoint(). Retry once with the Review Room UI untargetable.
    if (!document.elementFromPoint) return null
    const previousPointerEvents = root.style.pointerEvents
    root.style.pointerEvents = 'none'
    try {
      return selectableTarget(document.elementFromPoint(x, y))
    } finally {
      root.style.pointerEvents = previousPointerEvents
    }
  }

  function clampCursor(point) {
    return { x: Math.min(innerWidth - 22, Math.max(5, point.x)), y: Math.min(innerHeight - 28, Math.max(5, point.y)) }
  }

  function setCursor(point) {
    if (!state.inspecting) return
    state.cursor = clampCursor(point)
    elements.cursor.style.left = `${state.cursor.x}px`
    elements.cursor.style.top = `${state.cursor.y}px`
    updateCursorTarget()
  }

  function updateCursorTarget() {
    if (!state.inspecting) {
      state.cursorTarget = null
      elements.selectElement.disabled = true
      elements.targetLabel.textContent = 'Move the cursor over an element'
      elements.highlight.hidden = true
      return
    }
    const target = targetFromPoint(state.cursor.x, state.cursor.y)
    state.cursorTarget = target
    elements.selectElement.disabled = !target
    elements.targetLabel.textContent = target ? targetLabel(target) : 'Move the cursor over an element'
    if (!target) {
      elements.highlight.hidden = true
      return
    }
    const rect = target.getBoundingClientRect()
    Object.assign(elements.highlight.style, { top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px` })
    elements.highlightLabel.textContent = targetLabel(target)
    elements.highlightLabel.classList.toggle('rrc-inside', rect.top < 30)
    elements.highlight.hidden = false
  }

  function initialTarget() {
    return document.querySelector('[data-inspect-id]') || document.querySelector('main h1, main h2, main button, h1, h2, button, main')
  }

  function startInspector() {
    state.inspecting = true
    state.selection = null
    document.body.classList.add('rrc-inspecting')
    elements.surface.hidden = false
    elements.cursor.hidden = false
    elements.dock.hidden = false
    elements.commentButtonLabel.textContent = 'Cancel selection'
    syncMagicEditState()
    requestAnimationFrame(() => {
      const target = initialTarget()
      const rect = target?.getBoundingClientRect()
      state.cursorTarget = target || null
      setCursor(rect && rect.width
        ? { x: rect.left + Math.min(rect.width * .7, rect.width - 18), y: rect.top + rect.height / 2 }
        : { x: innerWidth / 2, y: innerHeight * .42 })
    })
  }

  function hideThreadDestination() {
    elements.threadDestination.hidden = true
    elements.threadLink.removeAttribute('href')
    elements.threadLink.removeAttribute('title')
    elements.threadLink.removeAttribute('target')
    elements.threadLink.removeAttribute('rel')
    elements.threadLink.textContent = ''
    elements.helpLink.hidden = true
    elements.helpLink.removeAttribute('href')
    elements.helpLink.removeAttribute('target')
    elements.helpLink.removeAttribute('rel')
    state.thread = null
  }

  function truncatedThreadTitle(value) {
    const title = String(value || '').trim() || 'Untitled ACP thread'
    return title.length > 30 ? `${title.slice(0, 29)}…` : title
  }

  function isIOS() {
    const userAgent = navigator.userAgent || ''
    if (/iPad|iPhone|iPod/.test(userAgent)) return true
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  }

  function validThreadId(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim())
  }

  function threadIdFromUrl(value) {
    try {
      const url = new URL(value, location.href)
      const match = url.pathname.match(/\/threads\/([^/]+)\/?$/)
      if (!match) return null
      const threadId = decodeURIComponent(match[1]).toLowerCase()
      return validThreadId(threadId) ? threadId : null
    } catch (_) {
      return null
    }
  }

  function appThreadUrl(threadId) {
    const normalized = String(threadId || '').trim().toLowerCase()
    if (!validThreadId(normalized)) return null
    return `acpweb://open?path=${encodeURIComponent(`/threads/${normalized}`)}`
  }

  function setThreadLink(element, threadId, webUrl) {
    const appUrl = isIOS() ? appThreadUrl(threadId || threadIdFromUrl(webUrl)) : null
    element.href = appUrl || webUrl
    if (appUrl) {
      element.removeAttribute('target')
      element.removeAttribute('rel')
      return
    }
    element.target = '_blank'
    element.rel = 'noopener noreferrer'
  }

  function helpThreadDestination(thread) {
    if (state.helpThreadUrl) {
      return { threadId: state.helpThreadId || threadIdFromUrl(state.helpThreadUrl), webUrl: state.helpThreadUrl }
    }
    if (!state.helpThreadId || !thread.url) return null
    try {
      const url = new URL(thread.url, location.href)
      if (!/\/threads\/[^/]+\/?$/.test(url.pathname)) return null
      url.pathname = url.pathname.replace(/\/threads\/[^/]+\/?$/, `/threads/${encodeURIComponent(state.helpThreadId)}`)
      return { threadId: state.helpThreadId, webUrl: url.href }
    } catch (_) {
      return null
    }
  }

  function showThreadDestination(thread) {
    const title = String(thread.title || '').trim() || `ACP thread ${String(thread.id || '').slice(0, 8)}`
    state.thread = thread
    elements.threadLink.textContent = truncatedThreadTitle(title)
    elements.threadLink.title = title
    setThreadLink(elements.threadLink, thread.id, thread.url)
    const helpDestination = helpThreadDestination(thread)
    elements.helpLink.hidden = !helpDestination
    if (helpDestination) setThreadLink(elements.helpLink, helpDestination.threadId, helpDestination.webUrl)
    elements.threadDestination.hidden = false
  }

  function stopInspector({ keepThreadDestination = false } = {}) {
    state.inspecting = false
    state.drag = null
    state.cursor = null
    state.cursorTarget = null
    document.body.classList.remove('rrc-inspecting')
    elements.surface.hidden = true
    elements.highlight.hidden = true
    elements.cursor.hidden = true
    elements.cursor.classList.remove('rrc-dragging')
    elements.dock.hidden = true
    elements.selectElement.disabled = true
    elements.targetLabel.textContent = 'Move the cursor over an element'
    elements.commentButtonLabel.textContent = 'Comment on UI'
    if (!keepThreadDestination) hideThreadDestination()
    syncMagicEditState()
  }

  function screenName() {
    if (document.body.dataset.reviewScreen) return document.body.dataset.reviewScreen
    const slug = new URLSearchParams(location.search).get('screen')
    if (!slug) return document.title
    return slug.split('-').map((part, index) => index ? part : part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
  }

  function selectCursorTarget() {
    if (!state.cursorTarget) return
    state.selection = {
      label: targetLabel(state.cursorTarget),
      selector: targetSelector(state.cursorTarget),
      screen: screenName(),
    }
    stopInspector({ keepThreadDestination: true })
    elements.commentLabel.textContent = state.selection.label
    elements.commentSelector.textContent = state.selection.selector
    elements.commentText.value = ''
    elements.continueButton.disabled = true
    elements.commentOverlay.hidden = false
    requestAnimationFrame(() => elements.commentText.focus())
  }

  function showError(message, heading = 'ACP thread not wired') {
    stopInspector()
    elements.errorHeading.textContent = heading
    elements.errorCopy.textContent = message || `ACP thread is not wired for ${document.title}`
    elements.errorOverlay.hidden = false
  }

  function closeError() {
    elements.errorOverlay.hidden = true
  }

  async function responseJson(response) {
    let payload
    try { payload = await response.json() } catch (_) { payload = {} }
    if (!response.ok) throw new Error(payload.error || `ACP Web returned ${response.status}`)
    return payload
  }

  async function ensureThread(threadId) {
    const query = threadId ? `?threadId=${encodeURIComponent(threadId)}` : ''
    const response = await fetch(`${apiRoot}/thread${query}`, { cache: 'no-store' })
    const payload = await responseJson(response)
    if (!payload.ok || !payload.thread?.id) throw new Error('ACP thread connection could not be verified')
    if (!payload.thread.title || !payload.thread.url) throw new Error('ACP thread destination is incomplete')
    return payload.thread
  }

  async function launchInspector(event) {
    if (state.checkingThread) return
    if (state.inspecting) {
      stopInspector()
      return
    }
    state.checkingThread = true
    elements.commentButton.disabled = true
    elements.commentButtonLabel.textContent = 'Checking thread…'
    syncMagicEditState()
    try {
      const source = event?.detail?.source || magicEdit
      state.threadId = event?.detail?.threadId?.trim?.() || source?.getAttribute?.('thread-id')?.trim() || null
      state.helpThreadId = event?.detail?.helpThreadId?.trim?.() || source?.getAttribute?.('help-thread-id')?.trim() || null
      state.helpThreadUrl = event?.detail?.helpThreadUrl?.trim?.() || source?.getAttribute?.('help-thread-url')?.trim() || null
      const thread = await ensureThread(state.threadId)
      showThreadDestination(thread)
      startInspector()
    } catch (error) {
      showError(error.message)
    } finally {
      state.checkingThread = false
      elements.commentButton.disabled = false
      if (!state.inspecting) elements.commentButtonLabel.textContent = 'Comment on UI'
      syncMagicEditState()
    }
  }

  function reviewMessageText(comment) {
    return `${comment}\n\nSelected element: ${state.selection.label}\nSelector: ${state.selection.selector}\nScreen: ${state.selection.screen}`
  }

  function showSentToast() {
    clearTimeout(sentToastTimer)
    elements.sentToast.hidden = false
    sentToastTimer = setTimeout(() => { elements.sentToast.hidden = true }, 2200)
  }

  async function sendComment(comment) {
    elements.continueButton.disabled = true
    elements.continueButton.textContent = 'Sending…'
    try {
      const payload = { text: reviewMessageText(comment) }
      if (state.threadId) payload.threadId = state.threadId
      const response = await fetch(`${apiRoot}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await responseJson(response)
      elements.commentOverlay.hidden = true
      elements.commentText.value = ''
      elements.commentLabel.textContent = ''
      elements.commentSelector.textContent = ''
      state.selection = null
      state.cursor = null
      state.cursorTarget = null
      state.drag = null
      hideThreadDestination()
      showSentToast()
    } catch (error) {
      showError(error.message, error.message.includes('not wired') ? 'ACP thread not wired' : 'Could not send comment')
    } finally {
      elements.continueButton.textContent = 'Send to ACP thread →'
      elements.continueButton.disabled = !elements.commentText.value.trim()
    }
  }

  elements.commentButton.addEventListener('click', launchInspector)
  addEventListener('review-room:magic-edit', launchInspector)
  addEventListener('review-room:magic-edit-ready', useMagicEditLauncher)
  addEventListener('message', (event) => {
    if (event.data?.type !== 'review-room:start-selection') return
    if (event.source !== parent || event.origin !== location.origin) return
    launchInspector()
  })
  elements.selectElement.addEventListener('click', selectCursorTarget)
  elements.surface.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    state.drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
    elements.surface.setPointerCapture?.(event.pointerId)
    elements.cursor.classList.add('rrc-dragging')
    if (event.pointerType === 'mouse') setCursor({ x: event.clientX, y: event.clientY })
  })
  elements.surface.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') {
      setCursor({ x: event.clientX, y: event.clientY })
      return
    }
    if (!state.drag || state.drag.id !== event.pointerId) return
    event.preventDefault()
    const dx = (event.clientX - state.drag.x) * 1.15
    const dy = (event.clientY - state.drag.y) * 1.15
    state.drag = { ...state.drag, x: event.clientX, y: event.clientY }
    setCursor({ x: state.cursor.x + dx, y: state.cursor.y + dy })
  })
  const endDrag = (event) => {
    if (!state.drag || state.drag.id !== event.pointerId) return
    state.drag = null
    elements.cursor.classList.remove('rrc-dragging')
    try { elements.surface.releasePointerCapture?.(event.pointerId) } catch (_) {}
  }
  elements.surface.addEventListener('pointerup', endDrag)
  elements.surface.addEventListener('pointercancel', endDrag)
  addEventListener('resize', () => { if (state.cursor) setCursor(state.cursor) })
  addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    stopInspector()
    elements.commentOverlay.hidden = true
    closeError()
  })
  elements.commentText.addEventListener('input', () => { elements.continueButton.disabled = !elements.commentText.value.trim() })
  $('#rrc-comment-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    const comment = elements.commentText.value.trim()
    if (!comment || !state.selection) return
    await sendComment(comment)
  })
  $('#rrc-close-comment').addEventListener('click', () => {
    elements.commentOverlay.hidden = true
    state.selection = null
    hideThreadDestination()
  })
  $('#rrc-close-error').addEventListener('click', closeError)
  $('#rrc-dismiss-error').addEventListener('click', closeError)
})();
(() => {
  'use strict'

  const tagNames = ['magic-edit', 'review-room-magic-edit']
  if (tagNames.every((tagName) => customElements.get(tagName))) return

  const template = document.createElement('template')
  template.innerHTML = `
    <style>
      :host {
        position: fixed;
        z-index: 2147483605;
        right: var(--review-room-magic-right, 14px);
        bottom: var(--review-room-magic-bottom, max(14px, env(safe-area-inset-bottom)));
        display: block;
        width: 44px;
        height: 44px;
        color: #7067c8;
        font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      }

      :host([placement="top-right"]) {
        top: var(--review-room-magic-top, max(12px, env(safe-area-inset-top)));
        bottom: auto;
      }

      :host([placement="inline"]) {
        position: relative;
        inset: auto;
        display: inline-block;
      }

      :host([hidden]) { display: none; }

      button {
        position: relative;
        width: 44px;
        height: 44px;
        padding: 0;
        display: grid;
        place-items: center;
        border: 1px solid transparent;
        border-radius: 50%;
        color: inherit;
        background:
          linear-gradient(145deg, rgba(255,255,255,.96), rgba(247,246,252,.95)) padding-box,
          linear-gradient(135deg, rgba(66,133,244,.5), rgba(139,92,246,.5), rgba(244,114,182,.38)) border-box;
        box-shadow: 0 7px 20px rgba(63,58,127,.16), inset 0 1px rgba(255,255,255,.8);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform .16s ease, box-shadow .16s ease, color .16s ease, opacity .16s ease;
      }

      button::after {
        content: '';
        position: absolute;
        inset: 6px;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 22%, rgba(112,103,200,.08), transparent 58%);
        pointer-events: none;
      }

      button:hover {
        color: #5e53bd;
        transform: translateY(-1px);
        box-shadow: 0 9px 23px rgba(63,58,127,.2), inset 0 1px rgba(255,255,255,.9);
      }

      button:active { transform: translateY(0) scale(.97); }
      button:focus-visible { outline: 3px solid rgba(66,133,244,.3); outline-offset: 3px; }
      button:disabled { opacity: .62; cursor: wait; }

      :host([data-active]) button {
        color: #5b4fc4;
        box-shadow: 0 0 0 3px rgba(112,103,200,.13), 0 9px 23px rgba(63,58,127,.2);
      }

      svg { position: relative; z-index: 1; width: 20px; height: 20px; overflow: visible; }

      @media (prefers-reduced-motion: reduce) {
        button { transition-duration: .01ms; }
      }
    </style>
    <button type="button" aria-label="Magic edit page" title="Magic edit">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="rr-magic-gradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stop-color="#4285f4" />
            <stop offset=".48" stop-color="#8b5cf6" />
            <stop offset="1" stop-color="#ec6fae" />
          </linearGradient>
        </defs>
        <path fill="url(#rr-magic-gradient)" d="M10.6 2.4c.18-.54.95-.54 1.13 0l.52 1.57a8.1 8.1 0 0 0 5.13 5.13l1.57.52c.54.18.54.95 0 1.13l-1.57.52a8.1 8.1 0 0 0-5.13 5.13l-.52 1.57c-.18.54-.95.54-1.13 0l-.52-1.57a8.1 8.1 0 0 0-5.13-5.13l-1.57-.52c-.54-.18-.54-.95 0-1.13l1.57-.52a8.1 8.1 0 0 0 5.13-5.13l.52-1.57Z" />
        <path fill="url(#rr-magic-gradient)" d="M19.2 15.3c.1-.31.55-.31.65 0l.2.62a3.2 3.2 0 0 0 2.03 2.03l.62.2c.31.1.31.55 0 .65l-.62.2a3.2 3.2 0 0 0-2.03 2.03l-.2.62c-.1.31-.55.31-.65 0l-.2-.62a3.2 3.2 0 0 0-2.03-2.03l-.62-.2c-.31-.1-.31-.55 0-.65l.62-.2A3.2 3.2 0 0 0 19 15.92l.2-.62Z" />
      </svg>
    </button>`

  class MagicEdit extends HTMLElement {
    constructor() {
      super()
      this.attachShadow({ mode: 'open' }).append(template.content.cloneNode(true))
      this.button = this.shadowRoot.querySelector('button')
      this.handleClick = this.handleClick.bind(this)
      this.handleSelectionState = this.handleSelectionState.bind(this)
    }

    connectedCallback() {
      this.button.addEventListener('click', this.handleClick)
      window.addEventListener('review-room:selection-state', this.handleSelectionState)
      window.dispatchEvent(new CustomEvent('review-room:magic-edit-ready', { detail: { source: this } }))
    }

    disconnectedCallback() {
      this.button.removeEventListener('click', this.handleClick)
      window.removeEventListener('review-room:selection-state', this.handleSelectionState)
    }

    get threadId() {
      return this.getAttribute('thread-id')?.trim() || ''
    }

    set threadId(value) {
      if (value) this.setAttribute('thread-id', value)
      else this.removeAttribute('thread-id')
    }

    get helpThreadId() {
      return this.getAttribute('help-thread-id')?.trim() || ''
    }

    set helpThreadId(value) {
      if (value) this.setAttribute('help-thread-id', value)
      else this.removeAttribute('help-thread-id')
    }

    get helpThreadUrl() {
      return this.getAttribute('help-thread-url')?.trim() || ''
    }

    set helpThreadUrl(value) {
      if (value) this.setAttribute('help-thread-url', value)
      else this.removeAttribute('help-thread-url')
    }

    handleClick() {
      this.dispatchEvent(new CustomEvent('review-room:magic-edit', {
        bubbles: true,
        composed: true,
        detail: {
          source: this,
          threadId: this.threadId || null,
          helpThreadId: this.helpThreadId || null,
          helpThreadUrl: this.helpThreadUrl || null,
        },
      }))
    }

    handleSelectionState(event) {
      const active = Boolean(event.detail?.active)
      const checking = Boolean(event.detail?.checking)
      this.toggleAttribute('data-active', active)
      this.button.disabled = checking
      this.button.setAttribute('aria-pressed', String(active))
      this.button.setAttribute('aria-label', checking ? 'Checking review thread' : active ? 'Cancel element selection' : 'Magic edit page')
      this.button.title = checking ? 'Checking review thread…' : active ? 'Cancel selection' : 'Magic edit'
    }
  }

  for (const tagName of tagNames) {
    if (customElements.get(tagName)) continue
    customElements.define(tagName, tagName === 'magic-edit' ? MagicEdit : class extends MagicEdit {})
  }
})();
