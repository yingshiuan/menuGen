import { defineStore } from 'pinia'
import type { MenuItem, MenuOption } from '@/types/types'

export const useMenuStore = defineStore('menu', {
  state: () => ({
    items: [] as MenuItem[],
  }),

  actions: {
    loadFromCSV(text: string) {
      const rows = text
        .split('\n')
        .map((r) => r.trim())
        .filter((r) => r.length > 0)
      if (!rows.length) return

      const [header, ...dataRows] = rows
      if (!header) return

      this.items = rows.slice(1).map((row) => {
        const columns = row.split(',')

        return {
          No: columns[0] ?? '',
          Name: columns[1] ?? '',
          Measure: columns[2] ?? '',
          ChineseName: columns[3] ?? '',
          Description: columns[4] ?? '',
          Price: columns[5] ?? '',
          Options: columns[6] ? (columns[6].split('|') as MenuOption[]) : [],
          Category: columns[7] ?? 'Uncategorized',
        }
      })
    },

    exportToCSV() {
      const header = [
        'No.',
        'Price',
        'Name',
        'Measure', 
        'Chinese Name',
        'Description',
        'Recommend',
        'Spicy',
        'Vegan',
        'Vegetarian',
        'Gluten Free',
      ].join('\t')

      const lines: string[] = []
      let currentCategory = ''

      this.items.forEach((item) => {
        // Insert category row if it's new
        if (item.Category && item.Category !== currentCategory) {
          currentCategory = item.Category
          lines.push(
            [
              '', // No.
              '', // Price
              currentCategory, // Name = category
              '', // Measure
              '', // Chinese Name
              '', // Description
              '',
              '',
              '',
              '',
              '', // Options columns
            ].join('\t'),
          )
        }

        const optionCols = [
          item.Options!.includes('Recommend') ? 'X' : '',
          item.Options!.includes('Spicy') ? 'X' : '',
          item.Options!.includes('Vegan') ? 'X' : '',
          item.Options!.includes('Vegetarian') ? 'X' : '',
          item.Options!.includes('Gluten Free') ? 'X' : '',
        ]

        lines.push(
          [
            item.No,
            item.Price,
            item.Name,
            item.ChineseName,
            item.Description ?? '',
            ...optionCols,
          ].join('\t'),
        )
      })

      return [header, ...lines].join('\n')
    },
  },
})
