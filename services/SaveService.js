/**
 * services/SaveService.js
 *
 * Handles save/unsave actions for stories.
 *
 *   POST /functions/v2_addSave  — save a story
 *   POST /functions/v2_unSave   — unsave a story
 *
 * Both endpoints require a valid session token and receive:
 *   { userId, storyId }
 */

import { apiPOST } from './api.js';
import { session }  from '../models/Session.js';

// ─────────────────────────────────────────────────────────────────
//  Save  →  POST /functions/v2_addSave
// ─────────────────────────────────────────────────────────────────
/**
 * @param {string} storyId
 * @returns {Promise<void>}
 */
export async function saveStoryApi(storyId) {
  await apiPOST('functions/v2_addSave', {
    userId:  session.userId ?? '',
    storyId: storyId ?? null,
  }, /* withToken= */ true);
}

// ─────────────────────────────────────────────────────────────────
//  Unsave  →  POST /functions/v2_unSave
// ─────────────────────────────────────────────────────────────────
/**
 * @param {string} storyId
 * @returns {Promise<void>}
 */
export async function unsaveStoryApi(storyId) {
  await apiPOST('functions/v2_unSave', {
    userId:  session.userId ?? '',
    storyId: storyId ?? null,
  }, /* withToken= */ true);
}
