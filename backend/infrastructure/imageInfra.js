import fs from 'fs'
import sharp from 'sharp'

export async function compressImage(filePath, width = 200, height = 200) {
  if (!fs.existsSync(filePath)) return null
  const buffer = fs.readFileSync(filePath)
  const optimizedBuffer = await sharp(buffer)
    .resize(width, height, { fit: 'inside' })
    .png({ quality: 100 })
    .toBuffer()
  return `data:image/png;base64,${optimizedBuffer.toString('base64')}`
}

export async function compressSvg(filePath, width = 96, height = 96) {
  if (!fs.existsSync(filePath)) return null
  const buffer = fs.readFileSync(filePath)
  const optimizedBuffer = await sharp(buffer)
    .resize(width, height, { fit: 'contain' })
    .png({ quality: 100 })
    .toBuffer()
  return `data:image/png;base64,${optimizedBuffer.toString('base64')}`
}

// No photo is drawn large enough to need more than this, however it is marked:
// the widest is a logo printed about 3in across. Guards the decode in Chromium
// against a size taken from the request.
export const MAX_IMAGE_EDGE = 1000

/**
 * The size to draw a `width` x `height` image so its short side covers a
 * `boxWidth` x `boxHeight` box, as `object-cover` fills it. Never enlarged,
 * and never past MAX_IMAGE_EDGE on the long side.
 */
export function coverSize(width, height, boxWidth, boxHeight) {
  const scale = Math.min(
    1,
    Math.max(boxWidth / width, boxHeight / height),
    MAX_IMAGE_EDGE / Math.max(width, height),
  )
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Shrink a base64 photo to cover a `width` x `height` box: the pixels it needs
 * where it prints. Returned as it came when sharp cannot read it.
 */
export async function compressBase64Image(base64, width = 300, height = 300) {
  try {
    const isPng = base64.startsWith('data:image/png')
    // The browser sends a picture with transparency (a cut-out dish) as WebP: as a
    // JPEG its see-through part would print black
    const isWebp = base64.startsWith('data:image/webp')
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    const image = sharp(buffer)
    const meta = await image.metadata()
    const size = coverSize(meta.width, meta.height, width, height)
    const resized = image.resize(size.width, size.height)

    if (isPng) {
      const optimized = await resized.png({ quality: 82, compressionLevel: 8 }).toBuffer()
      return `data:image/png;base64,${optimized.toString('base64')}`
    } else if (isWebp) {
      const optimized = await resized.webp({ quality: 82 }).toBuffer()
      return `data:image/webp;base64,${optimized.toString('base64')}`
    } else {
      // JPG
      const optimized = await resized.jpeg({ quality: 82 }).toBuffer()
      return `data:image/jpeg;base64,${optimized.toString('base64')}`
    }
  } catch {
    return base64
  }
}
