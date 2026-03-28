/**
 * services/SearchService.js
 * POST /functions/v2_searchUsersByUsername
 */
import { apiPOST } from './api.js';

/**
 * Search users whose username starts with `searchTerm`.
 * Returns array of { id, username } objects (up to 10).
 */
export async function searchUsers(searchTerm) {
  const raw = await apiPOST(
    'functions/v2_searchUsersByUsername',
    { searchTerm },
    /* withToken= */ true
  );
  return Array.isArray(raw.result) ? raw.result : [];
}
