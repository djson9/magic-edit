import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

const bundle = readFileSync('dist/magic-edit.js', 'utf8')
const threadId = '123e4567-e89b-42d3-a456-426614174000'
const helpThreadId = '123e4567-e89b-42d3-a456-426614174001'
const threadTitle = 'Example review thread with a deliberately long title'
const threadUrl = `https://acp.example.test/threads/${threadId}`

function page({ tagName = 'magic-edit', attributes = `thread-id="${threadId}"`, wired = true } = {}) {
  const requests = []
  const dom = new JSDOM(`<!doctype html><html><head></head><body data-review-screen="Overview">
    <main><h1 data-inspect-id="hero-title">Example title</h1><div id="plain-card">Plain dashboard card</div></main>
    <${tagName} ${attributes}></${tagName}>
    <script>${bundle}</script>
  </body></html>`, {
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    url: 'https://example.test/page',
    beforeParse(window) {
      window.fetch = async (input, init) => {
        const request = { url: String(input), init }
        requests.push(request)
        if (request.url.includes('/thread')) {
          return wired
            ? { ok: true, status: 200, json: async () => ({ ok: true, thread: { id: threadId, title: threadTitle, url: threadUrl } }) }
            : { ok: false, status: 409, json: async () => ({ error: 'ACP thread is not wired for this page' }) }
        }
        return { ok: true, status: 200, json: async () => ({ ok: true }) }
      }
    },
  })
  return { dom, requests }
}

const wait = (dom, milliseconds = 15) => new Promise((resolve) => dom.window.setTimeout(resolve, milliseconds))

describe('@djson9/magic-edit browser bundle', () => {
  it('installs the button, comment UI, and styles from one script', () => {
    const { dom } = page()
    const document = dom.window.document
    const element = document.querySelector('magic-edit')

    expect(element.shadowRoot.querySelector('button')).toBeTruthy()
    expect(document.querySelector('#review-room-comment-tool')).toBeTruthy()
    expect(document.querySelector('#magic-edit-styles').textContent).toContain('.rrc-inspector-surface')
    expect(document.querySelector('link[href*="review-room-comment.css"]')).toBeNull()
  })

  it('supports the legacy element name during migration', () => {
    const { dom } = page({ tagName: 'review-room-magic-edit' })
    expect(dom.window.document.querySelector('review-room-magic-edit').shadowRoot.querySelector('button')).toBeTruthy()
  })

  it('supports a page-owned selector without installing a second comment UI', () => {
    const { dom } = page({ attributes: `thread-id="${threadId}" external-controller` })
    const document = dom.window.document
    expect(document.querySelector('magic-edit').shadowRoot.querySelector('button')).toBeTruthy()
    expect(document.querySelector('#review-room-comment-tool')).toBeNull()
  })

  it('uses component routing attributes and shows the verified thread destination', async () => {
    const { dom, requests } = page({ attributes: `thread-id="${threadId}" help-thread-id="${helpThreadId}" review-id="settings" endpoint="/feedback"` })
    const document = dom.window.document
    document.querySelector('magic-edit').shadowRoot.querySelector('button').click()
    await wait(dom, 75)

    expect(requests[0].url).toBe(`/feedback/settings/thread?threadId=${threadId}`)
    const link = document.querySelector('#rrc-thread-link')
    expect(link.textContent).toBe(`${threadTitle.slice(0, 29)}…`)
    expect(link.textContent).toHaveLength(30)
    expect(link.href).toBe(threadUrl)
    const helpLink = document.querySelector('#rrc-help-link')
    expect(helpLink.hidden).toBe(false)
    expect(helpLink.textContent).toBe('Help')
    expect(helpLink.href).toBe(`https://acp.example.test/threads/${helpThreadId}`)
    expect(document.querySelector('#rrc-inspector-surface').hidden).toBe(false)
  })

  it('requires Select and posts one plain-text message with element context', async () => {
    const { dom, requests } = page()
    const document = dom.window.document
    const title = document.querySelector('[data-inspect-id="hero-title"]')
    Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => [title] })

    document.querySelector('magic-edit').shadowRoot.querySelector('button').click()
    await wait(dom, 75)
    expect(document.querySelector('#rrc-comment-overlay').hidden).toBe(true)

    document.querySelector('#rrc-select-element').click()
    const textarea = document.querySelector('#rrc-comment-text')
    textarea.value = 'Make the title clearer.'
    textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    document.querySelector('#rrc-comment-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
    await wait(dom)

    expect(requests).toHaveLength(2)
    expect(JSON.parse(requests[1].init.body)).toEqual({
      threadId,
      text: 'Make the title clearer.\n\nSelected element: Example title\nSelector: [data-inspect-id="hero-title"]\nScreen: Overview',
    })
    expect(document.querySelector('#rrc-sent-toast').hidden).toBe(false)
    expect(document.querySelector('#rrc-comment-overlay').hidden).toBe(true)
  })

  it('clears selection state when the button cancels inspector mode', async () => {
    const { dom } = page()
    const document = dom.window.document
    const card = document.querySelector('#plain-card')
    Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => [card] })
    const button = document.querySelector('magic-edit').shadowRoot.querySelector('button')

    button.click()
    await wait(dom, 75)
    expect(document.querySelector('#rrc-target-highlight').hidden).toBe(false)

    button.click()
    dom.window.dispatchEvent(new dom.window.Event('resize'))
    expect(document.querySelector('#rrc-inspector-surface').hidden).toBe(true)
    expect(document.querySelector('#rrc-target-highlight').hidden).toBe(true)
    expect(document.querySelector('#rrc-virtual-cursor').hidden).toBe(true)
    expect(document.querySelector('#rrc-select-element').disabled).toBe(true)
  })

  it('fails visibly before selection when the thread is not wired', async () => {
    const { dom, requests } = page({ wired: false })
    const document = dom.window.document
    document.querySelector('magic-edit').shadowRoot.querySelector('button').click()
    await wait(dom)

    expect(requests).toHaveLength(1)
    expect(document.querySelector('#rrc-error-overlay').hidden).toBe(false)
    expect(document.querySelector('#rrc-error-heading').textContent).toBe('ACP thread not wired')
    expect(document.querySelector('#rrc-inspector-surface').hidden).toBe(true)
  })
})
