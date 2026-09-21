import {
  DIETARY_KEYS,
  LANGS,
  type Dietary,
  type DietaryKey,
  type Lang,
  type LocalizedText,
  type MenuItem,
} from '@/types/types'

export const DIETARY_LABELS: Record<Lang, Record<DietaryKey, string>> = {
  en: {
    recommend: 'Recommended',
    spicy: 'Spicy',
    vegan: 'Vegan',
    vegetarian: 'Vegetarian',
    gluten_free: 'Gluten Free',
  },
  de: {
    recommend: 'Empfohlen',
    spicy: 'Scharf',
    vegan: 'Vegan',
    vegetarian: 'Vegetarisch',
    gluten_free: 'Glutenfrei',
  },
  zh: {
    recommend: '推薦',
    spicy: '辣',
    vegan: '純素',
    vegetarian: '素食',
    gluten_free: '無麩質',
  },
}

export const LANG_LABELS: Record<Lang, string> = { en: 'English', de: 'Deutsch', zh: '中文' }

export const MEASURE_UNIT: Record<Lang, string> = { en: 'pcs', de: 'Stk.', zh: '件' }

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function isDietaryKey(key: string): key is DietaryKey {
  return (DIETARY_KEYS as readonly string[]).includes(key)
}

export function emptyDietary(): Dietary {
  return { recommend: false, spicy: false, vegan: false, vegetarian: false, gluten_free: false }
}

export function createMenuItem(partial: Partial<MenuItem> = {}): MenuItem {
  return cloneMenuItem({
    id: '',
    no: '',
    price: '',
    measure: '',
    name: {},
    description: {},
    category: {},
    dietary: emptyDietary(),
    tags: [],
    ...partial,
  })
}

// Copies the nested maps/arrays so an edited copy never writes into the original
export function cloneMenuItem(item: MenuItem): MenuItem {
  return {
    ...item,
    name: { ...item.name },
    description: { ...item.description },
    category: { ...item.category },
    dietary: { ...emptyDietary(), ...item.dietary },
    tags: [...(item.tags ?? [])],
    images: item.images ? [...item.images] : item.images,
  }
}

// Text in `lang`, falling back to en → de → any language that has a value
export function pickText(text: LocalizedText | undefined, lang: Lang): string {
  if (!text) return ''
  for (const l of [lang, 'en', 'de', ...LANGS] as Lang[]) {
    const value = text[l]?.trim()
    if (value) return value
  }
  return ''
}

// Languages whose names follow the main one ("Gemüse Jiao Zi / Vegetable Jiaozi / 蔬菜煎餃"),
// in LANGS order and never repeating the main language
export function extraNameLangs(primary: Lang, show: Partial<Record<Lang, boolean>>): Lang[] {
  return LANGS.filter((lang) => lang !== primary && show[lang])
}

export function categoryLabel(item: MenuItem, lang: Lang): string {
  return pickText(item.category, lang) || 'Uncategorized'
}

// The piece count some names carry: "Spring Roll - 1 pc", "Gemüse Jiao Zi - 10 Stk."
const PIECE_COUNT = /\s+-\s*\d+\s*(?:pcs?|stk)\.?$/i

// NFC, because macOS can hand over "ü" in a filename as "u" + a combining mark
const pictureKey = (text: string) => text.normalize('NFC').trim().replace(PIECE_COUNT, '')

// A picture file is named after the dish in any of its languages, optionally prefixed
// by its number ("01_Szechuan Soup"); the piece count may be left off
export function matchesPictureName(item: MenuItem, filename: string): boolean {
  const file = pictureKey(filename)
  const no = item.no?.trim() ?? ''
  const prefixes = no ? ['', `${no}_`, `${no.padStart(2, '0')}_`] : ['']

  return Object.values(item.name).some((name) => {
    const key = name ? pictureKey(name) : ''
    return !!key && prefixes.some((prefix) => file === prefix + key)
  })
}

// Whether a dish belongs on a menu of `key` dishes. Dietary keys live in `dietary`, custom
// icons in `tags`. Vegan dishes are vegetarian too, even though the source data only marks
// them VG.
export function matchesIcon(item: MenuItem, key: string): boolean {
  if (key === 'vegetarian') return item.dietary.vegetarian || item.dietary.vegan
  return isDietaryKey(key) ? item.dietary[key] : item.tags.includes(key)
}

// The dishes that carry any of `keys`: vegetarian and spicy keeps both kinds, and a
// vegetarian dish that is also spicy once. No keys keeps every dish. A vegetarian or vegan
// menu can be made from the same data this way.
export function filterByIcons(items: MenuItem[], keys: string[]): MenuItem[] {
  if (!keys.length) return items
  return items.filter((item) => keys.some((key) => matchesIcon(item, key)))
}
