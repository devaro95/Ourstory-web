/**
 * models/Profile.js
 *
 * JavaScript representations of the profile-related Kotlin data models.
 */

import { createStoryApi, createBlockApi } from './Story.js';

// ─────────────────────────────────────────────────────────────────
//  UserApi  ←  class UserApi(objectId, username, email, emailVerified,
//                             alias, biography, aliasChanges, imageUrl)
// ─────────────────────────────────────────────────────────────────
/**
 * @typedef {Object} UserApi
 * @property {string|null}  id            - objectId
 * @property {string|null}  username
 * @property {string|null}  email
 * @property {boolean|null} isVerified    - emailVerified
 * @property {string|null}  alias         - display name chosen by user
 * @property {string|null}  biography
 * @property {number|null}  aliasChanges
 * @property {string|null}  image         - imageUrl (base64 encoded)
 */

/**
 * Factory — creates a UserApi from a raw GET /users/me response.
 * @param {Object} raw
 * @returns {UserApi}
 */
export function createUserApi(raw = {}) {
  return {
    id:           raw?.objectId      ?? null,
    username:     raw?.username      ?? null,
    email:        raw?.email         ?? null,
    isVerified:   raw?.emailVerified ?? null,
    alias:        raw?.alias         ?? null,
    biography:    raw?.biography     ?? null,
    aliasChanges: raw?.aliasChanges  ?? null,
    image:        raw?.imageUrl      ?? raw?.image ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────
//  GetProfileResultModel  ←  inner class of ResponseGetProfileStatsApi
// ─────────────────────────────────────────────────────────────────
/**
 * @typedef {Object} ProfileStats
 * @property {import('./Story.js').StoryApi[]} userStories
 * @property {import('./Story.js').StoryApi[]} userStoriesLiked
 * @property {import('./Story.js').StoryApi[]} userStoriesSaved
 * @property {import('./Story.js').BlockApi[]} usersBlocked
 * @property {number} userTotalLikes
 * @property {number} followers
 * @property {number} following
 */

/**
 * Factory — creates a ProfileStats from the `result` field of POST /functions/v2_profile.
 * @param {Object} raw
 * @returns {ProfileStats}
 */
export function createProfileStats(raw = {}) {
  return {
    userStories:      Array.isArray(raw?.userStories)      ? raw.userStories.map(createStoryApi)      : [],
    userStoriesLiked: Array.isArray(raw?.userStoriesLiked) ? raw.userStoriesLiked.map(createStoryApi) : [],
    userStoriesSaved: Array.isArray(raw?.userStoriesSaved) ? raw.userStoriesSaved.map(createStoryApi) : [],
    usersBlocked:     Array.isArray(raw?.usersBlocked)     ? raw.usersBlocked.map(createBlockApi)     : [],
    userTotalLikes:   Number(raw?.userTotalLikes ?? 0),
    followers:        Number(raw?.followers      ?? 0),
    following:        Number(raw?.following      ?? 0),
  };
}
