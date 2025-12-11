import { defineStore } from 'pinia'
import type { MenuItem, MenuOption } from '@/types/types'

export const useMenuStore = defineStore('menu', {
  state: () => ({
    items: [] as MenuItem[]
  }),

  actions: {
    loadFromCSV(text: string) {
      const rows = text.split('\n').map(r => r.trim()).filter(r => r.length > 0)
      if (!rows.length) return

      const [header, ...dataRows] = rows
      if (!header) return

      this.items = rows.slice(1).map(row => {
        const columns = row.split(',')

        return {
          No: columns[0] ?? '',
          Name: columns[1] ?? '',
          ChineseName: columns[2] ?? '',
          Description: columns[3] ?? '',
          Price: columns[4] ?? '',
          Options: columns[5] ? (columns[5].split('|') as MenuOption[]) : [],
          Category: columns[6] ?? 'Uncategorized'
        }
      })
    },

    exportToCSV() {
  const header = [
    'No.',
    'Price',
    'Name',
    'Chinese Name',
    'Description',
    'Recommend',
    'Spicy',
    'Vegan',
    'Vegetarian',
    'GlutenFree'
  ].join('\t')

  const lines: string[] = []
  let currentCategory = ''

  this.items.forEach(item => {
    // Insert category row if it's new
    if (item.Category && item.Category !== currentCategory) {
      currentCategory = item.Category
      lines.push([
        '', // No.
        '', // Price
        currentCategory, // Name = category
        '', // Chinese Name
        '', // Description
        '', '', '', '', '' // Options columns
      ].join('\t'))
    }

    const optionCols = [
      item.Options!.includes('Recommend') ? 'X' : '',
      item.Options!.includes('Spicy') ? 'X' : '',
      item.Options!.includes('Vegan') ? 'X' : '',
      item.Options!.includes('Vegetarian') ? 'X' : '',
      item.Options!.includes('GlutenFree') ? 'X' : ''
    ]

    lines.push([
      item.No,
      item.Price,
      item.Name,
      item.ChineseName,
      item.Description ?? '',
      ...optionCols
    ].join('\t'))
  })

  return [header, ...lines].join('\n')
}

  }
})
