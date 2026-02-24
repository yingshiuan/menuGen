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

export async function generatePdfFromHtml({ html, width = '210mm', height = '297mm', font }) {
  if (!html) throw new Error('HTML content is required')

  const dom = new JSDOM(html)
  const document = dom.window.document

  // Sanitize interactive controls (inputs, selects, textareas)
  sanitizeHtml(document)

  // Remove icons that are not selected and strip helper attributes
  await inlineLocalImages(document) // need to await this before PDF rendering to ensure all images are processed

  // Hide UI-only elements
  hideUiOnly(document)

  const fontLink = font
    ? `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}&display=swap" rel="stylesheet" />`
    : ''

  const optimizedHtml = `
    <html>
      <head>
        ${fontLink}
        <style>${tailwindCSS}</style>
      </head>
      <body>${document.body.innerHTML}</body>
    </html>
  `

  const pdfBuffer = await renderPdf(optimizedHtml, { width, height })
  return pdfBuffer
}
