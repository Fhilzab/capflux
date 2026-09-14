import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CapfluxMark from '../CapfluxMark.vue';

describe('CapfluxMark — canonical branding', () => {
  it('renders C monogram and is accessible', () => {
    const wrapper = mount(CapfluxMark, { props: { size: 28 } });
    expect(wrapper.text()).toContain('C');
    expect(wrapper.attributes('aria-label')).toBeTruthy();
  });

  it('respects size prop', () => {
    const wrapper = mount(CapfluxMark, { props: { size: 40 } });
    const el = wrapper.find('span');
    expect(el.exists()).toBe(true);
    expect(el.attributes('style')).toContain('40px');
  });

  it('does not contain legacy Inkscape payload', () => {
    const wrapper = mount(CapfluxMark);
    expect(wrapper.html()).not.toContain('Inkscape');
    expect(wrapper.html()).not.toContain('5df7da');
  });
});
