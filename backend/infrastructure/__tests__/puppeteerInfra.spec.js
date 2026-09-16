import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderPdf } from '../puppeteerInfra.js'

/**
 * The launch flags and the timeout budgets in this module are the settings that
 * keep a render inside a 512MB / 0.1 CPU instance, and the catch around
 * setContent is the rule that an optional resource -- a webfont from a CDN --
 * must never be able to fail a required output. Those are what these tests pin.
 *
 * puppeteer is stubbed wholesale: CI sets PUPPETEER_SKIP_DOWNLOAD, so no browser
 * exists on the runner. That also means the two page.evaluate bodies never run
 * here; they stay covered by the docker job's smoke render in CI.
 *
 * Unlike the frontend specs this file uses vi.mock: the backend has no dependency
 * injection and only static ESM imports, so the module path is the only seam.
 */
const launch = vi.hoisted(() => vi.fn())
vi.mock('puppeteer', () => ({ default: { launch } }))

let page
let browser

/** A TimeoutError as puppeteer raises it -- the code discriminates on `name`. */
function timeoutError() {
  return Object.assign(new Error('Navigation timeout of 20000 ms exceeded'), {
    name: 'TimeoutError',
  })
}

beforeEach(() => {
  page = {
    setContent: vi.fn().mockResolvedValue(undefined),
    setDefaultNavigationTimeout: vi.fn(),
    setDefaultTimeout: vi.fn(),
    evaluate: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
  }
  browser = {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
  }
  launch.mockReset()
  launch.mockResolvedValue(browser)

  // the module logs memory on every render; keep the test output readable
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.CHROMIUM_PATH
})

describe('renderPdf', () => {
  it('launches headless with the shared-memory and sandbox flags a container needs', async () => {
    await renderPdf('<p>menu</p>')

    const options = launch.mock.calls[0][0]
    expect(options.headless).toBe(true)
    expect(options.timeout).toBe(60000)
    expect(options.args).toEqual([
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
    ])
  })

  // The html comes from a request body, so its scripts run for real. With the
  // same-origin policy off they could read the response from anything this
  // container can reach and return it inside the PDF -- verified against a
  // running container before this was removed.
  it('keeps the same-origin policy on, so a rendered page cannot read the network', async () => {
    await renderPdf('<p>menu</p>')

    const { args } = launch.mock.calls[0][0]
    expect(args).not.toContain('--disable-web-security')
    expect(args).not.toContain('--allow-running-insecure-content')
  })

  it('uses CHROMIUM_PATH when set, so the image can skip the bundled download', async () => {
    process.env.CHROMIUM_PATH = '/usr/bin/chromium'

    await renderPdf('<p>menu</p>')

    expect(launch.mock.calls[0][0].executablePath).toBe('/usr/bin/chromium')
  })

  it('falls back to null rather than undefined when CHROMIUM_PATH is unset', async () => {
    await renderPdf('<p>menu</p>')

    // null is what tells puppeteer to use its own bundled browser
    expect(launch.mock.calls[0][0].executablePath).toBeNull()
  })

  it('waits for load on its own budget, not the full navigation timeout', async () => {
    await renderPdf('<p>menu</p>')

    // 'load' is what waits for the Google Fonts stylesheet; domcontentloaded
    // returns before any stylesheet is fetched and silently produced fallback PDFs
    expect(page.setContent).toHaveBeenCalledWith('<p>menu</p>', {
      waitUntil: 'load',
      timeout: 20000,
    })
    expect(page.setDefaultNavigationTimeout).toHaveBeenCalledWith(60000)
    expect(page.setDefaultTimeout).toHaveBeenCalledWith(60000)
  })

  it('still produces a PDF when the stylesheet misses its budget', async () => {
    page.setContent.mockRejectedValueOnce(timeoutError())

    const pdf = await renderPdf('<p>menu</p>')

    // the markup is already in place by then, so a slow CDN costs the webfont
    // rather than the export
    expect(pdf.toString()).toBe('%PDF-1.4')
    expect(page.pdf).toHaveBeenCalledOnce()
    expect(console.warn).toHaveBeenCalledWith(
      'Stylesheets did not load in time; exporting with fallback fonts',
    )
  })

  it('rethrows a setContent failure that is not a timeout', async () => {
    page.setContent.mockRejectedValueOnce(new Error('Target closed'))

    await expect(renderPdf('<p>menu</p>')).rejects.toThrow('Target closed')

    expect(page.pdf).not.toHaveBeenCalled() // no half-rendered output
    expect(browser.close).toHaveBeenCalledOnce()
  })

  it('passes the page size through and prints backgrounds at scale 1', async () => {
    await renderPdf('<p>menu</p>', { width: '148mm', height: '210mm' })

    expect(page.pdf).toHaveBeenCalledWith({
      width: '148mm',
      height: '210mm',
      printBackground: true,
      scale: 1,
    })
  })

  it('defaults to A4 millimetres when called with no options at all', async () => {
    await renderPdf('<p>menu</p>')

    expect(page.pdf).toHaveBeenCalledWith(
      expect.objectContaining({ width: '210mm', height: '297mm' }),
    )
  })

  it('closes the browser even when the render throws', async () => {
    page.pdf.mockRejectedValueOnce(new Error('Protocol error'))

    await expect(renderPdf('<p>menu</p>')).rejects.toThrow('Protocol error')

    // a leaked Chromium holds 150-250MB of a 512MB instance
    expect(browser.close).toHaveBeenCalledOnce()
  })
})
