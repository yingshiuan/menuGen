import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CsvUpload from '@/components/CsvUpload.vue'
import { useIcons } from '@/composables/useIcons'
import { useMenuStore } from '@/stores/menu'
import type { MenuItem } from '@/types/types'

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
    expect(wrapper.text()).toContain('Please upload a CSV file.')

    await selectFile(wrapper, csvFile())

    expect(wrapper.text()).toContain('menu.csv')
    expect(wrapper.text()).not.toContain('Please upload a CSV file.')
  })

  it('maps data rows to MenuItems and emits them', async () => {
    const wrapper = mountCsv()
    await selectFile(wrapper, csvFile())

    const items = await emittedItems(wrapper)

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      No: '1',
      Price: '12.50',
      Name: 'Kung Pao Chicken',
      Measure: 'plate',
      ChineseName: '宫保鸡丁',
      Description: 'With peanuts',
    })
    expect(items.every((i) => i.id.length > 0)).toBe(true)
  })

  it('defaults the category when a dish appears before any category row', async () => {
    const wrapper = mountCsv()
    await selectFile(wrapper, csvFile([HEADER, '1,8.00,Spring Roll,,春卷,,,'].join('\n')))

    const items = await emittedItems(wrapper)

    expect(items[0]!.Category).toBe('Uncategorized')
  })

  it('keeps a quoted comma inside a description in one field', async () => {
    const wrapper = mountCsv()
    const row = '1,12.50,Kung Pao Chicken,plate,宫保鸡丁,"With peanuts, chilli and rice",X,'
    await selectFile(wrapper, csvFile([HEADER, row].join('\n')))

    const items = await emittedItems(wrapper)

    // a naive split(',') would spill the description across Spicy/House Special
    expect(items).toHaveLength(1)
    expect(items[0]!.Description).toBe('With peanuts, chilli and rice')
    expect(items[0]!.Options).toEqual(['Spicy'])
  })

  it('treats a name-only row as a category header for the rows beneath it', async () => {
    const wrapper = mountCsv()
    await selectFile(wrapper, csvFile())

    const items = await emittedItems(wrapper)

    expect(items.map((i) => i.Category)).toEqual(['Mains', 'Sides'])
  })

  it('derives Options from the non-empty option columns', async () => {
    const wrapper = mountCsv()
    await selectFile(wrapper, csvFile())

    const items = await emittedItems(wrapper)

    expect(items[0]!.Options).toEqual(['Spicy'])
    expect(items[1]!.Options).toEqual(['House Special'])
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
    expect(store.items[1]!.Name).toBe('Steamed Rice')
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

  it('ignores a drop that carries no file', async () => {
    const wrapper = mountCsv()

    await wrapper.get('div.border-dashed').trigger('drop', { dataTransfer: { files: [] } })

    expect(wrapper.emitted('csvLoaded')).toBeUndefined()
  })
})

describe('export', () => {
  const items: MenuItem[] = [
    {
      id: 'a',
      No: '1',
      Price: '12.50',
      Name: 'Kung Pao Chicken',
      Measure: 'plate',
      ChineseName: '宫保鸡丁',
      Description: 'With peanuts',
      Options: ['Spicy'],
      Category: 'Mains',
    },
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

  it('uses renamed option labels in the exported header', async () => {
    const { renameOption } = useIcons()
    renameOption('Spicy', '🌶️ Hot')
    const wrapper = mountCsv(items)

    await exportButton(wrapper).trigger('click')

    const blob = createObjectURL.mock.calls[0]![0]
    await expect(readBlob(blob)).resolves.toContain('🌶️ Hot')
  })
})
