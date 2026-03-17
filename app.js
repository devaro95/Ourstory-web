/**
 * app.js
 *
 * Main application controller.
 * Imports session state, auth, and profile services; wires them to the DOM.
 *
 * Load order (enforced by index.html):
 *   1. style.css
 *   2. app.js  (type="module" — imports resolved by the browser)
 */

import { session }                          from './models/Session.js';
import { login, requestPasswordReset,
         logout as authLogout }             from './services/AuthService.js';
import { getCurrentUser, getProfileStats }  from './services/ProfileService.js';
import { getStories, getStoriesByType,
         StoryType }                        from './services/StoriesService.js';
import { addLike, removeLike }              from './services/LikeService.js';
import { saveStoryApi, unsaveStoryApi }     from './services/SaveService.js';
import { getUserDetail }                    from './services/UserService.js';
import { followUser, unfollowUser,
         blockUser, unblockUser }           from './services/SocialService.js';

// ═══════════════════════════════════════════════════════════════════
//  NAV
// ═══════════════════════════════════════════════════════════════════
function updateNav() {
  const li = session.isLoggedIn;
  document.getElementById('navLoginItem').style.display   = li ? 'none' : '';
  document.getElementById('navProfileItem').style.display = li ? '' : 'none';
  document.getElementById('navCtaBtn').textContent        = li ? 'Crear historia' : 'Entrar';
  if (li && session.username) {
    document.getElementById('navUserName').textContent       = session.username;
    document.getElementById('navAvatarInitials').textContent = session.username.slice(0, 2).toUpperCase();
  }
}

function handleLogoClick() { showPage('home'); }
function handleNavCta()    { session.isLoggedIn ? openModal('create') : showPage('login'); }

function logout() {
  authLogout();
  updateNav();
  showPage('home');
  showToast('Sesión cerrada');
}

function requireAuth(fn) {
  if (session.isLoggedIn) fn();
  else { showPage('login'); showToast('Inicia sesión para continuar'); }
}

// ═══════════════════════════════════════════════════════════════════
//  PAGES
// ═══════════════════════════════════════════════════════════════════
function showPage(name) {
  if (name === 'profile' && !session.isLoggedIn) { showPage('login'); return; }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById(name + '-page');
  if (pg) pg.classList.add('active');
  window.scrollTo(0, 0);
  sessionStorage.setItem('os_page', name);
  if (name === 'profile') loadProfile();
  if (name === 'home' && !homeFeedLoaded) loadHomeFeed();
}

function scrollToFeed() {
  showPage('home');
  setTimeout(() => document.getElementById('feed-anchor')?.scrollIntoView({ behavior: 'smooth' }), 50);
}

// ═══════════════════════════════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════════════════════════════
function togglePw(inputId, btn) {
  const inp  = document.getElementById(inputId);
  const show = inp.type === 'password';
  inp.type   = show ? 'text' : 'password';
  btn.innerHTML = show
    ? `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

function clearLoginErrors() {
  ['loginIdentifier', 'loginPassword'].forEach(id =>
    document.getElementById(id).classList.remove('has-error'));
  ['loginIdentifierErr', 'loginPasswordErr', 'loginErrorBanner'].forEach(id =>
    document.getElementById(id).classList.remove('visible'));
}

async function doLogin() {
  clearLoginErrors();
  const identifier = document.getElementById('loginIdentifier').value.trim();
  const password   = document.getElementById('loginPassword').value;
  let hasError = false;

  if (!identifier) {
    document.getElementById('loginIdentifier').classList.add('has-error');
    document.getElementById('loginIdentifierErr').classList.add('visible');
    hasError = true;
  }
  if (!password) {
    document.getElementById('loginPassword').classList.add('has-error');
    document.getElementById('loginPasswordErr').classList.add('visible');
    hasError = true;
  }
  if (hasError) return;

  const btn = document.getElementById('loginBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const { username } = await login(identifier, password);
    updateNav();
    showPage('home');
    showToast(`¡Bienvenido, ${username}! ✓`);
  } catch (e) {
    const banner = document.getElementById('loginErrorBanner');
    banner.textContent = e.status === 101
      ? 'Usuario o contraseña incorrectos.'
      : 'No se pudo conectar. Comprueba tu conexión.';
    banner.classList.add('visible');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  FORGOT PASSWORD
// ═══════════════════════════════════════════════════════════════════
function openForgotModal() {
  document.getElementById('forgotForm').style.display    = 'block';
  document.getElementById('forgotSuccess').style.display = 'none';
  document.getElementById('forgotEmail').value           = '';
  document.getElementById('forgotEmailErr').classList.remove('visible');
  document.getElementById('modalForgot').classList.add('open');
  document.body.style.overflow = 'hidden';
}

async function doForgotPassword() {
  const email = document.getElementById('forgotEmail').value.trim();
  const errEl = document.getElementById('forgotEmailErr');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.classList.add('visible');
    return;
  }
  errEl.classList.remove('visible');

  const btn = document.getElementById('forgotBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    await requestPasswordReset(email);
    document.getElementById('forgotForm').style.display    = 'none';
    document.getElementById('forgotSuccess').style.display = 'block';
  } catch (e) {
    showToast('Error al enviar el email. Inténtalo de nuevo.');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════════════════════════════════
async function loadProfile() {
  if (!session.isLoggedIn) { showPage('login'); return; }

  const loading = document.getElementById('profileLoading');
  const content = document.getElementById('profileContent');
  const error   = document.getElementById('profileError');
  loading.style.display = 'flex';
  content.style.display = 'none';
  error.style.display   = 'none';

  try {
    // 1. Identity data from GET /users/me
    const user = await getCurrentUser();

    // 2. Stats and story lists from POST /functions/v2_profile
    const stats = await getProfileStats();

    // ── Avatar ─────────────────────────────────────
    const avatarEl = document.getElementById('profileAvatar');
    if (user.image) {
      const mime = detectMime(user.image);
      avatarEl.innerHTML = `<img src="data:${mime};base64,${user.image}" alt="${user.alias || user.username}">`;
    } else {
      const ini = (user.alias || user.username || 'U').trim().slice(0, 2).toUpperCase();
      avatarEl.innerHTML = `<span class="profile-avatar-initials">${ini}</span>`;
    }

    // ── Identity text ───────────────────────────────
    const alias    = user.alias    || user.username || session.username || '—';
    const username = user.username || session.username || '—';
    const bio      = user.biography || 'Sin biografía.';

    document.getElementById('profileName').textContent     = alias;
    document.getElementById('profileUsername').textContent = '@' + username;
    document.getElementById('profileBio').textContent      = bio;

    const navIni = alias.slice(0, 2).toUpperCase();
    document.getElementById('navAvatarInitials').textContent = navIni;
    document.getElementById('navUserName').textContent       = alias;

    // ── Stats ───────────────────────────────────────
    document.getElementById('profileFollowers').textContent = fmtNum(stats.followers);
    document.getElementById('profileFollowing').textContent = fmtNum(stats.following);
    document.getElementById('profileLikes').textContent     = fmtNum(stats.userTotalLikes);

    // ── Story grids ─────────────────────────────────
    renderGrid('profileStoriesGrid', stats.userStories);
    renderGrid('profileLikedGrid',   stats.userStoriesLiked);
    renderGrid('profileSavedGrid',   stats.userStoriesSaved);

    // ── Blocked users ───────────────────────────────
    renderBlockedList('profileBlockedList', stats.usersBlocked);

    loading.style.display = 'none';
    content.style.display = 'block';

  } catch (e) {
    console.error('Profile error:', e);
    if (e.status === 209 || e.status === 403 || e.status === 401) {
      session.clear();
      updateNav();
      showPage('login');
      showToast('Sesión expirada. Vuelve a iniciar sesión.');
    } else {
      loading.style.display = 'none';
      error.style.display   = 'block';
    }
  }
}

function renderGrid(containerId, stories) {
  const grid = document.getElementById(containerId);
  if (!stories.length) {
    grid.innerHTML = `<div class="profile-empty">
      <div class="profile-empty-icon">✦</div>
      <p class="profile-empty-text">Aún no hay historias aquí</p>
    </div>`;
    return;
  }
  grid.innerHTML = stories.map(storyCardHTML).join('');
}

function renderBlockedList(containerId, blocked) {
  const el = document.getElementById(containerId);
  if (!blocked.length) {
    el.innerHTML = `<div class="blocked-empty">
      <div class="blocked-empty-icon">✦</div>
      <p class="blocked-empty-text">No tienes usuarios bloqueados</p>
    </div>`;
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

/**
 * Opens the generic confirm modal.
 * @param {object} opts
 * @param {string}   opts.label    - Small label above the title
 * @param {string}   opts.title    - Modal title
 * @param {string}   opts.message  - Body text
 * @param {string}   opts.btnText  - Confirm button label
 * @param {Function} opts.onConfirm - Called when user confirms
 */
function openConfirmDialog({ label, title, message, btnText = 'Confirmar', onConfirm }) {
  document.getElementById('confirmLabel').textContent  = label || 'Confirmar acción';
  document.getElementById('confirmTitle').textContent  = title || '¿Estás seguro?';
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

// ── Unblock from own profile ──────────────────────────────────────
function confirmUnblock(userId, username) {
  openConfirmDialog({
    label:   'Gestionar bloqueos',
    title:   `Desbloquear a @${username}`,
    message: `¿Seguro que quieres desbloquear a @${username}? Volvería a poder ver tu perfil y tus historias.`,
    btnText: 'Sí, desbloquear',
    onConfirm: () => doUnblockFromProfile(userId, username),
  });
}

async function doUnblockFromProfile(userId, username) {
  try {
    await unblockUser(userId);
    // Remove the item from the DOM
    document.getElementById(`blocked-item-${userId}`)?.remove();
    // If the list is now empty, show the empty state
    const list = document.querySelector('#profileBlockedList .blocked-list');
    if (list && !list.children.length) {
      document.getElementById('profileBlockedList').innerHTML = `
        <div class="blocked-empty">
          <div class="blocked-empty-icon">✦</div>
          <p class="blocked-empty-text">No tienes usuarios bloqueados</p>
        </div>`;
    }
    showToast(`@${username} desbloqueado ✓`);
  } catch (e) {
    console.error('Unblock error:', e);
    showToast('No se pudo desbloquear. Inténtalo de nuevo.');
  }
}

// ── Story card (shared between feed and profile grids) ────────────
function storyCardHTML(s) {
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
      wordsHTML = `<div class="story-words">${wArr.map(w =>
        `<span class="word-pill">${w}</span>`).join('')}</div>`;
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

  const author   = s.author || 'Anónimo';
  const initials = author.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const avatarHTML = s.userImage
    ? `<div class="author-avatar"><img src="data:${detectMime(s.userImage)};base64,${s.userImage}" alt="${author}"></div>`
    : `<div class="author-avatar">${initials}</div>`;

  const date      = s.date ? relDate(s.date) : '';
  const likedCls  = s.userLiked ? ' liked' : '';
  const savedCls  = s.userSaved ? ' liked' : '';

  return `
    <article class="story-card"
      data-type="${isCollab ? 'collab' : 'palabras'}"
      data-id="${s.id}"
      onclick="handleCardClick(event, this)"
      data-story='${JSON.stringify(s).replace(/'/g, '&#39;')}'>
      <div class="story-meta">${badge}<span class="story-date">${date}</span></div>
      ${wordsHTML}
      <h3 class="story-title">${s.title || 'Sin título'}</h3>
      <p class="story-excerpt">${excerpt}</p>
      <div class="story-footer">
        <div class="story-author" onclick="event.stopPropagation(); openUserProfile('${s.userId}')" style="cursor:pointer;">
          ${avatarHTML}<span class="author-name">${author}</span>
        </div>
        <div class="story-actions">
          <button class="action-btn${likedCls}" onclick="toggleLike(this)">
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>${s.likes || 0}</span>
          </button>
          <button class="action-btn${savedCls}" onclick="saveStory(this)">
            <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
      </div>
    </article>`;
}

function switchProfileTab(tab, btn) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.profile-tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
}

// ═══════════════════════════════════════════════════════════════════
//  MODALS
// ═══════════════════════════════════════════════════════════════════
function openModal(id) {
  const el = document.getElementById('modal' + cap(id));
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  document.body.style.overflow = '';
}

function openModalMode(mode) {
  closeAllModals();
  if (mode === 'words') {
    resetWordsModal();
    document.getElementById('modalWords').classList.add('open');
  } else {
    resetCollabModal();
    document.getElementById('modalCollab').classList.add('open');
    simulateCollabAssign();
  }
  document.body.style.overflow = 'hidden';
}

// ─── 3 PALABRAS ──────────────────────────────────────────────────
const WORD_POOL = [
  'espejo','tormenta','susurro','reloj','azul','caracol','biblioteca',
  'sombra','lluvia','jardín','memoria','invierno','crepúsculo','llave',
  'marea','volcán','silencio','cristal','brújula','niebla','umbral',
  'cuervo','laberinto','ceniza','abismo','vela','espiral','raíz',
  'eclipse','tinta','fractura','norte','telaraña','faro','grieta','huella',
];

function resetWordsModal() {
  ['wordIn1', 'wordIn2', 'wordIn3'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('wordsStoryText').value        = '';
  document.getElementById('wordsCharCount').textContent  = '0';
  setWordStep(1);
}

function setWordStep(s) {
  document.getElementById('wordsStep1').classList.toggle('active', s === 1);
  document.getElementById('wordsStep2').classList.toggle('active', s === 2);
  document.getElementById('wdot1').className = 'step-dot' + (s > 1 ? ' done' : ' active');
  document.getElementById('wdot2').className = 'step-dot' + (s === 2 ? ' active' : '');
  document.getElementById('wordsStepLabel').textContent =
    `Paso ${s} de 2 — 3 Palabras`;
  document.getElementById('wordsStepTitle').textContent =
    s === 1 ? 'Aporta tus palabras' : 'Escribe tu historia';
}

function submitWordsStep1() {
  const words = ['wordIn1', 'wordIn2', 'wordIn3'].map(id =>
    document.getElementById(id).value.trim());
  if (words.some(w => !w)) {
    showToast('Introduce las 3 palabras para continuar');
    return;
  }
  const received = [...WORD_POOL]
    .sort(() => Math.random() - 0.5)
    .filter(w => !words.includes(w))
    .slice(0, 3);
  document.getElementById('receivedWordsList').innerHTML =
    received.map(w => `<span class="received-word">${w}</span>`).join('');
  setWordStep(2);
}

function submitWordsStory() {
  if (document.getElementById('wordsStoryText').value.trim().length < 30) {
    showToast('La historia debe tener al menos 30 caracteres');
    return;
  }
  closeAllModals();
  resetWordsModal();
  showToast('¡Historia publicada! ✓');
}

// ─── COLABORATIVA ────────────────────────────────────────────────
function resetCollabModal() {
  document.getElementById('collabAssignLoading').style.display = 'flex';
  document.getElementById('collabContinueUI').style.display    = 'none';
  document.getElementById('collabStartUI').style.display       = 'none';
  ['collabContinueText', 'collabNewTitle', 'collabNewText'].forEach(id =>
    document.getElementById(id).value = '');
  ['collabContCount', 'collabNewCount'].forEach(id =>
    document.getElementById(id).textContent = '0');
  document.getElementById('collabStepTitle').textContent = 'Tu turno';
  document.getElementById('cdot1').className = 'step-dot active';
  document.getElementById('cdot2').className = 'step-dot';
}

function simulateCollabAssign() {
  setTimeout(() => {
    document.getElementById('collabAssignLoading').style.display = 'none';
    const samples = [
      { title: 'La estación espacial silenciosa', last: 'La comandante Yuki apagó el sistema. Luego lo volvió a encender. La melodía seguía ahí. Provenía de las coordenadas de su ciudad natal.' },
      { title: 'El último cartero de papel',     last: 'La carta llegó sin remitente. Solo llevaba una fecha: mañana. Y una instrucción: no abrir hasta que llueva.' },
      { title: 'Arenas que recuerdan',            last: 'El desierto guardaba todo lo que la ciudad había olvidado. Nombres, fechas, rostros. Solo necesitabas saber dónde cavar.' },
    ];
    if (Math.random() > 0.4) {
      const s = samples[Math.floor(Math.random() * samples.length)];
      document.getElementById('collabContextTitle').textContent = s.title;
      document.getElementById('collabContextText').textContent  = s.last;
      document.getElementById('collabStepTitle').textContent    = 'Continúa la historia';
      document.getElementById('collabContinueUI').style.display = 'block';
    } else {
      document.getElementById('collabStepTitle').textContent = 'Inicia una historia';
      document.getElementById('collabStartUI').style.display = 'block';
    }
  }, 1400);
}

function submitCollabParagraph() {
  if (document.getElementById('collabContinueText').value.trim().length < 30) {
    showToast('El párrafo debe tener al menos 30 caracteres');
    return;
  }
  closeAllModals();
  showToast('¡Párrafo añadido! ✓');
}

function submitCollabNew() {
  if (!document.getElementById('collabNewTitle').value.trim()) {
    showToast('Escribe un título para la historia');
    return;
  }
  if (document.getElementById('collabNewText').value.trim().length < 30) {
    showToast('El párrafo inicial debe tener al menos 30 caracteres');
    return;
  }
  closeAllModals();
  showToast('¡Historia iniciada! Otros escritores la continuarán ✓');
}

// ═══════════════════════════════════════════════════════════════════
//  HOME FEED
// ═══════════════════════════════════════════════════════════════════

// Per-tab pagination state
const feedState = {
  latest:    { page: 0, loading: false },
  trending:  { page: 0, loading: false },
  following: { page: 0, loading: false },
};
let homeFeedLoaded = false;

/** Switch visible feed tab */
function switchFeedTab(tab, btn) {
  document.querySelectorAll('.feed-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.feed-tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('feed-' + tab).classList.add('active');
}

/**
 * Initial load — calls v2_stories (page 0) and fills all three panels at once.
 * Triggered once when the home page is first shown.
 */
async function loadHomeFeed() {
  homeFeedLoaded = true;
  try {
    const feed = await getStories(0);
    renderFeedPanel('latest',    feed.latest,    'grid');
    renderFeedPanel('trending',  feed.trending,  'grid');
    renderFeedPanel('following', feed.following, 'grid');
  } catch (e) {
    console.error('Home feed error:', e);
    ['latest', 'trending', 'following'].forEach(tab => renderFeedError(tab));
  }
}

/**
 * Load more for a specific tab — calls v2_storyByType, appends cards.
 * @param {'LATEST'|'TRENDING'|'FOLLOWING'} type
 */
async function loadMoreStories(type) {
  const tabKey = type.toLowerCase();
  const state  = feedState[tabKey];
  if (state.loading) return;

  const moreWrap = document.getElementById(`feed-${tabKey}-more`);
  const btn      = moreWrap?.querySelector('.load-more-btn');
  const spinner  = btn?.querySelector('.btn-spinner');
  const label    = btn?.querySelector('span');

  state.loading = true;
  state.page   += 1;
  if (btn)     btn.disabled = true;
  if (spinner) spinner.style.display = 'block';
  if (label)   label.textContent = 'Cargando...';

  try {
    const stories = await getStoriesByType(type, state.page);
    if (!stories.length) {
      // No more pages
      if (moreWrap) moreWrap.style.display = 'none';
      return;
    }
    const contentEl  = document.getElementById(`feed-${tabKey}-content`);
    const container  = contentEl?.querySelector('.story-stream, .story-grid-3');
    if (container) {
      container.insertAdjacentHTML('beforeend', stories.map(storyCardHTML).join(''));
    }
  } catch (e) {
    console.error('Load more error:', e);
    showToast('Error al cargar más historias. Inténtalo de nuevo.');
    state.page -= 1;
  } finally {
    state.loading = false;
    if (btn)     btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
    if (label)   label.textContent = 'Cargar más';
  }
}

/**
 * Renders stories into a tab panel.
 * latest → stream (single-column); others → 3-col grid.
 */
function renderFeedPanel(tabKey, stories, layout) {
  const contentEl = document.getElementById(`feed-${tabKey}-content`);
  const moreEl    = document.getElementById(`feed-${tabKey}-more`);
  if (!contentEl) return;

  if (!stories.length) {
    contentEl.innerHTML = feedEmptyHTML(tabKey);
    if (moreEl) moreEl.style.display = 'none';
    return;
  }

  const cls = layout === 'stream' ? 'story-stream' : 'story-grid-3';
  contentEl.innerHTML = `<div class="${cls}">${stories.map(storyCardHTML).join('')}</div>`;
  if (moreEl) moreEl.style.display = 'flex';
}

function renderFeedError(tabKey) {
  const contentEl = document.getElementById(`feed-${tabKey}-content`);
  if (!contentEl) return;
  contentEl.innerHTML = `
    <div class="feed-error">
      <p class="feed-error-text">No se pudo cargar el contenido.</p>
      <button class="btn-secondary" onclick="retryFeedTab('${tabKey}')">Reintentar</button>
    </div>`;
}

async function retryFeedTab(tabKey) {
  const contentEl = document.getElementById(`feed-${tabKey}-content`);
  if (contentEl) contentEl.innerHTML = `<div class="feed-loading"><div class="loading-spinner"></div>Cargando historias...</div>`;
  try {
    const feed = await getStories(0);
    const layoutMap = { latest: 'grid', trending: 'grid', following: 'grid' };
    const dataMap   = { latest: feed.latest, trending: feed.trending, following: feed.following };
    renderFeedPanel(tabKey, dataMap[tabKey] || [], layoutMap[tabKey]);
  } catch (e) {
    renderFeedError(tabKey);
  }
}

function feedEmptyHTML(tabKey) {
  const msgs = {
    latest:    'Aún no hay historias publicadas.',
    trending:  'No hay historias destacadas esta semana.',
    following: 'Las personas que sigues no han publicado historias aún.',
  };
  return `
    <div class="feed-empty">
      <div class="feed-empty-icon">✦</div>
      <p class="feed-empty-text">${msgs[tabKey] || 'Sin historias.'}</p>
    </div>`;
}

async function toggleLike(btn) {
  const sp      = btn.querySelector('span');
  const n       = parseInt(sp.textContent);
  const liked   = !btn.classList.contains('liked');
  const card    = btn.closest('[data-id]');
  const storyId = card?.dataset?.id ?? null;

  // Optimistic UI update
  btn.classList.toggle('liked');
  sp.textContent = liked ? n + 1 : n - 1;

  try {
    if (liked) await addLike(storyId);
    else       await removeLike(storyId);
  } catch (e) {
    // Roll back on error
    console.error('Like error:', e);
    btn.classList.toggle('liked');
    sp.textContent = n;
    showToast('No se pudo actualizar el like. Inténtalo de nuevo.');
  }
}

async function saveStory(btn) {
  const saving  = !btn.classList.contains('liked');
  const card    = btn.closest('[data-id]');
  const storyId = card?.dataset?.id ?? null;

  // Optimistic UI update
  btn.classList.toggle('liked');
  showToast(saving ? 'Historia guardada ✓' : 'Historia eliminada de guardados');

  try {
    if (saving) await saveStoryApi(storyId);
    else        await unsaveStoryApi(storyId);
  } catch (e) {
    // Roll back on error
    console.error('Save error:', e);
    btn.classList.toggle('liked');
    showToast('No se pudo actualizar. Inténtalo de nuevo.');
  }
}

// ═══════════════════════════════════════════════════════════════════
//  USER PROFILE (other users)
// ═══════════════════════════════════════════════════════════════════
let currentUserDetail = null; // UserDetail currently shown

/**
 * Opens the public profile of another user.
 * Called from author avatar/name clicks on story cards.
 * @param {string} userId
 */
async function openUserProfile(userId) {
  if (!userId || userId === session.userId) {
    showPage('profile');
    return;
  }
  prevPage = document.querySelector('.page.active')?.id?.replace('-page', '') || 'home';
  sessionStorage.setItem('os_user_profile_id',   userId);
  sessionStorage.setItem('os_user_profile_prev',  prevPage);
  showPage('user-profile');
  await loadUserProfile(userId);
}

async function loadUserProfile(userId) {
  const loading = document.getElementById('userProfileLoading');
  const content = document.getElementById('userProfileContent');
  const error   = document.getElementById('userProfileError');
  loading.style.display = 'flex';
  content.style.display = 'none';
  error.style.display   = 'none';

  try {
    const detail = await getUserDetail(userId);
    currentUserDetail = detail;
    renderUserProfile(detail);
    loading.style.display = 'none';
    content.style.display = 'block';
  } catch (e) {
    console.error('User profile error:', e);
    loading.style.display = 'none';
    error.style.display   = 'block';
    error.dataset.userId  = userId; // store for retry
  }
}

function retryUserProfile() {
  const userId = document.getElementById('userProfileError').dataset.userId;
  if (userId) loadUserProfile(userId);
}

function renderUserProfile(detail) {
  const { user, followers, following, totalLikes, userStories,
          isUserFollow, isUserBlocked } = detail;

  // Avatar
  const avatarEl = document.getElementById('userProfileAvatar');
  if (user.image) {
    const mime = detectMime(user.image);
    avatarEl.innerHTML = `<img src="data:${mime};base64,${user.image}" alt="${escHtml(user.alias || user.username)}">`;
  } else {
    const ini = (user.alias || user.username || 'U').trim().slice(0, 2).toUpperCase();
    avatarEl.innerHTML = `<span class="user-profile-avatar-initials">${ini}</span>`;
  }

  // Text
  const alias    = user.alias    || user.username || '—';
  const username = user.username || '—';
  document.getElementById('userProfileName').textContent     = alias;
  document.getElementById('userProfileUsername').textContent = '@' + username;

  // Stats
  document.getElementById('userProfileFollowers').textContent = fmtNum(followers);
  document.getElementById('userProfileFollowing').textContent = fmtNum(following);
  document.getElementById('userProfileLikes').textContent     = fmtNum(totalLikes);

  // Follow button
  updateFollowBtn(isUserFollow);

  // Block button
  updateBlockBtn(isUserBlocked);

  // Stories grid
  const grid = document.getElementById('userProfileStoriesGrid');
  const count = document.getElementById('userProfileStoriesCount');
  count.textContent = userStories.length
    ? `${userStories.length} historia${userStories.length !== 1 ? 's' : ''}`
    : '';

  if (!userStories.length) {
    grid.innerHTML = `
      <div class="profile-empty" style="grid-column:1/-1;">
        <div class="profile-empty-icon">✦</div>
        <p class="profile-empty-text">Este usuario aún no ha publicado historias</p>
      </div>`;
  } else {
    grid.innerHTML = userStories.map(storyCardHTML).join('');
  }
}

// ── Follow / Unfollow ─────────────────────────────────────────────
function updateFollowBtn(isFollowing) {
  const btn   = document.getElementById('userFollowBtn');
  const label = document.getElementById('userFollowLabel');
  if (isFollowing) {
    btn.classList.add('secondary');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
      <span id="userFollowLabel">Siguiendo</span>`;
  } else {
    btn.classList.remove('secondary');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
      <span id="userFollowLabel">Seguir</span>`;
  }
}

async function toggleFollowUser() {
  if (!currentUserDetail) return;
  const wasFollowing = currentUserDetail.isUserFollow;
  const userId       = currentUserDetail.user.id;

  // Optimistic UI
  currentUserDetail.isUserFollow = !wasFollowing;
  updateFollowBtn(!wasFollowing);
  currentUserDetail.followers = wasFollowing
    ? Math.max(0, currentUserDetail.followers - 1)
    : currentUserDetail.followers + 1;
  document.getElementById('userProfileFollowers').textContent = fmtNum(currentUserDetail.followers);

  try {
    if (wasFollowing) await unfollowUser(userId);
    else              await followUser(userId);
    showToast(wasFollowing ? 'Has dejado de seguir a este usuario' : 'Ahora sigues a este usuario ✓');
  } catch (e) {
    // Roll back
    console.error('Follow error:', e);
    currentUserDetail.isUserFollow = wasFollowing;
    updateFollowBtn(wasFollowing);
    currentUserDetail.followers = wasFollowing
      ? currentUserDetail.followers + 1
      : Math.max(0, currentUserDetail.followers - 1);
    document.getElementById('userProfileFollowers').textContent = fmtNum(currentUserDetail.followers);
    showToast('No se pudo actualizar. Inténtalo de nuevo.');
  }
}

// ── Block / Unblock ───────────────────────────────────────────────
function updateBlockBtn(isBlocked) {
  const btn = document.getElementById('userBlockBtn');
  if (isBlocked) {
    btn.classList.remove('danger');
    btn.classList.add('secondary');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
      <span id="userBlockLabel">Desbloquear</span>`;
  } else {
    btn.classList.add('danger');
    btn.classList.remove('secondary');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
      <span id="userBlockLabel">Bloquear</span>`;
  }
}

async function toggleBlockUser() {
  if (!currentUserDetail) return;
  const wasBlocked = currentUserDetail.isUserBlocked;
  const userId     = currentUserDetail.user.id;

  // Optimistic UI
  currentUserDetail.isUserBlocked = !wasBlocked;
  updateBlockBtn(!wasBlocked);

  try {
    if (wasBlocked) await unblockUser(userId);
    else            await blockUser(userId);
    showToast(wasBlocked ? 'Usuario desbloqueado' : 'Usuario bloqueado');
  } catch (e) {
    // Roll back
    console.error('Block error:', e);
    currentUserDetail.isUserBlocked = wasBlocked;
    updateBlockBtn(wasBlocked);
    showToast('No se pudo actualizar. Inténtalo de nuevo.');
  }
}

// ═══════════════════════════════════════════════════════════════════
//  STORY DETAIL
// ═══════════════════════════════════════════════════════════════════
let currentStory = null;
let prevPage     = 'home';

function handleCardClick(event, card) {
  if (event.target.closest('.action-btn') || event.target.closest('.story-actions')) return;
  const raw = card.getAttribute('data-story');
  if (raw) {
    try {
      openDetail(JSON.parse(raw.replace(/&#39;/g, "'")));
    } catch (e) { console.error('Parse story:', e); }
    return;
  }
  // Home feed static cards — reconstruct a minimal StoryApi from the DOM
  const isCollab = card.dataset.type === 'collab';
  const pills    = [...card.querySelectorAll('.word-pill')].map(p => p.textContent);
  openDetail({
    id:            card.dataset.id || 'sample',
    title:         card.querySelector('.story-title')?.textContent || '',
    content:       [{ text: card.querySelector('.story-excerpt')?.textContent?.replace(/\.\.\.$/, '') || '' }],
    author:        card.querySelector('.author-name')?.textContent || '',
    date:          Date.now(),
    words:         pills.length === 3
                     ? { first: pills[0], second: pills[1], third: pills[2] }
                     : {},
    likes:         parseInt(card.querySelector('.action-btn span')?.textContent || '0'),
    userLiked:     card.querySelector('.action-btn')?.classList.contains('liked') ?? false,
    userSaved:     card.querySelector('.action-btn:last-child')?.classList.contains('liked') ?? false,
    isCooperative: isCollab,
    isCurrentUser: false,
    userImage:     null,
  });
}

function openDetail(story) {
  currentStory = story;
  prevPage = document.querySelector('.page.active')?.id?.replace('-page', '') || 'home';
  sessionStorage.setItem('os_detail_story', JSON.stringify(story));
  sessionStorage.setItem('os_detail_prev',  prevPage);
  renderDetail(story);
  showPage('detail');
  window.scrollTo(0, 0);
}

function goBack() {
  const target = prevPage || sessionStorage.getItem('os_detail_prev') || 'home';
  showPage(target);
}

function renderDetail(s) {
  document.getElementById('detailContent').innerHTML =
    s.isCooperative ? renderCollabDetail(s) : renderWordsDetail(s);
}

function renderWordsDetail(s) {
  const words = s.words
    ? [s.words.first, s.words.second, s.words.third].filter(w => w?.length)
    : [];
  const wordBadges = words.map(w => `<span class="detail-word-badge">${escHtml(w)}</span>`).join('');
  const contentItem = Array.isArray(s.content) && s.content.length ? s.content[0] : null;
  const rawText = contentItem
    ? (typeof contentItem === 'string' ? contentItem : contentItem.text || '')
    : (typeof s.content === 'string' ? s.content : '');
  const authorAvatar = buildAvatarHTML(s.userImage, s.author, 44, 'detail-author-avatar', 'detail-author-initials');
  const likedCls = s.userLiked ? ' liked' : '';
  const savedCls = s.userSaved ? ' liked' : '';
  const editBtn  = s.isCurrentUser
    ? `<button class="detail-action-btn" onclick="openEdit()">
        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Editar historia
       </button>`
    : '';
  return `
    <div class="detail-words-layout">
      <aside class="detail-sidebar">
        <div class="detail-meta-row">
          <span class="detail-meta-label">Fecha</span>
          <span class="detail-meta-value">${fmtDate(s.date)}</span>
        </div>
        <div class="detail-meta-row">
          <span class="detail-meta-label">Likes</span>
          <span class="detail-meta-big">${fmtNum(s.likes)}</span>
        </div>
        ${words.length ? `
        <div class="detail-meta-row">
          <span class="detail-meta-label">Palabras clave</span>
          <div class="detail-word-badges">${wordBadges}</div>
        </div>` : ''}
        <div class="detail-author-block" onclick="openUserProfile('${s.userId}')" style="cursor:pointer;">
          ${authorAvatar}
          <div>
            <div class="detail-author-name">${escHtml(s.author || 'Anónimo')}</div>
            <div class="detail-author-label">Autor</div>
          </div>
        </div>
        <div class="detail-sidebar-actions">
          <button class="detail-action-btn${likedCls}" onclick="detailToggleLike(this)">
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>${s.userLiked ? 'Te gusta' : 'Me gusta'}</span>
          </button>
          <button class="detail-action-btn${savedCls}" onclick="detailToggleSave(this)">
            <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            <span>${s.userSaved ? 'Guardada' : 'Guardar'}</span>
          </button>
          <button class="detail-action-btn" onclick="openShare()">
            <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Compartir
          </button>
          ${editBtn}
          <button class="detail-action-btn danger" onclick="openModal('report')">
            <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Reportar
          </button>
        </div>
      </aside>
      <main class="detail-main">
        <h1 class="detail-title">${escHtml(s.title || 'Sin título')}</h1>
        <div class="detail-content">${highlightWords(rawText, words)}</div>
      </main>
    </div>`;
}

function renderCollabDetail(s) {
  const contents      = Array.isArray(s.content) ? s.content : [];
  const uniqueAuthors = [];
  const seen          = new Set();
  contents.forEach(c => {
    const key = c.userId || c.author;
    if (key && !seen.has(key)) { seen.add(key); uniqueAuthors.push(c); }
  });
  const stackHTML = uniqueAuthors.slice(0, 2).map(c => {
    const ini = (c.author || '?').slice(0, 2).toUpperCase();
    if (c.userImage) {
      return `<div class="ca"><img src="data:${detectMime(c.userImage)};base64,${c.userImage}" alt="${escHtml(c.author || '')}"></div>`;
    }
    return `<div class="ca">${ini}</div>`;
  }).join('');
  const moreCount = uniqueAuthors.length > 2
    ? `<span class="collab-authors-more">+${uniqueAuthors.length - 2}</span>` : '';
  const likedCls = s.userLiked ? ' liked' : '';
  const savedCls = s.userSaved ? ' liked' : '';
  const parasHTML = contents.map(c => {
    const avHTML = buildAvatarHTML(c.userImage, c.author, 30, 'collab-para-avatar', 'collab-para-avatar-ini');
    return `
      <div class="collab-para-block">
        <p class="collab-para-text">${escHtml(c.text || '')}</p>
        <div class="collab-para-author" onclick="openUserProfile('${c.userId}')" style="cursor:pointer;">
          ${avHTML}
          <span class="collab-para-author-name">${escHtml(c.author || 'Anónimo')}</span>
          ${c.date ? `<span class="collab-para-date">${fmtDate(c.date)}</span>` : ''}
        </div>
      </div>`;
  }).join('');
  return `
    <div class="detail-collab-layout">
      <div class="detail-collab-header">
        <div class="detail-collab-top-meta">
          <span class="detail-collab-date">${fmtDate(s.date)}</span>
          <div class="detail-collab-actions-row">
            <button class="detail-collab-action${likedCls}" onclick="detailToggleLike(this)">
              <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span>${fmtNum(s.likes)}</span>
            </button>
            <button class="detail-collab-action${savedCls}" onclick="detailToggleSave(this)">
              <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              <span>${s.userSaved ? 'Guardada' : 'Guardar'}</span>
            </button>
            <button class="detail-collab-action" onclick="openShare()">
              <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Compartir
            </button>
            <button class="detail-collab-action danger" onclick="openModal('report')">
              <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Reportar
            </button>
          </div>
        </div>
        <h1 class="detail-collab-title">${escHtml(s.title || 'Sin título')}</h1>
        <div class="detail-collab-authors">
          <div class="collab-avatar-stack">${stackHTML}</div>
          ${moreCount}
          <span class="collab-authors-more" style="color:var(--gray-300);">
            ${uniqueAuthors.length} autor${uniqueAuthors.length !== 1 ? 'es' : ''}
          </span>
        </div>
      </div>
      <div class="collab-paragraphs">${parasHTML}</div>
    </div>`;
}

async function detailToggleLike(btn) {
  const liked   = !btn.classList.contains('liked');
  const storyId = currentStory?.id ?? null;

  // Optimistic UI update
  btn.classList.toggle('liked');
  const span = btn.querySelector('span');
  if (!currentStory?.isCooperative) {
    span.textContent = liked ? 'Te gusta' : 'Me gusta';
  } else {
    const n = parseInt(span.textContent) || 0;
    span.textContent = liked ? n + 1 : n - 1;
  }
  if (currentStory) currentStory.userLiked = liked;

  try {
    if (liked) await addLike(storyId);
    else       await removeLike(storyId);
  } catch (e) {
    // Roll back on error
    console.error('Like error:', e);
    btn.classList.toggle('liked');
    if (!currentStory?.isCooperative) {
      span.textContent = liked ? 'Me gusta' : 'Te gusta';
    } else {
      const n = parseInt(span.textContent) || 0;
      span.textContent = liked ? n - 1 : n + 1;
    }
    if (currentStory) currentStory.userLiked = !liked;
    showToast('No se pudo actualizar el like. Inténtalo de nuevo.');
  }
}

async function detailToggleSave(btn) {
  const saving  = !btn.classList.contains('liked');
  const storyId = currentStory?.id ?? null;

  // Optimistic UI update
  btn.classList.toggle('liked');
  btn.querySelector('span').textContent = saving ? 'Guardada' : 'Guardar';
  if (currentStory) currentStory.userSaved = saving;
  showToast(saving ? 'Historia guardada ✓' : 'Historia eliminada de guardados');

  try {
    if (saving) await saveStoryApi(storyId);
    else        await unsaveStoryApi(storyId);
  } catch (e) {
    // Roll back on error
    console.error('Save error:', e);
    btn.classList.toggle('liked');
    btn.querySelector('span').textContent = saving ? 'Guardar' : 'Guardada';
    if (currentStory) currentStory.userSaved = !saving;
    showToast('No se pudo actualizar. Inténtalo de nuevo.');
  }
}

function openShare() {
  const link = `${location.origin}${location.pathname}?story=${currentStory?.id || ''}`;
  document.getElementById('shareLinkInput').value = link;
  openModal('share');
}

function shareVia(platform) {
  const link = encodeURIComponent(`${location.origin}${location.pathname}?story=${currentStory?.id || ''}`);
  const text = encodeURIComponent(`Lee esta historia en Ourstory: ${currentStory?.title || ''}`);
  const urls = {
    twitter:  `https://twitter.com/intent/tweet?text=${text}&url=${link}`,
    whatsapp: `https://api.whatsapp.com/send?text=${text}%20${link}`,
    telegram: `https://t.me/share/url?url=${link}&text=${text}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${link}`,
  };
  if (platform === 'instagram') { showToast('Copia el enlace y compártelo en Instagram'); return; }
  if (platform === 'more') {
    if (navigator.share) navigator.share({ title: currentStory?.title || 'Ourstory', url: decodeURIComponent(link) }).catch(() => {});
    else showToast('Copia el enlace para compartir');
    return;
  }
  if (urls[platform]) window.open(urls[platform], '_blank', 'noopener,width=600,height=400');
}

function copyShareLink() {
  const input = document.getElementById('shareLinkInput');
  navigator.clipboard?.writeText(input.value)
    .then(() => showToast('Enlace copiado ✓'))
    .catch(() => { input.select(); document.execCommand('copy'); showToast('Enlace copiado ✓'); });
}

function selectReport(btn) {
  document.querySelectorAll('.report-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const submitBtn = document.getElementById('reportSubmitBtn');
  submitBtn.disabled      = false;
  submitBtn.style.opacity = '1';
  submitBtn.style.cursor  = 'pointer';
}

function submitReport() {
  closeAllModals();
  showToast('Reporte enviado. Gracias por tu colaboración.');
}

function openEdit() {
  if (!currentStory || currentStory.isCooperative || !currentStory.isCurrentUser) return;
  const contentItem = Array.isArray(currentStory.content) && currentStory.content.length
    ? currentStory.content[0] : null;
  const rawText = contentItem
    ? (typeof contentItem === 'string' ? contentItem : contentItem.text || '') : '';
  document.getElementById('editTitle').value        = currentStory.title || '';
  document.getElementById('editContent').value      = rawText;
  document.getElementById('editCharCount').textContent = rawText.length;
  openModal('edit');
}

function submitEdit() {
  const title   = document.getElementById('editTitle').value.trim();
  const content = document.getElementById('editContent').value.trim();
  if (!title)            { showToast('El título no puede estar vacío'); return; }
  if (content.length < 30) { showToast('El contenido debe tener al menos 30 caracteres'); return; }
  if (currentStory) {
    currentStory.title = title;
    if (Array.isArray(currentStory.content) && currentStory.content.length) {
      currentStory.content[0] = { ...currentStory.content[0], text: content };
    } else {
      currentStory.content = [{ text: content }];
    }
    renderDetail(currentStory);
  }
  closeAllModals();
  showToast('Historia actualizada ✓');
}

// ═══════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 3000);
}

function updateCount(id, val) {
  document.getElementById(id).textContent = val.length;
}

function fmtNum(n) {
  if (n == null) return '—';
  return n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n);
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function relDate(d) {
  const diff = Date.now() - new Date(d).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 60)  return `Hace ${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `Hace ${h}h` : `Hace ${Math.floor(h / 24)}d`;
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Detect MIME type from a base64 string header. */
function detectMime(b64) {
  if (!b64) return 'image/jpeg';
  if (b64.startsWith('/9j'))   return 'image/jpeg';
  if (b64.startsWith('iVBOR')) return 'image/png';
  if (b64.startsWith('R0lGO')) return 'image/gif';
  return 'image/jpeg';
}

/** Strips diacritics/accents from a string for comparison purposes. */
function stripAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function highlightWords(text, words) {
  if (!text) return '';

  const usedWords = new Set(); // each target word highlighted at most once

  // Unicode-aware token split: captures sequences of Unicode letters/digits as
  // word-tokens; everything else (spaces, punctuation, HTML entities) passes through.
  // The capturing group keeps delimiters in the resulting array.
  const tokens = escHtml(text).split(/([\p{L}\p{N}]+)/u);

  const result = tokens.map(token => {
    // Non-word tokens pass through unchanged
    if (!/^[\p{L}\p{N}]+$/u.test(token)) return token;

    const normToken = stripAccents(token).toLowerCase();

    for (const w of words) {
      if (!w || usedWords.has(w)) continue;
      const normWord = stripAccents(w).toLowerCase();
      if (normToken === normWord) {
        usedWords.add(w);
        return `<strong class="word-highlight">${token}</strong>`;
      }
    }
    return token;
  });

  return result
    .join('')
    .split(/\n\n|\n/)
    .filter(p => p.trim())
    .map(p => `<p>${p}</p>`)
    .join('');
}

function buildAvatarHTML(imageB64, name, size, containerClass, initialsClass) {
  const ini = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (imageB64) {
    return `<div class="${containerClass}" style="width:${size}px;height:${size}px;">
              <img src="data:${detectMime(imageB64)};base64,${imageB64}" alt="${escHtml(name || '')}">
            </div>`;
  }
  return `<div class="${containerClass}" style="width:${size}px;height:${size}px;">
            <span class="${initialsClass}">${ini}</span>
          </div>`;
}

// ═══════════════════════════════════════════════════════════════════
//  BOOTSTRAP — expose globals for inline HTML onclick handlers,
//  then initialise session and nav state.
// ═══════════════════════════════════════════════════════════════════

// Because app.js is loaded as type="module" its scope is private.
// Inline onclick="..." handlers in the HTML need these on window.
Object.assign(window, {
  // Nav
  handleLogoClick, handleNavCta, logout, requireAuth,
  // Pages
  showPage, scrollToFeed,
  // Login
  togglePw, doLogin, openForgotModal, doForgotPassword,
  // Profile (own)
  switchProfileTab,
  // Blocked users
  confirmUnblock, confirmAction,
  // User profile (other users)
  openUserProfile, retryUserProfile, toggleFollowUser, toggleBlockUser,
  // Modals
  openModal, closeAllModals, openModalMode,
  // Words modal
  submitWordsStep1, submitWordsStory,
  // Collab modal
  submitCollabParagraph, submitCollabNew,
  // Home feed
  switchFeedTab, loadMoreStories, retryFeedTab,
  // Feed / cards
  toggleLike, saveStory,
  // Detail
  handleCardClick, goBack, detailToggleLike, detailToggleSave,
  openShare, shareVia, copyShareLink,
  selectReport, submitReport,
  openEdit, submitEdit,
  // Utilities
  updateCount,
});

// ═══════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════
session.load();
updateNav();

(async function restoreSession() {
  const savedPage = sessionStorage.getItem('os_page') || 'home';
  const authPages = ['profile', 'user-profile', 'detail'];

  // If saved page needs auth but session is gone → land on home
  if (authPages.includes(savedPage) && !session.isLoggedIn) {
    showPage('home');
    return;
  }

  if (savedPage === 'detail') {
    // Restore story detail from sessionStorage
    const raw = sessionStorage.getItem('os_detail_story');
    if (raw) {
      try {
        const story = JSON.parse(raw);
        currentStory = story;
        prevPage     = sessionStorage.getItem('os_detail_prev') || 'home';
        // Show the detail page skeleton first
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('detail-page').classList.add('active');
        renderDetail(story);
        // Also prime the home feed in the background so Back works
        loadHomeFeed();
        return;
      } catch (_) { /* corrupted — fall through to home */ }
    }
    showPage('home');
    return;
  }

  if (savedPage === 'user-profile') {
    const userId = sessionStorage.getItem('os_user_profile_id');
    if (userId) {
      prevPage = sessionStorage.getItem('os_user_profile_prev') || 'home';
      // Show the page skeleton (loading state is already in HTML)
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('user-profile-page').classList.add('active');
      // Reload the user data via API
      await loadUserProfile(userId);
      // Prime home feed in background
      loadHomeFeed();
      return;
    }
    showPage('home');
    return;
  }

  // For all other pages (home, profile, login) — normal navigation
  showPage(savedPage);
})();

// Enter-key support for login / forgot forms
document.addEventListener('DOMContentLoaded', () => {
  ['loginIdentifier', 'loginPassword'].forEach(id =>
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    }));
  document.getElementById('forgotEmail')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doForgotPassword();
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(b =>
    b.addEventListener('click', e => { if (e.target === b) closeAllModals(); }));
});
