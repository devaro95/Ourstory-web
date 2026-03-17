/**
 * services/api.js
 *
 * Low-level HTTP client for the Back4App / Parse REST API.
 * Centralises base URL, credentials, and header construction so no other
 * module needs to know about them directly.
 */

import { session } from '../models/Session.js';

// ─────────────────────────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────────────────────────
export const API_BASE = 'https://parseapi.back4app.com/';

const APP_ID  = '0dwtTIBLmjJZFOPF1TOeSjm8uXymKdIRoEiH6xgS';
const API_KEY = 'K1pwU7zTLLCnRjWgW1yqdwfd0W7BObE5NChRKZsV';

// ─────────────────────────────────────────────────────────────────
//  Header builder
// ─────────────────────────────────────────────────────────────────
/**
 * Builds the required Parse API request headers.
 * @param {boolean} [withToken=false] - Include X-Parse-Session-Token if available.
 * @returns {Record<string, string>}
 */
export function buildHeaders(withToken = false) {
  const headers = {
    'Content-Type':          'application/json',
    'X-Parse-Application-Id': APP_ID,
    'X-Parse-JavaScript-Key': API_KEY,
  };
  if (withToken && session.token) {
    headers['X-Parse-Session-Token'] = session.token;
  }
  return headers;
}

// ─────────────────────────────────────────────────────────────────
//  HTTP helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Performs a GET request against the Parse REST API.
 * @param {string}              endpoint   - Path relative to API_BASE (e.g. 'login')
 * @param {Record<string,any>}  [params]   - Query-string parameters
 * @param {boolean}             [withToken]
 * @returns {Promise<any>}
 */
export async function apiGET(endpoint, params = {}, withToken = false) {
  const qs  = new URLSearchParams(params).toString();
  const url = API_BASE + endpoint + (qs ? '?' + qs : '');

  const res = await fetch(url, {
    method:  'GET',
    headers: buildHeaders(withToken),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, data });
  }
  return res.json();
}

/**
 * Performs a POST request against the Parse REST API.
 * @param {string}              endpoint
 * @param {Record<string,any>}  [body]
 * @param {boolean}             [withToken]
 * @returns {Promise<any>}
 */
export async function apiPOST(endpoint, body = {}, withToken = true) {
  const res = await fetch(API_BASE + endpoint, {
    method:  'POST',
    headers: buildHeaders(withToken),
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, data });
  }
  return res.json();
}
