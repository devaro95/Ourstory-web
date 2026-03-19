/**
 * services/StoriesService.js
 *
 * Fetches home-feed stories from two endpoints:
 *
 *   POST /functions/v2_stories       — initial page load (all tabs, page 0)
 *   POST /functions/v2_storyByType   — "load more" for a specific tab (page N)
 *
 * Story type constants mirror the Kotlin enum values expected by the API.
 */

import { apiPOST } from './api.js';
import { createStoryApi } from '../models/Story.js';

// ─────────────────────────────────────────────────────────────────
//  Fetch a single story by id  →  POST /functions/v2_getStory
// ─────────────────────────────────────────────────────────────────
/**
 * @param {string} storyId
 * @returns {Promise<import('../models/Story.js').StoryApi|null>}
 */
export async function getStoryById(storyId) {
  const raw = await apiPOST('functions/v2_getStory', { storyId }, /* withToken= */ false);
  return raw.result ? createStoryApi(raw.result) : null;
}

// ─────────────────────────────────────────────────────────────────
//  Story type enum  (sent as `type` to v2_storyByType)
// ─────────────────────────────────────────────────────────────────
/** @enum {string} */
export const StoryType = {
  /** Latest stories, sorted newest first (tab "Últimas") */
  LATEST:    'LATEST',
  /** Most liked this week (tab "Más gustadas") */
  TRENDING:  'TRENDING',
  /** Stories from users the current user follows (tab "Seguidores") */
  FOLLOWING: 'FOLLOWING',
};

// ─────────────────────────────────────────────────────────────────
//  Response model
// ─────────────────────────────────────────────────────────────────
/**
 * @typedef {Object} AppStats
 * @property {number} totalUsers
 * @property {number} totalStories
 * @property {number} totalCooperativeParagraphs
 *
 * @typedef {Object} StoriesFeed
 * @property {import('../models/Story.js').StoryApi[]} latest
 * @property {import('../models/Story.js').StoryApi[]} trending
 * @property {import('../models/Story.js').StoryApi[]} following
 * @property {AppStats} stats
 */

function parseStoriesFeed(raw) {
  return {
    latest:    Array.isArray(raw?.latest)     ? raw.latest.map(createStoryApi)     : [],
    trending:  Array.isArray(raw?.trending)   ? raw.trending.map(createStoryApi)   : [],
    following: Array.isArray(raw?.following)  ? raw.following.map(createStoryApi)  : [],
    stats: {
      totalUsers:                   Number(raw?.stats?.totalUsers                   ?? 0),
      totalStories:                 Number(raw?.stats?.totalStories                 ?? 0),
      totalCooperativeParagraphs:   Number(raw?.stats?.totalCooperativeParagraphs   ?? 0),
    },
  };
}

// ─────────────────────────────────────────────────────────────────
//  Initial feed  →  POST /functions/v2_stories
// ─────────────────────────────────────────────────────────────────
/**
 * Loads the first page of all three home-feed tabs in a single call.
 * Call on initial home page render (page = 0).
 *
 * @param {number} [page=0]
 * @returns {Promise<StoriesFeed>}
 */
export async function getStories(page = 0) {
  const raw = await apiPOST('functions/v2_stories', { page }, /* withToken= */ true);
  return parseStoriesFeed(raw.result);
}

// ─────────────────────────────────────────────────────────────────
//  Load more  →  POST /functions/v2_storyByType
// ─────────────────────────────────────────────────────────────────
/**
 * Loads the next page of stories for a specific tab.
 * Called when the user clicks "Cargar más" in any tab.
 *
 * @param {string} type  One of StoryType.LATEST | TRENDING | FOLLOWING
 * @param {number} page  Current page number (incremented by the caller before passing)
 * @returns {Promise<import('../models/Story.js').StoryApi[]>}
 */
export async function getStoriesByType(type, page) {
  const raw = await apiPOST(
    'functions/v2_storyByType',
    { page, type },
    /* withToken= */ true,
  );
  return Array.isArray(raw.result) ? raw.result.map(createStoryApi) : [];
}
