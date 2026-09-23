import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generatePdfFromHtml } from '../pdfApp.js'

/**
 * Everything this module decides ends up in one template string that only the
 * renderer ever sees, so the assertions here read that string back off the
 * stubbed renderPdf call.
 *
 * The font branch is the interesting part. A system font must not pull a Google
 * Fonts link -- that is an outbound request on a cold instance for a face the
 * machine already has -- while a webfont must, and CJK always needs Noto Sans TC
 * (then SC, for the characters TC lacks) behind whatever was asked for.
 *
 * Assertions stay on the structure of the markup rather than Tailwind's contents:
 * pdfApp reads frontend/public/css/tailwind.css at import, and matching its text
 * would couple this suite to a frontend build artifact.
 *
 * Unlike the frontend specs this file uses vi.mock: the backend has no dependency
 * injection and only static ESM imports, so the module path is the only seam.
 */
const renderPdf = vi.hoisted(() => vi.fn())
vi.mock('../../infrastructure/puppeteerInfra.js', () => ({ renderPdf }))

/** The assembled page that was handed to the renderer. */
function renderedHtml() {
  return renderPdf.mock.calls[0][0]
}

beforeEach(() => {
  renderPdf.mockReset().mockResolvedValue(Buffer.from('%PDF-1.4'))
})

describe('generatePdfFromHtml', () => {
  it('refuses an empty payload instead of rendering a blank page', async () => {
    await expect(generatePdfFromHtml({ html: '' })).rejects.toThrow('HTML content is required')

    expect(renderPdf).not.toHaveBeenCalled()
  })

  it('returns the renderer buffer untouched', async () => {
    const pdf = await generatePdfFromHtml({ html: '<p>Soup</p>' })

    expect(pdf.toString()).toBe('%PDF-1.4')
  })

  it('lets a render failure through to the queue after logging it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderPdf.mockRejectedValueOnce(new Error('Protocol error'))

    // the queue is what turns this into a job status; swallowing it here would
    // hand back an empty buffer and report success
    await expect(generatePdfFromHtml({ html: '<p>Soup</p>' })).rejects.toThrow('Protocol error')

    expect(console.error).toHaveBeenCalledWith('PDF generation failed:', expect.any(Error))
  })

  it('carries the menu body into the rendered page', async () => {
    await generatePdfFromHtml({ html: '<div><p>Szechuan Soup</p></div>' })

    expect(renderedHtml()).toContain('<p>Szechuan Soup</p>')
    expect(renderedHtml()).toContain('<style>') // tailwind is inlined, not linked
  })

  it('passes the page size through to the renderer', async () => {
    await generatePdfFromHtml({ html: '<p>Soup</p>', width: '148mm', height: '210mm' })

    expect(renderPdf.mock.calls[0][1]).toEqual({ width: '148mm', height: '210mm' })
  })

  it('defaults to A4 when no size is given', async () => {
    await generatePdfFromHtml({ html: '<p>Soup</p>' })

    expect(renderPdf.mock.calls[0][1]).toEqual({ width: '210mm', height: '297mm' })
  })

  it('requests a webfont and puts it in front of the CJK fallback', async () => {
    await generatePdfFromHtml({ html: '<p>Soup</p>', font: 'Inter' })

    expect(renderedHtml()).toContain('https://fonts.googleapis.com/css2?family=Inter')
    expect(renderedHtml()).toContain(
      "font-family: 'Inter', 'Noto Sans TC', 'Noto Sans SC', sans-serif",
    )
  })

  it('joins a multi-word family with + for the stylesheet URL', async () => {
    await generatePdfFromHtml({ html: '<p>Soup</p>', font: 'Playfair Display' })

    expect(renderedHtml()).toContain('family=Playfair+Display')
    expect(renderedHtml()).toContain("font-family: 'Playfair Display'")
  })

  it('takes the first family from a CSS stack and drops the quotes', async () => {
    await generatePdfFromHtml({ html: '<p>Soup</p>', font: "'Inter', Helvetica, sans-serif" })

    expect(renderedHtml()).toContain('family=Inter&display=swap')
    expect(renderedHtml()).toContain(
      "font-family: 'Inter', 'Noto Sans TC', 'Noto Sans SC', sans-serif",
    )
  })

  it('does not reach out to a CDN for a font the machine already has', async () => {
    await generatePdfFromHtml({ html: '<p>Soup</p>', font: 'Arial' })

    const links = renderedHtml().match(/fonts\.googleapis\.com/g) ?? []
    expect(links).toHaveLength(1) // only the unconditional CJK sheet
    expect(renderedHtml()).not.toContain('family=Arial')
    expect(renderedHtml()).toContain("font-family: 'Noto Sans TC', 'Noto Sans SC', sans-serif")
  })

  it('falls back to the CJK face when no font is named at all', async () => {
    await generatePdfFromHtml({ html: '<p>Soup</p>' })

    expect(renderedHtml()).toContain("font-family: 'Noto Sans TC', 'Noto Sans SC', sans-serif")
    expect(renderedHtml()).toContain('family=Noto+Sans+TC') // always requested, for CJK glyphs
  })

  it('backs Noto Sans TC with Noto Sans SC for the characters TC lacks, in one sheet', async () => {
    await generatePdfFromHtml({ html: '<p>叄峇豆腐</p>', font: 'Inter' })

    // 叄 (U+53C4) is missing from TC; a server without CJK system fonts would print a box
    expect(renderedHtml()).toContain(
      "font-family: 'Inter', 'Noto Sans TC', 'Noto Sans SC', sans-serif",
    )
    const sheets = renderedHtml().match(/<link href="[^"]*Noto\+Sans[^"]*"/g) ?? []
    expect(sheets).toHaveLength(1)
    expect(sheets[0]).toContain('family=Noto+Sans+TC:wght@200;300;400;500;700')
    expect(sheets[0]).toContain('family=Noto+Sans+SC:wght@200;300;400;500;700')
  })

  it('turns editor inputs into text and hides UI-only chrome', async () => {
    await generatePdfFromHtml({
      html: '<div><input value="Wonton Soup" /><button data-ui-only>Edit</button></div>',
    })

    expect(renderedHtml()).toContain('<span>Wonton Soup</span>')
    expect(renderedHtml()).not.toContain('<input')
    expect(renderedHtml()).toContain('style="display:none"')
  })
})
