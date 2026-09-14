# magicedit.dev operator runbook

`magicedit.dev` is the branded SSH Git ingress for registered Magic Edit apps.
It resolves to `jays-vm`, accepts only key-authenticated `git-shell` sessions,
mirrors an exact pushed commit to the registered GitHub `magic-edit` deployment
branch, and lets the app's one-step GitHub workflow select hot reload, native
publication, or no-op.

The versioned desired state is [`host/magicedit.dev.json`](../host/magicedit.dev.json).
It contains public infrastructure metadata and SecretStash credential names,
never secret values.

## Prerequisites

- `magicedit.dev` uses Porkbun nameservers.
- Porkbun API access is enabled for this domain in the Porkbun account.
- SecretStash on `jays-vm` contains raw credentials named
  `porkbun-apikey`, `porkbun-secretkey`, and `hetzner-api`.
- The host has the app-specific checkout and root-owned deployment adapter
  described in the main README. The target JSON itself is reconciled from this
  repository.
- Root administration reaches the VM over Tailscale, not public SSH.

Porkbun deliberately refuses DNS reads and writes until the account-side API
access toggle is enabled. The reconciler fails without changing anything when
that prerequisite is missing.

## Reconcile DNS, firewalls, and SSH

From an exact tagged Magic Edit checkout on `jays-vm`:

```sh
sudo script/install-host
sudo script/configure-domain --apply
sudo script/configure-domain --check
```

The apply command is idempotent. It:

1. Replaces only conflicting apex `A` or `ALIAS` records and requires
   `magicedit.dev A 178.105.73.243` with a 600-second TTL.
2. Preserves unrelated Porkbun DNS records.
3. Adds the exact IPv4 TCP/22 rule to the configured Hetzner firewall while
   preserving all existing rules.
4. Installs the host UFW and sshd policy through
   `magic-edit-enable-public-remote`.

The public sshd match permits only `git`, disables passwords, root login,
forwarding, and PTYs, and leaves tailnet administration unchanged.

## Create and authorize a developer key

Create one dedicated key on the developer machine. Do not reuse an interactive
administration key:

```sh
ssh-keygen -q -t ed25519 -N "" -f ~/.ssh/magicedit_ed25519 \
  -C "magicedit.dev deploy"
chmod 600 ~/.ssh/magicedit_ed25519
ssh root@jays-vm.tailade3f5.ts.net magic-edit-authorize-key \
  < ~/.ssh/magicedit_ed25519.pub
```

`magic-edit-authorize-key` keeps other authorized developer keys, replaces an
existing copy of the submitted key, prefixes it with OpenSSH's `restrict`
option, and makes the resulting authorization file root-owned and non-writable
by `git`. The file is mode `0644` because OpenSSH reads it as `git`; authorized
public keys are not secrets.

Configure the client:

```sshconfig
Host magicedit.dev
  User git
  IdentityFile ~/.ssh/magicedit_ed25519
  IdentitiesOnly yes
```

Back up the private key in Vaultwarden as a hidden field. The current canonical
item is `Magic Edit deploy key`, with separate public-key, fingerprint, and
remote fields. Never commit, paste into an issue, or place the private key in
SecretStash unless a VM service actually needs to consume it.

## Register an app

Add one validated desired-state file at `host/apps/<target>.json` and merge it
to `main`. The dedicated self-hosted runner automatically installs the
root-owned copy and reconciles the branded receiver. Confirm the workflow named
`Reconcile Magic Edit Apps` succeeded, then optionally verify it on the VM:

```sh
sudo magic-edit-register-remote --check <target>
```

In the app checkout:

```sh
git remote add magic-edit git@magicedit.dev:<target>.git
git config remote.magic-edit.push +HEAD:refs/heads/magic-edit
```

The app workflow remains one step:

```yaml
- uses: djson9/magic-edit/.github/actions/deploy@v0.4.8
  with:
    target: <target>
```

From any local branch or worktree, `git push magic-edit` now deploys `HEAD`.

### Follow a source branch automatically

For immediate Live deployment whenever a source branch moves, add
`autoPromote.sourceBranch` and `autoPromote.runnerUser` to the registered app,
then scaffold the app-side workflow:

```sh
npm exec --yes --package='github:djson9/magic-edit#v0.5.5' -- magic-edit-setup-live \
  --target <target> \
  --source-branch staging \
  --runner-label <target>-production \
  --runner-user <target>-actions-runner
```

The workflow deliberately runs no CI. It sends the repository, source branch,
and event SHA to the installed `magic-edit-promote` command. The command rejects
unregistered branches and stale event SHAs, then routes the commit through the
same local bare receiver used by `git push magic-edit`; GitHub's deployment ref
therefore retains the same exact-lease and workflow-trigger guarantees. No SSH
private key is stored in the app repository.

Use `magic-edit-setup-live ... --check` in repository maintenance to verify the
generated workflow. The app's existing Live workflow and branded remote remain
unchanged.

## Verification

```sh
dig +short @fortaleza.ns.porkbun.com A magicedit.dev
git ls-remote git@magicedit.dev:<target>.git refs/heads/magic-edit
git push magic-edit
```

Require the authoritative DNS answer to be `178.105.73.243`, the remote ref to
match the intended local commit, and the resulting GitHub workflow to succeed.
On the VM, `sudo script/configure-domain --check` and
`sudo magic-edit-register-remote --check <target>` must both pass.

The registered `magic-edit` ref is a Heroku-style deployment ref, so a pushed
commit may have unrelated history. The receiver mirrors it to GitHub with an
exact lease on the advertised old SHA. Deletes, multiple-ref pushes,
unregistered remote branches, and unknown targets still fail closed. Native iOS
publication still uses the existing protected signing lane and never creates or
revokes certificates.
