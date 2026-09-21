import { describe, expect, it } from 'vitest'
import {
  categoryLabel,
  cloneMenuItem,
  createMenuItem,
  emptyDietary,
  extraNameLangs,
  filterByDiet,
  matchesPictureName,
  pickText,
} from '@/domain/menuItem'
import type { Dietary } from '@/types/types'

describe('pickText', () => {
  it('returns the requested language when it has text', () => {
    expect(pickText({ en: 'Wonton Soup', de: 'Wan Tan Suppe' }, 'de')).toBe('Wan Tan Suppe')
  })

  it('falls back to English, then German, then any language', () => {
    expect(pickText({ en: 'Soup', de: 'Suppe' }, 'zh')).toBe('Soup')
    expect(pickText({ de: 'Suppe', zh: '湯' }, 'en')).toBe('Suppe')
    expect(pickText({ zh: '湯' }, 'de')).toBe('湯')
  })

  it('skips blank values and handles missing text', () => {
    expect(pickText({ de: '  ', en: 'Soup' }, 'de')).toBe('Soup')
    expect(pickText({}, 'en')).toBe('')
    expect(pickText(undefined, 'en')).toBe('')
  })
})

describe('extraNameLangs', () => {
  it('lists the ticked languages in a fixed order, after the main one', () => {
    expect(extraNameLangs('de', { en: true, de: false, zh: true })).toEqual(['en', 'zh'])
    expect(extraNameLangs('en', { zh: true })).toEqual(['zh'])
    expect(extraNameLangs('en', {})).toEqual([])
  })

  it('never repeats the main language', () => {
    expect(extraNameLangs('de', { en: true, de: true, zh: true })).toEqual(['en', 'zh'])
  })
})

describe('categoryLabel', () => {
  it('names a dish without a category Uncategorized', () => {
    expect(categoryLabel(createMenuItem(), 'en')).toBe('Uncategorized')
    expect(categoryLabel(createMenuItem({ category: { de: 'SUPPE' } }), 'de')).toBe('SUPPE')
  })
})

describe('cloneMenuItem', () => {
  it('shares no nested objects with the original', () => {
    const original = createMenuItem({ name: { en: 'Soup' }, tags: ['House Special'] })
    const copy = cloneMenuItem(original)

    copy.name.en = 'Rice'
    copy.dietary.vegan = true
    copy.tags.push('New')

    expect(original.name.en).toBe('Soup')
    expect(original.dietary.vegan).toBe(false)
    expect(original.tags).toEqual(['House Special'])
  })
})

describe('matchesPictureName', () => {
  const springRoll = createMenuItem({
    no: '10',
    name: { en: 'Spring Roll - 1 pc', de: 'Frühlingsrolle - 1 Stk.', zh: '春卷' },
  })

  it.each([
    'Spring Roll - 1 pc',
    '10_Spring Roll - 1 pc',
    '10_Spring Roll', // piece count left off the file
    'Frühlingsrolle',
    '10_Frühlingsrolle - 1 Stk.',
    '10_Frühlingsrolle - 1 Stk', // trailing dot lost with the extension
    '春卷',
  ])('matches "%s"', (filename) => {
    expect(matchesPictureName(springRoll, filename)).toBe(true)
  })

  it('matches the zero-padded number form', () => {
    const soup = createMenuItem({ no: '1', name: { en: 'Szechuan Soup' } })
    expect(matchesPictureName(soup, '01_Szechuan Soup')).toBe(true)
  })

  it('matches a German filename whose umlaut macOS stored decomposed', () => {
    const decomposed = '10_Frühlingsrolle'.normalize('NFD')
    expect(decomposed).not.toBe('10_Frühlingsrolle')
    expect(matchesPictureName(springRoll, decomposed)).toBe(true)
  })

  it('does not match another dish under the same number', () => {
    const kimchi = createMenuItem({ no: '23', name: { en: 'Kimchi Jiaozi - 6 pcs' } })
    expect(matchesPictureName(kimchi, '23_Chicken Jiaozi')).toBe(false)
    expect(matchesPictureName(springRoll, '11_Spring Roll')).toBe(false)
  })
})

describe('filterByDiet', () => {
  const dish = (no: string, dietary: Partial<Dietary>) =>
    createMenuItem({ no, dietary: { ...emptyDietary(), ...dietary } })

  const items = [
    dish('1', { vegetarian: true }), // marked VT
    dish('2', { vegan: true }), // marked VG only, as in the source sheets
    dish('3', { spicy: true }), // meat
  ]

  it('counts vegan dishes as vegetarian', () => {
    expect(filterByDiet(items, 'vegetarian').map((i) => i.no)).toEqual(['1', '2'])
  })

  it('keeps only vegan dishes for a vegan menu', () => {
    expect(filterByDiet(items, 'vegan').map((i) => i.no)).toEqual(['2'])
  })
})
