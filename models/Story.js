/**
 * models/Story.js
 *
 * JavaScript representations of the Kotlin data models returned by the API.
 * Each factory function validates and provides defaults mirroring the Kotlin
 * data classes (using Kotlin default values as fallbacks).
 */

// ─────────────────────────────────────────────────────────────────
//  WordsModel  ←  data class WordsModel(first, second, third)
// ─────────────────────────────────────────────────────────────────
/**
 * @typedef {Object} WordsModel
 * @property {string} first
 * @property {string} second
 * @property {string} third
 */

/**
 * Factory — creates a WordsModel from a raw API object.
 * @param {Object|null} raw
 * @returns {WordsModel}
 */
export function createWordsModel(raw = {}) {
  return {
    first:  String(raw?.first  ?? ''),
    second: String(raw?.second ?? ''),
    third:  String(raw?.third  ?? ''),
  };
}

/** Returns [first, second, third] filtering empty strings. */
export function wordsToArray(words) {
  return [words.first, words.second, words.third].filter(w => w && w.length > 0);
}

// ─────────────────────────────────────────────────────────────────
//  ContentApi  ←  data class ContentApi(userId, text, author, date, userImage)
// ─────────────────────────────────────────────────────────────────
/**
 * @typedef {Object} ContentApi
 * @property {string|null}  userId
 * @property {string|null}  text
 * @property {string|null}  author
 * @property {number|null}  date       - Unix timestamp (ms)
 * @property {string|null}  userImage  - base64 encoded image
 */

/**
 * Factory — creates a ContentApi from a raw API object.
 * @param {Object|null} raw
 * @returns {ContentApi}
 */
export function createContentApi(raw = {}) {
  return {
    userId:    raw?.userId    ?? null,
    text:      raw?.text      ?? null,
    author:    raw?.author    ?? null,
    date:      raw?.date      ?? null,
    userImage: raw?.userImage ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────
//  StoryApi  ←  data class StoryApi(id, title, content, author, date, words,
//                                   userId, userLiked, userSaved, likes,
//                                   isCurrentUser, userImage, isCooperative)
// ─────────────────────────────────────────────────────────────────
/**
 * @typedef {Object} StoryApi
 * @property {string}       id
 * @property {string}       title
 * @property {ContentApi[]} content
 * @property {string}       author       - filled for 3-words stories; empty for cooperative
 * @property {number}       date         - Unix timestamp (ms)
 * @property {WordsModel}   words        - filled for 3-words; default/null for cooperative
 * @property {string}       userId
 * @property {boolean}      userLiked
 * @property {boolean}      userSaved
 * @property {number}       likes
 * @property {boolean}      isCurrentUser
 * @property {string|null}  userImage    - base64 encoded image of the story author
 * @property {boolean}      isCooperative
 */

/**
 * Factory — creates a StoryApi from a raw API object.
 * @param {Object} raw
 * @returns {StoryApi}
 */
export function createStoryApi(raw = {}) {
  return {
    id:            String(raw?.id    ?? ''),
    title:         String(raw?.title ?? ''),
    content:       Array.isArray(raw?.content)
                     ? raw.content.map(createContentApi)
                     : [],
    author:        String(raw?.author  ?? ''),
    date:          Number(raw?.date    ?? 0),
    words:         createWordsModel(raw?.words),
    userId:        String(raw?.userId  ?? ''),
    userLiked:     Boolean(raw?.userLiked     ?? false),
    userSaved:     Boolean(raw?.userSaved     ?? false),
    likes:         Number(raw?.likes          ?? 0),
    isCurrentUser: Boolean(raw?.isCurrentUser ?? false),
    userImage:     raw?.userImage ?? null,
    isCooperative: Boolean(raw?.isCooperative ?? false),
  };
}

// ─────────────────────────────────────────────────────────────────
//  BlockApi  ←  data class BlockApi(username, id)
// ─────────────────────────────────────────────────────────────────
/**
 * @typedef {Object} BlockApi
 * @property {string} username
 * @property {string} id
 */

/**
 * Factory — creates a BlockApi from a raw API object.
 * @param {Object} raw
 * @returns {BlockApi}
 */
export function createBlockApi(raw = {}) {
  return {
    username: String(raw?.username ?? ''),
    id:       String(raw?.id       ?? ''),
  };
}
