
export function useImageCropper() {
  const cropImage = (
    imageSrc: string,
    container: HTMLElement,
    image: HTMLImageElement,
    cropFrame: { x: number; y: number; width: number; height: number }
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

    canvas.width = cropFrame.width
    canvas.height = cropFrame.height

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    )

    return canvas.toDataURL()
  }

  return { cropImage }
}