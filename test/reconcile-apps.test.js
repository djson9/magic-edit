import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const validConfig = {
  schemaVersion: 1,
  repository: 'djson9/example-app',
  branch: 'magic-edit',
  repoPath: '/home/davidson/workspace/example-app',
  repoUser: 'davidson',
  stateFile: '/var/lib/example-app-magic-edit-live/source-revision',
  adapter: '/usr/local/sbin/example-app-magic-edit-sync',
  appRoot: 'apps/native',
  unknownAppChange: 'native-release',
  nativePaths: ['apps/native/ios/*'],
  hotReloadPaths: ['apps/native/src/*'],
  ignorePaths: ['apps/native/__tests__/*'],
}

function validate(name, config) {
  const directory = mkdtempSync(join(tmpdir(), 'magic-edit-reconcile-'))
  const path = join(directory, `${name}.json`)
  writeFileSync(path, JSON.stringify(config))
  return spawnSync('bash', ['bin/magic-edit-reconcile-apps', 'validate', path], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
}

describe('Magic Edit declarative app registrations', () => {
  it('validates every checked-in app registration', () => {
    for (const target of ['acp-web', 'family-quill', 'money-app']) {
      const result = spawnSync(
        'bash',
        ['bin/magic-edit-reconcile-apps', 'validate', `host/apps/${target}.json`],
        { cwd: process.cwd(), encoding: 'utf8' },
      )
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
    }
  })

  it('rejects unsafe privileged paths and non-magic-edit branches', () => {
    expect(validate('example-app', validConfig).status).toBe(0)
    expect(
      validate('example-app', { ...validConfig, branch: 'main' }).status,
    ).not.toBe(0)
    expect(
      validate('example-app', { ...validConfig, adapter: '/tmp/run-anything' }).status,
    ).not.toBe(0)
    expect(
      validate('example-app', { ...validConfig, repoPath: '/root/example-app' }).status,
    ).not.toBe(0)
  })

  it('validates a bounded immediate-promotion registration', () => {
    const autoPromote = {
      sourceBranch: 'staging',
      runnerUser: 'example-actions-runner',
      policy: 'immediate',
    }
    expect(validate('example-app', { ...validConfig, autoPromote }).status).toBe(0)
    expect(
      validate('example-app', {
        ...validConfig,
        autoPromote: { ...autoPromote, sourceBranch: 'magic-edit' },
      }).status,
    ).not.toBe(0)
    expect(
      validate('example-app', {
        ...validConfig,
        autoPromote: { ...autoPromote, runnerUser: 'unsafe user' },
      }).status,
    ).not.toBe(0)
    expect(
      validate('example-app', {
        ...validConfig,
        autoPromote: { ...autoPromote, policy: 'after-checks' },
      }).status,
    ).not.toBe(0)
  })

  it('applies and checks an app registration idempotently', () => {
    const directory = mkdtempSync(join(tmpdir(), 'magic-edit-apply-'))
    const source = join(directory, 'source')
    const installed = join(directory, 'installed')
    const bin = join(directory, 'bin')
    const repos = join(directory, 'repos')
    const state = join(directory, 'state')
    const sudoers = join(directory, 'sudoers')
    const register = join(bin, 'register')
    const adapter = join(bin, 'example-app-magic-edit-sync')
    const promote = join(bin, 'magic-edit-promote')
    const visudo = join(bin, 'visudo')
    mkdirSync(source)
    mkdirSync(bin)
    mkdirSync(repos)
    mkdirSync(join(repos, 'example-app'))
    mkdirSync(state)
    mkdirSync(sudoers)
    const sourceConfig = join(source, 'example-app.json')
    const runnerUser = process.env.USER || 'runner'
    const sourceContents = JSON.stringify({
        ...validConfig,
        repoPath: join(repos, 'example-app'),
        repoUser: runnerUser,
        stateFile: join(state, 'example-app-magic-edit-live/source-revision'),
        adapter,
        autoPromote: { sourceBranch: 'staging', runnerUser, policy: 'immediate' },
      }, null, 3)
    writeFileSync(sourceConfig, sourceContents)
    writeFileSync(
      register,
      '#!/bin/sh\ncase "$1" in --check) shift;; esac\ntest "$1" = example-app\n',
    )
    writeFileSync(adapter, '#!/bin/sh\nexit 0\n')
    writeFileSync(promote, '#!/bin/sh\nexit 0\n')
    writeFileSync(visudo, '#!/bin/sh\ntest "$1" = -cf\ntest -f "$2"\n')
    chmodSync(register, 0o755)
    chmodSync(adapter, 0o755)
    chmodSync(promote, 0o755)
    chmodSync(visudo, 0o755)

    const env = {
      ...process.env,
      MAGIC_EDIT_CONFIG_ROOT: installed,
      MAGIC_EDIT_EXPECTED_SOURCE_ROOT: source,
      MAGIC_EDIT_REGISTER_REMOTE: register,
      MAGIC_EDIT_REPO_ROOT: repos,
      MAGIC_EDIT_REPO_USER: runnerUser,
      MAGIC_EDIT_STATE_ROOT: state,
      MAGIC_EDIT_ADAPTER_ROOT: bin,
      MAGIC_EDIT_PROMOTE_COMMAND: promote,
      MAGIC_EDIT_SUDOERS_ROOT: sudoers,
      MAGIC_EDIT_VISUDO_COMMAND: visudo,
    }
    const args = ['bin/magic-edit-reconcile-apps', '--apply', source]
    const first = spawnSync('bash', args, { cwd: process.cwd(), encoding: 'utf8', env })
    const second = spawnSync('bash', args, { cwd: process.cwd(), encoding: 'utf8', env })
    const check = spawnSync(
      'bash',
      ['bin/magic-edit-reconcile-apps', '--check', source],
      { cwd: process.cwd(), encoding: 'utf8', env },
    )

    expect(first.stderr).toBe('')
    expect(first.status).toBe(0)
    expect(second.status).toBe(0)
    expect(check.status).toBe(0)
    expect(readFileSync(join(installed, 'example-app.json'), 'utf8')).toBe(sourceContents)
    expect(readFileSync(join(sudoers, 'magic-edit-promote-example-app'), 'utf8')).toBe(
      `${runnerUser} ALL=(root) NOPASSWD: ${promote} example-app djson9/example-app staging *\n`,
    )
  }, 15_000)
})
