import { describe, expect, it } from 'vitest'
import { paginateMenu } from '@/domain/menuPages'
import { parseCsvText } from './parseCsvText'

/**
 * A menu CSV in the upload format: each category starts with a title row
 * (a name, no No./Price), followed by its dishes. Names are given in English and German.
 */
function menuCsv(dishesPerCategory: number[]): string {
  let no = 0
  const lines = ['No.,Price,Name (EN),Name (DE)']
  dishesPerCategory.forEach((dishes, i) => {
    lines.push(`,,Category ${i + 1},Kategorie ${i + 1}`)
    for (let d = 0; d < dishes; d++) {
      no++
      lines.push(`${no},10,Dish ${no},Gericht ${no}`)
    }
  })
  return lines.join('\n')
}

function paginateCsv(csv: string, itemsPerPage = 9, keepCategoryTogether = true) {
  const { items } = parseCsvText(csv)
  const pages = paginateMenu(items, itemsPerPage, keepCategoryTogether, 'en')
  // category titles in the order the CSV lists them, as read by the parser
  const titles = [...new Set(items.map((i) => i.category.en))]
  return { items, pages, titles }
}

const categoriesOf = (pages: ReturnType<typeof paginateMenu>) =>
  pages.map((page) => [...new Set(page.map((e) => e.category))])

describe('paginateMenu with categories kept together', () => {
  it('gives every title row in the CSV its own category header', () => {
    const { pages, titles } = paginateCsv(menuCsv([2, 3, 1]))

    expect(titles).toEqual(['Category 1', 'Category 2', 'Category 3'])
    expect(categoriesOf(pages)).toEqual([titles])
  })

  it('starts a new page when the next category would not fit', () => {
    const { pages } = paginateCsv(menuCsv([6, 3, 8]))

    expect(categoriesOf(pages)).toEqual([['Category 1', 'Category 2'], ['Category 3']])
  })

  it('ignores Items Per Page, so a category larger than it stays on one page', () => {
    const { pages } = paginateCsv(menuCsv([10]), 9)

    expect(pages.map((p) => p.length)).toEqual([10])
  })

  it('splits a category of more than 11 dishes across pages of 11', () => {
    const { pages } = paginateCsv(menuCsv([12]))

    expect(pages.map((p) => p.length)).toEqual([11, 1])
  })

  it('can need more pages than dishes ÷ items per page, and keeps every dish', () => {
    // Three categories of 6: none fit together, so each takes its own page
    const { items, pages, titles } = paginateCsv(menuCsv([6, 6, 6]), 9)

    expect(Math.ceil(items.length / 9)).toBe(2)
    expect(pages).toHaveLength(3)
    expect(pages.flat()).toHaveLength(items.length)
    expect(categoriesOf(pages).pop()).toEqual([titles.pop()])
  })
})

describe('paginateMenu without keeping categories together', () => {
  it('fills every page up to the items-per-page limit', () => {
    const { pages } = paginateCsv(menuCsv([6, 8]), 9, false)

    expect(pages.map((p) => p.length)).toEqual([9, 5])
  })
})

describe('paginateMenu categories', () => {
  it('labels categories in the menu language, from that language column of the title row', () => {
    const { items } = parseCsvText(menuCsv([1, 1]))

    expect(categoriesOf(paginateMenu(items, 9, true, 'en'))).toEqual([['Category 1', 'Category 2']])
    expect(categoriesOf(paginateMenu(items, 9, true, 'de'))).toEqual([
      ['Kategorie 1', 'Kategorie 2'],
    ])
  })
})
