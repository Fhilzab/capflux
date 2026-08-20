import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

const pushMock = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

import ModuleLockOverlay from '../ModuleLockOverlay.vue';

describe('ModuleLockOverlay (Phase 8.2 verification gate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders setup variant with correct content', () => {
    const wrapper = mount(ModuleLockOverlay, {
      props: { variant: 'setup' },
    });

    expect(wrapper.text()).toContain('Setup Required');
    expect(wrapper.text()).toContain('Complete your school setup');
    expect(wrapper.text()).toContain('Continue Setup');
  });

  it('renders kyc variant with correct content', () => {
    const wrapper = mount(ModuleLockOverlay, {
      props: { variant: 'kyc' },
    });

    expect(wrapper.text()).toContain('KYC Verification Required');
    expect(wrapper.text()).toContain('identity verification');
    expect(wrapper.text()).toContain('Complete KYC');
  });

  it('renders settlement variant with correct content', () => {
    const wrapper = mount(ModuleLockOverlay, {
      props: { variant: 'settlement' },
    });

    expect(wrapper.text()).toContain('Settlement Verification Required');
    expect(wrapper.text()).toContain('settlement account must be verified');
    expect(wrapper.text()).toContain('Verify Settlement');
  });

  it('renders payment variant with correct content', () => {
    const wrapper = mount(ModuleLockOverlay, {
      props: { variant: 'payment' },
    });

    expect(wrapper.text()).toContain('Payments Locked');
    expect(wrapper.text()).toContain('KYC, settlement');
    expect(wrapper.text()).toContain('Complete Verification');
  });

  it('renders provider variant with correct content', () => {
    const wrapper = mount(ModuleLockOverlay, {
      props: { variant: 'provider' },
    });

    expect(wrapper.text()).toContain('Payment Provider Not Ready');
    expect(wrapper.text()).toContain('not yet activated');
    expect(wrapper.text()).toContain('View Status');
  });

  it('navigates to /kyc/submit when setup CTA clicked', async () => {
    const wrapper = mount(ModuleLockOverlay, {
      props: { variant: 'setup' },
    });

    await wrapper.find('button').trigger('click');

    expect(pushMock).toHaveBeenCalledWith({ name: 'KycSubmission' });
  });

  it('navigates to /kyc/submit?section=identity when kyc CTA clicked', async () => {
    const wrapper = mount(ModuleLockOverlay, {
      props: { variant: 'kyc' },
    });

    await wrapper.find('button').trigger('click');

    expect(pushMock).toHaveBeenCalledWith({ name: 'KycSubmission', query: { section: 'identity' } });
  });

  it('navigates to /kyc/submit?section=settlement when settlement CTA clicked', async () => {
    const wrapper = mount(ModuleLockOverlay, {
      props: { variant: 'settlement' },
    });

    await wrapper.find('button').trigger('click');

    expect(pushMock).toHaveBeenCalledWith({ name: 'KycSubmission', query: { section: 'settlement' } });
  });

  it('allows custom title and message overrides', () => {
    const wrapper = mount(ModuleLockOverlay, {
      props: {
        variant: 'kyc',
        title: 'Custom Title',
        message: 'Custom message text',
      },
    });

    expect(wrapper.text()).toContain('Custom Title');
    expect(wrapper.text()).toContain('Custom message text');
  });

  it('is responsive (max-w-md, full-width on mobile)', () => {
    const wrapper = mount(ModuleLockOverlay, {
      props: { variant: 'kyc' },
    });

    const panel = wrapper.find('.max-w-md.w-full.mx-4');
    expect(panel.exists()).toBe(true);
  });
});
