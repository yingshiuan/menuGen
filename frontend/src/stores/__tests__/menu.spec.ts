import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMenuStore } from '@/stores/menu'
import type { MenuItem } from '@/types/types'

// Pinia needs an active instance before any store is used outside a component
beforeEach(() => {
  setActivePinia(createPinia())
})

describe('exportToCSV', () => {
  const items: MenuItem[] = [
    {
      id: 'a',
      No: '1',
      Price: '12.50',
      Name: 'Kung Pao Chicken',
      Measure: 'plate',
      ChineseName: '宫保鸡丁',
      Description: 'With peanuts',
      Options: ['Spicy'],
      Category: 'Mains',
    },
    {
      id: 'b',
      No: '2',
      Price: '3.00',
      Name: 'Steamed Rice',
      Measure: 'bowl',
      ChineseName: '米饭',
      Options: [],
      Category: 'Sides',
    },
  ]

  it('emits a tab-separated header, category rows and an X per active option', () => {
    const store = useMenuStore()
    const lines = store.exportToCSV(items, ['Spicy', 'Vegan']).split('\n')

    expect(lines[0]).toBe('No.\tPrice\tName\tMeasure\tChinese Name\tDescription\tSpicy\tVegan')
    // category separator row: category name sits in the Name column
    expect(lines[1]!.split('\t')[2]).toBe('Mains')
    expect(lines[2]!.split('\t').slice(-2)).toEqual(['X', ''])
    expect(lines[3]!.split('\t')[2]).toBe('Sides')
  })

  it('applies renamed option labels to the header only', () => {
    const store = useMenuStore()
    const header = store.exportToCSV(items, ['Spicy'], { Spicy: '🌶️' }).split('\n')[0]!

    expect(header.endsWith('\t🌶️')).toBe(true)
  })
})
