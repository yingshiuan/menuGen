import { computed, ref } from 'vue'
import type { Lang } from '@/types/types'
import { extraNameLangs } from '@/domain/menuItem'

export const PRIMARY_LANGS = ['en', 'de'] as const satisfies readonly Lang[]
export type PrimaryLang = (typeof PRIMARY_LANGS)[number]

// The menu's main language: dish name, description, category, icon labels, pcs/Stk.
const primary = ref<PrimaryLang>('en')
// Which other languages' names follow the main name ("Szechuan Soup / 酸辣湯")
export const DEFAULT_EXTRA_NAMES: Readonly<Record<Lang, boolean>> = {
  en: false,
  de: false,
  zh: true,
}
const extraNames = ref<Record<Lang, boolean>>({ ...DEFAULT_EXTRA_NAMES })

const extraLangs = computed(() => extraNameLangs(primary.value, extraNames.value))

export function useMenuLang() {
  return { primary, extraNames, extraLangs }
}
