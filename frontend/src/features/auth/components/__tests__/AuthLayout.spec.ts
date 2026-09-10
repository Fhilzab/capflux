/**
 * AuthLayout branded home link — redirects to the live (production) landing
 * page when in sandbox mode, and the local landing page otherwise.
 *
 * The link is the [icon][CAPFLUX] unit: an <img> (icons.svg) immediately
 * followed by the "CAPFLUX" text, both wrapped in a single <a>.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AuthLayout from '../AuthLayout.vue';
import { __resolveRuntimeEnvironmentForTests } from '../../../../shared/environment/runtimeEnvironment';

afterEach(() => {
  __resolveRuntimeEnvironmentForTests('production');
});

describe('AuthLayout branded home link', () => {
  it('renders the [icon][CAPFLUX] unit', () => {
    const wrapper = mount(AuthLayout);
    const homeLink = wrapper.find('a[aria-label="Go to CAPFLUX home"]');

    expect(homeLink.exists()).toBe(true);
    // Icon asset immediately followed by the CAPFLUX wordmark
    const icon = homeLink.find('img[src="/icons.svg"]');
    expect(icon.exists()).toBe(true);
    expect(homeLink.text()).toContain('CAPFLUX');
  });

  it('points to the live landing page in sandbox mode', () => {
    __resolveRuntimeEnvironmentForTests('sandbox');
    const wrapper = mount(AuthLayout);
    const homeLink = wrapper.find('a[aria-label="Go to CAPFLUX home"]');

    expect(homeLink.exists()).toBe(true);
    expect(homeLink.attributes('href')).toBe('https://capflux.vercel.app');
  });

  it('points to the local landing page in production mode', () => {
    __resolveRuntimeEnvironmentForTests('production');
    const wrapper = mount(AuthLayout);
    const homeLink = wrapper.find('a[aria-label="Go to CAPFLUX home"]');

    expect(homeLink.exists()).toBe(true);
    expect(homeLink.attributes('href')).toBe('/');
  });
});
