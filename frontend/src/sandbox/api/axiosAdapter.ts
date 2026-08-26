/**
 * Custom axios adapter that routes apiClient traffic to the in-browser
 * SandboxApiServer instead of the network.
 *
 * Error shapes intentionally mirror real HTTP behaviour so the shared
 * response interceptor (status/backendMessage/isNetworkError enrichment)
 * and every store's error handling keep working unchanged:
 *  - HttpError      → rejected with `error.response` set (HTTP-like failure);
 *  - Offline toggle → rejected WITHOUT `response` (network-error shape).
 */

import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';
import {
  SandboxHttpError,
  handleSandboxRequest,
} from './sandboxApiServer';
import { SandboxOfflineError } from '../runtime/sandboxRuntime';

function buildHeaders(config: InternalAxiosRequestConfig): Headers {
  const headers = new Headers();
  const source = config.headers ?? {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value !== null && typeof value !== 'symbol' && typeof value !== 'function') {
      headers.set(String(key), String(value));
    }
  }
  return headers;
}

async function parseBody(config: AxiosRequestConfig): Promise<unknown> {
  if (config.data === undefined || config.data === null) return null;
  if (typeof config.data === 'string') {
    try {
      return JSON.parse(config.data);
    } catch {
      return config.data;
    }
  }
  return config.data;
}

export const sandboxAxiosAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const headers = buildHeaders(config);

  let payload: unknown;
  if (!headers.get('Content-Type')?.includes('application/json')) {
    // Binary uploads (e.g. KYC documents posted as octet-stream).
    payload = config.data;
  } else {
    payload = await parseBody(config);
    headers.set('Content-Type', 'application/json');
    Object.assign(config.headers, { 'Content-Type': 'application/json' });
  }

  const requestConfig: AxiosRequestConfig = {
    ...config,
    url: config.url,
    baseURL: config.baseURL,
    method: config.method,
    params: config.params,
  };
  void headers;

  try {
    const result = await handleSandboxRequest({
      ...requestConfig,
      method: (config.method ?? 'get') as AxiosRequestConfig['method'],
      data: payload as never,
    });

    const response: AxiosResponse = {
      data: result.data,
      status: result.status,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      config,
      request: { sandbox: true },
    };
    return response;
  } catch (err) {
    if (err instanceof SandboxOfflineError) {
      // No `response` → downstream sees isNetworkError === true.
      throw new AxiosError(err.message, err.code, config, {}, {});
    }
    if (err instanceof SandboxHttpError) {
      const response: AxiosResponse = {
        data: { success: false, error: err.message },
        status: err.status,
        statusText: err.status === 404 ? 'Not Found' : err.status === 403 ? 'Forbidden' : err.status === 401 ? 'Unauthorized' : 'Error',
        headers: { 'content-type': 'application/json' },
        config,
        request: { sandbox: true },
      };
      throw new AxiosError(err.message, String(err.status), config, {}, response);
    }
    throw new AxiosError(
      err instanceof Error ? err.message : 'Sandbox request failed',
      'ECONNABORTED',
      config,
      {},
      {},
    );
  }
};
