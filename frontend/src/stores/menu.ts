import { defineStore } from 'pinia'
import type { MenuItem } from '@/types/types'

export const useMenuStore = defineStore('menu', {
  state: () => ({
    items: [] as MenuItem[],
  }),

  actions: {
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
