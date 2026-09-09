# Magic Edit

Magic Edit is a dependency-free web component for selecting any visible page element and sending a plain-text, contextual comment to an ACP Web thread.

The same package also owns the React Native bubble, iOS cursor selector, target
highlighting, and native comment composer. Apps provide an ACP API root and one
or more destination thread IDs; they do not implement their own selectors.

## Browser install

Pin an immutable release and add one element:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/gh/djson9/magic-edit@v0.2.0/dist/magic-edit.js">
</script>

<magic-edit
  thread-id="123e4567-e89b-42d3-a456-426614174000"
  help-thread-id="123e4567-e89b-42d3-a456-426614174001">
</magic-edit>
```

The default API route is `/api/reviews/{review-id}`. The review ID comes from, in order:

1. The component's `review-id` attribute.
2. `<meta name="review-room-mockup-id" content="…">`.
3. The `preview` query parameter.
4. `standalone` when `thread-id` is present.

Use `endpoint="/another/base"` to replace `/api/reviews`, or `api-root="/an/exact/review/route"` to provide the complete route before `/thread` and `/messages`.

Set `help-thread-id` to display a compact Help button beside the verified destination thread. Magic Edit derives its ACP Web origin from the verified thread URL. `help-thread-url` can provide an explicit URL instead.

On iPhone and iPad, both thread links use ACP Web's `acpweb://open?path=…` deep-link contract so a tap opens the selected thread directly in the installed app. Other platforms retain the verified HTTPS thread links.

```html
<magic-edit
  review-id="settings"
  thread-id="123e4567-e89b-42d3-a456-426614174000"
  endpoint="/api/reviews"
  placement="top-right">
</magic-edit>
```

Add `external-controller` when a page already owns its selector and composer and should use only the packaged button and `review-room:magic-edit` event.

The server contract is:

- `GET {api-root}/thread?threadId={thread-id}` → `{ "ok": true, "thread": { "id", "title", "url" } }`
- `POST {api-root}/messages` with `{ "text", "threadId" }` → any successful `2xx` JSON response

Comments remain ordinary thread messages. Selected-element context is appended to the message body without requiring ACP Web transcript changes.

## Package install

After the npm release is available:

```sh
npm install @djson9/magic-edit@0.2.0
```

Then import the self-registering component once:

```js
import '@djson9/magic-edit'
```

## React Native

Install the same package in a React Native app and run CocoaPods normally:

```sh
npm install @djson9/magic-edit@0.2.0
cd ios && pod install
```

Mount the shared bubble once above the app navigator:

```tsx
import { MagicEditBubble } from '@djson9/magic-edit/react-native'

<MagicEditBubble
  apiRoot="https://acp.example.test/api/magic_edit"
  threadId="123e4567-e89b-42d3-a456-426614174000"
  threadLinkTarget="web"
/>
```

On iOS the package supplies the floating bubble, draggable cursor, native and
WebView hit testing, explicit Select action, target context, and comment sheet.
The host app supplies only placement and routing configuration.

## Development

```sh
npm ci
npm test
```

Version tags run tests, build the browser artifact, create a GitHub Release, and attach both `magic-edit.js` and the installable npm tarball. The public npm publish step uses npm trusted publishing after the package's initial registry version is established.
