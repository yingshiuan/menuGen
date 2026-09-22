import { nextTick, onScopeDispose, ref, watch } from 'vue'
import { createStore, get, set } from 'idb-keyval'
import type { MenuItem } from '@/types/types'
import type { ItemSpacing } from '@/components/controls/ItemSpacingControl.vue'
import { defaultIcons, useIcons } from '@/composables/useIcons'
import { useMenuLang } from '@/composables/useMenuLang'
import { useMenuTypography } from '@/composables/useMenuTypography'
import { useMenuPhoto } from '@/composables/useMenuPhoto'
import { DRAFT_VERSION, defaultDraft, parseDraft, type MenuDraft } from '@/domain/menuDraft'

/*
 * Keeps the menu in this browser between visits: every change is saved a moment after
 * it is made, and the page puts the saved menu back when it opens. The menu never
 * leaves the device -- a different browser, or a private window once it is closed,
 * starts from the sample menu.
 *
 * Saving is best effort. Where the browser has no storage, blocks it or is full, the
 * editor works exactly as it does without this, and `status` says so.
 */

// The parts of MenuCreate's state that are saved
export interface DraftState {
  menuState: {
    menuCsv: MenuItem[]
    selectedFont: string
    bgColor: string
    textColor: string
    footerText: string
    logoBase64: string | null
    itemSpacing: ItemSpacing
    coverTitle: string
    coverSubtitle: string
    coverLogoBase64: string | null
    iconFilter: string[]
  }
  pageState: {
    currentPage: number
    itemsPerPage: number
    width: string
    height: string
    keepCategoryTogether: boolean
  }
  uiState: { csvUploaded: boolean }
}

export interface DraftStorage {
  get(key: string): Promise<unknown>
  set(key: string, value: string): Promise<void>
}

// idle: nothing saved yet this visit. unavailable: no storage, or the saved menu could
// not be read, so nothing is saved. error: the last save failed (e.g. storage is full).
export type DraftStatus = 'idle' | 'saved' | 'error' | 'unavailable'

export const DRAFT_KEY = 'menu-draft'

/**
 * IndexedDB rather than localStorage: photos are base64 in every dish, and a menu
 * with twenty of them is already at localStorage's ~5MB limit.
 *
 * The database is opened on first use. Where there is no IndexedDB, idb-keyval throws
 * at once rather than rejecting, so callers keep every call inside a try.
 */
export function idbStorage(): DraftStorage {
  let store: ReturnType<typeof createStore> | undefined
  const db = () => (store ??= createStore('menu-gen', 'draft'))
  return {
    get: (key) => get(key, db()),
    set: (key, value) => set(key, value, db()),
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No answer from storage in ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

export function useMenuDraft(
  state: DraftState,
  {
    storage = idbStorage(),
    debounceMs = 1000,
    // Opening IndexedDB can stall (another tab holding it open for an upgrade), and the
    // page shows nothing until this read is over
    readTimeoutMs = 2000,
  }: { storage?: DraftStorage; debounceMs?: number; readTimeoutMs?: number } = {},
) {
  const { customOptions, renamedLabels, userIcons, userColors, setUserColor, resetAllIcons } =
    useIcons()
  const { primary, extraNames } = useMenuLang()
  const { textSizes } = useMenuTypography()
  const { photoSize, followMax, showNameRing } = useMenuPhoto()

  const status = ref<DraftStatus>('idle')

  let armed = false // saving starts once the saved menu has been read, so it can't be overwritten first
  let lastJson: string | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  // Images and colours of a removed custom icon stay behind in these maps
  function iconsInUse(map: Partial<Record<string, string>>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(map).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === 'string' &&
          (entry[0] in defaultIcons || entry[0] in customOptions.value),
      ),
    )
  }

  function collect(): MenuDraft {
    const { menuState: m, pageState: p, uiState: u } = state
    return {
      version: DRAFT_VERSION,
      items: m.menuCsv,
      csvUploaded: u.csvUploaded,
      iconFilter: m.iconFilter,
      footerText: m.footerText,
      logo: m.logoBase64 || null,
      cover: { title: m.coverTitle, subtitle: m.coverSubtitle, logo: m.coverLogoBase64 || null },
      page: {
        width: p.width,
        height: p.height,
        itemsPerPage: p.itemsPerPage,
        keepCategoryTogether: p.keepCategoryTogether,
        itemSpacing: m.itemSpacing,
      },
      style: { font: m.selectedFont, bgColor: m.bgColor, textColor: m.textColor },
      textSizes: { ...textSizes },
      photo: {
        size: photoSize.value,
        followMax: followMax.value,
        showNameRing: showNameRing.value,
      },
      lang: { primary: primary.value, extraNames: extraNames.value },
      icons: {
        customOptions: customOptions.value,
        renamedLabels: renamedLabels.value,
        userIcons: iconsInUse(userIcons.value),
        userColors: iconsInUse(userColors.value),
      },
    }
  }

  async function save() {
    clearTimeout(timer)
    timer = undefined
    if (!armed) return

    // A string, not the objects: Vue's proxies can't be copied into IndexedDB, and the
    // menu is turned into text once per save rather than on every change
    const json = JSON.stringify(collect())
    if (json === lastJson) return

    try {
      await storage.set(DRAFT_KEY, json)
      lastJson = json
      status.value = 'saved'
    } catch {
      // Storage full, most likely. The previous save is kept, and the next change tries
      // again -- the menu may fit once a photo is removed.
      status.value = 'error'
    }
  }

  // collect() returns new objects each time, so this fires on any change to what it
  // reads -- and it reads nothing else: turning a page or zooming saves nothing
  watch(
    collect,
    () => {
      if (!armed) return
      clearTimeout(timer)
      timer = setTimeout(save, debounceMs)
    },
    { deep: true },
  )

  // Closing the tab within a second of a change would otherwise lose it
  const flush = () => {
    if (timer !== undefined) void save()
  }
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', flush)

  onScopeDispose(() => {
    flush()
    armed = false
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', flush)
  })

  async function apply(draft: MenuDraft) {
    const { menuState: m, pageState: p, uiState: u } = state

    // Icons first, with no dishes on the menu, then a tick: MenuCreate gives every dish
    // each newly added custom icon, and that must not switch on the icons a saved dish
    // had switched off
    m.menuCsv = []
    resetAllIcons()
    customOptions.value = { ...draft.icons.customOptions }
    renamedLabels.value = { ...draft.icons.renamedLabels }
    userIcons.value = { ...draft.icons.userIcons }
    // Recolouring rebuilds the coloured icons, which are not saved. Not awaited: a photo
    // icon waits for the browser to decode it, and the menu need not wait for that.
    void Promise.allSettled(
      Object.entries(draft.icons.userColors).map(([key, color]) => setUserColor(key, color)),
    )
    await nextTick()

    primary.value = draft.lang.primary
    extraNames.value = { ...draft.lang.extraNames }
    Object.assign(textSizes, draft.textSizes)
    photoSize.value = draft.photo.size
    followMax.value = draft.photo.followMax
    showNameRing.value = draft.photo.showNameRing

    p.width = draft.page.width
    p.height = draft.page.height
    p.itemsPerPage = draft.page.itemsPerPage
    p.keepCategoryTogether = draft.page.keepCategoryTogether

    m.itemSpacing = draft.page.itemSpacing
    m.selectedFont = draft.style.font
    m.bgColor = draft.style.bgColor
    m.textColor = draft.style.textColor
    m.footerText = draft.footerText
    m.logoBase64 = draft.logo
    m.coverTitle = draft.cover.title
    m.coverSubtitle = draft.cover.subtitle
    m.coverLogoBase64 = draft.cover.logo
    m.iconFilter = [...draft.iconFilter]
    m.menuCsv = draft.items
    u.csvUploaded = draft.csvUploaded

    // Open on the first menu page: it measures the room "Fill page" photos have
    p.currentPage = 1
  }

  /** Put the saved menu back. False when there is none, or it could not be read. */
  async function restore(): Promise<boolean> {
    let raw: unknown
    try {
      raw = await withTimeout(storage.get(DRAFT_KEY), readTimeoutMs)
    } catch {
      // No storage, or none that answers. Don't save this visit either: a menu that was
      // too slow to read is still there, and saving would write over it.
      status.value = 'unavailable'
      return false
    }

    const draft = parseDraft(raw)
    if (!draft) return false

    await apply(draft)
    lastJson = typeof raw === 'string' ? raw : null
    status.value = 'saved' // it is, from the last visit
    return true
  }

  /** Every setting back to how a first visit starts. The caller adds the sample dishes. */
  async function reset() {
    await apply(defaultDraft())
  }

  /** Save from now on. Call once the saved menu is back, or known to be absent. */
  function startAutosave() {
    if (status.value !== 'unavailable') armed = true
  }

  return { status, restore, reset, startAutosave }
}
