import puppeteer from 'puppeteer'

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
    
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 })

    // await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 })

    // Wait for all images to load
    await page.evaluate(async () => {
      const images = Array.from(document.images)
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve()
          return new Promise((resolve) => (img.onload = img.onerror = resolve))
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
