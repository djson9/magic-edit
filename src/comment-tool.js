(() => {
  'use strict'

  if (window.__reviewRoomCommentInstalled || document.querySelector('#comment-launcher')) return

  const magicEditSelector = 'magic-edit, review-room-magic-edit'
  const magicEdit = document.querySelector(magicEditSelector)
  const configuredThreadId = magicEdit?.getAttribute('thread-id')?.trim() || null
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
    thread: null,
  }
  let sentToastTimer = null

  const root = document.createElement('div')
  root.id = 'review-room-comment-tool'
  root.innerHTML = `
    <div class="rrc-launcher rrc-ui" data-review-comment-ui>
      <button id="rrc-comment-button" type="button"><span>⌁</span><span id="rrc-comment-button-label">Comment on UI</span></button>
    </div>
    <div class="rrc-thread-destination rrc-ui" id="rrc-thread-destination" data-review-comment-ui aria-live="polite" hidden><span>Sending to “</span><a id="rrc-thread-link" target="_blank" rel="noopener noreferrer"></a><span>”</span></div>
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
    elements.threadLink.textContent = ''
    state.thread = null
  }

  function truncatedThreadTitle(value) {
    const title = String(value || '').trim() || 'Untitled ACP thread'
    return title.length > 30 ? `${title.slice(0, 29)}…` : title
  }

  function showThreadDestination(thread) {
    const title = String(thread.title || '').trim() || `ACP thread ${String(thread.id || '').slice(0, 8)}`
    state.thread = thread
    elements.threadLink.textContent = truncatedThreadTitle(title)
    elements.threadLink.title = title
    elements.threadLink.href = thread.url
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
      state.threadId = event?.detail?.threadId?.trim?.() || magicEdit?.getAttribute('thread-id')?.trim() || null
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
})()
