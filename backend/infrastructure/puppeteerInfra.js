import puppeteer from 'puppeteer'

export async function renderPdf(html, { width = '210mm', height = '297mm' } = {}) {
  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
    ],
    timeout: 60000,
    executablePath: process.env.CHROMIUM_PATH || null, // use Puppeteer's bundled Chromium '/usr/bin/chromium' for local docker
  }

  const browser = await puppeteer.launch(launchOptions)
  try {
    const page = await browser.newPage()

    page.setDefaultNavigationTimeout(60000)
    page.setDefaultTimeout(60000)

    //  await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 })
    // await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 })

    const fontPreload = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''
    await page.setContent(`<html><head>${fontPreload}</head><body></body></html>`, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    })

    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })

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
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ])
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
