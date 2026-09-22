import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PageSizeSelector from '@/components/controls/PageSizeSelector.vue'

function mountSelector(width = '210mm', height = '297mm') {
  return mount(PageSizeSelector, { props: { width, height } })
}

const paper = (wrapper: ReturnType<typeof mountSelector>) =>
  (wrapper.get('select').element as HTMLSelectElement).value

const customSize = (wrapper: ReturnType<typeof mountSelector>) =>
  (wrapper.get('input[type="checkbox"]').element as HTMLInputElement).checked

describe('PageSizeSelector', () => {
  it('changes nothing just by appearing', () => {
    const wrapper = mountSelector('148mm', '210mm')

    expect(wrapper.emitted()).not.toHaveProperty('update:width')
    expect(wrapper.emitted()).not.toHaveProperty('update:height')
  })

  it.each([
    ['210mm', '297mm', 'A4'],
    ['148mm', '210mm', 'A5'],
    ['1000mm', '1414mm', 'B0'],
  ])('shows %s × %s as %s', (width, height, name) => {
    const wrapper = mountSelector(width, height)

    expect(paper(wrapper)).toBe(name)
    expect(customSize(wrapper)).toBe(false)
  })

  it('shows a size no paper has as a custom size', () => {
    const wrapper = mountSelector('300mm', '400mm')

    expect(paper(wrapper)).toBe('')
    expect(customSize(wrapper)).toBe(true)
    expect(wrapper.findAll('input[type="number"]')).toHaveLength(2)
  })

  it('follows a size set from outside, as a restored menu sets it', async () => {
    const wrapper = mountSelector()

    await wrapper.setProps({ width: '297mm', height: '420mm' })

    expect(paper(wrapper)).toBe('A3')
  })

  it('sets both sides when a paper is chosen', async () => {
    const wrapper = mountSelector()

    await wrapper.get('select').setValue('A3')

    expect(wrapper.emitted('update:width')).toEqual([['297mm']])
    expect(wrapper.emitted('update:height')).toEqual([['420mm']])
  })

  it('stays on a custom size when it passes through a paper size', async () => {
    const wrapper = mountSelector()
    await wrapper.get('input[type="checkbox"]').setValue(true)

    await wrapper.setProps({ width: '211mm' })
    await wrapper.setProps({ width: '210mm' })

    expect(customSize(wrapper)).toBe(true)
  })
})
