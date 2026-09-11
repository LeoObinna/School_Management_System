import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import BaseButton from '../BaseButton.vue'

describe('BaseButton', () => {
  it('renders its slot content as a button by default', () => {
    const wrapper = mount(BaseButton, { slots: { default: 'Save changes' } })

    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.text()).toContain('Save changes')
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('emits click only when not disabled or loading', async () => {
    const wrapper = mount(BaseButton, { slots: { default: 'Go' } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)

    await wrapper.setProps({ disabled: true })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)

    await wrapper.setProps({ disabled: false, loading: true })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('applies variant classes and submit type', () => {
    const wrapper = mount(BaseButton, {
      props: { variant: 'danger', type: 'submit' },
      slots: { default: 'Delete' },
    })

    expect(wrapper.attributes('type')).toBe('submit')
    expect(wrapper.classes().some((c) => c.includes('bg-red-600'))).toBe(true)
  })

  it('forwards a listener handler on click', async () => {
    const onClick = vi.fn()
    const wrapper = mount(BaseButton, {
      slots: { default: 'Tap' },
      attrs: { onClick },
    })

    await wrapper.trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
  })
})
