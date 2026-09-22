import { describe, expect, it } from 'vitest'
import {
  categoryLabel,
  cloneMenuItem,
  createMenuItem,
  emptyDietary,
  extraNameLangs,
  filterByIcons,
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

  it('leaves off a piece count in the middle of a name', () => {
    const tangYuan = createMenuItem({
      name: {
        en: 'Hong Dou Tang Yuan - 2 pcs. Tang Yuan',
        de: 'Hong Dou Tang Yuan mit 2 Stk. Tang Yuan',
      },
    })
    expect(matchesPictureName(tangYuan, 'Hong Dou Tang Yuan')).toBe(true)
  })

  it.each([
    ['100', 'Malaysian-style Prawns', '100_Malaysian Style Prawns'],
    ['', 'Schweinemagensuppe mit Pfeffer', 'Schweinemagen Suppe mit Pfeffer'],
    ['10', 'Spring Roll', '10_spring roll'],
  ])('does not count case, spaces or hyphens (dish %s "%s", file "%s")', (no, name, file) => {
    expect(matchesPictureName(createMenuItem({ no, name: { en: name } }), file)).toBe(true)
  })

  it('still needs the same words: a singular does not match a plural', () => {
    const wontons = createMenuItem({ no: '12', name: { en: 'Fried Wontons - 4 pcs.' } })
    expect(matchesPictureName(wontons, '12_Fried Wontons')).toBe(true)
    expect(matchesPictureName(wontons, '12_Fried Wonton')).toBe(false)
  })

  it('does not match another dish under the same number', () => {
    const kimchi = createMenuItem({ no: '23', name: { en: 'Kimchi Jiaozi - 6 pcs' } })
    expect(matchesPictureName(kimchi, '23_Chicken Jiaozi')).toBe(false)
    expect(matchesPictureName(springRoll, '11_Spring Roll')).toBe(false)
  })
})

describe('filterByIcons', () => {
  const dish = (no: string, dietary: Partial<Dietary>, tags: string[] = []) =>
    createMenuItem({ no, dietary: { ...emptyDietary(), ...dietary }, tags })

  const items = [
    dish('1', { vegetarian: true }), // marked VT
    dish('2', { vegan: true, gluten_free: true }), // marked VG only, as in the source sheets
    dish('3', { vegan: true }, ['House Special']),
    dish('4', { spicy: true }), // meat
  ]
  const nos = (keys: string[]) => filterByIcons(items, keys).map((i) => i.no)

  it('counts vegan dishes as vegetarian', () => {
    expect(nos(['vegetarian'])).toEqual(['1', '2', '3'])
  })

  it('keeps only vegan dishes for a vegan menu', () => {
    expect(nos(['vegan'])).toEqual(['2', '3'])
  })

  it('keeps the dishes that carry any ticked icon, each once', () => {
    expect(nos(['vegetarian', 'vegan'])).toEqual(['1', '2', '3'])
    expect(nos(['vegan', 'spicy'])).toEqual(['2', '3', '4'])
    expect(nos(['gluten_free', 'House Special'])).toEqual(['2', '3'])
  })

  it('filters by custom icons too', () => {
    expect(nos(['House Special'])).toEqual(['3'])
  })

  it('keeps every dish when nothing is ticked', () => {
    expect(nos([])).toEqual(['1', '2', '3', '4'])
  })
})
