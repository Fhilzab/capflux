/**
 * Remote sandbox demo-login must actually ATTEMPT the HTTP request.
 *
 * Regression test: SandboxAuthProvider used to call a non-existent
 * `apiClient.post` (the client only exposes `apiClient.http`), so the call
 * threw client-side before any request was constructed and the UI could
 * only report a generic failure. These tests pin the request boundary:
 * http.post must be invoked with the demo-login endpoint + personaId.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __resolveRuntimeEnvironmentForTests } from '../../shared/environment/runtimeEnvironment';

const { httpPostMock, httpGetMock } = vi.hoisted(() => ({
  httpPostMock: vi.fn(),
  httpGetMock: vi.fn(),
}));

vi.mock('../../shared/services/api/client', () => ({
  apiClient: {
    http: { post: httpPostMock, get: httpGetMock },
    baseUrl: 'http://sandbox.local/api',
  },
  default: {
    http: { post: httpPostMock, get: httpGetMock },
    baseUrl: 'http://sandbox.local/api',
  },
}));

import { getSandboxAuthProvider } from '../session/sandboxAuth';

const TOKEN_PAYLOAD = {
  success: true,
  token: 'signed-demo-token',
  persona: {
    id: 'proprietor',
    email: 'owner@demo.capflux',
    fullName: 'Amaka Obi',
    role: 'OWNER',
    systemRole: 'OWNER',
    title: 'Proprietress / School Owner',
    platformStaff: false,
  },
  expiresIn: 14400,
};

describe('sandbox remote demo-login request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    __resolveRuntimeEnvironmentForTests('sandbox');
    httpPostMock.mockResolvedValue({ data: TOKEN_PAYLOAD });
  });

  afterEach(() => {
    window.localStorage.clear();
    __resolveRuntimeEnvironmentForTests('production');
  });

  it('attempts POST /api/auth/demo-login with the canonical personaId', async () => {
    const provider = getSandboxAuthProvider();
    const result = await provider.switchToPersona('proprietor');
    expect(httpPostMock).toHaveBeenCalledTimes(1);
    expect(httpPostMock).toHaveBeenCalledWith('/auth/demo-login', { personaId: 'proprietor' });
    expect(result.error).toBeNull();
    expect(result.data?.session).toBeTruthy();
  });

  it('distinguishes attempted-but-failed from never-attempted', async () => {
    httpPostMock.mockRejectedValue(new Error('Network Error'));
    const provider = getSandboxAuthProvider();
    const result = await provider.switchToPersona('bursar');
    // The request WAS attempted (backend/infra failure), not skipped.
    expect(httpPostMock).toHaveBeenCalledTimes(1);
    expect(httpPostMock).toHaveBeenCalledWith('/auth/demo-login', { personaId: 'bursar' });
    expect(result.data?.session).toBeFalsy();
    expect(result.error).toBeTruthy();
  });

  it('rejects unknown personas without touching the network', async () => {
    const provider = getSandboxAuthProvider();
    const result = await provider.switchToPersona('demo-user-owner');
    expect(httpPostMock).not.toHaveBeenCalled();
    expect(result.error).toBeTruthy();
  });
});
