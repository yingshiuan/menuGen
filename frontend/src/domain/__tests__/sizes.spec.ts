import { describe, expect, it } from 'vitest'
import { clampSize, pagePhotoSize, uniformPhotoSize } from '@/domain/sizes'

// Measured on an A4 page with "Fill page": 1026px for headers + dishes,
// 33px per category header, 8px margin per dish
const room = { areaHeight: 1026, headerHeight: 33, dishMargin: 8 }

describe('pagePhotoSize', () => {
  it('matches the photo size measured on a page', () => {
    // DUCK + BEEF: 6 dishes, 2 headers → measured 152px
    expect(pagePhotoSize(room, { dishes: 6, headers: 2 })).toBe(152)
    // CHICKEN: 8 dishes, 1 header → measured 116px
    expect(pagePhotoSize(room, { dishes: 8, headers: 1 })).toBe(116)
  })
})

describe('uniformPhotoSize', () => {
  it('uses the size the fullest page can fit, so every page shows the same size', () => {
    // The 2026 afatt menu's 14 pages; Classic Starters fills one page with 11 dishes
    const pages = [
      [9, 2],
      [11, 1],
      [1, 1],
      [9, 1],
      [8, 1],
      [6, 2],
      [9, 1],
      [8, 1],
      [8, 1],
      [9, 2],
      [9, 1],
      [7, 2],
      [8, 1],
      [10, 2],
    ].map(([dishes, headers]) => ({ dishes: dishes!, headers: headers! }))

    // (1026 - 33) / 11 - 8 = 82.3
    expect(uniformPhotoSize(room, pages)).toBe(82)
  })

  it('gives 0 for an empty menu', () => {
    expect(uniformPhotoSize(room, [])).toBe(0)
    expect(uniformPhotoSize(room, [{ dishes: 0, headers: 0 }])).toBe(0)
  })
})

const range = { min: 80, max: 160 }

describe('clampSize', () => {
  it('keeps a size inside the range', () => {
    expect(clampSize(116, range, 80)).toBe(116)
  })

  it('moves a size outside the range to the nearest limit', () => {
    expect(clampSize(200, range, 80)).toBe(160)
    expect(clampSize(20, range, 80)).toBe(80)
  })

  it('uses the fallback for a cleared box or anything that is not a number', () => {
    expect(clampSize('', range, 100)).toBe(100)
    expect(clampSize(Number.NaN, range, 100)).toBe(100)
    expect(clampSize(undefined, range, 100)).toBe(100)
  })
})
