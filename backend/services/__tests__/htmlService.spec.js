import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hideUiOnly, inlineLocalImages, sanitizeHtml, shrinkInlineImages } from '../htmlService.js'

/**
 * Every pass here rewrites the page as text, because parsing a menu into a DOM
 * costs roughly thirty times what the markup does: 68MB of a 512MB instance on a
 * 76-photo menu, for a handful of edits Chrome then reparses anyway.
 *
 * So each suite pins two things: the edit itself, and that the markup around it
 * comes back untouched -- a pass with nothing to do must return the very same
 * string rather than a copy of it.
 *
 * inlineLocalImages reads from disk with a path built out of the request body, so
 * its containment check gets pinned here too.
 *
 * Unlike the frontend specs this file uses vi.mock: the backend has no dependency
 * injection and only static ESM imports, so the module path is the only seam.
 */
const compressBase64Image = vi.hoisted(() => vi.fn())
const compressImage = vi.hoisted(() => vi.fn())
const compressSvg = vi.hoisted(() => vi.fn())
const existsSync = vi.hoisted(() => vi.fn())

vi.mock('../../infrastructure/imageInfra.js', () => ({
  compressBase64Image,
  compressImage,
  compressSvg,
}))
vi.mock('fs', () => ({ default: { existsSync }, existsSync }))

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='

beforeEach(() => {
  compressBase64Image.mockReset().mockResolvedValue('data:image/jpeg;base64,SHRUNK')
  compressImage.mockReset().mockResolvedValue('data:image/png;base64,DISK')
  compressSvg.mockReset().mockResolvedValue('data:image/png;base64,SVG')
  existsSync.mockReset().mockReturnValue(true)
})

describe('shrinkInlineImages', () => {
  it('returns the very same string when there is nothing to shrink', async () => {
    const html = '<div><h1>Menu</h1><p>No photos here</p></div>'

    const result = await shrinkInlineImages(html)

    // identity, not an equal copy: a photo-free menu must not be duplicated in memory
    expect(result).toBe(html)
    expect(compressBase64Image).not.toHaveBeenCalled()
  })

  it('shrinks every inline photo to 300px and leaves the markup around them intact', async () => {
    const html = `<div><img src="${PNG}" /><span>Soup</span><img src="${JPEG}" /></div>`

    const result = await shrinkInlineImages(html)

    expect(result).toBe(
      '<div><img src="data:image/jpeg;base64,SHRUNK" /><span>Soup</span>' +
        '<img src="data:image/jpeg;base64,SHRUNK" /></div>',
    )
    expect(compressBase64Image).toHaveBeenCalledTimes(2)
    expect(compressBase64Image).toHaveBeenCalledWith(PNG, 300, 300)
  })

  it('handles a payload that is nothing but the data URI', async () => {
    const result = await shrinkInlineImages(PNG)

    expect(result).toBe('data:image/jpeg;base64,SHRUNK')
  })

  it('keeps the tail after the last match', async () => {
    const result = await shrinkInlineImages(`<img src="${PNG}" /><footer>end</footer>`)

    expect(result).toBe('<img src="data:image/jpeg;base64,SHRUNK" /><footer>end</footer>')
  })
})

describe('sanitizeHtml', () => {
  it('returns the very same string when the menu has no form controls', () => {
    const html = '<div><h1>Menu</h1><p>Szechuan Soup</p></div>'

    expect(sanitizeHtml(html)).toBe(html)
  })

  it('replaces inputs with their value so the PDF shows text, not form controls', () => {
    const result = sanitizeHtml('<input value="Szechuan Soup" /><textarea>Spicy</textarea>')

    expect(result).toBe('<span>Szechuan Soup</span><span>Spicy</span>')
  })

  it('leaves an empty span for an input with no value rather than dropping it', () => {
    expect(sanitizeHtml('<input />')).toBe('<span></span>')
  })

  it('keeps the markup around a control exactly as it arrived', () => {
    const result = sanitizeHtml('<div class="row"><input value="Wonton" /><em>x2</em></div>')

    expect(result).toBe('<div class="row"><span>Wonton</span><em>x2</em></div>')
  })

  it('keeps an entity in a value encoded, so it prints as one character', () => {
    expect(sanitizeHtml('<input value="Fish &amp; Chips" />')).toBe('<span>Fish &amp; Chips</span>')
  })

  it('reads a select through its selected option, as a browser does', () => {
    const html =
      '<select><option value="a">A</option><option value="b" selected>B</option></select>'

    expect(sanitizeHtml(html)).toBe('<span>b</span>')
  })

  it('falls back to the first option when none is selected', () => {
    const html = '<select><option value="a">A</option><option value="b">B</option></select>'

    expect(sanitizeHtml(html)).toBe('<span>a</span>')
  })

  it('uses an option label when the option carries no value', () => {
    expect(sanitizeHtml('<select><option>Small</option></select>')).toBe('<span>Small</span>')
  })

  it('keeps a selected icon but strips the attribute that marked it', () => {
    const result = sanitizeHtml('<img src="a.png" data-selected="true" />')

    expect(result).toBe('<img src="a.png" />')
  })

  it('removes an icon that was not selected', () => {
    expect(sanitizeHtml('<img src="a.png" data-selected="false" />')).toBe('')
  })

  it('leaves an icon with no data-selected attribute alone', () => {
    const html = '<img src="a.png" />'

    expect(sanitizeHtml(html)).toBe(html)
  })
})

describe('hideUiOnly', () => {
  it('hides editor chrome without removing it from the page', () => {
    const result = hideUiOnly('<button data-ui-only>Edit</button><p>Soup</p>')

    // removing it instead would reflow the layout it is printing
    expect(result).toBe('<button data-ui-only style="display:none">Edit</button><p>Soup</p>')
  })

  it('keeps the styles the element already had', () => {
    const result = hideUiOnly('<span data-ui-only style="color: red;">Edit</span>')

    expect(result).toBe('<span data-ui-only style="color: red;display:none">Edit</span>')
  })

  it('returns the very same string when there is no editor chrome', () => {
    const html = '<p>Soup</p>'

    expect(hideUiOnly(html)).toBe(html)
  })
})

describe('inlineLocalImages', () => {
  it('leaves data URIs alone, since shrinkInlineImages already handled them', async () => {
    const html = `<img src="${PNG}" />`

    // re-encoding here would cost a second decode of every photo for nothing
    expect(await inlineLocalImages(html)).toBe(html)
    expect(compressImage).not.toHaveBeenCalled()
  })

  it('inlines a raster file from disk at 200px', async () => {
    const result = await inlineLocalImages('<img src="/picture/soup.png" />')

    expect(compressImage).toHaveBeenCalledWith(
      expect.stringContaining('picture/soup.png'),
      200,
      200,
    )
    expect(result).toBe('<img src="data:image/png;base64,DISK" />')
  })

  it('keeps the other attributes of the image it rewrites', async () => {
    const result = await inlineLocalImages('<img class="dish" src="/picture/soup.png" alt="Soup">')

    expect(result).toBe('<img class="dish" src="data:image/png;base64,DISK" alt="Soup">')
  })

  it('rasterises an svg at 96px instead', async () => {
    await inlineLocalImages('<img src="/icons/chef.svg" />')

    expect(compressSvg).toHaveBeenCalledWith(expect.stringContaining('icons/chef.svg'), 96, 96)
    expect(compressImage).not.toHaveBeenCalled()
  })

  it('strips a cache-busting query string before looking on disk', async () => {
    await inlineLocalImages('<img src="/picture/soup.png?v=2" />')

    expect(compressImage).toHaveBeenCalledWith(expect.stringMatching(/soup\.png$/), 200, 200)
  })

  it('decodes a percent-escaped filename', async () => {
    await inlineLocalImages('<img src="/picture/wonton%20soup.png" />')

    expect(compressImage).toHaveBeenCalledWith(expect.stringContaining('wonton soup.png'), 200, 200)
  })

  it('marks a missing file rather than failing the whole export', async () => {
    existsSync.mockReturnValue(false)

    const result = await inlineLocalImages('<img src="/picture/gone.png" />')

    expect(result).toBe('<img src="/picture/gone.png" data-missing="true">')
    expect(compressImage).not.toHaveBeenCalled()
  })

  it('leaves the src untouched when the compressor returns nothing', async () => {
    compressImage.mockResolvedValue(null)
    const html = '<img src="/picture/soup.png" />'

    expect(await inlineLocalImages(html)).toBe(html)
  })

  it('skips an img with no src at all', async () => {
    const html = '<img />'

    expect(await inlineLocalImages(html)).toBe(html)
    expect(compressImage).not.toHaveBeenCalled()
  })

  // This HTML arrives in the POST body, so the src is attacker-controlled and
  // path.join walks straight out of frontend/public on a '../'. Without the
  // containment check any image on the server could be embedded in the reply.
  it('refuses a src that climbs out of the asset root', async () => {
    const result = await inlineLocalImages('<img src="../../../../etc/hosts.png" />')

    expect(compressImage).not.toHaveBeenCalled()
    expect(existsSync).not.toHaveBeenCalled() // rejected before it ever touches disk
    expect(result).toContain('data-missing="true"')
  })

  it('refuses a climb hidden in a percent escape', async () => {
    const result = await inlineLocalImages('<img src="%2e%2e/%2e%2e/secret.png" />')

    expect(compressImage).not.toHaveBeenCalled()
    expect(result).toContain('data-missing="true"')
  })

  // decodeURIComponent throws URIError on a stray '%', and nothing up the stack
  // catches it, so one bad filename used to fail the entire export.
  it('drops one image with a malformed escape instead of failing the export', async () => {
    const html = '<img src="/picture/100%.png" /><img src="/picture/soup.png" />'

    const result = await inlineLocalImages(html)

    expect(result).toBe(
      '<img src="/picture/100%.png" data-missing="true">' +
        '<img src="data:image/png;base64,DISK" />', // the rest still inlined
    )
  })
})
