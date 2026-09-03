import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMultiImageUpload } from '@/composables/useMultiImageUpload'
import type { MenuItem } from '@/types/types'

// jsdom has no canvas and never fires Image.onload, so compressImage needs both stubbed
class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  width = 400
  height = 300
  set src(value: string) {
    // a file whose bytes are 'corrupt' decodes to nothing, like a renamed .txt
    queueMicrotask(() => (value.includes(btoa('corrupt')) ? this.onerror?.() : this.onload?.()))
  }
}

beforeEach(() => {
  vi.stubGlobal('Image', MockImage)
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,AAA')
})

function dish(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'a',
    No: '1',
    Price: '10',
    Name: 'Spring Roll',
    Measure: '',
    ChineseName: '春捲',
    Options: [],
    Category: 'Starters',
    ...overrides,
  }
}

function imageFile(name: string) {
  return new File(['bytes'], name, { type: 'image/png' })
}

function setup(menuItems: MenuItem[] = [dish()]) {
  const emit = vi.fn()
  return { emit, ...useMultiImageUpload({ menuItems }, emit as never) }
}

describe('useMultiImageUpload', () => {
  it('reports an image whose filename matches no dish instead of dropping it silently', async () => {
    const { handleFiles, skippedFiles, lastBatchSize, emit } = setup()

    await handleFiles([imageFile('99_Nasi Lemak.png')])

    expect(emit).not.toHaveBeenCalled()
    expect(lastBatchSize.value).toBe(1)
    expect(skippedFiles.value).toEqual([{ name: '99_Nasi Lemak.png', reason: 'no-match' }])
  })

  it('reports a non-image file', async () => {
    const { handleFiles, skippedFiles } = setup()

    await handleFiles([new File(['x'], 'notes.pdf', { type: 'application/pdf' })])

    expect(skippedFiles.value).toEqual([{ name: 'notes.pdf', reason: 'not-an-image' }])
  })

  it('counts only the misses in a mixed batch', async () => {
    const { handleFiles, skippedFiles, lastBatchSize, emit } = setup()

    await handleFiles([imageFile('1_Spring Roll.png'), imageFile('unmatched.png')])

    expect(emit).toHaveBeenCalledTimes(1)
    expect(lastBatchSize.value).toBe(2)
    expect(skippedFiles.value.map((f) => f.name)).toEqual(['unmatched.png'])
  })

  it('matches the zero-padded and bare filename forms', async () => {
    const { handleFiles, skippedFiles, emit } = setup([dish(), dish({ id: 'b', No: '2', Name: 'Laksa' })])

    await handleFiles([imageFile('01_Spring Roll.png'), imageFile('Laksa.png')])

    expect(skippedFiles.value).toEqual([])
    expect(emit).toHaveBeenCalledTimes(2)
  })

  it('reports an undecodable image instead of hanging the batch forever', async () => {
    // the filename matches a dish, so only the decode can fail here
    const { handleFiles, skippedFiles, imageState, emit } = setup()

    await handleFiles([new File(['corrupt'], '1_Spring Roll.png', { type: 'image/png' })])

    expect(emit).not.toHaveBeenCalled()
    expect(skippedFiles.value).toEqual([{ name: '1_Spring Roll.png', reason: 'not-readable' }])
    expect(imageState.isUploading).toBe(false)
  })

  it('lets the good files through when one file in the batch is undecodable', async () => {
    const { handleFiles, skippedFiles, imageState, emit } = setup()

    await handleFiles([
      new File(['corrupt'], 'broken.png', { type: 'image/png' }),
      imageFile('1_Spring Roll.png'),
    ])

    expect(emit).toHaveBeenCalledTimes(1)
    expect(skippedFiles.value.map((f) => f.reason)).toEqual(['not-readable'])
    expect(imageState.isUploading).toBe(false)
  })

  it('clears the previous report on the next batch and on dismiss', async () => {
    const { handleFiles, skippedFiles, dismissSkipped } = setup()

    await handleFiles([imageFile('unmatched.png')])
    expect(skippedFiles.value).toHaveLength(1)

    await handleFiles([imageFile('1_Spring Roll.png')])
    expect(skippedFiles.value).toEqual([])

    await handleFiles([imageFile('unmatched.png')])
    dismissSkipped()
    expect(skippedFiles.value).toEqual([])
  })
})
