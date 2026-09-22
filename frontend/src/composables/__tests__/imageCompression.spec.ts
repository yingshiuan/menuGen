import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compressImage } from '@/composables/imageCompression'

/**
 * The point of this helper is that an upload leaves the browser small: the menu
 * HTML carries it as base64 to the PDF service, where an uncompressed phone
 * photo used to be enough to exhaust the heap. These tests pin the downscaling
 * rather than just the happy path.
 *
 * jsdom has no canvas and never fires Image.onload, so both are stubbed.
 */
let sourceWidth = 2400
let sourceHeight = 1600
let canvasSize: { width: number; height: number } | null = null
// The alpha every pixel of the drawn picture has: 255 is opaque
let pictureAlpha = 255
// Safari can't encode WebP: asked for one, it returns a PNG
let canMakeWebp = true
const getImageData = vi.fn((_x: number, _y: number, width: number, height: number) => {
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  data[data.length - 1] = pictureAlpha // the last pixel carries it
  return { data }
})

class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  width = 0
  height = 0
  set src(value: string) {
    this.width = sourceWidth
    this.height = sourceHeight
    queueMicrotask(() => (value.includes(btoa('corrupt')) ? this.onerror?.() : this.onload?.()))
  }
}

beforeEach(() => {
  canvasSize = null
  pictureAlpha = 255
  canMakeWebp = true
  getImageData.mockClear()
  sourceWidth = 2400
  sourceHeight = 1600
  vi.stubGlobal('Image', MockImage)
  // getContext runs after the dimensions are assigned, so it can capture them
  HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement) {
    canvasSize = { width: this.width, height: this.height }
    return { drawImage: vi.fn(), getImageData }
  }) as never
  HTMLCanvasElement.prototype.toDataURL = vi.fn((type?: string) => {
    if (type === 'image/jpeg') return 'data:image/jpeg;base64,AAA'
    if (type === 'image/webp' && canMakeWebp) return 'data:image/webp;base64,WWW'
    return 'data:image/png;base64,PPP'
  })
})

const file = (bytes = 'bytes', type = 'image/png') => new File([bytes], 'dish.png', { type })

describe('compressImage', () => {
  it('caps the long edge and keeps the aspect ratio', async () => {
    await compressImage(file(), 600, 600, 0.8)

    // 2400x1600 scaled to a 600 wide box is 600x400, not 600x600
    expect(canvasSize).toEqual({ width: 600, height: 400 })
  })

  // Every other case passes the bounds explicitly, so the defaults were the one
  // path nothing covered -- which is how they sat at 200x200 while the batch
  // upload called this with no arguments at all.
  it('applies the shared defaults when called with no bounds', async () => {
    await compressImage(file())

    expect(canvasSize).toEqual({ width: 600, height: 400 })
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8)
  })

  it('caps by height when the image is portrait', async () => {
    sourceWidth = 1200
    sourceHeight = 3000

    await compressImage(file(), 600, 600, 0.8)

    expect(canvasSize).toEqual({ width: 240, height: 600 })
  })

  it('leaves an image already inside the bounds alone', async () => {
    sourceWidth = 320
    sourceHeight = 240

    await compressImage(file(), 600, 600, 0.8)

    expect(canvasSize).toEqual({ width: 320, height: 240 })
  })

  it('re-encodes as jpeg at the requested quality', async () => {
    const result = await compressImage(file(), 600, 600, 0.8)

    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8)
    expect(result).toBe('data:image/jpeg;base64,AAA')
  })

  it('keeps a transparent picture transparent, as a WebP, so its background does not turn black', async () => {
    pictureAlpha = 0

    const result = await compressImage(file(), 600, 600, 0.8)

    expect(result).toBe('data:image/webp;base64,WWW')
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/webp', 0.8)
    expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalledWith('image/jpeg', 0.8)
    expect(canvasSize).toEqual({ width: 600, height: 400 })
  })

  it('counts a partly see-through edge as transparency', async () => {
    pictureAlpha = 254

    const result = await compressImage(file(), 600, 600, 0.8)

    expect(result).toBe('data:image/webp;base64,WWW')
  })

  it('falls back to a PNG no larger than the PDF uses where the browser cannot make WebP', async () => {
    pictureAlpha = 0
    canMakeWebp = false

    const result = await compressImage(file(), 600, 600, 0.8)

    expect(result).toBe('data:image/png;base64,PPP')
    // Redrawn at the PDF's 300px, not the 600px upload size: a quarter of the PNG
    expect(canvasSize).toEqual({ width: 300, height: 200 })
  })

  it('checks the whole resized picture', async () => {
    await compressImage(file(), 600, 600, 0.8)

    expect(getImageData).toHaveBeenCalledWith(0, 0, 600, 400)
  })

  it('does not look for transparency in a JPEG, which cannot have any', async () => {
    await compressImage(file('bytes', 'image/jpeg'), 600, 600, 0.8)

    expect(getImageData).not.toHaveBeenCalled()
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8)
  })

  it('rejects, rather than never answering, when the picture cannot be drawn', async () => {
    getImageData.mockImplementationOnce(() => {
      throw new Error('canvas unavailable')
    })

    await expect(compressImage(file())).rejects.toThrow('canvas unavailable')
  })

  it('rejects when the file cannot be decoded', async () => {
    await expect(compressImage(file('corrupt'))).rejects.toThrow('Could not decode dish.png')
  })
})
