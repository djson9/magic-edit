import { chmodSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
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

  it('applies and checks an app registration idempotently', () => {
    const directory = mkdtempSync(join(tmpdir(), 'magic-edit-apply-'))
    const source = join(directory, 'source')
    const installed = join(directory, 'installed')
    const bin = join(directory, 'bin')
    const repos = join(directory, 'repos')
    const state = join(directory, 'state')
    const register = join(bin, 'register')
    const adapter = join(bin, 'example-app-magic-edit-sync')
    mkdirSync(source)
    mkdirSync(bin)
    mkdirSync(repos)
    mkdirSync(join(repos, 'example-app'))
    mkdirSync(state)
    writeFileSync(
      join(source, 'example-app.json'),
      JSON.stringify({
        ...validConfig,
        repoPath: join(repos, 'example-app'),
        repoUser: process.env.USER,
        stateFile: join(state, 'example-app-magic-edit-live/source-revision'),
        adapter,
      }),
    )
    writeFileSync(
      register,
      '#!/bin/sh\ncase "$1" in --check) shift;; esac\ntest "$1" = example-app\n',
    )
    writeFileSync(adapter, '#!/bin/sh\nexit 0\n')
    chmodSync(register, 0o755)
    chmodSync(adapter, 0o755)

    const env = {
      ...process.env,
      MAGIC_EDIT_CONFIG_ROOT: installed,
      MAGIC_EDIT_EXPECTED_SOURCE_ROOT: source,
      MAGIC_EDIT_REGISTER_REMOTE: register,
      MAGIC_EDIT_REPO_ROOT: repos,
      MAGIC_EDIT_REPO_USER: process.env.USER,
      MAGIC_EDIT_STATE_ROOT: state,
      MAGIC_EDIT_ADAPTER_ROOT: bin,
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
  })
})
