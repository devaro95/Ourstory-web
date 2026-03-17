/**
 * services/SocialService.js
 *
 * Handles social actions between users:
 *
 *   POST /functions/v2_addFollow    — follow a user
 *   POST /functions/v2_removeFollow — unfollow a user
 *   POST /functions/v2_addBlock     — block a user
 *   POST /functions/v2_removeBlock  — unblock a user
 */

import { apiPOST } from './api.js';

// ─────────────────────────────────────────────────────────────────
//  Follow  →  POST /functions/v2_addFollow
// ─────────────────────────────────────────────────────────────────
/**
 * @param {string} userFollowId  — userId of the user to follow
 * @returns {Promise<void>}
 */
export async function followUser(userFollowId) {
  await apiPOST('functions/v2_addFollow', {
    followed: userFollowId,
  }, /* withToken= */ true);
}

// ─────────────────────────────────────────────────────────────────
//  Unfollow  →  POST /functions/v2_removeFollow
// ─────────────────────────────────────────────────────────────────
/**
 * @param {string} userFollowId  — userId of the user to unfollow
 * @returns {Promise<void>}
 */
export async function unfollowUser(userFollowId) {
  await apiPOST('functions/v2_removeFollow', {
    followed: userFollowId,
  }, /* withToken= */ true);
}

// ─────────────────────────────────────────────────────────────────
//  Block  →  POST /functions/v2_addBlock
// ─────────────────────────────────────────────────────────────────
/**
 * @param {string} userId  — userId of the user to block
 * @returns {Promise<void>}
 */
export async function blockUser(userId) {
  await apiPOST('functions/v2_addBlock', {
    userId,
  }, /* withToken= */ true);
}

// ─────────────────────────────────────────────────────────────────
//  Unblock  →  POST /functions/v2_removeBlock
// ─────────────────────────────────────────────────────────────────
/**
 * @param {string} userId  — userId of the user to unblock
 * @returns {Promise<void>}
 */
export async function unblockUser(userId) {
  await apiPOST('functions/v2_removeBlock', {
    userId,
  }, /* withToken= */ true);
}
