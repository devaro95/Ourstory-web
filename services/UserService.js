/**
 * services/UserService.js
 *
 * Handles public user profile data and social actions.
 *
 *   POST /functions/v2_userInfo  — fetch another user's public profile
 */

import { apiPOST }           from './api.js';
import { createUserApi }     from '../models/Profile.js';
import { createStoryApi }    from '../models/Story.js';

// ─────────────────────────────────────────────────────────────────
//  Response model
// ─────────────────────────────────────────────────────────────────
/**
 * @typedef {Object} UserDetail
 * @property {import('../models/Profile.js').UserApi} user
 * @property {number}  followers
 * @property {number}  following
 * @property {number}  totalLikes
 * @property {import('../models/Story.js').StoryApi[]} userStories
 * @property {boolean} isUserBlocked
 * @property {boolean} isUserFollow
 * @property {boolean} isCurrentUser
 */

/**
 * Hydrates a raw UserDetailApi object.
 * @param {Object} raw
 * @returns {UserDetail}
 */
function parseUserDetail(raw) {
  return {
    user:          createUserApi(raw?.user ?? {}),
    followers:     Number(raw?.followers  ?? 0),
    following:     Number(raw?.following  ?? 0),
    totalLikes:    Number(raw?.totalLikes ?? 0),
    userStories:   Array.isArray(raw?.userStories) ? raw.userStories.map(createStoryApi) : [],
    isUserBlocked: Boolean(raw?.isUserBlocked ?? false),
    isUserFollow:  Boolean(raw?.isUserFollow  ?? false),
    isCurrentUser: Boolean(raw?.isCurrentUser ?? false),
  };
}

// ─────────────────────────────────────────────────────────────────
//  Get user detail  →  POST /functions/v2_userInfo
// ─────────────────────────────────────────────────────────────────
/**
 * @param {string} userId
 * @returns {Promise<UserDetail>}
 */
export async function getUserDetail(userId) {
  const raw = await apiPOST('functions/v2_userInfo', { userId }, true);
  return parseUserDetail(raw.result);
}
