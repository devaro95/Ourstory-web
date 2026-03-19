/**
 * services/UserProfileService.js
 *
 * Handles updating the current user's own profile data.
 *
 *   POST /functions/v2_updateUser
 */

import { apiPOST } from './api.js';
import { session }  from '../models/Session.js';

/**
 * Updates alias, biography and/or profile image.
 * Only pass the fields that changed — null fields are ignored by the API.
 *
 * The image must be sent as a base64 string (no data URI prefix).
 * The API returns the updated values; we save them to the session.
 *
 * @param {{ alias?: string|null, biography?: string|null, image?: string|null }} fields
 * @returns {Promise<{ alias: string|null, biography: string|null, imageUrl: string|null }>}
 */
export async function updateProfile({ alias = null, biography = null, image = null } = {}) {
  const raw = await apiPOST('functions/v2_updateUser', { alias, biography, image }, /* withToken= */ true);

  // Persist updated values in the session cache
  if (raw.alias     !== undefined && raw.alias     !== null) session.alias     = raw.alias;
  if (raw.biography !== undefined && raw.biography !== null) session.biography = raw.biography;
  if (raw.image     !== undefined && raw.image     !== null) session.imageUrl  = raw.image;
  session.save();

  return {
    alias:    raw.alias     ?? session.alias,
    biography: raw.biography ?? session.biography,
    imageUrl:  raw.image     ?? session.imageUrl,
  };
}
