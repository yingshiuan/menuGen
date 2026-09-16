import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { compressImage, compressSvg, compressBase64Image } from '../infrastructure/imageInfra.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Shrink every base64 image in the page while it is still a string.
 *
 * JSDOM costs roughly thirty times the size of what it parses, so a menu full
 * of full-resolution photos is what exhausted the heap on a 512MB instance:
 * 11MB of HTML needed ~344MB of DOM to produce 0.5MB of output. The photos are
 * nearly all of that weight, and they get resized to 300px anyway, so doing it
 * here means the DOM only ever sees the small versions.
 *
 * Matches are replaced one at a time rather than collected first, so no pass
 * ever holds a second copy of every photo.
 */
export async function shrinkInlineImages(html) {
  // Only base64 payloads: an SVG data URI is already tiny and sharp cannot read
  // one, so it would cost a throw per icon to find that out.
  const dataUri = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g

  let out = ''
  let copiedUpTo = 0
  let match

  while ((match = dataUri.exec(html)) !== null) {
    out += html.slice(copiedUpTo, match.index)
    out += await compressBase64Image(match[0], 300, 300)
    copiedUpTo = match.index + match[0].length
  }

  return copiedUpTo === 0 ? html : out + html.slice(copiedUpTo)
}

export function sanitizeHtml(document) {
  document.querySelectorAll('input, textarea, select').forEach((el) => {
    const span = document.createElement('span')
    span.textContent = el.value || ''
    el.replaceWith(span)
  })

  // Remove the data-selected attribute on images that should appear
  document.querySelectorAll('img[data-selected]').forEach((img) => {
    if (img.getAttribute('data-selected') !== 'true') {
      img.remove()
    } else {
      img.removeAttribute('data-selected')
    }
  })
}

export async function inlineLocalImages(document) {
  const images = Array.from(document.querySelectorAll('img'))

  for (const img of images) {
    const src = img.getAttribute('src')
    if (!src) continue

    // shrinkInlineImages already handled these, before the DOM was built.
    // Re-encoding here would cost a second decode of every photo for nothing.
    if (src.startsWith('data:')) continue

    //     // Skip remote URLs and existing data URIs
    //     if (src.startsWith('http')) {
    //       console.log('[PDF] skipping remote image:', src)
    //       continue
    //     }
    //     if (src.startsWith('data:')) {
    //       console.log('[PDF] keeping existing data URI:', src.substring(0, 50) + '...')
    //       continue
    //     }

    // Strip query string and leading slash
    const cleanSrc = decodeURIComponent(src.split('?')[0].replace(/^\//, ''))

    // Candidate paths relative to THIS FILE (like old code)
    const fileDir = path.resolve(__dirname, '../../frontend/public') // adjust as needed
    const filePath = path.join(fileDir, cleanSrc)

    if (!fs.existsSync(filePath)) {
      // console.warn('[PDF] image not found for src:', src)
      img.setAttribute('data-missing', 'true')
      continue
    }

    // Compress image
    let base64 = null
    if (filePath.endsWith('.svg')) {
      base64 = await compressSvg(filePath, 96, 96)
    } else {
      base64 = await compressImage(filePath, 200, 200)
    }

    if (base64) {
      img.setAttribute('src', base64)
      // console.log('[PDF] inlined image from disk:', filePath)
    }
  }
}

export function hideUiOnly(document) {
  document.querySelectorAll('[data-ui-only]').forEach((el) => {
    el.style.display = 'none'
  })
}
