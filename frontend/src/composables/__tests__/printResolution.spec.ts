import { describe, expect, it } from 'vitest'
import { markPrintSizes, printPx } from '../printResolution'

/** An <img> laid out at the given size; jsdom does no layout of its own. */
function laidOut(width: number, height: number): HTMLImageElement {
  const img = document.createElement('img')
  Object.defineProperty(img, 'offsetWidth', { value: width })
  Object.defineProperty(img, 'offsetHeight', { value: height })
  return img
}

describe('printPx', () => {
  it('is the pixels for 300ppi at 96 CSS px an inch', () => {
    expect(printPx(96)).toBe(300)
    expect(printPx(240)).toBe(750)
  })
})

describe('markPrintSizes', () => {
  it('marks every laid-out image with its print size, allowing for the photo zoom', () => {
    const root = document.createElement('div')
    const dish = laidOut(80, 80)
    const logo = laidOut(300, 32)
    root.append(dish, logo)

    markPrintSizes(root)

    expect(dish.getAttribute('data-print-px')).toBe('275x275')
    expect(logo.getAttribute('data-print-px')).toBe('1032x110')
  })

  it('leaves an image that is not laid out unmarked, for the service default', () => {
    const root = document.createElement('div')
    const hidden = laidOut(0, 0)
    root.append(hidden)

    markPrintSizes(root)

    expect(hidden.hasAttribute('data-print-px')).toBe(false)
  })

  // The PDF copy of the menu is kept in a display:none box, where nothing has a
  // size: what the live site sent before this, so every photo got the default
  it('lays out a hidden menu for the measurement and hides it again', () => {
    const hiddenBox = document.createElement('div')
    hiddenBox.setAttribute('style', 'display: none')
    const root = document.createElement('div')
    const img = document.createElement('img')
    // sized only while the box around it is shown, as a browser would
    Object.defineProperty(img, 'offsetWidth', {
      get: () => (getComputedStyle(hiddenBox).display === 'none' ? 0 : 80),
    })
    Object.defineProperty(img, 'offsetHeight', {
      get: () => (getComputedStyle(hiddenBox).display === 'none' ? 0 : 80),
    })
    root.append(img)
    hiddenBox.append(root)
    document.body.append(hiddenBox)

    markPrintSizes(root)

    expect(img.getAttribute('data-print-px')).toBe('275x275')
    expect(hiddenBox.getAttribute('style')).toBe('display: none')
    expect(root.hasAttribute('style')).toBe(false)
    hiddenBox.remove()
  })
})
