import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('@djson9/magic-edit React Native distribution', () => {
  it('ships a compiled component and the autolinked iOS implementation', () => {
    const bundle = readFileSync('dist/react-native.cjs', 'utf8')
    const reduxBundle = readFileSync('dist/redux.cjs', 'utf8')
    const podspec = readFileSync('DJSON9MagicEdit.podspec', 'utf8')
    const swift = readFileSync('ios/MagicEditBubble.swift', 'utf8')

    expect(bundle).toContain('MagicEditBubble')
    expect(bundle).toContain('MagicEditSelectorModule')
    expect(bundle).toContain('Save debug metadata')
    expect(bundle).toContain('https://magicedit.dev/api/v1/captures')
    expect(reduxBundle).toContain('magicEditMiddleware')
    expect(podspec).toContain("spec.source_files = 'ios/**/*.{m,swift}'")
    expect(swift).toContain('DRAG ANYWHERE TO AIM')
    expect(swift).toContain('magic_edit_selector_select')
    expect(swift).toContain('CFBundleShortVersionString')
  })
})
