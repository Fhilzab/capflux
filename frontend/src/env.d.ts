/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** CAPFLUX execution mode: 'production' | 'sandbox' (fail-closed to production). */
  readonly VITE_CAPFLUX_MODE?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_WORKOS_CLIENT_ID?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
