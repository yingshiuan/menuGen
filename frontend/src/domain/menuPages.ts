import type { Lang, MenuItem } from '@/types/types'
import { categoryLabel } from '@/domain/menuItem'

export interface PageEntry {
  category: string
  item: MenuItem
}

// Group items by category, as named in the menu language
function groupItems(items: MenuItem[], lang: Lang): Record<string, MenuItem[]> {
  const grouped: Record<string, MenuItem[]> = {}
  items.forEach((item) => {
    const cat = categoryLabel(item, lang)
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  })
  return grouped
}

// Splits the menu into pages. The preview, the page counter and the PDF all use this,
// so they agree on how many pages there are.
export function paginateMenu(
  items: MenuItem[],
  itemsPerPage: number,
  keepCategoryTogether: boolean | undefined,
  lang: Lang,
): PageEntry[][] {
  const grouped = groupItems(items, lang)

  const result: PageEntry[][] = []
  let currentPage: PageEntry[] = []

  if (keepCategoryTogether) {
    for (const [category, items] of Object.entries(grouped)) {
      const categoryEntries = items.map((item) => ({ category, item }))
      const categoryLength = categoryEntries.length

      if (categoryLength > 11) {
        if (currentPage.length) {
          result.push(currentPage)
          currentPage = []
        }
        for (let i = 0; i < categoryLength; i += 11) {
          result.push(categoryEntries.slice(i, i + 11))
        }
        continue
      }

      if (currentPage.length > 0 && currentPage.length + categoryLength > 10) {
        result.push(currentPage)
        currentPage = []
      }

      currentPage.push(...categoryEntries)
      if (currentPage.length >= 10) {
        result.push(currentPage)
        currentPage = []
      }
    }
  } else {
    for (const [category, items] of Object.entries(grouped)) {
      items.forEach((item) => {
        if (currentPage.length >= itemsPerPage) {
          result.push(currentPage)
          currentPage = []
        }
        currentPage.push({ category, item })
      })
    }
  }

  if (currentPage.length > 0) result.push(currentPage)
  return result
}
