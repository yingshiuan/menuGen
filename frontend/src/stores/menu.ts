import { defineStore } from 'pinia'
import type { MenuItem } from '@/types/types'
import { exportMenuCsv } from '@/domain/menuCsv'

export const useMenuStore = defineStore('menu', {
  state: () => ({
    items: [] as MenuItem[],
  }),

  actions: {
    exportToCSV(items: MenuItem[], customTags: string[] = []) {
      return exportMenuCsv(items, customTags)
    },
  },
})
