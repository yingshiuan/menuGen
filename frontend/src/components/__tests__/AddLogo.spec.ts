import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AddLogo from '@/components/AddLogo.vue'
import ImageCropper from '@/components/ImageCropper.vue'

describe('AddLogo', () => {
  const shown = (wrapper: ReturnType<typeof shallowMount>) =>
    wrapper.findComponent(ImageCropper).props('modelValue')

  it('shows the logo it is given', () => {
    const wrapper = shallowMount(AddLogo, { props: { defaultSrc: 'data:image/png;base64,A' } })

    expect(shown(wrapper)).toBe('data:image/png;base64,A')
  })

  it('follows the menu when its logo is replaced or cleared', async () => {
    const wrapper = shallowMount(AddLogo, { props: { defaultSrc: 'data:image/png;base64,A' } })

    await wrapper.setProps({ defaultSrc: 'data:image/png;base64,B' })
    expect(shown(wrapper)).toBe('data:image/png;base64,B')

    // "Start new menu" clears it
    await wrapper.setProps({ defaultSrc: '' })
    expect(shown(wrapper)).toBe('')
  })
})
