import {
  DIETARY_KEYS,
  LANGS,
  type Dietary,
  type Lang,
  type LocalizedText,
  type MenuImage,
  type MenuItem,
} from '@/types/types'
import type { ItemSpacing } from '@/components/controls/ItemSpacingControl.vue'
import { createMenuItem, emptyDietary, generateId } from '@/domain/menuItem'
import { clampSize } from '@/domain/sizes'
import {
  DEFAULT_TEXT_SIZES,
  TEXT_SIZE_RANGES,
  type TextSizeKey,
} from '@/composables/useMenuTypography'
import { DEFAULT_PHOTO_SIZE, PHOTO_SIZE_RANGE } from '@/composables/useMenuPhoto'
import { DEFAULT_EXTRA_NAMES, PRIMARY_LANGS, type PrimaryLang } from '@/composables/useMenuLang'

/*
 * The menu as it is saved in the browser between visits: everything the user made,
 * nothing about where they were looking (page, zoom, open panels).
 *
 * A draft is read back from storage the app does not control -- an older version of
 * the app wrote it, or it was cut short -- so parseDraft trusts none of it and falls
 * back to the default for anything that is not the right shape.
 */

// Raise when the shape changes; an older draft is then dropped rather than misread
export const DRAFT_VERSION = 1

export const ITEM_SPACINGS = [
  'compact',
  'normal',
  'spacious',
  'fill',
] as const satisfies readonly ItemSpacing[]

export interface MenuDraft {
  version: typeof DRAFT_VERSION
  items: MenuItem[]
  csvUploaded: boolean
  iconFilter: string[]
  footerText: string
  logo: string | null
  cover: { title: string; subtitle: string; logo: string | null }
  page: {
    width: string
    height: string
    itemsPerPage: number
    keepCategoryTogether: boolean
    itemSpacing: ItemSpacing
  }
  style: { font: string; bgColor: string; textColor: string }
  textSizes: Record<TextSizeKey, number>
  photo: { size: number; followMax: boolean; showNameRing: boolean }
  lang: { primary: PrimaryLang; extraNames: Record<Lang, boolean> }
  icons: {
    customOptions: Record<string, string> // label -> icon data URI
    renamedLabels: Record<string, string>
    userIcons: Record<string, string>
    userColors: Record<string, string>
  }
}

// The menu on a first visit, and after "Start new menu" (which adds the sample dishes)
export function defaultDraft(): MenuDraft {
  return {
    version: DRAFT_VERSION,
    items: [],
    csvUploaded: false,
    iconFilter: [],
    footerText: 'All prices are in CHF, including VAT',
    logo: null,
    cover: { title: 'Menu', subtitle: 'Welcome to our restaurant', logo: null },
    page: {
      width: '210mm',
      height: '297mm',
      itemsPerPage: 9,
      keepCategoryTogether: true,
      itemSpacing: 'fill',
    },
    style: { font: 'Sans-Serif', bgColor: '#ffffff', textColor: '#000000' },
    textSizes: { ...DEFAULT_TEXT_SIZES },
    photo: { size: DEFAULT_PHOTO_SIZE, followMax: true, showNameRing: true },
    lang: { primary: 'en', extraNames: { ...DEFAULT_EXTRA_NAMES } },
    icons: { customOptions: {}, renamedLabels: {}, userIcons: {}, userColors: {} },
  }
}

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

// An image, or nothing: an empty string is how a removed logo comes back
const image = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

function stringRecord(value: unknown): Record<string, string> {
  if (!isObject(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

function localized(value: unknown): LocalizedText {
  if (!isObject(value)) return {}
  const text: LocalizedText = {}
  for (const lang of LANGS) {
    if (typeof value[lang] === 'string') text[lang] = value[lang]
  }
  return text
}

function dietary(value: unknown): Dietary {
  const flags = emptyDietary()
  if (!isObject(value)) return flags
  for (const key of DIETARY_KEYS) flags[key] = value[key] === true
  return flags
}

const isImage = (value: unknown): value is MenuImage =>
  isObject(value) && typeof value.name === 'string' && typeof value.base64 === 'string'

// Dishes are found by id (add, delete, reorder), so a missing or repeated id gets a new one
function parseItem(value: unknown, seenIds: Set<string>): MenuItem | null {
  if (!isObject(value)) return null

  let id = str(value.id)
  if (!id || seenIds.has(id)) id = generateId()
  seenIds.add(id)

  const item = createMenuItem({
    id,
    no: str(value.no),
    price: str(value.price),
    measure: str(value.measure),
    name: localized(value.name),
    description: localized(value.description),
    category: localized(value.category),
    dietary: dietary(value.dietary),
    tags: strings(value.tags),
  })

  // Any string: the sample dish points at a file (/data/...) rather than a data URI
  const mainImage = image(value.mainImageBase64)
  if (mainImage) item.mainImageBase64 = mainImage
  if (Array.isArray(value.images)) {
    item.images = value.images.filter(isImage).map(({ name, base64 }) => ({ name, base64 }))
  }
  if (typeof value.lastUpdated === 'number' && Number.isFinite(value.lastUpdated)) {
    item.lastUpdated = value.lastUpdated
  }
  return item
}

// Paper sizes run from A5 (148mm) to B0 (1414mm). Not the custom-size box's limits:
// the larger presets are beyond them. A cleared custom box saves as 'mm'.
function pageLength(value: unknown, fallback: string): string {
  const match = typeof value === 'string' ? /^(\d+)mm$/.exec(value) : null
  const mm = match ? Number(match[1]) : NaN
  return mm >= 50 && mm <= 2000 ? `${mm}mm` : fallback
}

const color = (value: unknown, fallback: string): string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback
}

function itemsPerPage(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? Math.min(11, Math.max(1, value))
    : fallback
}

/** The saved draft, or null when there is none worth restoring. Never throws. */
export function parseDraft(raw: unknown): MenuDraft | null {
  let data: unknown = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!isObject(data) || data.version !== DRAFT_VERSION || !Array.isArray(data.items)) return null

  const d = defaultDraft()
  const cover = isObject(data.cover) ? data.cover : {}
  const page = isObject(data.page) ? data.page : {}
  const style = isObject(data.style) ? data.style : {}
  const textSizes = isObject(data.textSizes) ? data.textSizes : {}
  const photo = isObject(data.photo) ? data.photo : {}
  const lang = isObject(data.lang) ? data.lang : {}
  const extraNames = isObject(lang.extraNames) ? lang.extraNames : {}
  const icons = isObject(data.icons) ? data.icons : {}

  const seenIds = new Set<string>()

  return {
    version: DRAFT_VERSION,
    items: data.items
      .map((item) => parseItem(item, seenIds))
      .filter((item): item is MenuItem => item !== null),
    csvUploaded: bool(data.csvUploaded, d.csvUploaded),
    iconFilter: strings(data.iconFilter),
    footerText: str(data.footerText, d.footerText),
    logo: image(data.logo),
    cover: {
      title: str(cover.title, d.cover.title),
      subtitle: str(cover.subtitle, d.cover.subtitle),
      logo: image(cover.logo),
    },
    page: {
      width: pageLength(page.width, d.page.width),
      height: pageLength(page.height, d.page.height),
      itemsPerPage: itemsPerPage(page.itemsPerPage, d.page.itemsPerPage),
      keepCategoryTogether: bool(page.keepCategoryTogether, d.page.keepCategoryTogether),
      itemSpacing: oneOf(page.itemSpacing, ITEM_SPACINGS, d.page.itemSpacing),
    },
    style: {
      font: str(style.font) || d.style.font,
      bgColor: color(style.bgColor, d.style.bgColor),
      textColor: color(style.textColor, d.style.textColor),
    },
    textSizes: {
      category: clampSize(textSizes.category, TEXT_SIZE_RANGES.category, d.textSizes.category),
      name: clampSize(textSizes.name, TEXT_SIZE_RANGES.name, d.textSizes.name),
      description: clampSize(
        textSizes.description,
        TEXT_SIZE_RANGES.description,
        d.textSizes.description,
      ),
    },
    photo: {
      size: clampSize(photo.size, PHOTO_SIZE_RANGE, d.photo.size),
      followMax: bool(photo.followMax, d.photo.followMax),
      showNameRing: bool(photo.showNameRing, d.photo.showNameRing),
    },
    lang: {
      primary: oneOf(lang.primary, PRIMARY_LANGS, d.lang.primary),
      extraNames: Object.fromEntries(
        LANGS.map((l) => [l, bool(extraNames[l], d.lang.extraNames[l])]),
      ) as Record<Lang, boolean>,
    },
    icons: {
      customOptions: stringRecord(icons.customOptions),
      renamedLabels: stringRecord(icons.renamedLabels),
      userIcons: stringRecord(icons.userIcons),
      userColors: stringRecord(icons.userColors),
    },
  }
}
