import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CsvUpload from '@/components/CsvUpload.vue'
import { useIcons } from '@/composables/useIcons'
import { useMenuStore } from '@/stores/menu'
import type { MenuItem } from '@/types/types'
import { createMenuItem } from '@/domain/menuItem'

const HEADER = 'No.,Price,Name,Measure,Chinese Name,Description,Spicy,House Special'
const CSV = [
  HEADER,
  ',,Mains,,,,,', // category row: no No./Price, only a Name
  '1,12.50,Kung Pao Chicken,plate,宫保鸡丁,With peanuts,X,',
  ',,Sides,,,,,',
  '2,3.00,Steamed Rice,bowl,米饭,,,X',
].join('\n')

const alertMock = vi.fn()
const createObjectURL = vi.fn((_blob: Blob) => 'blob:menu-csv')
const revokeObjectURL = vi.fn()
const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('alert', alertMock)
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
  vi.clearAllMocks()

  // useIcons keeps its state in module scope, so it leaks between tests unless reset
  const { customOptions, renamedLabels } = useIcons()
  customOptions.value = {}
  renamedLabels.value = {}
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function csvFile(content = CSV, name = 'menu.csv') {
  return new File([content], name, { type: 'text/csv' })
}

function mountCsv(items: MenuItem[] = []) {
  return mount(CsvUpload, { props: { items } })
}

/** Drive the hidden <input type="file">; jsdom has no DataTransfer to assign `files` normally. */
async function selectFile(wrapper: VueWrapper, file: File) {
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
}

/** jsdom's Blob has no .text(), so read it the way the browser API allows. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

/** papaparse reads the File through FileReader, so the results arrive asynchronously. */
function emittedItems(wrapper: VueWrapper) {
  return vi.waitFor(() => {
    const events = wrapper.emitted('csvLoaded')
    expect(events).toBeTruthy()
    return events![0]![0] as MenuItem[]
  })
}

describe('upload', () => {
  it('prompts for a file and then shows the chosen file name', async () => {
    const wrapper = mountCsv()
    expect(wrapper.text()).toContain('Upload CSV')

    await selectFile(wrapper, csvFile())

    expect(wrapper.text()).toContain('menu.csv')
    expect(wrapper.text()).not.toContain('Upload CSV')
  })

  it('maps data rows to MenuItems and emits them', async () => {
    const wrapper = mountCsv()
    await selectFile(wrapper, csvFile())

    const items = await emittedItems(wrapper)

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      no: '1',
      price: '12.50',
      name: { en: 'Kung Pao Chicken', zh: '宫保鸡丁' },
      measure: 'plate',
      description: { en: 'With peanuts' },
    })
    expect(items.every((i) => i.id.length > 0)).toBe(true)
  })

  it('defaults the category when a dish appears before any category row', async () => {
    const wrapper = mountCsv()
    await selectFile(wrapper, csvFile([HEADER, '1,8.00,Spring Roll,,春卷,,,'].join('\n')))

    const items = await emittedItems(wrapper)

    expect(items[0]!.category).toEqual({})
  })

  it('keeps a quoted comma inside a description in one field', async () => {
    const wrapper = mountCsv()
    const row = '1,12.50,Kung Pao Chicken,plate,宫保鸡丁,"With peanuts, chilli and rice",X,'
    await selectFile(wrapper, csvFile([HEADER, row].join('\n')))

    const items = await emittedItems(wrapper)

    // a naive split(',') would spill the description across Spicy/House Special
    expect(items).toHaveLength(1)
    expect(items[0]!.description.en).toBe('With peanuts, chilli and rice')
    expect(items[0]!.dietary.spicy).toBe(true)
    expect(items[0]!.tags).toEqual([])
  })

  it('treats a name-only row as a category header for the rows beneath it', async () => {
    const wrapper = mountCsv()
    await selectFile(wrapper, csvFile())

    const items = await emittedItems(wrapper)

    expect(items.map((i) => i.category.en)).toEqual(['Mains', 'Sides'])
  })

  it('derives dietary flags and custom tags from the non-empty option columns', async () => {
    const wrapper = mountCsv()
    await selectFile(wrapper, csvFile())

    const items = await emittedItems(wrapper)

    expect(items[0]!.dietary.spicy).toBe(true)
    expect(items[0]!.tags).toEqual([])
    expect(items[1]!.dietary.spicy).toBe(false)
    expect(items[1]!.tags).toEqual(['House Special'])
  })

  it('registers unknown option columns as custom icons', async () => {
    const { iconMap } = useIcons()
    expect(Object.keys(iconMap.value)).not.toContain('House Special')

    const wrapper = mountCsv()
    await selectFile(wrapper, csvFile())
    await emittedItems(wrapper)

    expect(Object.keys(iconMap.value)).toContain('House Special')
    expect(iconMap.value['House Special']).toMatch(/^data:image\/svg\+xml/)
  })

  it('writes the parsed items into the menu store', async () => {
    const wrapper = mountCsv()
    const store = useMenuStore()

    await selectFile(wrapper, csvFile())
    await emittedItems(wrapper)

    expect(store.items).toHaveLength(2)
    expect(store.items[1]!.name.en).toBe('Steamed Rice')
  })

  it('accepts a dropped file and clears the drag highlight', async () => {
    const wrapper = mountCsv()
    const dropzone = wrapper.get('div.border-dashed')

    await dropzone.trigger('dragover')
    expect(dropzone.classes()).toContain('border-blue-500')

    await dropzone.trigger('drop', { dataTransfer: { files: [csvFile(CSV, 'dropped.csv')] } })

    expect(dropzone.classes()).not.toContain('border-blue-500')
    expect(wrapper.text()).toContain('dropped.csv')
    expect(await emittedItems(wrapper)).toHaveLength(2)
  })

  it('refuses a file that is not a CSV and leaves the menu alone', async () => {
    const wrapper = mountCsv()

    await selectFile(wrapper, new File(['\x89PNG'], 'dish.png', { type: 'image/png' }))

    expect(alertMock).toHaveBeenCalledWith(
      '“dish.png” is not a CSV file. Please upload a .csv file.',
    )
    expect(wrapper.text()).toContain('Upload CSV')
    expect(wrapper.emitted('csvLoaded')).toBeUndefined()
  })

  it('refuses a dropped file too, which the picker filter never sees', async () => {
    const wrapper = mountCsv()
    const numbers = new File(['PK'], 'menu-2026.numbers')

    await wrapper.get('div.border-dashed').trigger('drop', { dataTransfer: { files: [numbers] } })

    expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('File → Export To → CSV'))
    expect(wrapper.text()).not.toContain('menu-2026.numbers')
    expect(wrapper.emitted('csvLoaded')).toBeUndefined()
  })

  it('points an Excel file at Save As CSV', async () => {
    const wrapper = mountCsv()

    await selectFile(wrapper, new File(['PK'], 'menu.xlsx'))

    expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Save As → CSV UTF-8'))
    expect(wrapper.emitted('csvLoaded')).toBeUndefined()
  })

  it('accepts a CSV whatever case its extension is in', async () => {
    const wrapper = mountCsv()

    await selectFile(wrapper, csvFile(CSV, 'MENU.CSV'))

    expect(alertMock).not.toHaveBeenCalled()
    expect(await emittedItems(wrapper)).toHaveLength(2)
  })

  it('ignores a drop that carries no file', async () => {
    const wrapper = mountCsv()

    await wrapper.get('div.border-dashed').trigger('drop', { dataTransfer: { files: [] } })

    expect(wrapper.emitted('csvLoaded')).toBeUndefined()
  })
})

describe('export', () => {
  const items: MenuItem[] = [
    createMenuItem({
      id: 'a',
      no: '1',
      price: '12.50',
      measure: 'plate',
      name: { en: 'Kung Pao Chicken', zh: '宫保鸡丁' },
      description: { en: 'With peanuts' },
      category: { en: 'Mains' },
      dietary: { ...createMenuItem().dietary, spicy: true },
    }),
  ]

  function exportButton(wrapper: VueWrapper) {
    return wrapper.findAll('button').find((b) => b.text() === 'Export CSV')!
  }

  it('warns instead of downloading when there is nothing to export', async () => {
    const wrapper = mountCsv([])

    await exportButton(wrapper).trigger('click')

    expect(alertMock).toHaveBeenCalledWith('No data to export')
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('downloads menu-output.csv built from the current items', async () => {
    const wrapper = mountCsv(items)

    await exportButton(wrapper).trigger('click')

    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0]![0]
    expect(blob.type).toContain('text/csv')
    await expect(readBlob(blob)).resolves.toContain('Kung Pao Chicken')

    expect(anchorClick).toHaveBeenCalledOnce()
    const anchor = anchorClick.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe('menu-output.csv')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:menu-csv')
  })

  it('keeps the canonical dietary header when the label is renamed, so it re-imports', async () => {
    const { renameOption } = useIcons()
    renameOption('spicy', '🌶️ Hot')
    const wrapper = mountCsv(items)

    await exportButton(wrapper).trigger('click')

    const header = (await readBlob(createObjectURL.mock.calls[0]![0])).split('\r\n')[0]!
    expect(header.split(',')).toContain('Spicy')
    expect(header).not.toContain('🌶️ Hot')
  })

  it('adds a column for each custom icon', async () => {
    const { addCustomOption } = useIcons()
    addCustomOption('House Special', 'data:image/svg+xml,<svg/>')
    const wrapper = mountCsv([{ ...items[0]!, tags: ['House Special'] }])

    await exportButton(wrapper).trigger('click')

    const [header, , row] = (await readBlob(createObjectURL.mock.calls[0]![0])).split('\r\n')
    expect(header!.split(',').pop()).toBe('House Special')
    expect(row!.split(',').pop()).toBe('X')
  })
})
