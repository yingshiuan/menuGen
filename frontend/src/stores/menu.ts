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

        // generate a simple unique id for each row to satisfy MenuItem.id
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

        return {
          id,
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

    exportToCSV(items: MenuItem[], allOptions: string[], renamedLabels?: Record<string, string>) {
      const getLabel = (key: string) => renamedLabels?.[key] ?? key
      const header = [
        'No.',
        'Price',
        'Name',
        'Measure',
        'Chinese Name',
        'Description',
        ...allOptions.map(getLabel),
      ].join('\t')

      const lines: string[] = []
      let currentCategory = ''

      items.forEach((item) => {
        if (item.Category && item.Category !== currentCategory) {
          currentCategory = item.Category
          const emptyCols = new Array(6 + allOptions.length).fill('')
          emptyCols[2] = currentCategory
          lines.push(emptyCols.join('\t'))
        }

        const optionCols = allOptions.map((opt) => (item.Options?.includes(opt) ? 'X' : ''))

        lines.push(
          [
            item.No,
            item.Price,
            item.Name,
            item.Measure,
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
