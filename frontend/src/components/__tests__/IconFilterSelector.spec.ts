import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import IconFilterSelector from '@/components/controls/IconFilterSelector.vue'
import { createMenuItem, emptyDietary } from '@/domain/menuItem'
import type { Dietary } from '@/types/types'

const dish = (dietary: Partial<Dietary>) =>
  createMenuItem({ dietary: { ...emptyDietary(), ...dietary } })

const items = [
  dish({ vegetarian: true }),
  dish({ vegan: true, gluten_free: true }),
  dish({ spicy: true }),
]

function mountFilter(modelValue: string[] = []) {
  const wrapper = mount(IconFilterSelector, { props: { modelValue, items } })
  const option = (label: string) => wrapper.findAll('label').find((l) => l.text().includes(label))!
  return { wrapper, option }
}

describe('IconFilterSelector', () => {
  it('offers a checkbox with its icon for every menu icon', () => {
    const { wrapper, option } = mountFilter()

    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(5)
    expect(option('Vegan').find('img').attributes('src')).toMatch(/^data:image\/svg\+xml/)
  })

  it('counts the dishes with each icon, vegan ones as vegetarian', () => {
    const { option } = mountFilter()

    expect(option('Vegetarian').text()).toMatch(/2$/)
    expect(option('Vegan').text()).toMatch(/1$/)
    expect(option('Recommended').text()).toMatch(/0$/)
  })

  it('shows the ticked icons as checked', () => {
    const { option } = mountFilter(['vegan'])

    expect((option('Vegan').find('input').element as HTMLInputElement).checked).toBe(true)
    expect((option('Spicy').find('input').element as HTMLInputElement).checked).toBe(false)
  })

  it('adds a ticked icon to the ones already ticked', async () => {
    const { wrapper, option } = mountFilter(['vegan'])

    await option('Gluten Free').find('input').setValue(true)

    expect(wrapper.emitted('update:modelValue')).toEqual([[['vegan', 'gluten_free']]])
  })

  it('drops an unticked icon', async () => {
    const { wrapper, option } = mountFilter(['vegan', 'gluten_free'])

    await option('Vegan').find('input').setValue(false)

    expect(wrapper.emitted('update:modelValue')).toEqual([[['gluten_free']]])
  })

  it('says how many dishes carry any ticked icon', () => {
    expect(mountFilter(['vegan', 'spicy']).wrapper.text()).toContain(
      'Dishes with any ticked icon: 2 of 3',
    )
    expect(mountFilter().wrapper.text()).not.toContain('Dishes with any ticked icon')
  })
})
