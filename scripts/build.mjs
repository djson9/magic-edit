import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [styles, tool, element] = await Promise.all([
  readFile(resolve(root, 'src/styles.css'), 'utf8'),
  readFile(resolve(root, 'src/comment-tool.js'), 'utf8'),
  readFile(resolve(root, 'src/magic-edit-element.js'), 'utf8'),
])

const styleInstaller = `(() => {
  if (document.getElementById('magic-edit-styles')) return
  const style = document.createElement('style')
  style.id = 'magic-edit-styles'
  style.textContent = ${JSON.stringify(styles)}
  document.head.append(style)
})()`

const banner = `/* @djson9/magic-edit v${process.env.npm_package_version || '0.1.0'} | https://github.com/djson9/magic-edit */`
const output = `${banner}\n${styleInstaller};\n${tool.trim()};\n${element.trim()};\n`

await mkdir(resolve(root, 'dist'), { recursive: true })
await writeFile(resolve(root, 'dist/magic-edit.js'), output)
await build({
  entryPoints: [resolve(root, 'react-native/index.tsx')],
  outfile: resolve(root, 'dist/react-native.cjs'),
  bundle: true,
  external: ['react', 'react-native'],
  format: 'cjs',
  platform: 'neutral',
  target: ['es2022'],
})
await build({
  entryPoints: [resolve(root, 'redux/index.ts')],
  outfile: resolve(root, 'dist/redux.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'neutral',
  target: ['es2022'],
})
await build({
  entryPoints: [resolve(root, 'redux/testing.ts')],
  outfile: resolve(root, 'dist/redux-testing.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'neutral',
  target: ['es2022'],
})
