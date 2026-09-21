import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotoSizeControl from '@/components/controls/PhotoSizeControl.vue'
import { useMenuPhoto } from '@/composables/useMenuPhoto'

// The photo state lives in module scope; start each test from a menu whose average page
// fits 114px photos, with the size at that maximum
beforeEach(() => {
  const { photoSize, maxPhotoSize, followMax } = useMenuPhoto()
  maxPhotoSize.value = 114
  photoSize.value = 114
  followMax.value = true
})

function input() {
  return mount(PhotoSizeControl).get('input')
}

describe('PhotoSizeControl', () => {
  it('stops the box at the size that fits the average page', () => {
    expect((input().element as HTMLInputElement).max).toBe('114')
  })

  it('snaps a typed size above the maximum back to it', async () => {
    const box = input()
    await box.setValue('150')
    await box.trigger('change')

    const { photoSize, followMax } = useMenuPhoto()
    expect(photoSize.value).toBe(114)
    expect(followMax.value).toBe(true)
  })

  it('keeps a smaller size, which then no longer follows the maximum', async () => {
    const box = input()
    await box.setValue('96')
    await box.trigger('change')

    const { photoSize, followMax } = useMenuPhoto()
    expect(photoSize.value).toBe(96)
    expect(followMax.value).toBe(false)
  })

  it('does not go below 80px', async () => {
    const box = input()
    await box.setValue('40')
    await box.trigger('change')

    expect(useMenuPhoto().photoSize.value).toBe(80)
  })

  it('is locked when "Fill page" is off', () => {
    const box = mount(PhotoSizeControl, { props: { disabled: true } }).get('input')
    expect((box.element as HTMLInputElement).disabled).toBe(true)
  })

  it('turns the name around the photo off and on, also with "Compact"', async () => {
    const { showNameRing } = useMenuPhoto()
    showNameRing.value = true
    const checkbox = mount(PhotoSizeControl, { props: { disabled: true } }).get(
      'input[type="checkbox"]',
    )
    expect((checkbox.element as HTMLInputElement).disabled).toBe(false)

    await checkbox.setValue(false)
    expect(showNameRing.value).toBe(false)
    await checkbox.setValue(true)
    expect(showNameRing.value).toBe(true)
  })
})
