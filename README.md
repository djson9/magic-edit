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
  src="https://cdn.jsdelivr.net/gh/djson9/magic-edit@v0.5.4/dist/magic-edit.js">
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
npm install @djson9/magic-edit@0.5.4
```

Then import the self-registering component once:

```js
import '@djson9/magic-edit'
```

## React Native

Install the same package in a React Native app and run CocoaPods normally:

```sh
npm install @djson9/magic-edit@0.5.4
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

Private development builds can also add `audio` to `UIBackgroundModes`. When
that capability is present, the bubble popup offers **Keep updates active in
background**. The opt-in is persisted on-device and uses a silent, mixed audio
stream so Metro can continue delivering updates while the app is backgrounded.
The option stays hidden from builds without the capability, and force quitting
the app always stops it.

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
- uses: djson9/magic-edit/.github/actions/deploy@v0.4.8
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

## Immediate branch promotion

A registered app can make an ordinary source branch its zero-CI Live entrypoint
without distributing an SSH credential to GitHub Actions. Add a bounded
`autoPromote` block to the app registration:

```json
{
  "branch": "magic-edit",
  "autoPromote": {
    "sourceBranch": "staging",
    "runnerUser": "my-app-actions-runner",
    "policy": "immediate"
  }
}
```

`branch` remains the internal, Heroku-style deployment ref. `sourceBranch` is
the only GitHub branch the framework will accept for automatic promotion, and
`runnerUser` is the unprivileged account used by the app's existing deployment
runner. The `immediate` policy explicitly runs without a CI or status-check
gate. Reconciliation generates an exact, target-scoped sudo rule; the
repository workflow cannot select another repository, branch, or target.

Install the source-branch workflow from the app repository:

```sh
npm exec --yes --package='github:djson9/magic-edit#v0.5.4' -- magic-edit-setup-live \
  --target my-app \
  --source-branch staging \
  --runner-label my-app-production \
  --runner-user my-app-actions-runner
```

The generated workflow runs no checkout, tests, or status-check gate. It asks
the root-owned promoter to verify that the event SHA is still the exact source
branch tip, then pushes that commit through the local branded receiver. The
receiver applies its existing exact lease, mirrors the commit to GitHub's
`magic-edit` ref, and triggers the existing Live deployment workflow. An older
queued event becomes a successful no-op after a newer source push arrives.

The setup command is idempotent and refuses to overwrite a different workflow.
Run the same command with `--check` to detect drift. Manual `git push
magic-edit` remains available for deploying another branch or rolling back;
the next source-branch push resumes automatic promotion.

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
sudo RUNNER_TOKEN="$one_time_github_runner_token" script/install-actions-runner
sudo script/configure-domain --apply
```

`RUNNER_TOKEN` is the short-lived registration token returned by GitHub's
repository Actions runner API. The installer verifies the pinned runner archive
checksum, registers only `djson9/magic-edit`, and runs it as the unprivileged
`magic-edit-actions-runner` user. Its sudo policy permits only the reconciler
with the exact Actions checkout path.

After that bootstrap, app registration is GitOps: merge
`host/apps/my-app.json` to `main` and the
[`Reconcile Magic Edit Apps`](.github/workflows/reconcile-apps.yml) workflow
converges and verifies the host automatically. Registrations with
`autoPromote` also receive a validated, target-scoped sudo rule for their
generated source-branch workflow.

Authorize a dedicated key from the developer machine:

```sh
ssh root@jays-vm.tailade3f5.ts.net magic-edit-authorize-key \
  < ~/.ssh/magicedit_ed25519.pub
```

The app needs one local remote:

```sh
git remote add magic-edit git@magicedit.dev:my-app.git
git config remote.magic-edit.push +HEAD:refs/heads/magic-edit
```

From then on, `git push magic-edit` deploys the current `HEAD` from any local
branch or worktree to the registered GitHub `magic-edit` deployment ref. Like a
Heroku remote, deployment does not require the pushed commit to descend from the
previous Live commit. The receiver updates GitHub with an exact lease on the
currently advertised ref, keeps incoming objects in Git quarantine until
GitHub accepts them, and still rejects deletes, multiple-ref pushes, and pushes
to any other remote branch. The public SSH policy allows only the
key-authenticated `git` account, whose shell is `git-shell`; normal VM users
remain tailnet-only.

### Pushing an onboarded app

Push the current commit from any app worktree:

```sh
git status --short
git push magic-edit
```

The custom remote is an authenticated deployment ingress rather than a second
canonical repository. Its `magic-edit` ref records the latest deployed commit,
mirrors that exact SHA to GitHub, and lets the app's GitHub workflow call the
shared dispatcher. A successful workflow records the selected mode and served
revision in its job summary.

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
Live bundle identifier. Their deployment-owned source checkouts and Metro
LaunchAgents must stay running, and the Mac and test iPhone must remain on
Tailscale for Fast Refresh. Product-specific commands and safeguards live in the
[ACP Web guide](https://github.com/djson9/acp-web/blob/magic-edit/native/README.md#magic-edit-live-development),
[Family Quill guide](https://github.com/djson9/coparenting/blob/magic-edit/apps/native/README.md),
and [Money App guide](https://github.com/djson9/money-app/blob/magic-edit/docs/magic-edit-live.md).
## Zero-configuration Redux diagnostics

Add the shared middleware to every Redux store that should appear in a Magic
Edit capture:

```ts
import {
  createMagicEditMiddleware,
  magicEditMiddleware,
} from '@djson9/magic-edit/redux'

const store = configureStore({
  reducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat(magicEditMiddleware),
})
```

The zero-configuration middleware retains the latest complete state plus the
last 200 actions and their structural state changes. Unchanged branches are
never copied into each transition, and unusually broad changes are capped at
256 paths. Network and runtime histories are bounded independently. This keeps
repeated full-state serialization off the dispatch hot path while retaining
exact action ordering, Redux Toolkit async-operation correlation, dispatch
timing, and idempotent `fetch` plus `XMLHttpRequest` observation.

Apps with large stores should select a small diagnostic projection and omit
their own derived diagnostics action, while preserving the same capture
schema:

```ts
const diagnosticsMiddleware = createMagicEditMiddleware({
  includeStateSnapshots: true,
  selectAction: action => ({ type: action.type, requestId: action.meta?.requestId }),
  selectState: state => state.diagnosticsProjection,
  shouldRecordAction: action => action.type !== 'diagnostics/actionRecorded',
})
```

`includeStateSnapshots` retains the complete selected projection on changed
transitions in addition to its structural changes; leave it off when the
selector is the full application state.

`selectAction` is useful when server snapshot actions contain large entity
payloads; retain the action type and only the correlation fields needed for
diagnosis. The recorder does not otherwise redact action or projected-state
values. Request and response bodies remain excluded because observing them can
alter stream behavior. Successful save alerts include the final byte size and
end-to-end client duration; `capture_prepared` runtime events expose snapshot and
serialization timing to the next capture.

The existing React Native `MagicEditBubble` discovers the same process-wide
singleton automatically. When a store is attached, tapping the bubble offers
`Save debug metadata`, which uploads directly to the shared Phoenix service
without creating an ACP thread or requiring another prop.

Successful uploads return an exact URL and a per-app latest URL:

```sh
curl 'https://magicedit.dev/api/v1/captures/latest?appId=YOUR_BUNDLE_ID' | jq .
```

See [the capture API runbook](docs/magic-edit-capture-api.md) for B2 paths,
health, deployment, and rollback details.
