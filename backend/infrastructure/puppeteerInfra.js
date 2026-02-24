import puppeteer from 'puppeteer'
import fs from 'fs'

export async function renderPdf(html, { width = '210mm', height = '297mm' } = {}) {
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    timeout: 30000,
  }

  // prefer environment path or common system paths
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) {
    launchOptions.executablePath = process.env.CHROMIUM_PATH
  } else {
    const candidates = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome-stable',
      '/snap/bin/chromium',
    ]
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        launchOptions.executablePath = p
        break
      }
    }
  }

  const browser = await puppeteer.launch(launchOptions)
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    await page.evaluate(async () => {
      const images = Array.from(document.images)
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve()
          return new Promise((resolve) => (img.onload = img.onerror = resolve))
        }),
      )
    })

    await page.evaluate(async () => {
      await document.fonts.ready
    })

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
