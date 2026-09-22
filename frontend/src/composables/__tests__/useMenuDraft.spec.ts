import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive } from 'vue'
import {
  DRAFT_KEY,
  idbStorage,
  useMenuDraft,
  type DraftState,
  type DraftStorage,
} from '@/composables/useMenuDraft'
import { useIcons } from '@/composables/useIcons'
import { DEFAULT_EXTRA_NAMES, useMenuLang } from '@/composables/useMenuLang'
import { DEFAULT_TEXT_SIZES, useMenuTypography } from '@/composables/useMenuTypography'
import { DEFAULT_PHOTO_SIZE, useMenuPhoto } from '@/composables/useMenuPhoto'
import { defaultDraft, parseDraft, type MenuDraft } from '@/domain/menuDraft'
import { createMenuItem } from '@/domain/menuItem'

/** Storage kept in a Map, standing in for IndexedDB (which jsdom does not have). */
function memoryStorage(saved?: string) {
  const map = new Map<string, string>()
  if (saved !== undefined) map.set(DRAFT_KEY, saved)
  return {
    map,
    get: vi.fn(async (key: string): Promise<unknown> => map.get(key)),
    set: vi.fn(async (key: string, value: string) => {
      map.set(key, value)
    }),
  }
}

/** MenuCreate's state, as it starts. */
function editorState(): DraftState {
  const d = defaultDraft()
  return {
    menuState: reactive({
      menuCsv: [],
      selectedFont: d.style.font,
      bgColor: d.style.bgColor,
      textColor: d.style.textColor,
      footerText: d.footerText,
      logoBase64: d.logo,
      itemSpacing: d.page.itemSpacing,
      coverTitle: d.cover.title,
      coverSubtitle: d.cover.subtitle,
      coverLogoBase64: d.cover.logo,
      iconFilter: [],
    }),
    pageState: reactive({
      currentPage: 0,
      itemsPerPage: d.page.itemsPerPage,
      width: d.page.width,
      height: d.page.height,
      keepCategoryTogether: d.page.keepCategoryTogether,
    }),
    uiState: reactive({ csvUploaded: d.csvUploaded }),
  }
}

const mounted: VueWrapper[] = []

/** useMenuDraft inside a component, so unmounting stops it as leaving the page does. */
function setup(storage: DraftStorage, options: { readTimeoutMs?: number } = {}) {
  const state = editorState()
  let draft!: ReturnType<typeof useMenuDraft>
  const wrapper = mount(
    defineComponent({
      setup() {
        draft = useMenuDraft(state, { storage, ...options })
        return () => h('div')
      },
    }),
  )
  mounted.push(wrapper)
  return { state, draft, wrapper }
}

/** Past the one-second wait after the last change. */
async function afterSaveDelay() {
  await nextTick()
  await vi.advanceTimersByTimeAsync(1000)
}

function savedDraft(storage: ReturnType<typeof memoryStorage>): MenuDraft {
  return parseDraft(storage.map.get(DRAFT_KEY))!
}

const savedMenu: MenuDraft = parseDraft({
  ...defaultDraft(),
  items: [
    createMenuItem({ id: 'a', no: '1', name: { en: 'Spring Roll' }, tags: ['House Special'] }),
    createMenuItem({ id: 'b', no: '2', name: { en: 'Rice' } }),
  ],
  csvUploaded: true,
  iconFilter: ['vegan'],
  footerText: 'Prices in EUR',
  logo: 'data:image/png;base64,TOP',
  cover: { title: 'Lunch', subtitle: 'Daily', logo: 'data:image/png;base64,COVER' },
  page: {
    width: '148mm',
    height: '210mm',
    itemsPerPage: 6,
    keepCategoryTogether: false,
    itemSpacing: 'compact',
  },
  style: { font: 'Arial', bgColor: '#fdf6e3', textColor: '#333333' },
  textSizes: { category: 18, name: 13, description: 11 },
  photo: { size: 120, followMax: false, showNameRing: false },
  lang: { primary: 'de', extraNames: { en: true, de: false, zh: false } },
  icons: {
    customOptions: { 'House Special': 'data:image/svg+xml,<svg/>' },
    renamedLabels: { spicy: 'Hot' },
    userIcons: {},
    userColors: { vegan: '#ff0000' },
  },
})!

beforeEach(() => {
  vi.useFakeTimers()
  // These composables keep their state in module scope, so it would carry over between tests
  useIcons().resetAllIcons()
  const { primary, extraNames } = useMenuLang()
  primary.value = 'en'
  extraNames.value = { ...DEFAULT_EXTRA_NAMES }
  useMenuTypography().resetTextSizes()
  const { photoSize, followMax, showNameRing } = useMenuPhoto()
  photoSize.value = DEFAULT_PHOTO_SIZE
  followMax.value = true
  showNameRing.value = true
})

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
})

describe('autosave', () => {
  it('saves nothing until it is started', async () => {
    const storage = memoryStorage()
    const { state } = setup(storage)

    state.menuState.footerText = 'Prices in EUR'
    await afterSaveDelay()

    expect(storage.set).not.toHaveBeenCalled()
  })

  it('saves a change a second after it, as text', async () => {
    const storage = memoryStorage()
    const { state, draft } = setup(storage)
    draft.startAutosave()

    state.menuState.footerText = 'Prices in EUR'
    await nextTick()
    await vi.advanceTimersByTimeAsync(999)
    expect(storage.set).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(storage.set).toHaveBeenCalledOnce()
    expect(typeof storage.map.get(DRAFT_KEY)).toBe('string')
    expect(savedDraft(storage).footerText).toBe('Prices in EUR')
    expect(draft.status.value).toBe('saved')
  })

  it('saves a run of changes once', async () => {
    const storage = memoryStorage()
    const { state, draft } = setup(storage)
    draft.startAutosave()

    for (const text of ['P', 'Pr', 'Pri']) {
      state.menuState.footerText = text
      await nextTick()
      await vi.advanceTimersByTimeAsync(500)
    }
    await vi.advanceTimersByTimeAsync(1000)

    expect(storage.set).toHaveBeenCalledOnce()
    expect(savedDraft(storage).footerText).toBe('Pri')
  })

  it('does not write the same menu again', async () => {
    const storage = memoryStorage()
    const { state, draft } = setup(storage)
    draft.startAutosave()
    state.menuState.footerText = 'Prices in EUR'
    await afterSaveDelay()

    state.menuState.footerText = 'something else'
    await nextTick()
    state.menuState.footerText = 'Prices in EUR'
    await afterSaveDelay()

    expect(storage.set).toHaveBeenCalledOnce()
  })

  it('saves what the whole menu is made of', async () => {
    const storage = memoryStorage()
    const { state, draft } = setup(storage)
    draft.startAutosave()

    state.menuState.menuCsv = [createMenuItem({ id: 'a', name: { en: 'Spring Roll' } })]
    state.pageState.width = '148mm'
    useMenuTypography().textSizes.name = 13
    useMenuPhoto().showNameRing.value = false
    useMenuLang().primary.value = 'de'
    useIcons().addCustomOption('House Special', 'data:image/svg+xml,<svg/>')
    await afterSaveDelay()

    const saved = savedDraft(storage)
    expect(saved.items[0]!.name).toEqual({ en: 'Spring Roll' })
    expect(saved.page.width).toBe('148mm')
    expect(saved.textSizes.name).toBe(13)
    expect(saved.photo.showNameRing).toBe(false)
    expect(saved.lang.primary).toBe('de')
    expect(saved.icons.customOptions).toHaveProperty('House Special')
  })

  it('does not save when only the page being looked at changes', async () => {
    const storage = memoryStorage()
    const { state, draft } = setup(storage)
    draft.startAutosave()

    state.pageState.currentPage = 3
    await afterSaveDelay()

    expect(storage.set).not.toHaveBeenCalled()
  })

  it('leaves out the images and colours of a removed custom icon', async () => {
    const storage = memoryStorage()
    const { state, draft } = setup(storage)
    const { addCustomOption, removeCustomOption, setUserIcon, setUserColor } = useIcons()
    draft.startAutosave()

    addCustomOption('House Special', 'data:image/svg+xml,<svg/>')
    await setUserIcon('House Special', 'data:image/svg+xml,<svg/>')
    await setUserColor('House Special', '#ff0000')
    removeCustomOption('House Special')
    state.menuState.footerText = 'x'
    await afterSaveDelay()

    expect(savedDraft(storage).icons).toMatchObject({ userIcons: {}, userColors: {} })
  })

  it('saves at once when the page is hidden, so closing the tab keeps the last change', async () => {
    const storage = memoryStorage()
    const { state, draft } = setup(storage)
    draft.startAutosave()
    state.menuState.footerText = 'Prices in EUR'
    await nextTick()

    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    visibility.mockRestore()

    expect(storage.set).toHaveBeenCalledOnce()
    expect(savedDraft(storage).footerText).toBe('Prices in EUR')
  })

  it('saves a waiting change when the editor closes, and nothing after', async () => {
    const storage = memoryStorage()
    const { state, draft, wrapper } = setup(storage)
    draft.startAutosave()
    state.menuState.footerText = 'Prices in EUR'
    await nextTick()

    wrapper.unmount()
    await flushPromises()
    expect(storage.set).toHaveBeenCalledOnce()

    state.menuState.footerText = 'after'
    await afterSaveDelay()
    expect(storage.set).toHaveBeenCalledOnce()
  })

  it('says when a save failed, and saves again on the next change', async () => {
    const storage = memoryStorage()
    storage.set.mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'))
    const { state, draft } = setup(storage)
    draft.startAutosave()

    state.menuState.footerText = 'first'
    await afterSaveDelay()
    expect(draft.status.value).toBe('error')

    state.menuState.footerText = 'second'
    await afterSaveDelay()
    expect(draft.status.value).toBe('saved')
    expect(savedDraft(storage).footerText).toBe('second')
  })
})

describe('restore', () => {
  it('has nothing to restore on a first visit', async () => {
    const { draft } = setup(memoryStorage())

    expect(await draft.restore()).toBe(false)
    expect(draft.status.value).toBe('idle')
  })

  it('puts the saved menu back', async () => {
    const { state, draft } = setup(memoryStorage(JSON.stringify(savedMenu)))

    expect(await draft.restore()).toBe(true)
    await flushPromises()
    expect(draft.status.value).toBe('saved')

    const { menuState: m, pageState: p, uiState: u } = state
    expect(m.menuCsv.map((i) => i.id)).toEqual(['a', 'b'])
    expect(m.menuCsv[0]!.tags).toEqual(['House Special'])
    expect(u.csvUploaded).toBe(true)
    expect(m).toMatchObject({
      iconFilter: ['vegan'],
      footerText: 'Prices in EUR',
      logoBase64: 'data:image/png;base64,TOP',
      coverTitle: 'Lunch',
      coverSubtitle: 'Daily',
      coverLogoBase64: 'data:image/png;base64,COVER',
      itemSpacing: 'compact',
      selectedFont: 'Arial',
      bgColor: '#fdf6e3',
      textColor: '#333333',
    })
    expect(p).toMatchObject({
      width: '148mm',
      height: '210mm',
      itemsPerPage: 6,
      keepCategoryTogether: false,
      currentPage: 1, // the first menu page, which measures the room photos have
    })
    expect({ ...useMenuTypography().textSizes }).toEqual({
      category: 18,
      name: 13,
      description: 11,
    })
    const { photoSize, followMax, showNameRing } = useMenuPhoto()
    expect([photoSize.value, followMax.value, showNameRing.value]).toEqual([120, false, false])
    const { primary, extraNames } = useMenuLang()
    expect(primary.value).toBe('de')
    expect(extraNames.value).toEqual({ en: true, de: false, zh: false })

    const { customOptions, renamedLabels, userColors, iconMap } = useIcons()
    expect(Object.keys(customOptions.value)).toEqual(['House Special'])
    expect(renamedLabels.value).toEqual({ spicy: 'Hot' })
    expect(userColors.value).toEqual({ vegan: '#ff0000' })
    // The coloured icon is not saved; it is made again from the colour
    expect(decodeURIComponent(iconMap.value.vegan!)).toContain('fill="#ff0000"')
  })

  it('does not save the menu again straight after putting it back', async () => {
    const storage = memoryStorage(JSON.stringify(savedMenu))
    const { draft } = setup(storage)

    await draft.restore()
    draft.startAutosave()
    await afterSaveDelay()

    expect(storage.set).not.toHaveBeenCalled()
  })

  it('ignores a saved menu it cannot read, and saves over it', async () => {
    const storage = memoryStorage('{"version":1,')
    const { state, draft } = setup(storage)

    expect(await draft.restore()).toBe(false)
    draft.startAutosave()
    state.menuState.footerText = 'new'
    await afterSaveDelay()

    expect(savedDraft(storage).footerText).toBe('new')
  })

  it('carries on without saving where the browser has no storage', async () => {
    const storage = memoryStorage()
    storage.get.mockImplementation(() => {
      throw new ReferenceError('indexedDB is not defined') // what idb-keyval does, synchronously
    })
    const { state, draft } = setup(storage)

    expect(await draft.restore()).toBe(false)
    expect(draft.status.value).toBe('unavailable')

    draft.startAutosave()
    state.menuState.footerText = 'new'
    await afterSaveDelay()
    expect(storage.set).not.toHaveBeenCalled()
  })

  it('copes with the real IndexedDB storage missing, as it is in jsdom', async () => {
    const { draft } = setup(idbStorage())

    expect(await draft.restore()).toBe(false)
    expect(draft.status.value).toBe('unavailable')
  })

  it('stops waiting for storage that never answers, and does not save over what it holds', async () => {
    const storage = memoryStorage()
    storage.get.mockReturnValue(new Promise(() => {}))
    const { state, draft } = setup(storage, { readTimeoutMs: 2000 })

    const restoring = draft.restore()
    await vi.advanceTimersByTimeAsync(2000)
    expect(await restoring).toBe(false)
    expect(draft.status.value).toBe('unavailable')

    draft.startAutosave()
    state.menuState.footerText = 'new'
    await afterSaveDelay()
    expect(storage.set).not.toHaveBeenCalled()
  })
})

describe('reset', () => {
  it('puts every setting back to its default and removes custom icons', async () => {
    const { state, draft } = setup(memoryStorage(JSON.stringify(savedMenu)))
    await draft.restore()
    await flushPromises()

    await draft.reset()
    await flushPromises()

    const d = defaultDraft()
    expect(state.menuState).toMatchObject({
      menuCsv: [],
      iconFilter: [],
      footerText: d.footerText,
      logoBase64: null,
      coverTitle: d.cover.title,
      coverLogoBase64: null,
      itemSpacing: 'fill',
      selectedFont: d.style.font,
      bgColor: d.style.bgColor,
    })
    expect(state.pageState).toMatchObject({ width: '210mm', height: '297mm', itemsPerPage: 9 })
    expect(state.uiState.csvUploaded).toBe(false)
    expect({ ...useMenuTypography().textSizes }).toEqual(DEFAULT_TEXT_SIZES)
    expect(useMenuLang().primary.value).toBe('en')

    const { customOptions, renamedLabels, userColors, iconMap, defaultIcons } = useIcons()
    expect(customOptions.value).toEqual({})
    expect(renamedLabels.value).toEqual({})
    expect(userColors.value).toEqual({})
    expect(iconMap.value.vegan).toBe(defaultIcons.vegan) // no longer coloured
  })
})
