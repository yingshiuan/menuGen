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
