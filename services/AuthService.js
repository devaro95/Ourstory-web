/**
 * services/AuthService.js
 *
 * Handles authentication against the Parse REST API:
 *   - Login    →  GET  /login
 *   - Register →  POST /users
 *   - Verify   →  POST /verificationEmailRequest
 *   - Password reset  →  POST /requestPasswordReset
 */

import { apiGET, apiPOST, API_BASE, buildHeaders } from './api.js';
import { session } from '../models/Session.js';

// ─────────────────────────────────────────────────────────────────
//  Login
// ─────────────────────────────────────────────────────────────────
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
//  Register  →  POST /users
// ─────────────────────────────────────────────────────────────────
/**
 * Creates a new user account.
 * On success, stores the session token and returns user data.
 * Does NOT navigate — caller decides what to do next (show verify screen).
 *
 * @param {string} username
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{username: string, email: string}>}
 */
export async function register(username, email, password) {
  const data = await apiPOST('users', { username, email, password, alias: username }, /* withToken= */ false);
  session.token    = data.sessionToken ?? null;
  session.userId   = data.objectId     ?? null;
  session.username = username;
  session.email    = email;
  session.save();
  return { username, email };
}

// ─────────────────────────────────────────────────────────────────
//  Send / resend verification email  →  POST /verificationEmailRequest
// ─────────────────────────────────────────────────────────────────
/**
 * Triggers a verification email for the given address.
 * Safe to call multiple times (rate-limited in the UI, not here).
 *
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function sendVerificationEmail(email) {
  await fetch(API_BASE + 'verificationEmailRequest', {
    method:  'POST',
    headers: buildHeaders(false),
    body:    JSON.stringify({ email }),
  });
}

// ─────────────────────────────────────────────────────────────────
//  Password reset
// ─────────────────────────────────────────────────────────────────
export async function requestPasswordReset(email) {
  await fetch(API_BASE + 'requestPasswordReset', {
    method:  'POST',
    headers: buildHeaders(false),
    body:    JSON.stringify({ email }),
  });
}

// ─────────────────────────────────────────────────────────────────
//  Change password  →  POST /functions/v2_changePassword
// ─────────────────────────────────────────────────────────────────
/**
 * Changes the user's password. On success the API returns a new session
 * token (the old one is invalidated), which we store immediately.
 *
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
export async function changePassword(currentPassword, newPassword) {
  const raw = await apiPOST('functions/v2_changePassword', { currentPassword, newPassword }, /* withToken= */ true);
  // Store the new session token returned by the API
  const newToken = raw.result?.token;
  if (newToken) {
    session.token = newToken;
    session.save();
  }
}

// ─────────────────────────────────────────────────────────────────
//  Logout
// ─────────────────────────────────────────────────────────────────
export function logout() {
  session.clear();
}
