import { describe, expect, it } from 'vitest'
import { DRAFT_VERSION, defaultDraft, parseDraft, type MenuDraft } from '@/domain/menuDraft'
import { createMenuItem } from '@/domain/menuItem'

function draft(overrides: Partial<MenuDraft> = {}): MenuDraft {
  return {
    ...defaultDraft(),
    items: [
      createMenuItem({
        id: 'a',
        no: '1',
        price: '12.50',
        name: { en: 'Kung Pao Chicken', zh: '宫保鸡丁' },
        category: { en: 'Mains' },
        dietary: { ...createMenuItem().dietary, spicy: true },
        tags: ['House Special'],
        mainImageBase64: 'data:image/jpeg;base64,AAA',
        images: [{ name: '01_Kung Pao Chicken', base64: 'data:image/jpeg;base64,AAA' }],
        lastUpdated: 1700000000000,
      }),
    ],
    csvUploaded: true,
    ...overrides,
  }
}

/** A saved draft with one field of one dish swapped for something else. */
function withItem(item: Record<string, unknown>) {
  return { ...draft(), items: [item] }
}

describe('parseDraft', () => {
  it('reads back what was saved', () => {
    const saved = draft({
      page: { ...defaultDraft().page, width: '148mm', height: '210mm', itemSpacing: 'compact' },
      icons: {
        customOptions: { 'House Special': 'data:image/svg+xml,<svg/>' },
        renamedLabels: { spicy: '🌶️ Hot' },
        userIcons: {},
        userColors: { vegan: '#ff0000' },
      },
    })

    expect(parseDraft(JSON.stringify(saved))).toEqual(saved)
  })

  it('reads the defaults back unchanged', () => {
    expect(parseDraft(JSON.stringify(defaultDraft()))).toEqual(defaultDraft())
  })

  it.each([
    ['text that is not JSON', '{"version":1,'],
    ['nothing', undefined],
    ['null', null],
    ['a list', '[]'],
    ['a draft from another version', JSON.stringify({ ...draft(), version: DRAFT_VERSION + 1 })],
    ['a draft whose dishes are not a list', JSON.stringify({ ...draft(), items: {} })],
  ])('has nothing to restore from %s', (_, raw) => {
    expect(parseDraft(raw)).toBeNull()
  })

  it('keeps only the languages and text a dish can have', () => {
    const item = parseDraft(
      withItem({
        id: 'a',
        name: 'Spring Roll',
        description: { en: 'Crispy', fr: 'Croustillant', de: 3 },
      }),
    )!.items[0]!

    // A bare string would otherwise be spread into { 0: 'S', 1: 'p', ... }
    expect(item.name).toEqual({})
    expect(item.description).toEqual({ en: 'Crispy' })
  })

  it('reads a dietary flag as set only when it is true', () => {
    const item = parseDraft(
      withItem({ id: 'a', dietary: { spicy: 'yes', vegan: true, halal: true } }),
    )!.items[0]!

    expect(item.dietary).toEqual({
      recommend: false,
      spicy: false,
      vegan: true,
      vegetarian: false,
      gluten_free: false,
    })
  })

  it('drops tags and photos that are not the right shape', () => {
    const item = parseDraft(
      withItem({
        id: 'a',
        tags: ['House Special', 7, null],
        images: [
          { name: '01_Spring Roll', base64: 'data:image/jpeg;base64,AAA' },
          { name: 'x' },
          'y',
        ],
      }),
    )!.items[0]!

    expect(item.tags).toEqual(['House Special'])
    expect(item.images).toEqual([{ name: '01_Spring Roll', base64: 'data:image/jpeg;base64,AAA' }])
  })

  it('keeps a photo given as a file path, as the sample dish has', () => {
    const item = parseDraft(withItem({ id: 'a', mainImageBase64: '/data/2_Sample2.png' }))!
      .items[0]!

    expect(item.mainImageBase64).toBe('/data/2_Sample2.png')
  })

  it('gives a dish without an id, or with a repeated one, a new id', () => {
    const { items } = parseDraft({
      ...draft(),
      items: [{ id: 'a' }, { id: 'a' }, { no: '3' }, 'x'],
    })!

    expect(items).toHaveLength(3) // the string is not a dish
    expect(items[0]!.id).toBe('a')
    expect(new Set(items.map((i) => i.id)).size).toBe(3)
    expect(items.every((i) => i.id)).toBe(true)
  })

  it('brings sizes back into range, and a size that is not a number back to its default', () => {
    const parsed = parseDraft({
      ...draft(),
      textSizes: { category: 99, name: 'big', description: 1 },
      photo: { size: 500, followMax: 'no', showNameRing: false },
    })!

    expect(parsed.textSizes).toEqual({ category: 30, name: 12, description: 6 })
    expect(parsed.photo).toEqual({ size: 160, followMax: true, showNameRing: false })
  })

  it.each([
    [0, 1],
    [99, 11],
    [4.5, 9],
  ])('keeps dishes per page within 1–11 (%s → %s)', (saved, expected) => {
    const parsed = parseDraft({ ...draft(), page: { ...draft().page, itemsPerPage: saved } })!

    expect(parsed.page.itemsPerPage).toBe(expected)
  })

  it('keeps the largest paper size and replaces a half-typed one with A4', () => {
    const b0 = parseDraft({
      ...draft(),
      page: { ...draft().page, width: '1000mm', height: '1414mm' },
    })!
    const cleared = parseDraft({
      ...draft(),
      page: { ...draft().page, width: 'mm', height: '12' },
    })!

    expect(b0.page).toMatchObject({ width: '1000mm', height: '1414mm' })
    expect(cleared.page).toMatchObject({ width: '210mm', height: '297mm' })
  })

  it('falls back to the defaults for settings it does not know', () => {
    const parsed = parseDraft({
      ...draft(),
      page: { ...draft().page, itemSpacing: 'roomy' },
      style: { font: '', bgColor: 'red', textColor: '#123456' },
      lang: { primary: 'zh', extraNames: { en: true } },
    })!

    expect(parsed.page.itemSpacing).toBe('fill')
    expect(parsed.style).toEqual({ font: 'Sans-Serif', bgColor: '#ffffff', textColor: '#123456' })
    // Chinese is never the main language; its name is shown beside the main one
    expect(parsed.lang).toEqual({ primary: 'en', extraNames: { en: true, de: false, zh: true } })
  })

  it('reads a removed logo as no logo', () => {
    const parsed = parseDraft({ ...draft(), logo: '', cover: { ...draft().cover, logo: 42 } })!

    expect(parsed.logo).toBeNull()
    expect(parsed.cover.logo).toBeNull()
  })

  it('keeps only icon entries that are text', () => {
    const parsed = parseDraft({
      ...draft(),
      icons: {
        customOptions: { a: 'data:,a', b: 1 },
        renamedLabels: null,
        userIcons: [],
        userColors: { c: '#fff' },
      },
    })!

    expect(parsed.icons).toEqual({
      customOptions: { a: 'data:,a' },
      renamedLabels: {},
      userIcons: {},
      userColors: { c: '#fff' },
    })
  })
})
