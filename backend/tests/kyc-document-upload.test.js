/**
 * KYC document upload body-parser limit tests.
 *
 * Verifies that the fix for PayloadTooLargeError works correctly:
 *   1. Binary (application/octet-stream) uploads to /api/kyc/documents/cac
 *      are accepted up to the route-specific 15MB limit.
 *   2. Binary uploads exceeding 15MB are rejected with HTTP 413.
 *   3. Ordinary JSON endpoints retain the default 100kb limit — the
 *      route-specific binary parser does NOT relax protection for JSON APIs.
 *
 * This test uses a minimal Express app that mirrors the body-parser
 * configuration in index.js + kyc.js. It does NOT require Supabase or auth
 * — the focus is purely on the body-parser size enforcement.
 */
import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

// Mirror the error handler from kyc.js — returns JSON 413 for entity.too.large
function makeApp() {
  const app = express();

  // Global JSON body parser — default 100kb limit (from index.js)
  app.use(express.json());

  // Route-specific binary body parser — 15MB limit (from kyc.js)
  app.post(
    '/api/kyc/documents/cac',
    express.raw({ type: 'application/octet-stream', limit: '15mb' }),
    (req, res) => {
      if (!req.body || !Buffer.isBuffer(req.body)) {
        return res.status(400).json({ error: 'No file received.' });
      }
      res.json({ success: true, data: { file_size: req.body.length } });
    },
  );

  // Ordinary JSON endpoint (simulates /api/kyc/submit, etc.)
  app.post('/api/kyc/submit', (req, res) => {
    res.json({ success: true });
  });

  // Body-parser error handler (route-scoped in kyc.js)
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body exceeds the maximum allowed size.' });
    }
    next(err);
  });

  return app;
}

function makeRequest(server, port, options) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:${port}${options.path}`, {
      method: options.method || 'POST',
      headers: options.headers || {},
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

describe('KYC document upload body-parser limits', () => {
  let app, server, port;

  beforeEach(() => {
    app = makeApp();
    server = app.listen(0);
    port = server.address().port;
  });

  afterEach(() => {
    server.close();
  });

  // --- Realistic CAC certificate upload (PDF magic bytes, ~5MB) ---

  test('accepts a realistic CAC certificate PDF upload under the 15MB limit', async () => {
    // Simulate a 5MB PDF file: %PDF- magic bytes + padding
    const pdfHeader = Buffer.from('%PDF-1.4\n', 'ascii');
    const body = Buffer.concat([pdfHeader, Buffer.alloc(5 * 1024 * 1024 - pdfHeader.length, 0x20)]);

    const res = await makeRequest(server, port, {
      path: '/api/kyc/documents/cac?filename=certificate.pdf&mimetype=application/pdf',
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: body,
    });

    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
    assert.equal(json.data.file_size, 5 * 1024 * 1024);
  });

  test('rejects binary upload exceeding 15MB with HTTP 413', async () => {
    // 16MB — exceeds the 15MB route-specific limit
    const body = Buffer.alloc(16 * 1024 * 1024, 0x25);

    const res = await makeRequest(server, port, {
      path: '/api/kyc/documents/cac?filename=big.pdf&mimetype=application/pdf',
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: body,
    });

    assert.equal(res.status, 413);
    const json = JSON.parse(res.body);
    assert.match(json.error, /exceeds the maximum allowed size/i);
  });

  // --- Ordinary JSON endpoints retain 100kb protection ---

  test('ordinary JSON endpoints reject payloads larger than 100kb', async () => {
    const bigJson = JSON.stringify({ data: 'x'.repeat(200 * 1024) });

    const res = await makeRequest(server, port, {
      path: '/api/kyc/submit',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bigJson,
    });

    assert.equal(res.status, 413);
  });

  test('ordinary JSON endpoints accept payloads under 100kb', async () => {
    const smallJson = JSON.stringify({ name: 'test', nin: '12345678901' });

    const res = await makeRequest(server, port, {
      path: '/api/kyc/submit',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: smallJson,
    });

    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.success, true);
  });

  // --- Base64-in-JSON is no longer accepted (transport changed) ---

  test('base64-in-JSON payload to /documents/cac is rejected (not parsed as file)', async () => {
    const base64Payload = JSON.stringify({
      filename: 'cert.pdf',
      mimeType: 'application/pdf',
      dataBase64: 'JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmogWzw8L2ZvbnQ+L0NvdXJlciA+XSBcCiAgL1R5cGUgL0NhdGFsb2cKICAvUGFnZXMgMyAwIFIKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFsgNCAwIFIgXQovQ291bnQgMQo+PgplbmRvYmoKNCAwIG9iago8PAovVHlwZS9QYWdlCi9QYXJlbnQgMyAwIFIKL1Jlc291cmNlcyA8PAovRm9udCA8PAovRjEgNSAwIFIKPj4KPj4KL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL0NvbnRlbnRzIDUgMCBSCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9MZW5ndGggNjgKL0ZpbHRlciAvRmxhdGVEZWNvZGUKPj4Kc3RyZWFtCnicXf1db9tAwD7Hv0TJQFJhQUGAQKgVqkCpBpoBQKFCkWKhECHZqVLXRlT92TY/NAqKo3d9m7vT3bT92T3T3P9Mz9M7s2b3Jz3p2t3t2eP3bV9fPz+Pz3b3P3v7j3v7z6/2v7j3v7z6/2v7j3v7z6/2v7j3v7z6/2v7j3v7z6/2v7j3v7z6/2v7j3v7z6/8KPgB9B8AAP//Aw==',
    });

    const res = await makeRequest(server, port, {
      path: '/api/kyc/documents/cac',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: base64Payload,
    });

    // express.raw() only handles application/octet-stream, so the JSON body
    // is not parsed — req.body is undefined
    assert.equal(res.status, 400);
  });
});
