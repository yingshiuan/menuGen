export interface SizeRange {
  min: number
  max: number
}

// Measured on a menu page, in px
export interface PageRoom {
  areaHeight: number // what headers + dishes share (between logo and footer)
  headerHeight: number // one category header, margin included
  dishMargin: number // vertical margin around each dish, outside its photo
}

export interface PageCount {
  dishes: number
  headers: number
}

// Photo size (px) that fills the dish boxes on one page
export function pagePhotoSize(room: PageRoom, page: PageCount): number {
  const box = (room.areaHeight - page.headers * room.headerHeight) / page.dishes
  return Math.floor(box - room.dishMargin)
}

// Largest photo size every page can show, so all pages use the same size:
// the fullest page (most dishes and headers for its room) decides. 0 for an empty menu.
export function uniformPhotoSize(room: PageRoom, pages: PageCount[]): number {
  const sizes = pages.filter((p) => p.dishes > 0).map((p) => pagePhotoSize(room, p))
  return sizes.length ? Math.min(...sizes) : 0
}

// For a size typed into a number box: out of range → the nearest limit; cleared or not a
// number → the fallback. (v-model.number leaves a cleared field as '' rather than a number.)
export function clampSize(value: unknown, range: SizeRange, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(range.max, Math.max(range.min, value))
    : fallback
}
