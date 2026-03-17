/**
 * services/LikeService.js
 *
 * Handles like/unlike actions for stories.
 *
 *   POST /functions/v2_addLike    — add a like
 *   POST /functions/v2_removeLike — remove a like
 *
 * Both endpoints require a valid session token and receive the same body:
 *   { userId, storyId }
 */

import { apiPOST } from './api.js';
import { session }  from '../models/Session.js';

// ─────────────────────────────────────────────────────────────────
//  Add like  →  POST /functions/v2_addLike
// ─────────────────────────────────────────────────────────────────
/**
 * @param {string} storyId
 * @returns {Promise<void>}
 */
export async function addLike(storyId) {
  await apiPOST('functions/v2_addLike', {
    userId:  session.userId ?? '',
    storyId: storyId ?? null,
  }, /* withToken= */ true);
}

// ─────────────────────────────────────────────────────────────────
//  Remove like  →  POST /functions/v2_removeLike
// ─────────────────────────────────────────────────────────────────
/**
 * @param {string} storyId
 * @returns {Promise<void>}
 */
export async function removeLike(storyId) {
  await apiPOST('functions/v2_removeLike', {
    userId:  session.userId ?? '',
    storyId: storyId ?? null,
  }, /* withToken= */ true);
}
