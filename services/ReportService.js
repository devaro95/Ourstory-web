/**
 * services/ReportService.js
 *
 * POST /classes/Reports — submit a story report.
 */

import { apiPOST } from './api.js';

export const ReportType = {
  SPAM:       0,
  RACIST:     1,
  HOMOPHOBIA: 2,
  TOXIC:      3,
  OTHER:      3,
};

/**
 * @param {object} params
 * @param {string} params.storyId
 * @param {string} params.userId
 * @param {number} params.type      - ReportType value
 * @param {string} [params.cause]   - free-text reason (only for OTHER)
 */
export async function reportStory({ storyId, userId, type, cause = '' }) {
  await apiPOST('classes/Reports', { storyId, userId, type, cause }, /* withToken= */ true);
}
