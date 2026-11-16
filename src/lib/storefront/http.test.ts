import { NextRequest } from 'next/server';

import { requestOrigin } from './http';

const request = (headers: Record<string, string>, url = 'http://localhost:3000/api/storefront/status') =>
  new NextRequest(url, { headers });

describe('requestOrigin', () => {
  test('uses the Origin header the browser sent', () => {
    expect(requestOrigin(request({ origin: 'https://shop.example.com', 'sec-fetch-site': 'cross-site' }))).toBe('https://shop.example.com');
  });

  test('the Origin header wins even for a same-origin request', () => {
    expect(requestOrigin(request({ origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' }))).toBe('http://localhost:3000');
  });

  test('a same-origin GET carries no Origin, so it is our own site: use the request origin', () => {
    expect(requestOrigin(request({ 'sec-fetch-site': 'same-origin' }))).toBe('http://localhost:3000');
  });

  test.each([
    ['a cross-site request with no Origin', { 'sec-fetch-site': 'cross-site' }],
    ['a same-site (sibling domain) request with no Origin', { 'sec-fetch-site': 'same-site' }],
    ['a request with no fetch metadata at all', {}],
  ])('treats %s as unknown, never as trusted', (_name, headers) => {
    expect(requestOrigin(request(headers))).toBe('');
  });
});
