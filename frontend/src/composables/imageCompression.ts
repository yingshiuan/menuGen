import { PHOTO_SIZE_RANGE } from './useMenuPhoto'
import { PHOTO_ZOOM, printPx } from './printResolution'

// Above the 550px a dish photo needs to print at 300ppi at its largest
// (printResolution.ts), while a phone photo stops arriving as several megabytes
// of base64. That payload is parsed twice server side and was large enough on
// its own to exhaust the heap of a 512MB instance. 800px would keep a landscape
// photo's short side at 550 too, but cost ~60MB more on the 76 real afatt photos
// (512MB instead of ~420MB), so a landscape photo at the largest size prints a
// little under 300ppi instead.
//
// The PDF service then shrinks each photo to the size it actually prints at;
// it never enlarges, so this cap has to stay above that.
export const MAX_EDGE = 600
export const JPEG_QUALITY = 0.8

// The largest a dish photo prints: 160px drawn, at 300ppi
const PNG_FALLBACK_EDGE = printPx(PHOTO_SIZE_RANGE.max * PHOTO_ZOOM)

// JPEG has no transparency: a see-through pixel encodes as black, so a cut-out
// dish on a transparent PNG came back on a black square. True when any pixel of
// the drawn picture is even partly see-through.
function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height)
  for (let alpha = 3; alpha < data.length; alpha += 4) {
    if (data[alpha]! < 255) return true
  }
  return false
}

// The picture's size scaled down, never up, to fit the box
function fit(img: HTMLImageElement, maxWidth: number, maxHeight: number) {
  let { width, height } = img

  if (width > maxWidth) {
    height = (height * maxWidth) / width
    width = maxWidth
  }
  if (height > maxHeight) {
    width = (width * maxHeight) / height
    height = maxHeight
  }
  return { width, height }
}

function draw(
  img: HTMLImageElement,
  { width, height }: { width: number; height: number },
  name: string,
) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(`Could not draw ${name}`)
  ctx.drawImage(img, 0, 0, width, height)
  return { canvas, ctx }
}

/**
 * A drawn canvas as a data URI: JPEG, or WebP when it has transparency to keep.
 * Where the browser can't make WebP (Safari) it calls `pngFallback` for a PNG.
 */
export function encodeCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  quality: number,
  opaque: boolean,
  pngFallback: () => string = () => canvas.toDataURL('image/png'),
): string {
  // A JPEG file never has transparency, so it skips reading every pixel
  if (opaque || !hasTransparency(ctx, canvas.width, canvas.height)) {
    return canvas.toDataURL('image/jpeg', quality)
  }

  // WebP keeps the transparency at about a JPEG's size: a cut-out dish photo came
  // to 41KB, against 445KB as a PNG
  const webp = canvas.toDataURL('image/webp', quality)
  if (webp.startsWith('data:image/webp')) return webp

  return pngFallback()
}

// The decoded picture, scaled into the box and encoded
function encode(
  img: HTMLImageElement,
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number,
): string {
  const { canvas, ctx } = draw(img, fit(img, maxWidth, maxHeight), file.name)

  // A PNG is about four times a JPEG, so where it is the only way to keep the
  // transparency it is drawn only as large as a dish photo ever prints
  return encodeCanvas(canvas, ctx, quality, file.type === 'image/jpeg', () => {
    const pdfSize = fit(
      img,
      Math.min(maxWidth, PNG_FALLBACK_EDGE),
      Math.min(maxHeight, PNG_FALLBACK_EDGE),
    )
    return draw(img, pdfSize, file.name).canvas.toDataURL('image/png')
  })
}

/**
 * Downscale an image file and return it as a data URI: a JPEG, or a WebP when the
 * picture has transparency to keep (a PNG where the browser can't make WebP).
 *
 * Uploads are embedded straight into the menu HTML and posted to the PDF
 * service, so an untouched phone photo costs several megabytes of base64 on
 * every export. Shrinking before the encode keeps the payload small at the one
 * point where it is cheap to do.
 *
 * Shared by the single and batch upload paths so they cannot drift apart.
 */
export function compressImage(
  file: File,
  maxWidth = MAX_EDGE,
  maxHeight = MAX_EDGE,
  quality = JPEG_QUALITY,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = () => {
      img.src = reader.result as string
    }

    // A throw in here would leave the promise pending, and the upload spinning, for good
    img.onload = () => {
      try {
        resolve(encode(img, file, maxWidth, maxHeight, quality))
      } catch (err) {
        reject(err)
      }
    }

    img.onerror = () => reject(new Error(`Could not decode ${file.name}`))

    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })
}
