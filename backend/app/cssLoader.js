import fs from 'fs'

/**
 * Reads a stylesheet on demand and rereads it only when the file changes.
 *
 * The PDF styling comes from frontend/public/css/tailwind.css, which the frontend
 * rebuilds whenever its sources change. Reading it once at startup meant a running
 * backend kept rendering PDFs with the old copy until someone restarted it.
 * A missing file gives '' so a render still goes ahead, unstyled.
 */
export function createCssLoader(cssPath) {
  let cached = { mtimeMs: -1, css: '' }

  return function loadCss() {
    let mtimeMs
    try {
      mtimeMs = fs.statSync(cssPath).mtimeMs
    } catch {
      return ''
    }
    if (mtimeMs !== cached.mtimeMs) {
      cached = { mtimeMs, css: fs.readFileSync(cssPath, 'utf-8') }
    }
    return cached.css
  }
}
