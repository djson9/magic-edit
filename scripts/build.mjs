import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
