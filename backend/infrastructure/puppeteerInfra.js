import puppeteer from 'puppeteer'

// Fetching the webfont stylesheet means reaching out to Google's CDN in the
// middle of a render, so that wait gets a budget of its own well inside the 60s
// the whole page is allowed.
const STYLESHEET_BUDGET_MS = 20000

/* The only origins a menu has any reason to reach: the stylesheet, and the font
   files that stylesheet points at. Everything else in the page is already
   inline by the time it gets here. */
const ALLOWED_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com'])

/* Schemes that never leave the process. `about:` covers the blank document
   setContent starts from; blocking that would abort the render itself. */
const INERT_SCHEMES = ['data:', 'about:', 'blob:']

/**
 * Decide whether a request the page made may leave the container.
 *
 * Dropping --disable-web-security stopped a script reading a cross-origin
 * response, but the same-origin policy never stopped the request being sent: an
 * <img src> or a no-cors fetch pointed at an internal address still reaches it,
 * verified against a running container. Since the page is built from a request
 * body, every such request is one this server makes on a caller's behalf --
 * enough to reach internal services, to map what answers, or to make this
 * instance generate traffic against a third party.
 */
export function isRequestAllowed(url) {
  if (INERT_SCHEMES.some((scheme) => url.startsWith(scheme))) return true

  try {
    return ALLOWED_HOSTS.has(new URL(url).hostname)
  } catch {
    return false // an unparseable url is not one worth making
  }
}

export async function renderPdf(html, { width = '210mm', height = '297mm' } = {}) {
  const launchOptions = {
    headless: true,
    // No --disable-web-security here, and no --allow-running-insecure-content.
    // The html being rendered arrives in a request body, so it is untrusted and
    // its scripts run for real; without the same-origin policy they could read
    // the response from anything this container can reach and hand it back
    // inside the PDF. Nothing in a menu needs them: photos arrive base64
    // inlined, Tailwind is inlined, and Google Fonts serves its stylesheets
    // CORS-enabled.
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
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

    // Has to be in place before setContent, or the first requests the page makes
    // are already gone. An aborted image fires onerror, which the image wait
    // below already treats as settled, so a blocked request costs that one
    // element rather than the export.
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      if (isRequestAllowed(request.url())) return request.continue()
      return request.abort()
    })

    // A throwaway page used to be loaded first, holding just this page's <head>,
    // meant to warm the webfonts. It could not do that -- its body was empty, and
    // Chrome fetches a font file only once a glyph needs one -- but it did wait
    // for networkidle0, total network silence, on a request out to Google's CDN.
    // That wait is what timed out at 60s on a cold instance.
    //
    // Waiting for 'load' here is what actually gets the fonts: stylesheets are
    // still unfetched when domcontentloaded fires, so the Google Fonts link never
    // loaded and every export quietly used the fallback face -- 0 registered
    // @font-face rules, against 525 once the sheet is in. A timeout is not fatal,
    // because the markup is already in place by then: the menu exports in the
    // fallback face instead of failing, which is the right trade for a font.
    try {
      await page.setContent(html, {
        waitUntil: 'load',
        timeout: STYLESHEET_BUDGET_MS,
      })
    } catch (err) {
      if (err.name !== 'TimeoutError') throw err
      console.warn('Stylesheets did not load in time; exporting with fallback fonts')
    }

    // Before
    const memBefore = process.memoryUsage()
    console.log('Memory before PDF (MB):', {
      rss: (memBefore.rss / 1024 / 1024).toFixed(2),
      heapUsed: (memBefore.heapUsed / 1024 / 1024).toFixed(2),
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

    // After 
    const memAfter = process.memoryUsage()
    console.log('Memory after PDF (MB):', {
      rss: (memAfter.rss / 1024 / 1024).toFixed(2),
      heapUsed: (memAfter.heapUsed / 1024 / 1024).toFixed(2),
    })

  
    return pdfBuffer
  } finally {
    await browser.close()
  }
}
