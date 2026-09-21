import Papa from 'papaparse'
import {
  DIETARY_KEYS,
  LANGS,
  type DietaryKey,
  type Lang,
  type LocalizedText,
  type MenuItem,
} from '@/types/types'
import { DIETARY_LABELS, createMenuItem } from '@/domain/menuItem'

type TextField = 'name' | 'description'

type Column =
  | { kind: 'no' | 'price' | 'measure' }
  | { kind: 'text'; field: TextField; lang: Lang }
  | { kind: 'dietary'; key: DietaryKey }
  | { kind: 'tag'; tag: string }

const PLAIN_COLUMNS: Record<string, Column> = {
  'no.': { kind: 'no' },
  no: { kind: 'no' },
  'nr.': { kind: 'no' },
  nr: { kind: 'no' },
  price: { kind: 'price' },
  preis: { kind: 'price' },
  measure: { kind: 'measure' },
  menge: { kind: 'measure' },
  'chinese name': { kind: 'text', field: 'name', lang: 'zh' },
  chinesename: { kind: 'text', field: 'name', lang: 'zh' },
}

const DIETARY_HEADERS: Record<string, DietaryKey> = {
  recommend: 'recommend',
  empfohlen: 'recommend',
  spicy: 'spicy',
  scharf: 'spicy',
  vegan: 'vegan',
  vegetarian: 'vegetarian',
  vegetarisch: 'vegetarian',
  'gluten free': 'gluten_free',
  glutenfree: 'gluten_free',
  gluten_free: 'gluten_free',
  glutenfrei: 'gluten_free',
}

const TEXT_HEADERS: Record<string, TextField> = {
  name: 'name',
  description: 'description',
  beschreibung: 'description',
}

// Headers that mark a sheet written in German, so plain `Name` / `Description` mean German text
const GERMAN_HINTS = new Set([
  'preis',
  'empfohlen',
  'scharf',
  'vegetarisch',
  'glutenfrei',
  'beschreibung',
])

// Any other mark (X, V, S, VG, VT, G, true, 1, ...) means the flag is set
const FALSE_CELLS = new Set(['', 'false', 'no', 'nein', '0', '-'])

const LANG_SUFFIX = /^(.+?)\s*(?:\((\w+)\)|_(\w+))$/

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isLang(value: string): value is Lang {
  return (LANGS as readonly string[]).includes(value)
}

function classifyColumn(header: string, defaultLang: Lang): Column | null {
  const h = normalizeHeader(header)
  if (!h || h === '__parsed_extra') return null

  const plain = PLAIN_COLUMNS[h]
  if (plain) return plain

  const dietary = DIETARY_HEADERS[h]
  if (dietary) return { kind: 'dietary', key: dietary }

  const text = TEXT_HEADERS[h]
  if (text) return { kind: 'text', field: text, lang: defaultLang }

  // `Name (DE)`, `description_en`, ...
  const match = h.match(LANG_SUFFIX)
  const field = match && TEXT_HEADERS[match[1]!]
  const lang = match?.[2] ?? match?.[3]
  if (field && lang && isLang(lang)) return { kind: 'text', field, lang }

  return { kind: 'tag', tag: header.trim() }
}

export function isChecked(cell: string): boolean {
  return !FALSE_CELLS.has(cell.trim().toLowerCase())
}

export interface ParsedMenu {
  items: MenuItem[]
  customTags: string[] // columns that are not data or dietary columns, in CSV order
}

export function parseMenuRows(
  rows: Record<string, unknown>[],
  fields: string[],
  newId: () => string,
): ParsedMenu {
  const defaultLang: Lang = fields.some((f) => GERMAN_HINTS.has(normalizeHeader(f))) ? 'de' : 'en'

  const columns = fields
    .map((header) => ({ header, column: classifyColumn(header, defaultLang) }))
    .filter((c): c is { header: string; column: Column } => c.column !== null)

  const customTags = columns.flatMap(({ column }) => (column.kind === 'tag' ? [column.tag] : []))

  const items: MenuItem[] = []
  let currentCategory: LocalizedText = {}

  for (const row of rows) {
    const item = createMenuItem()

    for (const { header, column } of columns) {
      const raw = row[header]
      const cell = typeof raw === 'string' ? raw.trim() : ''

      switch (column.kind) {
        case 'no':
        case 'price':
        case 'measure':
          item[column.kind] = cell
          break
        case 'text':
          if (cell) item[column.field][column.lang] = cell
          break
        case 'dietary':
          item.dietary[column.key] = isChecked(cell)
          break
        case 'tag':
          if (isChecked(cell)) item.tags.push(column.tag)
          break
      }
    }

    const hasName = Object.values(item.name).some(Boolean)
    if (!item.no && !item.price) {
      // Category row: its name columns hold the category for the rows below it
      if (hasName) currentCategory = { ...item.name }
      // A row with nothing but separators is skipped
      if (hasName || !Object.values(item.description).some(Boolean)) continue
    }

    items.push({ ...item, id: newId(), category: { ...currentCategory } })
  }

  return { items, customTags }
}

const langHeader = (label: string, lang: Lang) => `${label} (${lang.toUpperCase()})`

export function exportMenuCsv(items: MenuItem[], customTags: string[]): string {
  const fields = [
    'No.',
    'Price',
    'Measure',
    ...LANGS.map((l) => langHeader('Name', l)),
    ...LANGS.map((l) => langHeader('Description', l)),
    // Canonical English headers, so a renamed display label still imports as the same flag
    ...DIETARY_KEYS.map((k) => DIETARY_LABELS.en[k]),
    ...customTags,
  ]
  const flagCount = DIETARY_KEYS.length + customTags.length
  const mark = (on: boolean) => (on ? 'X' : '')

  const data: string[][] = []
  let currentCategory = ''

  items.forEach((item) => {
    const categoryCells = LANGS.map((l) => item.category?.[l] ?? '')
    const categoryKey = categoryCells.join('\u0000')
    if (categoryCells.some((c) => c.trim()) && categoryKey !== currentCategory) {
      currentCategory = categoryKey
      data.push([
        '',
        '',
        '',
        ...categoryCells,
        ...LANGS.map(() => ''),
        ...Array.from({ length: flagCount }, () => ''),
      ])
    }

    data.push([
      item.no,
      item.price,
      item.measure,
      ...LANGS.map((l) => item.name[l] ?? ''),
      ...LANGS.map((l) => item.description[l] ?? ''),
      ...DIETARY_KEYS.map((k) => mark(item.dietary[k])),
      ...customTags.map((tag) => mark(item.tags.includes(tag))),
    ])
  })

  return Papa.unparse({ fields, data })
}
