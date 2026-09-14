import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const config = {
  schemaVersion: 1,
  repository: 'djson9/coparenting',
  branch: 'magic-edit',
  appRoot: 'apps/native',
  unknownAppChange: 'native-release',
  nativePaths: [
    'apps/native/ios/*',
    'apps/native/package.json',
    'apps/native/package-lock.json',
  ],
  hotReloadPaths: [
    'apps/native/App.tsx',
    'apps/native/index.js',
    'apps/native/src/*',
    'apps/native/assets/*',
  ],
  ignorePaths: ['apps/native/README.md', 'apps/native/__tests__/*'],
}

function validateReceive(oldSha, newSha, ref) {
  const directory = mkdtempSync(join(tmpdir(), 'magic-edit-receiver-'))
  const configPath = join(directory, 'app.json')
  writeFileSync(configPath, JSON.stringify(config))
  return spawnSync(
    'bash',
    ['bin/magic-edit-receive', 'validate', configPath, oldSha, newSha, ref],
    { cwd: process.cwd(), encoding: 'utf8' },
  )
}

function classify(paths) {
  const directory = mkdtempSync(join(tmpdir(), 'magic-edit-classifier-'))
  const configPath = join(directory, 'app.json')
  writeFileSync(configPath, JSON.stringify(config))
  const result = spawnSync('bash', ['bin/magic-edit-deploy', 'classify', configPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    input: `${paths.join('\n')}\n`,
  })
  expect(result.stderr).toBe('')
  expect(result.status).toBe(0)
  return result.stdout.trim()
}

describe('Magic Edit deployment classifier', () => {
  it('ships syntactically valid capture host and deploy scripts', () => {
    for (const script of [
      'bin/magic-edit-capture-deploy',
      'bin/magic-edit-promote',
      'bin/magic-edit-setup-live',
      'script/install-capture-host',
    ]) {
      const result = spawnSync('bash', ['-n', script], { cwd: process.cwd(), encoding: 'utf8' })
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
    }
    expect(readFileSync('host/magic-edit-capture.sudoers', 'utf8')).toContain(
      'magic-edit-capture-deploy deploy *',
    )
  })

  it('uses hot reload for runtime JavaScript and assets', () => {
    expect(classify(['apps/native/src/screens/Home.tsx'])).toBe('hot-reload')
    expect(classify(['apps/native/assets/icon.png'])).toBe('hot-reload')
  })

  it('publishes a native release for native or dependency changes', () => {
    expect(classify(['apps/native/ios/AppDelegate.swift'])).toBe('native-release')
    expect(classify(['apps/native/package-lock.json'])).toBe('native-release')
    expect(classify(['apps/native/a-future-native-config.yml'])).toBe('native-release')
  })

  it('does nothing for docs, tests, and unrelated application files', () => {
    expect(classify(['apps/native/README.md', 'rails/app/models/user.rb'])).toBe('noop')
    expect(classify(['apps/native/__tests__/app.test.tsx'])).toBe('noop')
  })

  it('always prefers a native release when a commit mixes change classes', () => {
    expect(
      classify(['apps/native/src/screens/Home.tsx', 'apps/native/ios/AppDelegate.swift']),
    ).toBe('native-release')
  })
})

describe('Magic Edit Git receiver validation', () => {
  const oldSha = '1'.repeat(40)
  const newSha = '2'.repeat(40)

  it('accepts the registered branch and a non-delete update', () => {
    expect(validateReceive(oldSha, newSha, 'refs/heads/magic-edit').status).toBe(0)
  })

  it('rejects another branch and branch deletion', () => {
    expect(validateReceive(oldSha, newSha, 'refs/heads/main').status).not.toBe(0)
    expect(validateReceive(oldSha, '0'.repeat(40), 'refs/heads/magic-edit').status).not.toBe(0)
  })

  it('treats the registered branch as a deploy ref instead of a history branch', () => {
    const receiver = readFileSync('bin/magic-edit-receive', 'utf8')
    const registration = readFileSync('bin/magic-edit-register-remote', 'utf8')

    expect(receiver).not.toContain('merge-base --is-ancestor "$old_sha" "$new_sha"')
    expect(receiver).toContain('--force-with-lease="$ref:$old_sha"')
    expect(registration).toContain('config receive.denyNonFastForwards false')
  })
})
