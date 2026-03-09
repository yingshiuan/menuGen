import puppeteer from 'puppeteer'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadFont(filename) {
  const fontPath = join(__dirname, '../fonts', filename)
  return readFileSync(fontPath).toString('base64')
}

export async function renderPdf(html, { width = '210mm', height = '297mm' } = {}) {
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    timeout: 60000,
    executablePath: puppeteer.executablePath(), // use Puppeteer's bundled Chromium
  }

  const browser = await puppeteer.launch(launchOptions)
  try {
    const page = await browser.newPage()

    await page.addStyleTag({
      content: `
        @font-face {
          font-family: 'NotoSansTC';
          font-weight: 200;
          src: url('data:font/truetype;base64,${loadFont('NotoSansTC-ExtraLight.ttf')}') format('truetype');
        }
        @font-face {
          font-family: 'NotoSansTC';
          font-weight: 300;
          src: url('data:font/truetype;base64,${loadFont('NotoSansTC-Light.ttf')}') format('truetype');
        }
        @font-face {
          font-family: 'NotoSansTC';
          font-weight: 400;
          src: url('data:font/truetype;base64,${loadFont('NotoSansTC-Regular.ttf')}') format('truetype');
        }
        @font-face {
          font-family: 'NotoSansTC';
          font-weight: 500;
          src: url('data:font/truetype;base64,${loadFont('NotoSansTC-Medium.ttf')}') format('truetype');
        }
        @font-face {
          font-family: 'NotoSansTC';
          font-weight: 700;
          src: url('data:font/truetype;base64,${loadFont('NotoSansTC-Bold.ttf')}') format('truetype');
        }
        * { font-family: 'NotoSansTC', sans-serif; }
      `,
    })

    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 })
    // await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 })

    // Wait for all images to load
    await page.evaluate(async () => {
      const images = Array.from(document.images)
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve()
          return new Promise((resolve) => {
            img.onload = resolve
            img.onerror = resolve
            setTimeout(resolve, 3000) // wait 3 seconds
          })
        }),
      )
    })

    // Wait for fonts to load
    await page.evaluate(async () => {
      await document.fonts.ready
    })

    // Generate PDF
    const pdfBuffer = await page.pdf({
      width,
      height,
      // format: 'A4',
      printBackground: true,
      scale: 1,
      // margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    })

    return pdfBuffer
  } finally {
    await browser.close()
  }
}