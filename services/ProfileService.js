/**
 * services/ProfileService.js
 *
 * Fetches all data needed to render the profile screen in two sequential calls:
 *
 *   1. GET  /users/me          →  UserApi   (identity, avatar, bio)
 *   2. POST /functions/v2_profile  →  ProfileStats (stories, likes, followers…)
 *
 * Both endpoints require a valid session token (X-Parse-Session-Token).
 */

import { apiGET, apiPOST } from './api.js';
import { createUserApi }     from '../models/Profile.js';
import { createProfileStats } from '../models/Profile.js';

// ─────────────────────────────────────────────────────────────────
//  Fetch current user identity
// ─────────────────────────────────────────────────────────────────
/**
 * Calls GET /users/me and returns a hydrated UserApi model.
 * Must be called before getProfileStats so the UI has identity data first.
 *
 * @returns {Promise<import('../models/Profile.js').UserApi>}
 */
export async function getCurrentUser() {
  const raw = await apiGET('users/me', {}, /* withToken= */ true);
  return createUserApi(raw);
}

// ─────────────────────────────────────────────────────────────────
//  Fetch profile statistics and story lists
// ─────────────────────────────────────────────────────────────────
/**
 * Calls POST /functions/v2_profile and returns a hydrated ProfileStats model.
 *
 * Contains:
 *   - userStories, userStoriesLiked, userStoriesSaved  (List<StoryApi>)
 *   - usersBlocked                                     (List<BlockApi>)
 *   - userTotalLikes, followers, following             (Int)
 *
 * @returns {Promise<import('../models/Profile.js').ProfileStats>}
 */
export async function getProfileStats() {
  const raw = await apiPOST('functions/v2_profile', {}, /* withToken= */ true);
  return createProfileStats(raw.result);
}
