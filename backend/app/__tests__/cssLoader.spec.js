import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createCssLoader } from '../cssLoader.js'

/**
 * The PDF stylesheet is rebuilt by the frontend while the backend keeps running,
 * so the loader has to notice a new version without a restart.
 */
let dir
let cssPath

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'css-loader-'))
  cssPath = path.join(dir, 'tailwind.css')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

/** Write the file with a distinct mtime, as a rebuild a moment later would. */
function writeCss(css, secondsFromNow) {
  fs.writeFileSync(cssPath, css)
  const time = new Date(Date.now() + secondsFromNow * 1000)
  fs.utimesSync(cssPath, time, time)
}

describe('createCssLoader', () => {
  it('reads the stylesheet', () => {
    writeCss('.aspect-square{aspect-ratio:1}', 0)

    expect(createCssLoader(cssPath)()).toBe('.aspect-square{aspect-ratio:1}')
  })

  it('picks up a rebuilt stylesheet without a restart', () => {
    writeCss('.old{}', 0)
    const loadCss = createCssLoader(cssPath)
    expect(loadCss()).toBe('.old{}')

    writeCss('.old{}.h-lh{height:1lh}', 5)

    expect(loadCss()).toBe('.old{}.h-lh{height:1lh}')
  })

  it('does not reread a file that has not changed', () => {
    writeCss('.a{}', 0)
    const loadCss = createCssLoader(cssPath)
    loadCss()

    // Same mtime, different bytes: only possible if the file was not reread
    const { mtime } = fs.statSync(cssPath)
    fs.writeFileSync(cssPath, '.b{}')
    fs.utimesSync(cssPath, mtime, mtime)

    expect(loadCss()).toBe('.a{}')
  })

  it('renders unstyled rather than failing when the file is missing', () => {
    expect(createCssLoader(path.join(dir, 'missing.css'))()).toBe('')
  })
})
