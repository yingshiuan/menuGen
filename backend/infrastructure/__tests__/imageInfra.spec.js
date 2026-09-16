import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { compressBase64Image, compressImage, compressSvg } from '../imageInfra.js'

/**
 * sharp runs for real here -- it is the thing under test, and stubbing it would
 * leave the format and resize branches unverified. Only fs is faked, so the two
 * path-based functions need no fixture files on disk.
 *
 * The behaviour that matters most is the swallow in compressBase64Image: it
 * returns its input unchanged on any failure, so a photo that will not decode
 * flows on at full size and defeats the memory protection the whole pipeline
 * exists to provide.
 *
 * Unlike the frontend specs this file uses vi.mock: the backend has no dependency
 * injection and only static ESM imports, so the module path is the only seam.
 */
const existsSync = vi.hoisted(() => vi.fn())
const readFileSync = vi.hoisted(() => vi.fn())

vi.mock('fs', () => ({
  default: { existsSync, readFileSync },
  existsSync,
  readFileSync,
}))

/** A real, decodable image of the given size, as raw bytes. */
function pixels(width, height, format = 'png') {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } },
  })
    [format]()
    .toBuffer()
}

/** Turn raw bytes into the data URI shape the exporter actually passes around. */
function dataUri(buffer, mime) {
  return `data:${mime};base64,${buffer.toString('base64')}`
}

/** Read a data URI back through sharp so its real dimensions can be asserted. */
function metadataOf(uri) {
  return sharp(Buffer.from(uri.split(',')[1], 'base64')).metadata()
}

beforeEach(() => {
  existsSync.mockReset().mockReturnValue(true)
  readFileSync.mockReset()
})

describe('compressBase64Image', () => {
  it('shrinks an oversized photo to fit 300px and keeps it a PNG', async () => {
    const uri = dataUri(await pixels(1200, 800), 'image/png')

    const result = await compressBase64Image(uri)

    expect(result.startsWith('data:image/png;base64,')).toBe(true)
    const { width, height } = await metadataOf(result)
    expect({ width, height }).toEqual({ width: 300, height: 200 }) // aspect kept
  })

  it('never enlarges an image that is already smaller than the box', async () => {
    const uri = dataUri(await pixels(40, 30), 'image/png')

    const result = await compressBase64Image(uri)

    // withoutEnlargement: a 200px upload cannot be rescued back up to 300px,
    // which is why the browser-side cap has to sit above this number
    const { width, height } = await metadataOf(result)
    expect({ width, height }).toEqual({ width: 40, height: 30 })
  })

  it('re-encodes anything that is not a PNG as JPEG, losing transparency', async () => {
    const uri = dataUri(await pixels(400, 400, 'jpeg'), 'image/jpeg')

    const result = await compressBase64Image(uri)

    expect(result.startsWith('data:image/jpeg;base64,')).toBe(true)
  })

  it('picks the branch from the prefix, not from the bytes', async () => {
    // a JPEG payload announced as PNG still takes the PNG branch
    const uri = dataUri(await pixels(400, 400, 'jpeg'), 'image/png')

    const result = await compressBase64Image(uri)

    expect(result.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('honours a caller-supplied box', async () => {
    const uri = dataUri(await pixels(1200, 1200), 'image/png')

    const result = await compressBase64Image(uri, 64, 64)

    const { width } = await metadataOf(result)
    expect(width).toBe(64)
  })

  // The swallow is deliberate -- one unreadable photo should not fail a menu --
  // but the cost is that it flows on at its original size, so the heap protection
  // silently does not apply to it.
  it('hands back the original untouched when the bytes will not decode', async () => {
    const broken = 'data:image/png;base64,bm90YW5pbWFnZQ=='

    const result = await compressBase64Image(broken)

    expect(result).toBe(broken)
  })
})

describe('compressImage', () => {
  it('reads a file from disk and returns it as a 200px PNG data URI', async () => {
    readFileSync.mockReturnValue(await pixels(800, 600))

    const result = await compressImage('/assets/soup.png')

    expect(result.startsWith('data:image/png;base64,')).toBe(true)
    const { width, height } = await metadataOf(result)
    expect({ width, height }).toEqual({ width: 200, height: 150 })
  })

  it('returns null instead of throwing when the file is not there', async () => {
    existsSync.mockReturnValue(false)

    expect(await compressImage('/assets/gone.png')).toBeNull()
    expect(readFileSync).not.toHaveBeenCalled()
  })
})

describe('compressSvg', () => {
  it('rasterises to a 96px PNG so the PDF does not depend on SVG support', async () => {
    readFileSync.mockReturnValue(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"></svg>'),
    )

    const result = await compressSvg('/assets/chef.svg')

    expect(result.startsWith('data:image/png;base64,')).toBe(true)
    const { width } = await metadataOf(result)
    expect(width).toBe(96)
  })

  it('returns null for a missing file', async () => {
    existsSync.mockReturnValue(false)

    expect(await compressSvg('/assets/gone.svg')).toBeNull()
  })
})
