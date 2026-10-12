import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Parser } from 'htmlparser2'
import { compressImage, compressSvg, compressBase64Image } from '../infrastructure/imageInfra.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// The size a photo the browser did not mark is shrunk to: an older frontend,
// or an image that was hidden when the menu was exported
export const DEFAULT_PRINT_PX = 300

// Pixels all of a menu's photos may add up to. Chromium holds every one decoded
// at 4 bytes a pixel while it prints, so this is about 96MB of the 512MB
// instance; past it, every photo is scaled down by the same factor, and the
// menu prints a little softer instead of being killed. In a 512MB / 0.1 CPU
// container, 76 photos at the largest size (23M pixels, so the full 300ppi)
// peaked at 406MB, and 120 of them, held to this budget, at 426MB.
export const PRINT_PIXEL_BUDGET = 24_000_000

const PRINT_PX = /data-print-px="(\d+)x(\d+)"/

/**
 * The box a data URI's image prints in, from the `data-print-px` the frontend
 * writes on it (printResolution.ts). Only the attributes on either side of the
 * URI are searched, so the photo itself is never copied.
 */
function printBox(html, uriStart, uriEnd) {
  const tagStart = html.lastIndexOf('<', uriStart)
  const tagEnd = html.indexOf('>', uriEnd)
  const attrs =
    html.slice(tagStart === -1 ? uriStart : tagStart, uriStart) +
    html.slice(uriEnd, tagEnd === -1 ? html.length : tagEnd)

  const marked = PRINT_PX.exec(attrs)
  if (!marked) return { width: DEFAULT_PRINT_PX, height: DEFAULT_PRINT_PX }
  return { width: Number(marked[1]), height: Number(marked[2]) }
}

/**
 * Shrink every base64 image in the page while it is still a string, to the
 * pixels it needs to print at 300ppi where it is drawn.
 *
 * JSDOM costs roughly thirty times the size of what it parses, so a menu full
 * of full-resolution photos is what exhausted the heap on a 512MB instance:
 * 11MB of HTML needed ~344MB of DOM to produce 0.5MB of output. The photos are
 * nearly all of that weight, so doing it here means the DOM only ever sees the
 * small versions.
 *
 * A first pass only reads the marked sizes, to scale them all down together
 * when the menu would go over PRINT_PIXEL_BUDGET. The second replaces matches
 * one at a time rather than collecting them first, so no pass ever holds a
 * second copy of every photo.
 */
export async function shrinkInlineImages(html) {
  // Only base64 payloads: an SVG data URI is already tiny and sharp cannot read
  // one, so it would cost a throw per icon to find that out.
  const dataUri = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g

  let match
  let pixels = 0
  while ((match = dataUri.exec(html)) !== null) {
    const { width, height } = printBox(html, match.index, dataUri.lastIndex)
    pixels += width * height
  }
  if (pixels === 0) return html

  // Pixels go with the square of the edge
  const fit = Math.min(1, Math.sqrt(PRINT_PIXEL_BUDGET / pixels))

  let out = ''
  let copiedUpTo = 0

  while ((match = dataUri.exec(html)) !== null) {
    const box = printBox(html, match.index, dataUri.lastIndex)
    out += html.slice(copiedUpTo, match.index)
    out += await compressBase64Image(
      match[0],
      Math.max(1, Math.round(box.width * fit)),
      Math.max(1, Math.round(box.height * fit)),
    )
    copiedUpTo = match.index + match[0].length
  }

  return out + html.slice(copiedUpTo)
}

/**
 * Splice a list of rewrites into a page, left to right.
 *
 * Every pass below ends here, and none of them copies the page when it has
 * nothing to change -- the same rule shrinkInlineImages follows, for the same
 * reason: on a 76-photo menu each needless copy is megabytes.
 *
 * The edits arrive in the order the tags did, and each covers one tag, so they
 * never overlap.
 */
function applyEdits(html, edits) {
  if (edits.length === 0) return html

  let out = ''
  let copiedUpTo = 0

  for (const { start, end, text } of edits) {
    out += html.slice(copiedUpTo, start) + text
    copiedUpTo = end
  }

  return out + html.slice(copiedUpTo)
}

/**
 * Find the tags a pass cares about, without building a document.
 *
 * htmlparser2 only tokenizes: `parser.startIndex`/`endIndex` bracket the tag
 * that triggered a callback, so a pass can rewrite that slice and leave the rest
 * of the page as the original string. Parsing the menu into a DOM instead cost
 * 68MB of a 512MB instance on a 76-photo menu -- a tree built to make a handful
 * of edits, then dropped so Chrome could parse the same markup over again.
 *
 * `decodeEntities: false` keeps attribute values exactly as they arrived, so
 * anything copied back out stays encoded the way the browser wrote it.
 */
function scanTags(html, handlers) {
  const parser = new Parser(handlers, { decodeEntities: false, recognizeSelfClosing: true })
  // The handlers read positions off the parser, so they need it before it runs
  handlers.parser = parser
  parser.end(html)
}

/** The slice of the page that a tag occupies, `<img ...>` included. */
function tagText(html, start, end) {
  return html.slice(start, end)
}

/** Add an attribute to a tag, whether it ends in `>` or `/>`. */
function withAttribute(tag, attribute) {
  return tag.replace(/\s*\/?>$/, ` ${attribute}>`)
}

/**
 * What a form control shows once it is text.
 *
 * A select is its selected option (the first one, when none is marked, as a
 * browser does), and an option with no value attribute falls back to its label.
 */
function controlText({ name, value, options }) {
  if (name !== 'select') return value

  const selected = options.find((option) => option.selected) ?? options[0]
  if (!selected) return ''
  return selected.value ?? selected.label
}

export function sanitizeHtml(html) {
  const edits = []
  // The control being read, while the scan is inside one
  let control = null
  let option = null

  const h = {
    onopentag(name, attribs) {
      const start = h.parser.startIndex

      if (control) {
        // Only a select has anything worth reading inside it
        if (name === 'option') option = { selected: 'selected' in attribs, value: attribs.value }
        return
      }

      if (name === 'input') {
        // An input is empty of content, so the tag itself is the whole control
        edits.push({
          start,
          end: h.parser.endIndex + 1,
          text: `<span>${attribs.value ?? ''}</span>`,
        })
        return
      }

      if (name === 'textarea' || name === 'select') {
        control = { name, start, value: '', options: [] }
        return
      }

      if (name === 'img' && 'data-selected' in attribs) {
        const end = h.parser.endIndex + 1
        // An icon that is off was never meant to print; one that is on prints
        // without the attribute that marked it
        const text =
          attribs['data-selected'] === 'true'
            ? tagText(html, start, end).replace(/\s+data-selected="[^"]*"/, '')
            : ''
        edits.push({ start, end, text })
      }
    },

    ontext(text) {
      if (!control) return
      if (option) option.label = (option.label ?? '') + text
      else if (control.name === 'textarea') control.value += text
    },

    onclosetag(name) {
      if (!control) return

      if (name === 'option' && option) {
        control.options.push(option)
        option = null
        return
      }

      if (name === control.name) {
        edits.push({
          start: control.start,
          end: h.parser.endIndex + 1,
          text: `<span>${controlText(control)}</span>`,
        })
        control = null
      }
    },
  }

  scanTags(html, h)
  return applyEdits(html, edits)
}

export async function inlineLocalImages(html) {
  const targets = []

  const h = {
    onopentag(name, attribs) {
      if (name !== 'img') return

      const src = attribs.src
      if (!src) return

      // shrinkInlineImages already handled these, over the raw string.
      // Re-encoding here would cost a second decode of every photo for nothing.
      if (src.startsWith('data:')) return

      targets.push({ src, start: h.parser.startIndex, end: h.parser.endIndex + 1 })
    },
  }

  scanTags(html, h)

  const edits = []

  for (const { src, start, end } of targets) {
    const tag = tagText(html, start, end)
    const missing = { start, end, text: withAttribute(tag, 'data-missing="true"') }

    // Strip query string and leading slash. A malformed percent sequence makes
    // decodeURIComponent throw, and nothing up the stack catches it, so one bad
    // filename would fail the whole export instead of dropping one image.
    let cleanSrc
    try {
      cleanSrc = decodeURIComponent(src.split('?')[0].replace(/^\//, ''))
    } catch {
      edits.push(missing)
      continue
    }

    const fileDir = path.resolve(__dirname, '../../frontend/public')
    const filePath = path.join(fileDir, cleanSrc)

    // path.join walks straight out of fileDir on a '../' src, and this HTML
    // arrives in the request body, so the src is attacker-controlled. Anything
    // resolving outside the asset root is treated as missing rather than read.
    if (!filePath.startsWith(fileDir + path.sep)) {
      edits.push(missing)
      continue
    }

    if (!fs.existsSync(filePath)) {
      edits.push(missing)
      continue
    }

    const base64 = filePath.endsWith('.svg')
      ? await compressSvg(filePath, 96, 96)
      : await compressImage(filePath, 200, 200)

    // A compressor that came back empty leaves the src alone: the picture is
    // still on disk for the next export, and the alternative is a broken img
    if (!base64) continue

    edits.push({
      start,
      end,
      // A replacement function, so `$&` and friends inside a data URI stay literal
      text: tag.replace(/(\ssrc=")[^"]*"/, (_, prefix) => `${prefix}${base64}"`),
    })
  }

  return applyEdits(html, edits)
}

export function hideUiOnly(html) {
  const edits = []

  const h = {
    onopentag(_name, attribs) {
      if (!('data-ui-only' in attribs)) return

      const start = h.parser.startIndex
      const end = h.parser.endIndex + 1
      const tag = tagText(html, start, end)

      // Hidden rather than removed: the editor's own chrome sits inside the
      // menu's layout, and dropping it would reflow the page it is printing
      const style = attribs.style
      const text =
        style === undefined
          ? withAttribute(tag, 'style="display:none"')
          : tag.replace(
              /(\sstyle=")[^"]*"/,
              () => ` style="${style.replace(/;\s*$/, '')};display:none"`,
            )

      edits.push({ start, end, text })
    },
  }

  scanTags(html, h)
  return applyEdits(html, edits)
}
