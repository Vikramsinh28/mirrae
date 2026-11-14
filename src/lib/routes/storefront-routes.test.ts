import { NextRequest, NextResponse } from 'next/server';

import { applyCorsHeaders, handleCorsPreflightRequest } from './cors';
import { isPublicRoute, isRouteConfigured } from './utils';

const STOREFRONT_PATHS = ['/api/storefront/session', '/api/storefront/photo', '/api/storefront/tryon', '/api/storefront/status'];

const request = (path: string, method: string, origin = 'https://www.example.com') =>
  new NextRequest(`http://localhost${path}`, { method, headers: origin ? { origin } : {} });

describe('storefront routes in the route config', () => {
  test.each(STOREFRONT_PATHS)('%s is registered and public (shoppers have no account)', path => {
    expect(isRouteConfigured(path)).toBe(true);
    expect(isPublicRoute(request(path, 'POST'))).toBe(true);
  });

  test('unknown storefront paths are still not configured', () => {
    expect(isRouteConfigured('/api/storefront/admin')).toBe(false);
  });
});

describe('storefront CORS preflight', () => {
  test.each(STOREFRONT_PATHS)('%s answers a preflight from any merchant origin with the widget headers', path => {
    const response = handleCorsPreflightRequest(request(path, 'OPTIONS', 'https://shop.merchant.in'));

    expect(response).not.toBeNull();
    expect(response?.headers.get('Access-Control-Allow-Origin')).toBe('https://shop.merchant.in');
    expect(response?.headers.get('Access-Control-Allow-Headers')).toMatch(/x-storefront-token/i);
    expect(response?.headers.get('Access-Control-Allow-Headers')).toMatch(/content-type/i);
    expect(response?.headers.get('Access-Control-Allow-Methods')).toMatch(/POST/);
    expect(response?.headers.get('Vary')).toBe('Origin');
  });

  test('never sends credentials to storefront origins (the widget uses a token, not cookies)', () => {
    const response = handleCorsPreflightRequest(request('/api/storefront/tryon', 'OPTIONS', 'https://shop.merchant.in'));
    expect(response?.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  test('a preflight with no origin gets no allow-origin header', () => {
    const response = handleCorsPreflightRequest(request('/api/storefront/tryon', 'OPTIONS', ''));
    expect(response?.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  test('the account API still only trusts our own origins', () => {
    const response = handleCorsPreflightRequest(request('/api/tryon/create', 'OPTIONS', 'https://shop.merchant.in'));
    expect(response?.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  test('the proxy does not overwrite the storefront route CORS headers on real responses', () => {
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Headers', 'x-storefront-token');

    applyCorsHeaders(request('/api/storefront/status', 'GET'), response);

    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('x-storefront-token');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });
});
