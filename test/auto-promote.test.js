import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()
const validConfig = {
  schemaVersion: 1,
  repository: 'djson9/example-app',
  branch: 'magic-edit',
  autoPromote: {
    sourceBranch: 'staging',
    runnerUser: 'example-actions-runner',
    policy: 'immediate',
  },
}
const sha = 'a'.repeat(40)

function validate(config, repository = 'djson9/example-app', branch = 'staging', revision = sha) {
  const directory = mkdtempSync(join(tmpdir(), 'magic-edit-promote-validation-'))
  const configPath = join(directory, 'example-app.json')
  writeFileSync(configPath, JSON.stringify(config))
  return spawnSync(
    'bash',
    ['bin/magic-edit-promote', 'validate', configPath, repository, branch, revision],
    { cwd: repoRoot, encoding: 'utf8' },
  )
}

describe('Magic Edit automatic promotion', () => {
  it('accepts only the registered repository and source branch', () => {
    expect(validate(validConfig).status).toBe(0)
    expect(validate(validConfig, 'djson9/another-app').status).not.toBe(0)
    expect(validate(validConfig, 'djson9/example-app', 'main').status).not.toBe(0)
    expect(validate(validConfig, 'djson9/example-app', 'staging', 'short').status).not.toBe(0)
  })

  it('requires source and deployment branches to remain distinct', () => {
    expect(
      validate({
        ...validConfig,
        autoPromote: { ...validConfig.autoPromote, sourceBranch: 'magic-edit' },
      }).status,
    ).not.toBe(0)
  })

  it('publishes through the branded receiver rather than directly to GitHub', () => {
    const source = readFileSync('bin/magic-edit-promote', 'utf8')
    expect(source).toContain('push --porcelain --force "$bare_repo"')
    expect(source).not.toContain('push --porcelain --force-with-lease')
    expect(source).toContain('chown -R git:git "$bare_repo/objects" "$bare_repo/refs"')
    expect(source).toContain('Skipping stale Magic Edit promotion')
  })
})

describe('Magic Edit live workflow scaffolder', () => {
  it('installs and checks an idempotent immediate-promotion workflow', () => {
    const directory = mkdtempSync(join(tmpdir(), 'magic-edit-setup-live-'))
    const script = resolve(repoRoot, 'bin/magic-edit-setup-live')
    const args = [
      script,
      '--target',
      'example-app',
      '--source-branch',
      'preview',
      '--runner-label',
      'example-production',
      '--runner-user',
      'example-actions-runner',
      '--action-ref',
      'v9.8.7',
    ]

    const first = spawnSync('bash', args, { cwd: directory, encoding: 'utf8' })
    const second = spawnSync('bash', args, { cwd: directory, encoding: 'utf8' })
    const check = spawnSync('bash', [...args, '--check'], { cwd: directory, encoding: 'utf8' })
    expect(first.stderr).toBe('')
    expect(first.status).toBe(0)
    expect(second.status).toBe(0)
    expect(check.status).toBe(0)

    const workflow = readFileSync(
      join(directory, '.github/workflows/magic-edit-auto-promote.yml'),
      'utf8',
    )
    expect(workflow).toContain('branches: [preview]')
    expect(workflow).toContain('runs-on: [self-hosted, linux, x64, example-production]')
    expect(workflow).toContain('djson9/magic-edit/.github/actions/promote@v9.8.7')
    expect(workflow).not.toContain('actions/checkout')
  })

  it('refuses to overwrite a different workflow', () => {
    const directory = mkdtempSync(join(tmpdir(), 'magic-edit-setup-live-conflict-'))
    const workflows = join(directory, '.github/workflows')
    mkdirSync(workflows, { recursive: true })
    writeFileSync(join(workflows, 'magic-edit-auto-promote.yml'), 'custom: true\n')
    const result = spawnSync(
      'bash',
      [
        resolve(repoRoot, 'bin/magic-edit-setup-live'),
        '--target',
        'example-app',
        '--runner-label',
        'example-production',
        '--runner-user',
        'example-actions-runner',
      ],
      { cwd: directory, encoding: 'utf8' },
    )
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('refusing to overwrite')
  })
})
