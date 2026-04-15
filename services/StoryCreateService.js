/**
 * services/StoryCreateService.js
 *
 * Handles the story creation flows:
 *
 *  3-WORDS FLOW:
 *   POST /functions/v2_getCurrentUserWords  — check if user already has words assigned
 *   POST /functions/v2_addWords             — contribute 3 words, receive 3 words back
 *
 *  COOPERATIVE FLOW:
 *   POST /functions/v2_getUserCooperative   — get the user's assigned action + story
 */

import { apiPOST }        from './api.js';
import { createWordsModel } from '../models/Story.js';

// ─────────────────────────────────────────────────────────────────
//  Typedefs
// ─────────────────────────────────────────────────────────────────
/**
 * @typedef {Object} WordsApi
 * @property {string} first
 * @property {string} second
 * @property {string} third
 */

/**
 * @typedef {'CONTINUE'|'START'} CoopAction
 *
 * @typedef {Object} CoopAssignment
 * @property {CoopAction} action
 * @property {import('../models/Story.js').StoryApi|null} story
 */

// ─────────────────────────────────────────────────────────────────
//  3-WORDS: check existing words  →  POST /functions/v2_getCurrentUserWords
// ─────────────────────────────────────────────────────────────────
/**
 * Returns the 3 words already assigned to the current user, or null if
 * the user has no words assigned yet (they must contribute first).
 *
 * @returns {Promise<WordsApi|null>}
 */
export async function getCurrentUserWords() {
  const raw = await apiPOST('functions/v2_getCurrentUserWords', {}, /* withToken= */ true);
  if (!raw.result) return null;
  const w = createWordsModel(raw.result);
  // Treat empty model (all empty strings) as "no words assigned"
  return (w.first || w.second || w.third) ? w : null;
}

// ─────────────────────────────────────────────────────────────────
//  3-WORDS: contribute words & receive words  →  POST /functions/v2_addWords
// ─────────────────────────────────────────────────────────────────
/**
 * Submits 3 words to the community pool and returns the 3 words the
 * current user must use in their story.
 *
 * @param {string} first
 * @param {string} second
 * @param {string} third
 * @returns {Promise<WordsApi>}
 */
export async function addWords(first, second, third) {
  const raw = await apiPOST('functions/v2_addWords', { first, second, third }, /* withToken= */ true);
  return createWordsModel(raw.result);
}

// ─────────────────────────────────────────────────────────────────
//  COOPERATIVE: get assignment  →  POST /functions/v2_getUserCooperative
// ─────────────────────────────────────────────────────────────────
/**
 * Returns the cooperative assignment for the current user:
 *  - action === 'START'    → user must start a new story (title + first paragraph)
 *  - action === 'CONTINUE' → user must add a paragraph to `story`
 *
 * @returns {Promise<CoopAssignment>}
 */
export async function getUserCooperative() {
  const raw = await apiPOST('functions/v2_getUserCooperative', {}, /* withToken= */ true);
  const result = raw.result;
  return {
    action: result?.action ?? 'START',
    story:  result?.story  ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────
//  COOPERATIVE: add paragraph  →  POST /functions/v2_addCooperativeStory
// ─────────────────────────────────────────────────────────────────
/**
 * Adds a new paragraph to an existing cooperative story.
 *
 * @param {string} id       - Story ID
 * @param {string} title    - Story title
 * @param {{ text: string, author: string, userId: string }} content - New paragraph
 */
export async function addCooperativeStory(id, title, content) {
  await apiPOST('functions/v2_addCooperativeStory', { id, title, content }, /* withToken= */ true);
}
