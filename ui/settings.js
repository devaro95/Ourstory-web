// ═══════════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════════

// ── Change password ───────────────────────────────────────────────
function openChangePasswordModal() {
  ['changePwCurrent','changePwNew'].forEach(id => {
    document.getElementById(id).value = '';
    document.getElementById(id).classList.remove('has-error');
  });
  ['changePwCurrentErr','changePwNewErr'].forEach(id =>
    document.getElementById(id).classList.remove('visible'));
  const errEl = document.getElementById('changePwError');
  errEl.classList.remove('visible'); errEl.textContent = '';
  openModal('changePassword');
}

async function doChangePassword() {
  const currentPw = document.getElementById('changePwCurrent').value;
  const newPw     = document.getElementById('changePwNew').value;
  let hasError = false;
  if (!currentPw) {
    document.getElementById('changePwCurrent').classList.add('has-error');
    document.getElementById('changePwCurrentErr').classList.add('visible');
    hasError = true;
  }
  if (newPw.length < 6) {
    document.getElementById('changePwNew').classList.add('has-error');
    document.getElementById('changePwNewErr').classList.add('visible');
    hasError = true;
  }
  if (hasError) return;

  const btn = document.getElementById('changePwBtn');
  btn.classList.add('loading'); btn.disabled = true;
  try {
    await changePassword(currentPw, newPw);
    closeAllModals();
    showToast('Contraseña actualizada ✓');
  } catch (e) {
    const errEl = document.getElementById('changePwError');
    errEl.textContent = (e.data?.error || '').toLowerCase().includes('password')
      ? 'La contraseña actual no es correcta.'
      : 'No se pudo cambiar la contraseña. Inténtalo de nuevo.';
    errEl.classList.add('visible');
  } finally {
    btn.classList.remove('loading'); btn.disabled = false;
  }
}

// ── Bug report ────────────────────────────────────────────────────
function openBugReportModal() {
  ['bugSubject','bugBody'].forEach(id => document.getElementById(id).value = '');
  ['bugSubjectErr','bugBodyErr'].forEach(id =>
    document.getElementById(id).classList.remove('visible'));
  openModal('bugReport');
}

function doSendBugReport() {
  const subject = document.getElementById('bugSubject').value.trim();
  const body    = document.getElementById('bugBody').value.trim();
  let hasError  = false;
  if (!subject) { document.getElementById('bugSubjectErr').classList.add('visible'); hasError = true; }
  if (!body)    { document.getElementById('bugBodyErr').classList.add('visible');    hasError = true; }
  if (hasError) return;

  const mailto = 'mailto:alvaromcarmena95@gmail.com'
    + '?subject=' + encodeURIComponent('[Ourstory Bug] ' + subject)
    + '&body='    + encodeURIComponent(body + '\n\n---\nUsuario: ' + (session.username || '—') + '\nID: ' + (session.userId || '—'));
  window.location.href = mailto;
  closeAllModals();
  showToast('Abriendo cliente de email...');
}

// ── Logout confirm ────────────────────────────────────────────────
function confirmLogout() { openModal('logout'); }
function doLogout()      { closeAllModals(); logout(); }

async function loadProfile() {
  if (!session.isLoggedIn) { showPage('login'); return; }
  const loading = document.getElementById('profileLoading');
  const content = document.getElementById('profileContent');
  const error   = document.getElementById('profileError');
  loading.style.display = 'flex'; content.style.display = 'none'; error.style.display = 'none';
  try {
    const user  = await getCurrentUser();
    const stats = await getProfileStats();

    const avatarEl = document.getElementById('profileAvatar');
    if (user.image) {
      avatarEl.innerHTML = `<img src="${user.image}" alt="${escHtml(user.alias || user.username)}">`;
    } else {
      const ini = (user.alias || user.username || 'U').trim().slice(0, 2).toUpperCase();
      avatarEl.innerHTML = `<span class="profile-avatar-initials">${ini}</span>`;
    }

    const alias    = user.alias    || user.username || session.username || '—';
    const username = user.username || session.username || '—';
    const bio      = user.biography || 'Sin biografía.';
    document.getElementById('profileName').textContent     = alias;
    document.getElementById('profileUsername').textContent = '@' + username;
    document.getElementById('profileBio').textContent      = bio;

    const navIni = alias.slice(0, 2).toUpperCase();
    document.getElementById('navUserName').textContent = alias;
    // Persist profile data in session so nav renders correctly on any page refresh
    session.alias     = alias;
    session.biography = bio;
    session.imageUrl  = user.image || null;
    session.save();
    // Update nav avatar
    updateNav();

    document.getElementById('profileFollowers').textContent = fmtNum(stats.followers);
    document.getElementById('profileFollowing').textContent = fmtNum(stats.following);
    document.getElementById('profileLikes').textContent     = fmtNum(stats.userTotalLikes);

    // Keep dashboard card in sync
    const df = document.getElementById('dashFollowers');
    const dg = document.getElementById('dashFollowing');
    const dl = document.getElementById('dashLikes');
    if (df) df.textContent = fmtNum(stats.followers);
    if (dg) dg.textContent = fmtNum(stats.following);
    if (dl) dl.textContent = fmtNum(stats.userTotalLikes);

    renderGrid('profileStoriesGrid', stats.userStories);
    renderGrid('profileLikedGrid',   stats.userStoriesLiked);
    renderGrid('profileSavedGrid',   stats.userStoriesSaved);
    renderBlockedList('profileBlockedList', stats.usersBlocked);

    loading.style.display = 'none'; content.style.display = 'block';
  } catch (e) {
    console.error('Profile error:', e);
    if (e.status === 209 || e.status === 403 || e.status === 401) {
      session.clear(); updateNav(); showPage('login');
      showToast('Sesión expirada. Vuelve a iniciar sesión.');
    } else {
      loading.style.display = 'none'; error.style.display = 'block';
    }
  }
}

function renderGrid(containerId, stories) {
  const grid = document.getElementById(containerId);
  if (!stories.length) {
    grid.innerHTML = `<div class="profile-empty"><div class="profile-empty-icon">✦</div><p class="profile-empty-text">Aún no hay historias aquí</p></div>`;
    return;
  }
  grid.innerHTML = stories.map(storyCardHTML).join('');
}

function renderBlockedList(containerId, blocked) {
  const el = document.getElementById(containerId);
  if (!blocked.length) {
    el.innerHTML = `<div class="blocked-empty"><div class="blocked-empty-icon">✦</div><p class="blocked-empty-text">No tienes usuarios bloqueados</p></div>`;
    return;
  }
  el.innerHTML = `<div class="blocked-list">${blocked.map(b => {
    const ini = (b.username || '?').slice(0, 2).toUpperCase();
    return `
      <div class="blocked-item" id="blocked-item-${b.id}">
        <div class="blocked-item-info">
          <div class="blocked-item-avatar">${ini}</div>
          <div>
            <div class="blocked-item-username">@${b.username || '—'}</div>
            <div class="blocked-item-id">ID: ${b.id || '—'}</div>
          </div>
        </div>
        <button class="unblock-btn"
          onclick="confirmUnblock('${b.id}', '${(b.username || '').replace(/'/g, "\\'")}')">
          Desbloquear
        </button>
      </div>`;
  }).join('')}</div>`;
}

// ── Generic confirm dialog ────────────────────────────────────────
let _confirmCallback = null;

function openConfirmDialog({ label, title, message, btnText = 'Confirmar', onConfirm }) {
  document.getElementById('confirmLabel').textContent   = label   || 'Confirmar acción';
  document.getElementById('confirmTitle').textContent   = title   || '¿Estás seguro?';
  document.getElementById('confirmMessage').textContent = message || '';
  document.getElementById('confirmActionBtn').textContent = btnText;
  _confirmCallback = onConfirm || null;
  openModal('confirm');
}

function confirmAction() {
  closeAllModals();
  if (typeof _confirmCallback === 'function') _confirmCallback();
  _confirmCallback = null;
}

function confirmUnblock(userId, username) {
  openConfirmDialog({
    label:     'Gestionar bloqueos',
    title:     `Desbloquear a @${username}`,
    message:   `¿Seguro que quieres desbloquear a @${username}? Volvería a poder ver tu perfil y tus historias.`,
    btnText:   'Sí, desbloquear',
    onConfirm: () => doUnblockFromProfile(userId, username),
  });
}

async function doUnblockFromProfile(userId, username) {
  try {
    await unblockUser(userId);
    document.getElementById(`blocked-item-${userId}`)?.remove();
    const list = document.querySelector('#profileBlockedList .blocked-list');
    if (list && !list.children.length) {
      document.getElementById('profileBlockedList').innerHTML = `<div class="blocked-empty"><div class="blocked-empty-icon">✦</div><p class="blocked-empty-text">No tienes usuarios bloqueados</p></div>`;
    }
    showToast(`@${username} desbloqueado ✓`);
  } catch (e) {
    console.error('Unblock error:', e);
    showToast('No se pudo desbloquear. Inténtalo de nuevo.');
  }
}

function switchProfileTab(tab, btn) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.profile-tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
}

// ── Story card (shared between feed and profile grids) ────────────
function storyCardHTML(s, guestMode = false) {
  const isCollab = s.isCooperative === true;
  const badge    = isCollab
    ? `<span class="story-mode-badge collab">colaborativa</span>`
    : `<span class="story-mode-badge">3 palabras</span>`;

  let wordsHTML = '';
  if (!isCollab && s.words) {
    const wArr = Array.isArray(s.words)
      ? s.words
      : Object.values(s.words).filter(v => typeof v === 'string' && v.length);
    if (wArr.length) {
      wordsHTML = `<div class="story-words">${wArr.map(w => `<span class="word-pill">${w}</span>`).join('')}</div>`;
    }
  }

  let excerpt = '';
  if (Array.isArray(s.content) && s.content.length) {
    const first = s.content[0];
    excerpt = (typeof first === 'string' ? first : first.text || '').substring(0, 160);
  } else if (typeof s.content === 'string') {
    excerpt = s.content.substring(0, 160);
  }
  excerpt = excerpt ? excerpt + '...' : 'Sin contenido.';

  const author    = s.author || 'Anónimo';
  const initials  = author.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const date     = s.date ? relDate(s.date) : '';
  const likedCls = s.userLiked ? ' liked' : '';
  const savedCls = s.userSaved ? ' liked' : '';

  // ── Author area: stack for collab, single avatar for 3-words ──────
  let authorAreaHTML;
  if (isCollab && Array.isArray(s.content) && s.content.length) {
    // Deduplicate authors by userId, keeping order of first appearance
    const seen = new Set();
    const uniqueAuthors = [];
    s.content.forEach(c => {
      const key = c.userId || c.author;
      if (key && !seen.has(key)) { seen.add(key); uniqueAuthors.push(c); }
    });
    const total     = uniqueAuthors.length;
    const stackHtml = uniqueAuthors.slice(0, 2).map(c => {
      const ini = (c.author || '?').slice(0, 2).toUpperCase();
      return c.userImage
        ? `<div class="ca"><img src="${c.userImage}" alt="${escHtml(c.author || '')}"></div>`
        : `<div class="ca">${ini}</div>`;
    }).join('');
    const moreHtml = total > 2
      ? `<span class="card-collab-more">+${total - 2}</span>`
      : '';
    // Encode authors list for the dialog
    const authorsData = encodeURIComponent(JSON.stringify(uniqueAuthors.map(c => ({
      userId: c.userId, author: c.author, userImage: c.userImage || null,
    }))));
    authorAreaHTML = `
      <button class="card-collab-authors" onclick="event.stopPropagation(); openCollabAuthorsDialog('${authorsData}')" title="Ver autores">
        <div class="card-avatar-stack">${stackHtml}</div>
        ${moreHtml}
      </button>`;
  } else {
    const avatarHTML = s.userImage
      ? `<div class="author-avatar"><img src="${s.userImage}" alt="${author}"></div>`
      : `<div class="author-avatar">${initials}</div>`;
    // inline-flex so only avatar+name area is clickable, not the full row width
    authorAreaHTML = `
      <a class="story-author"
        href="#user/${s.userId}"
        onclick="event.preventDefault(); event.stopPropagation(); openUserProfile('${s.userId}')"
        style="text-decoration:none; cursor:pointer;">
        ${avatarHTML}<span class="author-name">${author}</span>
      </a>`;
  }

  return `
    <article class="story-card"
      data-type="${isCollab ? 'collab' : 'palabras'}"
      data-id="${s.id}"
      data-story='${JSON.stringify(s).replace(/'/g, '&#39;')}'>
      <a href="#detail/${s.id}"
         onclick="handleCardClick(event, this.closest('[data-id]'))"
         style="display:block;text-decoration:none;color:inherit;cursor:pointer;">
        <div class="story-meta">${badge}<span class="story-date">${date}</span></div>
        ${wordsHTML}
        <h3 class="story-title">${s.title || 'Sin título'}</h3>
        <p class="story-excerpt">${excerpt}</p>
        <div class="story-footer" onclick="event.stopPropagation()">
          ${authorAreaHTML}
          ${guestMode ? '' : `<div class="story-actions">
            <button class="action-btn${likedCls}" onclick="toggleLike(this)">
              <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span>${s.likes || 0}</span>
            </button>
            <button class="action-btn${savedCls}" onclick="saveStory(this)">
              <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          </div>`}
        </div>
      </a>
    </article>`;
}

