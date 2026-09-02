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

    handleClick() {
      this.dispatchEvent(new CustomEvent('review-room:magic-edit', {
        bubbles: true,
        composed: true,
        detail: { source: this, threadId: this.threadId || null },
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
})()
