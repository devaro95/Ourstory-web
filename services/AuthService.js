/**
 * services/AuthService.js
 *
 * Handles authentication against the Parse REST API:
 *   - Login  →  GET /login
 *   - Password reset  →  POST /requestPasswordReset
 *
 * On success, populates and persists the shared session object.
 */

import { apiGET, apiPOST, API_BASE, buildHeaders } from './api.js';
import { session } from '../models/Session.js';

// ─────────────────────────────────────────────────────────────────
//  Login  →  ResponseLoginApi
// ─────────────────────────────────────────────────────────────────
/**
 * Authenticates the user with username/email + password.
 * Stores the resulting session token on success.
 *
 * @param {string} identifier - username or email
 * @param {string} password
 * @returns {Promise<{username: string}>} Resolved user data
 * @throws Parse-style error with `.status` code (101 = invalid credentials)
 */
export async function login(identifier, password) {
  const data = await apiGET('login', { username: identifier, password }, false);

  session.token    = data.sessionToken ?? null;
  session.userId   = data.objectId     ?? null;
  session.username = data.username     ?? identifier;
  session.email    = data.email        ?? null;
  session.save();

  return { username: session.username };
}

// ─────────────────────────────────────────────────────────────────
//  Password reset
// ─────────────────────────────────────────────────────────────────
/**
 * Requests a password-reset email from Parse.
 * Back4App returns 200 regardless of whether the email exists — this is
 * intentional to avoid user enumeration.
 *
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function requestPasswordReset(email) {
  await fetch(API_BASE + 'requestPasswordReset', {
    method:  'POST',
    headers: buildHeaders(false),
    body:    JSON.stringify({ email }),
  });
  // We intentionally do not check the response status here — see JSDoc above.
}

// ─────────────────────────────────────────────────────────────────
//  Logout (client-side only — no API call needed for Parse sessions)
// ─────────────────────────────────────────────────────────────────
/**
 * Clears the local session without calling the API.
 * (A production app would also call DELETE /logout to invalidate the token
 * server-side; add that here when the endpoint is available.)
 */
export function logout() {
  session.clear();
}
