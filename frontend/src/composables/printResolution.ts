// A printed photo looks sharp at 300 pixels per inch, and the PDF lays the page
// out at CSS's 96px per inch. So a photo drawn 80px wide needs 250 pixels, and
// one drawn 240px wide needs 750.
export const PRINT_PPI = 300
const CSS_PX_PER_INCH = 96

// Dish photos are drawn `scale-110` inside their circle (MenuItem.vue), so they
// print a tenth larger than the box they are laid out in
export const PHOTO_ZOOM = 1.1

/** Pixels an image drawn `cssPx` wide needs to print at PRINT_PPI. */
export function printPx(cssPx: number): number {
  return Math.ceil((cssPx * PRINT_PPI) / CSS_PX_PER_INCH)
}

/**
 * Write on every image in `root` the pixels it needs to print sharp, as
 * `data-print-px="WxH"`. The PDF service resizes each photo to exactly that,
 * instead of one size for all: a small dish photo stays small and cheap, and
 * a cover printed 2.5in wide gets the 750px it needs.
 *
 * offsetWidth is the laid-out size, so the preview's on-screen zoom (a CSS
 * transform) does not change it. An image that is not laid out (hidden) is
 * left unmarked and the service falls back to its default.
 */
export function markPrintSizes(root: HTMLElement): void {
  for (const img of root.querySelectorAll('img')) {
    const { offsetWidth, offsetHeight } = img
    if (!offsetWidth || !offsetHeight) continue

    const w = printPx(offsetWidth * PHOTO_ZOOM)
    const h = printPx(offsetHeight * PHOTO_ZOOM)
    img.setAttribute('data-print-px', `${w}x${h}`)
  }
}
