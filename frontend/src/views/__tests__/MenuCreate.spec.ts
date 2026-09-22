import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils'
import MenuCreate from '@/views/MenuCreate.vue'
import GeneratePdf from '@/components/GeneratePdf.vue'
import FontSelector from '@/components/controls/FontSelector.vue'
import IconFilterSelector from '@/components/controls/IconFilterSelector.vue'
import PageSizeSelector from '@/components/controls/PageSizeSelector.vue'
import { DRAFT_KEY } from '@/composables/useMenuDraft'
import { useIcons } from '@/composables/useIcons'
import { DEFAULT_EXTRA_NAMES, useMenuLang } from '@/composables/useMenuLang'
import { useMenuTypography } from '@/composables/useMenuTypography'
import { DEFAULT_PHOTO_SIZE, useMenuPhoto } from '@/composables/useMenuPhoto'
import { defaultDraft, type MenuDraft } from '@/domain/menuDraft'
import { createMenuItem } from '@/domain/menuItem'
import type { MenuItem } from '@/types/types'

// IndexedDB, as a Map: jsdom has none. Hoisted, because vi.mock runs before the imports.
const idb = vi.hoisted(() => ({ map: new Map<string, unknown>() }))
vi.mock('idb-keyval', () => ({
  createStore: () => 'store',
  get: async (key: string) => idb.map.get(key),
  set: async (key: string, value: unknown) => {
    idb.map.set(key, value)
  },
}))

const confirmMock = vi.fn(() => true)

const HOUSE_SPECIAL = 'data:image/svg+xml,<svg/>'

function savedMenu(overrides: Partial<MenuDraft> = {}): MenuDraft {
  return {
    ...defaultDraft(),
    items: [
      // "House Special" is switched off on the first dish and on for the second
      createMenuItem({ id: 'a', no: '1', name: { en: 'Spring Roll' }, tags: [] }),
      createMenuItem({ id: 'b', no: '2', name: { en: 'Rice' }, tags: ['House Special'] }),
    ],
    csvUploaded: true,
    style: { font: 'Arial', bgColor: '#fdf6e3', textColor: '#333333' },
    page: { ...defaultDraft().page, width: '148mm', height: '210mm' },
    icons: {
      customOptions: { 'House Special': HOUSE_SPECIAL },
      renamedLabels: {},
      userIcons: {},
      userColors: {},
    },
    ...overrides,
  }
}

const mounted: VueWrapper[] = []

async function openEditor() {
  // The real PanelSection, so the controls inside the panels render (as stubs)
  const wrapper = shallowMount(MenuCreate, { global: { stubs: { PanelSection: false } } })
  mounted.push(wrapper)
  await flushPromises() // reading the saved menu, and the tick it waits for
  return wrapper
}

const dishes = (wrapper: VueWrapper) =>
  wrapper.findComponent(IconFilterSelector).props('items') as MenuItem[]

const startNewMenuButton = (wrapper: VueWrapper) =>
  wrapper.findAll('button').find((b) => b.text() === 'Start new menu')!

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  vi.stubGlobal('confirm', confirmMock)
  confirmMock.mockClear()
  confirmMock.mockReturnValue(true)
  idb.map.clear()

  // Module-scope state would otherwise carry over from the previous test
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
  vi.unstubAllGlobals()
})

describe('MenuCreate, saved in the browser', () => {
  it('shows the sample menu on a first visit', async () => {
    const wrapper = await openEditor()

    expect(dishes(wrapper)).toHaveLength(4)
    expect(wrapper.findComponent(GeneratePdf).props('noCsv')).toBe(true)
  })

  it('puts the saved menu back instead of the sample', async () => {
    idb.map.set(DRAFT_KEY, JSON.stringify(savedMenu()))

    const wrapper = await openEditor()

    expect(dishes(wrapper).map((d) => d.id)).toEqual(['a', 'b'])
    expect(wrapper.findComponent(FontSelector).props('font')).toBe('Arial')
    expect(wrapper.findComponent(PageSizeSelector).props()).toMatchObject({
      width: '148mm',
      height: '210mm',
    })
    // It was made from a CSV, so exporting it needs no warning
    expect(wrapper.findComponent(GeneratePdf).props('noCsv')).toBe(false)
  })

  it('keeps a custom icon off on the dishes it was off on', async () => {
    idb.map.set(DRAFT_KEY, JSON.stringify(savedMenu()))

    const wrapper = await openEditor()

    // A newly added custom icon is switched on for every dish; restoring must not count
    expect(dishes(wrapper).map((d) => d.tags)).toEqual([[], ['House Special']])
  })

  it('keeps a change for the next visit', async () => {
    const first = await openEditor()
    first.findComponent(FontSelector).vm.$emit('update:font', 'Times New Roman')
    await vi.advanceTimersByTimeAsync(1000)
    expect(first.text()).toContain('Saved in this browser')
    first.unmount()

    const second = await openEditor()

    expect(second.findComponent(FontSelector).props('font')).toBe('Times New Roman')
  })

  it('asks before starting a new menu, and keeps the menu on Cancel', async () => {
    idb.map.set(DRAFT_KEY, JSON.stringify(savedMenu()))
    confirmMock.mockReturnValue(false)
    const wrapper = await openEditor()

    await startNewMenuButton(wrapper).trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledOnce()
    expect(dishes(wrapper).map((d) => d.id)).toEqual(['a', 'b'])
    expect(wrapper.findComponent(FontSelector).props('font')).toBe('Arial')
  })

  it('starts a new menu as a first visit would, and saves that', async () => {
    idb.map.set(DRAFT_KEY, JSON.stringify(savedMenu()))
    const wrapper = await openEditor()

    await startNewMenuButton(wrapper).trigger('click')
    await flushPromises()

    expect(dishes(wrapper)).toHaveLength(4)
    expect(dishes(wrapper).every((d) => !d.tags.includes('House Special'))).toBe(true)
    expect(wrapper.findComponent(FontSelector).props('font')).toBe('Sans-Serif')
    expect(wrapper.findComponent(PageSizeSelector).props()).toMatchObject({
      width: '210mm',
      height: '297mm',
    })
    expect(wrapper.findComponent(GeneratePdf).props('noCsv')).toBe(true)
    expect(useIcons().customOptions.value).toEqual({})

    await vi.advanceTimersByTimeAsync(1000)
    const saved = JSON.parse(idb.map.get(DRAFT_KEY) as string)
    expect(saved.items).toHaveLength(4)
    expect(saved.style.font).toBe('Sans-Serif')
  })
})
