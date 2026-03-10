import { JSDOM } from 'jsdom'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { sanitizeHtml, inlineLocalImages, hideUiOnly } from '../services/htmlService.js'
import { renderPdf } from '../infrastructure/puppeteerInfra.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const cssPath = path.resolve(__dirname, '../../frontend/public/css/tailwind.css')
const tailwindCSS = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf-8') : ''

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

  const dom = new JSDOM(html)
  const document = dom.window.document

  sanitizeHtml(document)
  await inlineLocalImages(document)
  hideUiOnly(document)

  const fontName = parseFontName(font || '')                          // ← 加這行
  const isSystemFont = systemFonts.includes(fontName.toLowerCase())  // ← 加這行

  const fontLink = fontName && !isSystemFont
    ? `<link href="https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}&display=swap" rel="stylesheet" />`
    : ''

  const fontFamily = fontName && !isSystemFont
    ? `'${fontName}', 'Noto Sans TC', sans-serif`
    : `'Noto Sans TC', sans-serif`

  const optimizedHtml = `
    <html>
      <head>
        ${fontLink}
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@200;300;400;500;700&display=swap" rel="stylesheet">
        <style>
          ${tailwindCSS}
          body { font-family: ${fontFamily}; }
        </style>
      </head>
      <body>${document.body.innerHTML}</body>
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