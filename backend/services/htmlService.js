import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { compressImage, compressSvg } from '../infrastructure/imageInfra.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
