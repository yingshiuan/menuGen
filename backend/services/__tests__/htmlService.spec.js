import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import {
  hideUiOnly,
  inlineLocalImages,
  sanitizeHtml,
  shrinkInlineImages,
} from '../htmlService.js'

/**
 * shrinkInlineImages is the load-bearing one: it rewrites photos while the page
 * is still a string, because JSDOM costs roughly thirty times the size of what it
 * parses and a menu of full-resolution photos is what exhausted the heap on a
 * 512MB instance. Its fast path matters as much as its rewriting -- a menu with
 * no photos must come back as the same string, not a copy.
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

/** The document these functions mutate is always a real JSDOM one. */
function docOf(html) {
  return new JSDOM(`<body>${html}</body>`).window.document
}

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
  it('replaces inputs with their value so the PDF shows text, not form controls', () => {
    const document = docOf('<input value="Szechuan Soup" /><textarea>Spicy</textarea>')

    sanitizeHtml(document)

    expect(document.body.innerHTML).toBe('<span>Szechuan Soup</span><span>Spicy</span>')
  })

  it('leaves an empty span for an input with no value rather than dropping it', () => {
    const document = docOf('<input />')

    sanitizeHtml(document)

    expect(document.body.innerHTML).toBe('<span></span>')
  })

  it('keeps a selected icon but strips the attribute that marked it', () => {
    const document = docOf('<img src="a.png" data-selected="true" />')

    sanitizeHtml(document)

    expect(document.body.innerHTML).toBe('<img src="a.png">')
  })

  it('removes an icon that was not selected', () => {
    const document = docOf('<img src="a.png" data-selected="false" />')

    sanitizeHtml(document)

    expect(document.body.innerHTML).toBe('')
  })
})

describe('hideUiOnly', () => {
  it('hides editor chrome without removing it from the tree', () => {
    const document = docOf('<button data-ui-only>Edit</button><p>Soup</p>')

    hideUiOnly(document)

    expect(document.querySelector('button').style.display).toBe('none')
    expect(document.querySelector('p').style.display).toBe('')
  })
})

describe('inlineLocalImages', () => {
  it('leaves data URIs alone, since shrinkInlineImages already handled them', async () => {
    const document = docOf(`<img src="${PNG}" />`)

    await inlineLocalImages(document)

    // re-encoding here would cost a second decode of every photo for nothing
    expect(compressImage).not.toHaveBeenCalled()
    expect(document.querySelector('img').getAttribute('src')).toBe(PNG)
  })

  it('inlines a raster file from disk at 200px', async () => {
    const document = docOf('<img src="/picture/soup.png" />')

    await inlineLocalImages(document)

    expect(compressImage).toHaveBeenCalledWith(expect.stringContaining('picture/soup.png'), 200, 200)
    expect(document.querySelector('img').getAttribute('src')).toBe('data:image/png;base64,DISK')
  })

  it('rasterises an svg at 96px instead', async () => {
    const document = docOf('<img src="/icons/chef.svg" />')

    await inlineLocalImages(document)

    expect(compressSvg).toHaveBeenCalledWith(expect.stringContaining('icons/chef.svg'), 96, 96)
    expect(compressImage).not.toHaveBeenCalled()
  })

  it('strips a cache-busting query string before looking on disk', async () => {
    const document = docOf('<img src="/picture/soup.png?v=2" />')

    await inlineLocalImages(document)

    expect(compressImage).toHaveBeenCalledWith(expect.stringMatching(/soup\.png$/), 200, 200)
  })

  it('decodes a percent-escaped filename', async () => {
    const document = docOf('<img src="/picture/wonton%20soup.png" />')

    await inlineLocalImages(document)

    expect(compressImage).toHaveBeenCalledWith(expect.stringContaining('wonton soup.png'), 200, 200)
  })

  it('marks a missing file rather than failing the whole export', async () => {
    existsSync.mockReturnValue(false)
    const document = docOf('<img src="/picture/gone.png" />')

    await inlineLocalImages(document)

    expect(document.querySelector('img').getAttribute('data-missing')).toBe('true')
    expect(compressImage).not.toHaveBeenCalled()
  })

  it('leaves the src untouched when the compressor returns nothing', async () => {
    compressImage.mockResolvedValue(null)
    const document = docOf('<img src="/picture/soup.png" />')

    await inlineLocalImages(document)

    expect(document.querySelector('img').getAttribute('src')).toBe('/picture/soup.png')
  })

  it('skips an img with no src at all', async () => {
    const document = docOf('<img />')

    await inlineLocalImages(document)

    expect(compressImage).not.toHaveBeenCalled()
  })

  // This HTML arrives in the POST body, so the src is attacker-controlled and
  // path.join walks straight out of frontend/public on a '../'. Without the
  // containment check any image on the server could be embedded in the reply.
  it('refuses a src that climbs out of the asset root', async () => {
    const document = docOf('<img src="../../../../etc/hosts.png" />')

    await inlineLocalImages(document)

    expect(compressImage).not.toHaveBeenCalled()
    expect(existsSync).not.toHaveBeenCalled() // rejected before it ever touches disk
    expect(document.querySelector('img').getAttribute('data-missing')).toBe('true')
  })

  it('refuses a climb hidden in a percent escape', async () => {
    const document = docOf('<img src="%2e%2e/%2e%2e/secret.png" />')

    await inlineLocalImages(document)

    expect(compressImage).not.toHaveBeenCalled()
    expect(document.querySelector('img').getAttribute('data-missing')).toBe('true')
  })

  // decodeURIComponent throws URIError on a stray '%', and nothing up the stack
  // catches it, so one bad filename used to fail the entire export.
  it('drops one image with a malformed escape instead of failing the export', async () => {
    const document = docOf('<img src="/picture/100%.png" /><img src="/picture/soup.png" />')

    await expect(inlineLocalImages(document)).resolves.not.toThrow()

    const [bad, good] = document.querySelectorAll('img')
    expect(bad.getAttribute('data-missing')).toBe('true')
    expect(good.getAttribute('src')).toBe('data:image/png;base64,DISK') // the rest still inlined
  })
})
