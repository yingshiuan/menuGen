import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TopBanner from '@/components/TopBanner.vue'

describe('TopBanner', () => {
  it('renders the default message', () => {
    const wrapper = mount(TopBanner)

    expect(wrapper.text()).toContain('First request may take a few seconds')
  })

  it('renders a custom message from props', () => {
    const wrapper = mount(TopBanner, { props: { message: 'Backend is waking up' } })

    expect(wrapper.text()).toContain('Backend is waking up')
  })

  it('hides itself when the close button is clicked', async () => {
    const wrapper = mount(TopBanner)

    await wrapper.get('button').trigger('click')

    expect(wrapper.find('span').exists()).toBe(false)
  })
})
