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
  src="https://cdn.jsdelivr.net/gh/djson9/magic-edit@v0.4.7/dist/magic-edit.js">
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
npm install @djson9/magic-edit@0.4.7
```

Then import the self-registering component once:

```js
import '@djson9/magic-edit'
```

## React Native

Install the same package in a React Native app and run CocoaPods normally:

```sh
npm install @djson9/magic-edit@0.4.7
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

## One-step live deployment

Magic Edit also owns the common push-to-live dispatcher. A registered app needs
one workflow step:

```yaml
- uses: djson9/magic-edit/.github/actions/deploy@v0.4.7
  with:
    target: my-app
```

The self-hosted runner keeps a root-owned `/etc/magic-edit/apps/my-app.json`
registration. It declares the repository, branch, deployment adapter, last
successful revision, app root, and path patterns for native releases, hot
reloads, and ignored files. The shared dispatcher compares the pushed commit
with the last successfully served revision and selects exactly one action:

- `native-release` when iOS, dependencies, or an unknown app-level file changed;
- `hot-reload` for declared runtime source and assets;
- `noop` for docs, tests, or unrelated files.

Registrations and adapters are root-owned, so a repository workflow cannot turn
the reusable action into arbitrary privileged execution. Product-specific
details—such as an Xcode scheme, bundle identifier, provisioning profile, Metro
origin, and installer destination—remain in the registered adapter. The action
and installed dispatcher must have the same release version or deployment
fails closed.

Install the shared dispatcher once on a deployment host with
`sudo script/install-host`. App registrations then live centrally in
[`host/apps`](host/apps). Merging one new or changed JSON file to this
repository's `main` branch triggers the protected infrastructure runner, which
copies the validated desired state to `/etc/magic-edit/apps`, creates or updates
the branded Git receiver, and verifies the result. The dispatcher owns diff
classification and invokes only the adapter named by that protected
registration.

The repository checkout and root-owned product adapter named by a registration
must already exist because they contain app-specific runtime, signing, and
publication behavior. Once those product prerequisites exist, registration is
one change in this repository—there is no separate VM command. Copy an existing
file in `host/apps`, change its repository paths and change classifiers, and
open a pull request. Removing a file does not delete live infrastructure;
teardown is intentionally manual.

## Branded Git remote

The same host can expose registered apps through `magicedit.dev`. The complete
DNS, Hetzner firewall, restricted SSH, developer-key, Bitwarden, app onboarding,
and verification procedure lives in
[`docs/magicedit.dev.md`](docs/magicedit.dev.md). The public desired state is
versioned in [`host/magicedit.dev.json`](host/magicedit.dev.json); credentials
remain encrypted in SecretStash.

On the VM, bootstrap the host and the dedicated repository runner once:

```sh
sudo script/install-host
sudo script/configure-domain --apply
```

After that bootstrap, app registration is GitOps: merge
`host/apps/my-app.json` to `main` and the
[`Reconcile Magic Edit Apps`](.github/workflows/reconcile-apps.yml) workflow
converges and verifies the host automatically.

Authorize a dedicated key from the developer machine:

```sh
ssh root@jays-vm.tailade3f5.ts.net magic-edit-authorize-key \
  < ~/.ssh/magicedit_ed25519.pub
```

The app needs one local remote:

```sh
git remote add magic-edit git@magicedit.dev:my-app.git
git config branch.magic-edit.pushRemote magic-edit
```

From then on, both `git push` while on the `magic-edit` branch and the explicit
`git push magic-edit` publish the exact fast-forward commit to GitHub. GitHub's
one-step workflow then selects hot reload, native release, or no-op. The shared
SSH receiver accepts only one update to the target's registered branch, keeps
incoming objects in Git quarantine until GitHub accepts them, and rejects
deletes and force pushes. The public SSH policy allows only the key-authenticated
`git` account, whose shell is `git-shell`; normal VM users remain tailnet-only.

### Pushing an onboarded app

Use the app's permanent `magic-edit` worktree and push normally:

```sh
git status --short
git branch --show-current
git push
```

The worktree must be clean before the host advances it, and the current branch
must be `magic-edit`. The custom remote is an authenticated ingress rather than
a second canonical repository: it validates the update, mirrors the exact SHA
to the app's GitHub `magic-edit` branch, and lets the app's GitHub workflow call
the shared dispatcher. A successful workflow records the selected mode and
served revision in its job summary.

Runtime source and assets take the hot-reload path. Native code, dependencies,
and unknown files under the configured app root take the signed native-release
path. Documentation, tests, and changes outside the app root take the no-op
path. A no-op still advances the verified served revision, so the next diff is
always calculated from the last successful push.

Native signing remains a product-adapter responsibility. The reference iOS
adapters use the existing approved Apple Development identity through a
protected Mac GUI signing lane; Magic Edit does not create, import, replace, or
revoke certificates and profiles.

### Registered reference apps

| Target | Custom remote | Live source | Native installer |
|---|---|---|---|
| ACP Web | `git@magicedit.dev:acp-web.git` | `http://100.108.87.81:8088` | `https://jays-vm.tailade3f5.ts.net:8447/live/latest/` |
| Family Quill | `git@magicedit.dev:family-quill.git` | `http://100.108.87.81:8090` | `https://jays-vm.tailade3f5.ts.net:8451/live/latest/` |
| Money App | `git@magicedit.dev:money-app.git` | `https://jays-vm.tailade3f5.ts.net:8466` | `https://jays-vm.tailade3f5.ts.net:8448/live/latest/` |

The reference apps keep Stable/production separate from their development
Live bundle identifier. Their permanent Mac worktrees and Metro LaunchAgents
must stay running, and the Mac and test iPhone must remain on Tailscale for Fast
Refresh. Product-specific commands and safeguards live in the
[ACP Web guide](https://github.com/djson9/acp-web/blob/magic-edit/native/README.md#magic-edit-live-development),
[Family Quill guide](https://github.com/djson9/coparenting/blob/magic-edit/apps/native/README.md),
and [Money App guide](https://github.com/djson9/money-app/blob/magic-edit/docs/magic-edit-live.md).
