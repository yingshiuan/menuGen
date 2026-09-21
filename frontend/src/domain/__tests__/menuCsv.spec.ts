import { describe, expect, it } from 'vitest'
import { exportMenuCsv, isChecked } from '@/domain/menuCsv'
import { createMenuItem, emptyDietary } from '@/domain/menuItem'
import { parseCsvText as parseCsv } from './parseCsvText'

describe('parseMenuRows', () => {
  it('reads the legacy English sheet with its V/S/VG/VT/G flag codes', () => {
    const { items } = parseCsv(
      [
        'No.,Price,Name,Measure,Chinese Name,Description,Recommend,Spicy,Vegan,Vegetarian,Gluten Free',
        ',,SOUP / SALAD,,,,,,,,',
        '1,8,Szechuan Soup,,酸辣湯,Hot and sour soup with vegetables and tofu,,S,,VT,',
        '6,8.5,Acar,,馬來西亞泡菜,"Malaysian cabbage salad with chilli, sesame",V,S,VG,,G',
      ].join('\n'),
    )

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      id: 'id-1',
      no: '1',
      price: '8',
      name: { en: 'Szechuan Soup', zh: '酸辣湯' },
      description: { en: 'Hot and sour soup with vegetables and tofu' },
      category: { en: 'SOUP / SALAD' },
      dietary: {
        recommend: false,
        spicy: true,
        vegan: false,
        vegetarian: true,
        gluten_free: false,
      },
      tags: [],
    })
    expect(items[1]!.description.en).toBe('Malaysian cabbage salad with chilli, sesame')
    expect(items[1]!.dietary).toEqual({
      recommend: true,
      spicy: true,
      vegan: true,
      vegetarian: false,
      gluten_free: true,
    })
  })

  it('reads plain Name/Description as German when the headers are German', () => {
    const { items, customTags } = parseCsv(
      [
        'No.,Preis,Name,Chinese Name,Description,Empfohlen,Scharf,Vegan,Vegetarisch,Glutenfrei',
        ',,SUPPE / SALAT,,,,,,,',
        '1,8.5,Szechuan Suppe,酸辣湯,Scharf-saure Suppe mit Gemüse & Tofu,,S,,VT,',
      ].join('\n'),
    )

    expect(customTags).toEqual([])
    expect(items[0]).toMatchObject({
      price: '8.5',
      name: { de: 'Szechuan Suppe', zh: '酸辣湯' },
      description: { de: 'Scharf-saure Suppe mit Gemüse & Tofu' },
      category: { de: 'SUPPE / SALAT' },
      dietary: { spicy: true, vegetarian: true },
    })
  })

  it('reads a column per language from `Name (DE)` and `name_de` style headers', () => {
    const { items } = parseCsv(
      [
        'no,price,Name (EN),name_de,Name (ZH),Description (EN),description_de',
        '1,8,Wonton Soup,Wan Tan Suppe,餛飩湯,Dumplings,Teigtaschen',
      ].join('\n'),
    )

    expect(items[0]!.name).toEqual({ en: 'Wonton Soup', de: 'Wan Tan Suppe', zh: '餛飩湯' })
    expect(items[0]!.description).toEqual({ en: 'Dumplings', de: 'Teigtaschen' })
  })

  it('keeps each cell of a custom icon column instead of switching it on everywhere', () => {
    const { items, customTags } = parseCsv(
      ['No.,Price,Name,House Special', '1,8,Soup,X', '2,9,Rice,'].join('\n'),
    )

    expect(customTags).toEqual(['House Special'])
    expect(items.map((i) => i.tags)).toEqual([['House Special'], []])
  })

  it('leaves the category empty for dishes above the first category row', () => {
    const { items } = parseCsv(['No.,Price,Name', '1,8,Spring Roll'].join('\n'))

    expect(items[0]!.category).toEqual({})
  })

  it('skips rows that hold nothing but separators', () => {
    const { items } = parseCsv(['No.,Price,Name,Spicy', ',,,', '1,8,Soup,X'].join('\n'))

    expect(items).toHaveLength(1)
  })
})

describe('isChecked', () => {
  it.each(['X', 'x', 'V', 'S', 'VG', 'VT', 'G', 'true', 'TRUE', '1', 'yes', 'ja'])(
    'treats %s as set',
    (cell) => expect(isChecked(cell)).toBe(true),
  )

  it.each(['', ' ', 'false', 'FALSE', 'no', 'nein', '0', '-'])('treats "%s" as not set', (cell) =>
    expect(isChecked(cell)).toBe(false),
  )
})

describe('exportMenuCsv', () => {
  const items = [
    createMenuItem({
      id: 'a',
      no: '1',
      price: '8.5',
      measure: '2',
      name: { en: 'Szechuan Soup', de: 'Szechuan Suppe', zh: '酸辣湯' },
      description: { en: 'Hot, sour and "spicy"', de: 'Scharf-sauer\nmit Tofu' },
      category: { en: 'SOUP', de: 'SUPPE' },
      dietary: { ...emptyDietary(), spicy: true, vegetarian: true },
      tags: ['House Special'],
    }),
    createMenuItem({
      id: 'b',
      no: '2',
      price: '9.5',
      name: { en: 'Wonton Soup', de: 'Wan Tan Suppe' },
      category: { en: 'SOUP', de: 'SUPPE' },
    }),
    createMenuItem({
      id: 'c',
      no: '22',
      price: '18.5',
      name: { en: 'Vegetable Jiaozi', zh: '蔬菜煎餃' },
      category: { en: 'JIAOZI' },
      dietary: { ...emptyDietary(), recommend: true, vegan: true },
    }),
  ]

  it('round-trips through parseMenuRows, including quotes, commas and newlines', () => {
    const csv = exportMenuCsv(items, ['House Special'])
    const { items: parsed, customTags } = parseCsv(csv)

    expect(customTags).toEqual(['House Special'])
    expect(parsed.map(({ id: _id, ...rest }) => rest)).toEqual(
      items.map(({ id: _id, ...rest }) => rest),
    )
  })

  it('writes one category row per change of category', () => {
    const lines = exportMenuCsv(items, []).split('\r\n')
    const categoryRows = lines.filter((l) => l.startsWith(',,,'))

    expect(categoryRows).toHaveLength(2)
    expect(categoryRows[0]).toContain('SOUP,SUPPE')
    expect(categoryRows[1]).toContain('JIAOZI')
  })
})
