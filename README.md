# Magic Edit

Magic Edit is a dependency-free web component for selecting any visible page element and sending a plain-text, contextual comment to an ACP Web thread.

## Browser install

Pin an immutable release and add one element:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/gh/djson9/magic-edit@v0.1.0/dist/magic-edit.js">
</script>

<magic-edit
  thread-id="123e4567-e89b-42d3-a456-426614174000">
</magic-edit>
```

The default API route is `/api/reviews/{review-id}`. The review ID comes from, in order:

1. The component's `review-id` attribute.
2. `<meta name="review-room-mockup-id" content="…">`.
3. The `preview` query parameter.
4. `standalone` when `thread-id` is present.

Use `endpoint="/another/base"` to replace `/api/reviews`, or `api-root="/an/exact/review/route"` to provide the complete route before `/thread` and `/messages`.

```html
<magic-edit
  review-id="settings"
  thread-id="123e4567-e89b-42d3-a456-426614174000"
  endpoint="/api/reviews"
  placement="top-right">
</magic-edit>
```

The server contract is:

- `GET {api-root}/thread?threadId={thread-id}` → `{ "ok": true, "thread": { "id", "title", "url" } }`
- `POST {api-root}/messages` with `{ "text", "threadId" }` → any successful `2xx` JSON response

Comments remain ordinary thread messages. Selected-element context is appended to the message body without requiring ACP Web transcript changes.

## Package install

After the npm release is available:

```sh
npm install @djson9/magic-edit@0.1.0
```

Then import the self-registering component once:

```js
import '@djson9/magic-edit'
```

## Development

```sh
npm ci
npm test
```

Version tags run tests, build the browser artifact, create a GitHub Release, and attach both `magic-edit.js` and the installable npm tarball. The public npm publish step uses npm trusted publishing after the package's initial registry version is established.
