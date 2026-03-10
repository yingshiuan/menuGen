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

export async function compressBase64Image(base64, width = 300, height = 300) {
  try {
    const isPng = base64.startsWith('data:image/png')
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    if (isPng) {
      // PNG 
      const optimized = await sharp(buffer)
        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
        .png({ quality: 70, compressionLevel: 8 })
        .toBuffer()
      return `data:image/png;base64,${optimized.toString('base64')}`
    } else {
      // JPG
      const optimized = await sharp(buffer)
        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer()
      return `data:image/jpeg;base64,${optimized.toString('base64')}`
    }
  } catch {
    return base64
  }
}
