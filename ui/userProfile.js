// ═══════════════════════════════════════════════════════════════════
//  USER PROFILE (other users)
// ═══════════════════════════════════════════════════════════════════
let currentUserDetail = null;

async function loadUserProfile(userId) {
  const loading = document.getElementById('userProfileLoading');
  const content = document.getElementById('userProfileContent');
  const error   = document.getElementById('userProfileError');
  loading.style.display = 'flex'; content.style.display = 'none'; error.style.display = 'none';
  try {
    const detail = await getUserDetail(userId);
    currentUserDetail = detail;
    renderUserProfile(detail);
    loading.style.display = 'none'; content.style.display = 'block';
  } catch (e) {
    console.error('User profile error:', e);
    loading.style.display = 'none'; error.style.display = 'block';
    error.dataset.userId = userId;
  }
}

function retryUserProfile() {
  const userId = document.getElementById('userProfileError').dataset.userId;
  if (userId) loadUserProfile(userId);
}

function renderUserProfile(detail) {
  const { user, followers, following, totalLikes, userStories, isUserFollow, isUserBlocked } = detail;

  const avatarEl = document.getElementById('userProfileAvatar');
  if (user.image) {
    avatarEl.innerHTML = `<img src="${user.image}" alt="${escHtml(user.alias || user.username)}">`;
  } else {
    const ini = (user.alias || user.username || 'U').trim().slice(0, 2).toUpperCase();
    avatarEl.innerHTML = `<span class="user-profile-avatar-initials">${ini}</span>`;
  }

  const alias    = user.alias    || user.username || '—';
  const username = user.username || '—';
  document.getElementById('userProfileName').textContent     = alias;
  document.getElementById('userProfileUsername').textContent = '@' + username;
  document.getElementById('userProfileFollowers').textContent = fmtNum(followers);
  document.getElementById('userProfileFollowing').textContent = fmtNum(following);
  document.getElementById('userProfileLikes').textContent     = fmtNum(totalLikes);

  updateFollowBtn(isUserFollow);
  updateBlockBtn(isUserBlocked);

  const grid  = document.getElementById('userProfileStoriesGrid');
  const count = document.getElementById('userProfileStoriesCount');
  count.textContent = userStories.length ? `${userStories.length} historia${userStories.length !== 1 ? 's' : ''}` : '';

  if (!userStories.length) {
    grid.innerHTML = `<div class="profile-empty" style="grid-column:1/-1;"><div class="profile-empty-icon">✦</div><p class="profile-empty-text">Este usuario aún no ha publicado historias</p></div>`;
  } else {
    grid.innerHTML = userStories.map(storyCardHTML).join('');
  }
}

function updateFollowBtn(isFollowing) {
  const btn = document.getElementById('userFollowBtn');
  if (isFollowing) {
    btn.classList.add('secondary');
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg><span id="userFollowLabel">Siguiendo</span>`;
  } else {
    btn.classList.remove('secondary');
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg><span id="userFollowLabel">Seguir</span>`;
  }
}

async function toggleFollowUser() {
  if (!currentUserDetail) return;
  const wasFollowing = currentUserDetail.isUserFollow;
  const userId       = currentUserDetail.user.id;
  currentUserDetail.isUserFollow = !wasFollowing;
  updateFollowBtn(!wasFollowing);
  currentUserDetail.followers = wasFollowing ? Math.max(0, currentUserDetail.followers - 1) : currentUserDetail.followers + 1;
  document.getElementById('userProfileFollowers').textContent = fmtNum(currentUserDetail.followers);
  try {
    if (wasFollowing) await unfollowUser(userId);
    else              await followUser(userId);
    showToast(wasFollowing ? 'Has dejado de seguir a este usuario' : 'Ahora sigues a este usuario ✓');
  } catch (e) {
    console.error('Follow error:', e);
    currentUserDetail.isUserFollow = wasFollowing;
    updateFollowBtn(wasFollowing);
    currentUserDetail.followers = wasFollowing ? currentUserDetail.followers + 1 : Math.max(0, currentUserDetail.followers - 1);
    document.getElementById('userProfileFollowers').textContent = fmtNum(currentUserDetail.followers);
    showToast('No se pudo actualizar. Inténtalo de nuevo.');
  }
}

function updateBlockBtn(isBlocked) {
  const btn = document.getElementById('userBlockBtn');
  if (isBlocked) {
    btn.classList.remove('danger'); btn.classList.add('secondary');
    btn.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg><span id="userBlockLabel">Desbloquear</span>`;
  } else {
    btn.classList.add('danger'); btn.classList.remove('secondary');
    btn.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg><span id="userBlockLabel">Bloquear</span>`;
  }
}

async function toggleBlockUser() {
  if (!currentUserDetail) return;
  const wasBlocked = currentUserDetail.isUserBlocked;
  const userId     = currentUserDetail.user.id;
  currentUserDetail.isUserBlocked = !wasBlocked;
  updateBlockBtn(!wasBlocked);
  try {
    if (wasBlocked) await unblockUser(userId);
    else            await blockUser(userId);
    showToast(wasBlocked ? 'Usuario desbloqueado' : 'Usuario bloqueado');
  } catch (e) {
    console.error('Block error:', e);
    currentUserDetail.isUserBlocked = wasBlocked;
    updateBlockBtn(wasBlocked);
    showToast('No se pudo actualizar. Inténtalo de nuevo.');
  }
}

// ═══════════════════════════════════════════════════════════════════
