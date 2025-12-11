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

      const header = rows[0].split(',') 

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
      const header = 'No,Name,ChineseName,Description,Price,Options,Category'

      const lines = this.items.map(item =>
        [
          item.No,
          item.Name,
          item.ChineseName,
          item.Description ?? '',
          item.Price,
          item.Options?.join('|') ?? '',
          item.Category
        ].join(',')
      )

      return [header, ...lines].join('\n')
    }
  }
})
