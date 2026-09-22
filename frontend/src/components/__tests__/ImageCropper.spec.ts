import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ImageCropper from '@/components/ImageCropper.vue'

const alertMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('alert', alertMock)
  alertMock.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function mountCropper() {
  // The crop window is teleported to <body>
  return mount(ImageCropper, { attachTo: document.body, props: { variant: 'cover' } })
}

function drop(wrapper: ReturnType<typeof mountCropper>, file: File) {
  return wrapper.get('div').trigger('drop', { dataTransfer: { files: [file] } })
}

describe('ImageCropper', () => {
  it('refuses a dropped file that is not an image', async () => {
    const wrapper = mountCropper()

    await drop(wrapper, new File(['No.,Price'], 'menu.csv', { type: 'text/csv' }))

    expect(alertMock).toHaveBeenCalledWith('Please upload a valid image file')
    expect(document.body.querySelector('.modal')).toBeNull()
  })

  it('opens the crop window for a dropped image', async () => {
    const wrapper = mountCropper()

    await drop(wrapper, new File(['fake-bytes'], 'logo.png', { type: 'image/png' }))

    // FileReader is async, so wait for the window rather than guess a delay
    await vi.waitFor(() => expect(document.body.querySelector('.modal')).not.toBeNull())
    expect(alertMock).not.toHaveBeenCalled()
  })
})
