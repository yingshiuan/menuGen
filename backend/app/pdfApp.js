import path from 'path'
import { fileURLToPath } from 'url'
import {
  sanitizeHtml,
  inlineLocalImages,
  hideUiOnly,
  shrinkInlineImages,
} from '../services/htmlService.js'
import { renderPdf } from '../infrastructure/puppeteerInfra.js'
import { createCssLoader } from './cssLoader.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const cssPath = path.resolve(__dirname, '../../frontend/public/css/tailwind.css')
// Reread when the frontend rebuilds it, so a running backend never renders with a stale copy
const loadTailwindCss = createCssLoader(cssPath)

// Chinese text: Noto Sans TC, then Noto Sans SC for the characters TC lacks -- 叄 in
// 叄峇 (sambal) is one. A server without CJK system fonts has nothing else to fall back
// on and prints a box. Chrome fetches the SC slice only for a character that needs it.
const CJK_FAMILIES = "'Noto Sans TC', 'Noto Sans SC'"
const CJK_WEIGHTS = 'wght@200;300;400;500;700'
const CJK_STYLESHEET = `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:${CJK_WEIGHTS}&family=Noto+Sans+SC:${CJK_WEIGHTS}&display=swap`

const systemFonts = ['sans-serif', 'serif', 'monospace', 'arial', 'times new roman', 'courier new']

function parseFontName(fontFamily) {
  return (
    fontFamily
      .split(',')
      .map((f) => f.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)[0] || ''
  )
}

export async function generatePdfFromHtml({ html, width = '210mm', height = '297mm', font }) {
  if (!html) throw new Error('HTML content is required')

  // Resize the photos before the DOM exists. Parsing them first is what ran the
  // heap out of memory; see shrinkInlineImages.
  const shrunkHtml = await shrinkInlineImages(html)

  // Each of these rewrites the page as text. Parsing it into a DOM first, to
  // make the same handful of edits, cost 68MB of a 512MB instance on a 76-photo
  // menu -- and then threw the tree away so Chrome could parse the markup again.
  const bodyHtml = hideUiOnly(await inlineLocalImages(sanitizeHtml(shrunkHtml)))

  const fontName = parseFontName(font || '')
  const isSystemFont = systemFonts.includes(fontName.toLowerCase())

  const fontLink = fontName && !isSystemFont
    ? `<link href="https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}&display=swap" rel="stylesheet" />`
    : ''

  const fontFamily = fontName && !isSystemFont
    ? `'${fontName}', ${CJK_FAMILIES}, sans-serif`
    : `${CJK_FAMILIES}, sans-serif`

  const optimizedHtml = `
    <html>
      <head>
        ${fontLink}
        <link href="${CJK_STYLESHEET}" rel="stylesheet">
        <style>
          ${loadTailwindCss()}
          body { font-family: ${fontFamily}; }
        </style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `

  try {
    const pdfBuffer = await renderPdf(optimizedHtml, { width, height })
    return pdfBuffer
  } catch (err) {
    console.error('PDF generation failed:', err)
    throw err
  }
}