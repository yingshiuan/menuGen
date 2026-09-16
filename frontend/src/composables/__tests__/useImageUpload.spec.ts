import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useImageUpload } from '@/composables/useImageUpload'

// jsdom has no real alert(); stub it so the invalid-file path is observable
const alertSpy = vi.fn()

// jsdom has no canvas and never fires Image.onload, so the compression step
// uploads now go through needs both stubbed
class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  width = 2400
  height = 1600
  set src(value: string) {
    // a file whose bytes are 'corrupt' decodes to nothing, like a renamed .txt
    queueMicrotask(() => (value.includes(btoa('corrupt')) ? this.onerror?.() : this.onload?.()))
  }
}

beforeEach(() => {
  vi.stubGlobal('alert', alertSpy)
  vi.stubGlobal('Image', MockImage)
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,AAA')
  alertSpy.mockClear()
})

function pngFile() {
  return new File(['fake-bytes'], 'dish.png', { type: 'image/png' })
}

function dropEvent(file?: File) {
  return {
    preventDefault: vi.fn(),
    dataTransfer: { files: file ? [file] : [] },
  } as unknown as DragEvent
}

describe('useImageUpload', () => {
  it('seeds state from the initial value', () => {
    const { pictureBase64, pictureVisible } = useImageUpload(
      'data:image/png;base64,AAA',
      false,
      vi.fn(),
    )

    expect(pictureBase64.value).toBe('data:image/png;base64,AAA')
    expect(pictureVisible.value).toBe(true)
  })

  it('compresses a dropped image and emits it as a jpeg', async () => {
    const emit = vi.fn()
    const { handleDrop, pictureVisible, isDragging } = useImageUpload(null, false, emit)

    handleDrop(dropEvent(pngFile()))

    // FileReader.onload is async — wait for the emit instead of guessing a timeout
    await vi.waitFor(() => expect(emit).toHaveBeenCalledTimes(1))
    // A raw readAsDataURL would emit the original png; the payload posted to the
    // PDF service has to be the re-encoded, downscaled version.
    expect(emit.mock.calls[0]![0]).toMatch(/^data:image\/jpeg;base64,/)
    expect(pictureVisible.value).toBe(true)
    expect(isDragging.value).toBe(false)
  })

  it('reports an image-typed file that cannot be decoded', async () => {
    const emit = vi.fn()
    const { handleDrop, pictureVisible } = useImageUpload(null, false, emit)

    handleDrop(dropEvent(new File(['corrupt'], 'dish.png', { type: 'image/png' })))

    await vi.waitFor(() => expect(alertSpy).toHaveBeenCalledOnce())
    expect(emit).not.toHaveBeenCalled()
    expect(pictureVisible.value).toBe(false)
  })

  it('rejects a non-image file', async () => {
    const emit = vi.fn()
    const { handleDrop } = useImageUpload(null, false, emit)

    handleDrop(dropEvent(new File(['x'], 'menu.pdf', { type: 'application/pdf' })))

    expect(alertSpy).toHaveBeenCalledOnce()
    expect(emit).not.toHaveBeenCalled()
  })

  it('ignores drag and drop in readonly mode', () => {
    const onDragStateChange = vi.fn()
    const emit = vi.fn()
    const { handleDragOver, handleDrop, isDragging } = useImageUpload(
      null,
      true,
      emit,
      onDragStateChange,
    )

    handleDragOver(dropEvent())
    handleDrop(dropEvent(pngFile()))

    expect(isDragging.value).toBe(false)
    expect(onDragStateChange).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it('clears state and emits an empty string on delete', () => {
    const emit = vi.fn()
    const { deletePicture, pictureBase64, pictureVisible } = useImageUpload('data:x', false, emit)

    deletePicture()

    expect(pictureBase64.value).toBe('')
    expect(pictureVisible.value).toBe(false)
    expect(emit).toHaveBeenCalledWith('')
  })
})
