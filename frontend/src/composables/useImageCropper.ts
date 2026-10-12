import { encodeCanvas, JPEG_QUALITY } from './imageCompression'

export function useImageCropper() {
  /**
   * The framed part of the picture, from the original's own pixels: as many as
   * the frame covers, down to `maxEdge` on the long side. Sizing the canvas to
   * the frame on screen instead threw a phone photo away to 240px, a third of
   * what a cover needs to print sharp.
   */
  const cropImage = (
    imageSrc: string,
    container: HTMLElement,
    image: HTMLImageElement,
    cropFrame: { x: number; y: number; width: number; height: number },
    maxEdge: number,
  ): string | null => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const naturalWidth = image.naturalWidth
    const naturalHeight = image.naturalHeight

    const imageRatio = naturalWidth / naturalHeight
    const containerRatio = containerWidth / containerHeight

    let displayWidth = 0
    let displayHeight = 0

    if (imageRatio > containerRatio) {
      displayWidth = containerWidth
      displayHeight = containerWidth / imageRatio
    } else {
      displayHeight = containerHeight
      displayWidth = containerHeight * imageRatio
    }

    const offsetX = (containerWidth - displayWidth) / 2
    const offsetY = (containerHeight - displayHeight) / 2
    const scaleX = naturalWidth / displayWidth
    const scaleY = naturalHeight / displayHeight

    const cropX = (cropFrame.x - offsetX) * scaleX
    const cropY = (cropFrame.y - offsetY) * scaleY
    const cropWidth = cropFrame.width * scaleX
    const cropHeight = cropFrame.height * scaleY

    // Never enlarged: past the original's pixels there is no detail to add
    const scale = Math.min(1, maxEdge / Math.max(cropWidth, cropHeight))
    canvas.width = Math.max(1, Math.round(cropWidth * scale))
    canvas.height = Math.max(1, Math.round(cropHeight * scale))

    ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height)

    // A JPEG or WebP rather than a PNG, a quarter the size for a photo
    return encodeCanvas(canvas, ctx, JPEG_QUALITY, false)
  }

  return { cropImage }
}
