# Magic Edit capture API

The shared Phoenix 1.7 service accepts zero-configuration Redux and network
captures at `https://magicedit.dev/api/v1/captures` and stores them byte-for-byte
under the existing private B2 mount at `/mnt/b2/magic-edit/captures`.

The package sends `X-Magic-Edit-App-Id` and `X-Magic-Edit-Schema-Version: 1`.
The service returns an exact capture URL and a per-app latest URL, so a saved
Money Live capture can be inspected with:

```sh
curl 'https://magicedit.dev/api/v1/captures/latest?appId=com.financeapplabs.MoneyApp.live' | jq .
```

Family Quill Live uses its bundle identifier in the same query. Exact captures
remain available at `/api/v1/captures/<uuid>` and there is no public list,
delete, authentication, redaction, compression, retention, or database in the
first version.

## Deployment

Pushes to `djson9/magic-edit` `main` deploy only when `capture_server/**` or the
named capture deployment files change. The existing
`magic-edit-infrastructure` runner installs the internal Elixir 1.18/OTP 27 toolchain,
runs ExUnit, creates a release, calls the root-owned deployer, verifies the
public health revision, and completes a B2 write/read smoke test.

Bootstrap or check the host from an exact repository checkout:

```sh
sudo script/install-capture-host --apply
sudo script/install-capture-host --check
```

The installer maintains a marked `magicedit.dev` block inside the existing
`/etc/caddy/Caddyfile`, keeps a one-time backup at
`/var/lib/magic-edit-capture/Caddyfile.before-magic-edit-capture`, and does not
rewrite other sites. Phoenix binds only `127.0.0.1:8490`; Caddy owns public TLS.

The current release is `/opt/magic-edit-capture/current`, immutable releases
are keyed by full Git SHA under `/opt/magic-edit-capture/releases`, the service
is `magic-edit-capture.service`, and health is `https://magicedit.dev/up`.
The service runs as the existing unprivileged `davidson` account because the
rclone B2 mount presents that UID even with `allow_other`.

Inspect a deployment with:

```sh
systemctl status magic-edit-capture.service
journalctl -u magic-edit-capture.service --since '10 minutes ago'
curl https://magicedit.dev/up | jq .
```

The deployer switches the `current` symlink only after validating the artifact,
and restores the previous target automatically if the new local health endpoint
does not report the requested Git SHA.
