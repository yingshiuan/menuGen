export const LANGS = ['en', 'de', 'zh'] as const
export type Lang = (typeof LANGS)[number]
export type LocalizedText = Partial<Record<Lang, string>>

export const DIETARY_KEYS = ['recommend', 'spicy', 'vegan', 'vegetarian', 'gluten_free'] as const
export type DietaryKey = (typeof DIETARY_KEYS)[number]
export type Dietary = Record<DietaryKey, boolean>

export interface MenuItem {
  id: string // Unique identifier (generated when created or loaded from CSV)
  no: string
  price: string
  measure: string
  name: LocalizedText
  description: LocalizedText
  category: LocalizedText
  dietary: Dietary
  tags: string[] // custom icon keys added by the user (e.g. 'House Special')
  mainImageBase64?: string | null //Base64-encoded string
  images?: MenuImage[]
  lastUpdated?: number
}

export interface MenuImage {
  name: string
  base64: string //Base64-encoded string
}
