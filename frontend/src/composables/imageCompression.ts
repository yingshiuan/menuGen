// Comfortably above the 300px the PDF service resizes to, so the exported menu
// looks the same while a phone photo stops arriving as several megabytes of
// base64. That payload is parsed twice server side and was large enough on its
// own to exhaust the heap of a 512MB instance.
//
// They also have to stay above that 300px target: sharp is called with
// withoutEnlargement, so an image arriving at or below it is never resized and
// the second encode costs quality for nothing.
export const MAX_EDGE = 600
export const JPEG_QUALITY = 0.8

/**
 * Downscale an image file and return it as a JPEG data URI.
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

    img.onload = () => {
      let { width, height } = img

      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height
        height = maxHeight
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      const base64 = canvas.toDataURL('image/jpeg', quality)
      resolve(base64)
    }

    img.onerror = () => reject(new Error(`Could not decode ${file.name}`))

    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })
}
