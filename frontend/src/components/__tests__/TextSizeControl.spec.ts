import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TextSizeControl from '@/components/controls/TextSizeControl.vue'
import { DEFAULT_TEXT_SIZES, useMenuTypography } from '@/composables/useMenuTypography'

// The sizes live in module scope, so reset them between tests
beforeEach(() => useMenuTypography().resetTextSizes())

function inputs() {
  const wrapper = mount(TextSizeControl)
  const [category, name, description] = wrapper.findAll('input')
  return { wrapper, category: category!, name: name!, description: description! }
}

describe('TextSizeControl', () => {
  it('starts at the default sizes', () => {
    const { category, name, description } = inputs()

    expect(Number((category.element as HTMLInputElement).value)).toBe(DEFAULT_TEXT_SIZES.category)
    expect(Number((name.element as HTMLInputElement).value)).toBe(DEFAULT_TEXT_SIZES.name)
    expect(Number((description.element as HTMLInputElement).value)).toBe(
      DEFAULT_TEXT_SIZES.description,
    )
  })

  it('sets the size used on the menu, in pt', async () => {
    const { name } = inputs()

    await name.setValue('14')
    await name.trigger('change')

    expect(useMenuTypography().fontSize('name')).toEqual({ fontSize: '14pt' })
  })

  it('keeps a typed size within its allowed range', async () => {
    const { category, description } = inputs()

    await category.setValue('99')
    await category.trigger('change')
    await description.setValue('1')
    await description.trigger('change')

    expect(useMenuTypography().textSizes).toMatchObject({ category: 30, description: 6 })
  })

  it('limits the dish name to 8–14 pt', async () => {
    const { name } = inputs()
    const input = name.element as HTMLInputElement
    expect([input.min, input.max]).toEqual(['8', '14'])

    await name.setValue('18')
    await name.trigger('change')
    expect(useMenuTypography().textSizes.name).toBe(14)

    await name.setValue('6')
    await name.trigger('change')
    expect(useMenuTypography().textSizes.name).toBe(8)
  })

  it('falls back to the default when the field is cleared', async () => {
    const { category } = inputs()

    await category.setValue('')
    await category.trigger('change')

    expect(useMenuTypography().textSizes.category).toBe(DEFAULT_TEXT_SIZES.category)
  })

  it('resets every size', async () => {
    const { wrapper, name } = inputs()
    await name.setValue('20')

    await wrapper.get('button').trigger('click')

    expect(useMenuTypography().textSizes).toEqual(DEFAULT_TEXT_SIZES)
  })
})
