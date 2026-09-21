import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMenuStore } from '@/stores/menu'
import { createMenuItem, emptyDietary } from '@/domain/menuItem'
import type { MenuItem } from '@/types/types'

// Pinia needs an active instance before any store is used outside a component
beforeEach(() => {
  setActivePinia(createPinia())
})

// The fixtures hold no commas or quotes, so a plain split reads the CSV back
function rows(csv: string): string[][] {
  return csv.split('\r\n').map((line) => line.split(','))
}

describe('exportToCSV', () => {
  const items: MenuItem[] = [
    createMenuItem({
      id: 'a',
      no: '1',
      price: '12.50',
      measure: 'plate',
      name: { en: 'Kung Pao Chicken', zh: '宫保鸡丁' },
      description: { en: 'With peanuts' },
      category: { en: 'Mains', de: 'Hauptgerichte' },
      dietary: { ...emptyDietary(), spicy: true },
      tags: ['House Special'],
    }),
    createMenuItem({
      id: 'b',
      no: '2',
      price: '3.00',
      measure: 'bowl',
      name: { en: 'Steamed Rice', zh: '米饭' },
      category: { en: 'Sides' },
    }),
  ]

  it('writes a header with a column per language, dietary flag and custom icon', () => {
    const store = useMenuStore()
    const [header] = rows(store.exportToCSV(items, ['House Special']))

    expect(header).toEqual([
      'No.',
      'Price',
      'Measure',
      'Name (EN)',
      'Name (DE)',
      'Name (ZH)',
      'Description (EN)',
      'Description (DE)',
      'Description (ZH)',
      'Recommend',
      'Spicy',
      'Vegan',
      'Vegetarian',
      'Gluten Free',
      'House Special',
    ])
  })

  it('writes a category row before each change of category and an X per active flag', () => {
    const store = useMenuStore()
    const [, mains, kungPao, sides, rice] = rows(store.exportToCSV(items, ['House Special']))

    // category separator row: category names sit in the Name columns
    expect(mains!.slice(0, 6)).toEqual(['', '', '', 'Mains', 'Hauptgerichte', ''])
    expect(kungPao!.slice(3, 6)).toEqual(['Kung Pao Chicken', '', '宫保鸡丁'])
    expect(kungPao!.slice(-6)).toEqual(['', 'X', '', '', '', 'X'])
    expect(sides![3]).toBe('Sides')
    expect(rice!.slice(-6)).toEqual(['', '', '', '', '', ''])
  })
})
