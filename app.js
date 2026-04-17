/**
 * app.js
 *
 * Main application controller.
 * Imports session state, auth, and profile services; wires them to the DOM.
 */

import { session }                          from './models/Session.js';
import { login, register, requestPasswordReset,
         sendVerificationEmail, changePassword,
         logout as authLogout }             from './services/AuthService.js';
import { getCurrentUser, getProfileStats }  from './services/ProfileService.js';
import { getStories, getStoriesByType,
         getStoryById, StoryType }          from './services/StoriesService.js';
import { addLike, removeLike }              from './services/LikeService.js';
import { saveStoryApi, unsaveStoryApi }     from './services/SaveService.js';
import { reportStory }                      from './services/ReportService.js';
import { searchUsers }                      from './services/SearchService.js';
import { getUserDetail }                    from './services/UserService.js';
import { followUser, unfollowUser,
         blockUser, unblockUser }           from './services/SocialService.js';
import { updateProfile }                    from './services/UserProfileService.js';
import { getCurrentUserWords, addWords,
         getUserCooperative,
         addCooperativeStory }              from './services/StoryCreateService.js';

// ═══════════════════════════════════════════════════════════════════
//  NAV
// ═══════════════════════════════════════════════════════════════════
function updateNav() {
  const li = session.isLoggedIn;
  // Right side
  document.getElementById('navCtaBtn').style.display      = li ? 'none' : '';
  document.getElementById('navProfileItem').style.display = li ? 'flex' : 'none';
  // Centre tabs — hide Inicio/Historias/Crear when logged in
  document.getElementById('navInicioItem').style.display    = li ? 'none' : '';
  document.getElementById('navHistoriasItem').style.display = li ? 'none' : '';
  document.getElementById('navCreateItem').style.display    = li ? '' : 'none';
  document.getElementById('navSearchItem').style.display    = li ? '' : 'none';
  if (li) {
    const displayName = session.alias || session.username || '';
    document.getElementById('navUserName').textContent = displayName;
    const navBtn = document.getElementById('navAvatarBtn');
    if (session.imageUrl) {
      navBtn.innerHTML = `<img src="${session.imageUrl}" alt="${escHtml(displayName)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      const ini = displayName.slice(0, 2).toUpperCase() || 'U';
      navBtn.innerHTML = `<span class="nav-avatar-initials" id="navAvatarInitials">${ini}</span>`;
    }
  }
}

function handleLogoClick() {
  location.hash = 'home';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function handleNavCta() { location.hash = 'login'; }

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
//  PAGES — internal navigation (does NOT touch location.hash)
// ═══════════════════════════════════════════════════════════════════
let _restoreScroll = false; // set by goBack() to skip auto-scroll-to-top

function _activatePage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById(name + '-page');
  if (pg) pg.classList.add('active');

  if (_restoreScroll) {
    _restoreScroll = false;
    const y = _prevScrollY;
    // Double rAF: first frame activates the page, second restores scroll
    // after the browser has had a chance to paint and measure the layout
    requestAnimationFrame(() => requestAnimationFrame(() =>
      window.scrollTo({ top: y, behavior: 'instant' })
    ));
  } else {
    window.scrollTo(0, 0);
  }
}

// showPage: used by all internal onclick handlers.
// Sets the hash → triggers the router → router does the actual work.
function showPage(name) {
  if (name === 'profile' && !session.isLoggedIn) { location.hash = 'login'; return; }
  location.hash = name;
}

function scrollToFeed() {
  location.hash = 'home';
  setTimeout(() => document.getElementById('feed-anchor')?.scrollIntoView({ behavior: 'smooth' }), 100);
}

// ═══════════════════════════════════════════════════════════════════
//  HASH ROUTER
// ═══════════════════════════════════════════════════════════════════

// Parse '#detail/abc123' → { page: 'detail', param: 'abc123' }
function _parseHash(hash) {
  const h = (hash || '').replace(/^#/, '');
  if (!h || h === 'home')          return { page: 'home',         param: null };
  if (h === 'profile')             return { page: 'profile',      param: null };
  if (h === 'login')               return { page: 'login',        param: null };
  if (h === 'register')            return { page: 'register',     param: null };
  if (h === 'verify')              return { page: 'verify',       param: null };
  if (h === 'edit-profile')        return { page: 'edit-profile', param: null };
  if (h.startsWith('detail/'))     return { page: 'detail',       param: h.slice(7) };
  if (h.startsWith('user/'))       return { page: 'user-profile', param: h.slice(5) };
  return { page: h, param: null };
}

async function _route(hash) {
  const { page, param } = _parseHash(hash);

  // Stop verification polling when navigating away from verify
  if (page !== 'verify') {
    clearInterval(_verifyPollInterval);
    clearInterval(_resendTimer);
  }

  // Auth guard — only profile strictly needs auth
  if ((page === 'profile' || page === 'edit-profile') && !session.isLoggedIn) {
    _activatePage('login'); return;
  }

  if (page === 'edit-profile') {
    _activatePage('edit-profile');
    initEditProfilePage();
    return;
  }

  if (page === 'detail') {
    if (param && _restoreScroll && currentStory?.id === param) {
      // Coming back from a sub-page — re-render without API call, then restore scroll
      _activatePage('detail'); // clears _restoreScroll and sets rAF to restore
    } else if (param) {
      _activatePage('detail');
      await _loadDetailPage(param);
    } else {
      location.hash = 'home';
    }
    return;
  }

  if (page === 'user-profile') {
    _activatePage('user-profile');
    if (param) {
      await loadUserProfile(param);
    } else {
      location.hash = 'home';
    }
    return;
  }

  if (page === 'home') {
    _hasHistory = false;
    _updateMeta(); // restore default title/description
    _activatePage('home');
    if (session.isLoggedIn) {
      document.getElementById('homeGuest').style.display     = 'none';
      document.getElementById('homeDashboard').style.display = 'block';
      homeFeedLoaded = false;
      loadHomeFeed();
    } else {
      document.getElementById('homeGuest').style.display     = 'block';
      document.getElementById('homeDashboard').style.display = 'none';
      homeFeedLoaded = false;
      loadHomeFeed();
    }
    return;
  }

  if (page === 'profile') {
    _activatePage('profile');
    loadProfile();
    return;
  }

  // Simple pages with their own HTML (no extra logic needed)
  if (['login', 'register', 'verify'].includes(page)) {
    _activatePage(page);
    return;
  }

  // Unknown route → 404
  _activatePage('not-found');
}

async function _loadDetailPage(storyId) {
  // Show back button only if opened from within the app, not via a direct link
  const backBtn = document.getElementById('detailBackBtn');
  if (backBtn) backBtn.style.display = _hasHistory ? '' : 'none';

  const el = document.getElementById('detailContent');
  el.innerHTML = `<div class="feed-loading" style="padding:8rem;"><div class="loading-spinner"></div>Cargando historia...</div>`;
  try {
    const story = await getStoryById(storyId);
    if (story) {
      currentStory = story;
      renderDetail(story);
      // Update meta tags so shared links show story info
      _updateMeta(
        `${story.title || 'Historia'} — Ourstory`,
        story.content?.[0]?.text?.slice(0, 150) || 'Lee esta historia en Ourstory.'
      );
    } else {
      location.hash = 'home';
    }
  } catch (_) {
    location.hash = 'home';
  }
}

// goBack: navigate back — uses the previous hash if available
let _prevHash      = '#home';
let _prevScrollY   = 0;        // scroll position to restore when going back
let _hasHistory    = false;    // true only when detail was opened via internal navigation
let currentStory   = null;     // story currently shown in detail page
let _collabAssignedStory = null; // story assigned for cooperative continuation

function goBack() {
  _restoreScroll = true;       // flag: skip scrollTo(0,0) on the next _activatePage
  location.hash  = _prevHash.replace(/^#/, '') || 'home';
}

// Open a story detail page from a card click
function openDetail(story) {
  _prevHash    = location.hash || '#home';
  _prevScrollY = window.scrollY;          // remember where user was
  _hasHistory  = true;                    // came from inside the app
  currentStory = story;
  location.hash = 'detail/' + story.id;
}

// Open a user profile page
// ─── Collab authors dialog ────────────────────────────────────────
function openCollabAuthorsDialog(encodedAuthors) {
  let authors;
  try { authors = JSON.parse(decodeURIComponent(encodedAuthors)); } catch (_) { return; }

  const list = document.getElementById('collabAuthorsList');
  list.innerHTML = authors.map(a => {
    const ini        = (a.author || '?').slice(0, 2).toUpperCase();
    const avatarHtml = a.userImage
      ? `<img src="${a.userImage}" alt="${escHtml(a.author || '')}">`
      : `<span class="collab-dialog-ini">${ini}</span>`;
    const isMe    = a.userId === session.userId;
    const goTo    = isMe ? `location.hash='profile'` : `_prevScrollY=window.scrollY; openUserProfile('${a.userId}'); closeAllModals();`;
    const actionBtn = isMe
      ? `<span class="collab-dialog-you">Tú</span>`
      : `<button class="collab-dialog-action" onclick="${goTo}">Ver perfil</button>`;
    return `
      <div class="collab-dialog-author">
        <div class="collab-dialog-avatar" onclick="${goTo}" style="cursor:pointer;">${avatarHtml}</div>
        <div class="collab-dialog-info">
          <span class="collab-dialog-name">${escHtml(a.author || 'Anónimo')}</span>
        </div>
        ${actionBtn}
      </div>`;
  }).join('');

  openModal('collabAuthors');
}

function openUserProfile(userId) {
  if (!userId || userId === session.userId) { location.hash = 'profile'; return; }
  _prevHash    = location.hash || '#home';
  _prevScrollY = window.scrollY;
  // _hasHistory stays true so the back button remains visible when returning to detail
  location.hash = 'user/' + userId;
}

window.addEventListener('hashchange', () => {
  _route(location.hash);
});



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
  btn.classList.add('loading'); btn.disabled = true;
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
    btn.classList.remove('loading'); btn.disabled = false;
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
    errEl.classList.add('visible'); return;
  }
  errEl.classList.remove('visible');
  const btn = document.getElementById('forgotBtn');
  btn.classList.add('loading'); btn.disabled = true;
  try {
    await requestPasswordReset(email);
    document.getElementById('forgotForm').style.display    = 'none';
    document.getElementById('forgotSuccess').style.display = 'block';
  } catch (e) {
    showToast('Error al enviar el email. Inténtalo de nuevo.');
  } finally {
    btn.classList.remove('loading'); btn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  REGISTER
// ═══════════════════════════════════════════════════════════════════
function clearRegisterErrors() {
  ['regUsername', 'regEmail', 'regPassword'].forEach(id =>
    document.getElementById(id).classList.remove('has-error'));
  ['regUsernameErr', 'regEmailErr', 'regPasswordErr', 'regTermsErr'].forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('visible');
  });
  // Reset dynamic messages back to defaults
  document.getElementById('regUsernameErr').textContent = 'El usuario debe tener al menos 4 caracteres';
  document.getElementById('regEmailErr').textContent    = 'Introduce un email válido';
  document.getElementById('registerErrorBanner').classList.remove('visible');
  document.getElementById('registerErrorBanner').innerHTML = '';
}

async function doRegister() {
  clearRegisterErrors();
  const username = document.getElementById('regUsername').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const terms    = document.getElementById('regTerms').checked;
  let hasError   = false;

  if (username.length < 4) {
    document.getElementById('regUsername').classList.add('has-error');
    document.getElementById('regUsernameErr').classList.add('visible');
    hasError = true;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('regEmail').classList.add('has-error');
    document.getElementById('regEmailErr').classList.add('visible');
    hasError = true;
  }
  if (password.length < 6) {
    document.getElementById('regPassword').classList.add('has-error');
    document.getElementById('regPasswordErr').classList.add('visible');
    hasError = true;
  }
  if (!terms) {
    document.getElementById('regTermsErr').classList.add('visible');
    hasError = true;
  }
  if (hasError) return;

  const btn = document.getElementById('registerBtn');
  btn.classList.add('loading'); btn.disabled = true;
  try {
    await register(username, email, password);
    updateNav();
    // Go to verify screen — user must click "Reenviar" to trigger the email
    startVerifyFlow(email);
  } catch (e) {
    const banner  = document.getElementById('registerErrorBanner');
    const code    = e.data?.code ?? e.status; // Parse error code is in data.code
    if (code === 202) {
      // Username already taken — highlight the username field
      document.getElementById('regUsername').classList.add('has-error');
      document.getElementById('regUsernameErr').textContent = 'Este nombre de usuario ya está en uso. Elige otro.';
      document.getElementById('regUsernameErr').classList.add('visible');
    } else if (code === 203) {
      // Email already registered — highlight email field + offer recovery
      document.getElementById('regEmail').classList.add('has-error');
      document.getElementById('regEmailErr').textContent = 'Este email ya está registrado.';
      document.getElementById('regEmailErr').classList.add('visible');
      banner.innerHTML = `¿Ya tienes cuenta? <button class="legal-link" onclick="location.hash='login'" style="font-size:inherit;">Inicia sesión</button> o <button class="legal-link" onclick="openForgotModal()" style="font-size:inherit;">recupera tu contraseña</button>.`;
      banner.classList.add('visible');
    } else {
      banner.textContent = 'No se pudo crear la cuenta. Inténtalo de nuevo.';
      banner.classList.add('visible');
    }
  } finally {
    btn.classList.remove('loading'); btn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  VERIFY EMAIL
// ═══════════════════════════════════════════════════════════════════
let _verifyEmail        = '';
let _verifyPollInterval = null;
let _resendTimer        = null;
const RESEND_COOLDOWN   = 30; // seconds

function startVerifyFlow(email) {
  _verifyEmail = email;
  document.getElementById('verifyEmailBadge').textContent = email;
  // Reset button to enabled — no cooldown until first send
  const btn       = document.getElementById('resendBtn');
  const countdown = document.getElementById('resendCountdown');
  btn.disabled            = false;
  countdown.textContent   = '';
  clearInterval(_resendTimer);
  location.hash = 'verify';
  _startVerifyPolling();
}

function _startResendCooldown() {
  const btn       = document.getElementById('resendBtn');
  const countdown = document.getElementById('resendCountdown');
  let seconds     = RESEND_COOLDOWN;
  btn.disabled    = true;
  clearInterval(_resendTimer);

  _resendTimer = setInterval(() => {
    seconds--;
    countdown.textContent = seconds > 0
      ? `Puedes reenviar en ${seconds}s`
      : '';
    if (seconds <= 0) {
      clearInterval(_resendTimer);
      btn.disabled = false;
      countdown.textContent = '';
    }
  }, 1000);
}

async function resendVerification() {
  if (!_verifyEmail) return;
  const btn = document.getElementById('resendBtn');
  btn.disabled = true;
  try {
    await sendVerificationEmail(_verifyEmail);
    showToast('Email de verificación reenviado ✓');
  } catch (_) {
    showToast('No se pudo reenviar. Inténtalo de nuevo.');
  }
  _startResendCooldown();
}

function _startVerifyPolling() {
  clearInterval(_verifyPollInterval);
  // Poll every 5 seconds
  _verifyPollInterval = setInterval(_checkVerification, 10000);
}

async function _checkVerification() {
  if (!session.isLoggedIn) { clearInterval(_verifyPollInterval); return; }
  try {
    const { apiGET } = await import('./services/api.js');
    const user = await apiGET('users/me', {}, /* withToken= */ true);
    if (user.emailVerified) {
      clearInterval(_verifyPollInterval);
      _onVerified();
    }
  } catch (_) { /* network hiccup — keep polling */ }
}

async function _onVerified() {
  showToast('¡Email verificado! Cargando tus historias...');
  homeFeedLoaded = false;
  location.hash  = 'home';
}

// ═══════════════════════════════════════════════════════════════════
//  EDIT PROFILE
// ═══════════════════════════════════════════════════════════════════
let _editAvatarBase64 = null;  // new image selected by user (base64, no prefix)
let _editAvatarRemoved = false; // user explicitly removed the photo

function initEditProfilePage() {
  _editAvatarBase64  = null;
  _editAvatarRemoved = false;
  document.getElementById('editProfileError').classList.remove('visible');
  document.getElementById('editProfileError').textContent = '';

  // Pre-fill fields from session cache
  const alias = session.alias || session.username || '';
  document.getElementById('editAlias').value       = alias;
  document.getElementById('editBiography').value   = session.biography || '';
  document.getElementById('editBioCount').textContent = (session.biography || '').length;
  document.getElementById('editAliasErr').classList.remove('visible');

  // Avatar preview
  _renderEditAvatar(session.imageUrl, alias);
}

function _renderEditAvatar(imageUrl, name) {
  const preview    = document.getElementById('editAvatarPreview');
  const removeBtn  = document.getElementById('editAvatarRemoveBtn');
  const ini        = (name || 'U').slice(0, 2).toUpperCase();
  if (imageUrl) {
    preview.innerHTML = `<img src="${imageUrl}" alt="${escHtml(name)}">`;
    removeBtn.style.display = 'inline';
  } else {
    preview.innerHTML = `<span class="edit-avatar-initials" id="editAvatarInitials">${ini}</span>`;
    removeBtn.style.display = 'none';
  }
}

function onAvatarFileSelected(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast('La imagen no puede superar 2 MB');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    // Strip the data URI prefix to get plain base64
    const dataUrl = e.target.result;
    _editAvatarBase64  = dataUrl.split(',')[1];
    _editAvatarRemoved = false;
    // Show preview
    const preview   = document.getElementById('editAvatarPreview');
    const removeBtn = document.getElementById('editAvatarRemoveBtn');
    preview.innerHTML = `<img src="${dataUrl}" alt="preview">`;
    removeBtn.style.display = 'inline';
  };
  reader.readAsDataURL(file);
  input.value = ''; // reset so same file can be re-selected
}

function removeEditAvatar() {
  _editAvatarBase64  = null;
  _editAvatarRemoved = true;
  const alias = document.getElementById('editAlias').value || session.username || 'U';
  _renderEditAvatar(null, alias);
}

async function doSaveProfile() {
  const alias    = document.getElementById('editAlias').value.trim();
  const biography = document.getElementById('editBiography').value.trim();

  if (!alias) {
    document.getElementById('editAliasErr').classList.add('visible');
    return;
  }
  document.getElementById('editAliasErr').classList.remove('visible');

  const btn = document.getElementById('editProfileBtn');
  btn.classList.add('loading'); btn.disabled = true;
  const errEl = document.getElementById('editProfileError');
  errEl.classList.remove('visible'); errEl.textContent = '';

  try {
    // Only send image field if changed: new base64 or null to remove
    const imageField = _editAvatarBase64 !== null
      ? _editAvatarBase64
      : (_editAvatarRemoved ? '' : undefined);

    const result = await updateProfile({
      alias,
      biography: biography || null,
      image: imageField ?? null,
    });

    // Update session with returned values
    session.alias     = result.alias     || alias;
    session.biography = result.biography || biography;
    if (_editAvatarRemoved)           session.imageUrl = null;
    if (_editAvatarBase64 !== null)   session.imageUrl = result.imageUrl;
    session.save();

    // Refresh nav
    updateNav();

    // Refresh profile page data if already loaded
    const profileName = document.getElementById('profileName');
    if (profileName) {
      profileName.textContent = session.alias || session.username;
      document.getElementById('profileBio').textContent = session.biography || 'Sin biografía.';
      const avatarEl = document.getElementById('profileAvatar');
      if (avatarEl) {
        if (session.imageUrl) {
          avatarEl.innerHTML = `<img src="${session.imageUrl}" alt="${escHtml(session.alias || session.username)}">`;
        } else {
          const ini = (session.alias || session.username || 'U').slice(0, 2).toUpperCase();
          avatarEl.innerHTML = `<span class="profile-avatar-initials">${ini}</span>`;
        }
      }
    }

    showToast('Perfil actualizado ✓');
    location.hash = 'profile';
  } catch (e) {
    console.error('Update profile error:', e);
    errEl.textContent = 'No se pudo actualizar el perfil. Inténtalo de nuevo.';
    errEl.classList.add('visible');
  } finally {
    btn.classList.remove('loading'); btn.disabled = false;
  }
}

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
    initWordsModal();
  } else {
    initCollabModal();
  }
}

// ─── 3 PALABRAS ──────────────────────────────────────────────────

function resetWordsModal() {
  ['wordIn1', 'wordIn2', 'wordIn3'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('wordsStoryText').value       = '';
  document.getElementById('wordsCharCount').textContent = '0';
  // Reset to step 1 (input words); step 2 is shown if user already has words
  setWordStep(1);
}

function setWordStep(s) {
  document.getElementById('wordsStep1').classList.toggle('active', s === 1);
  document.getElementById('wordsStep2').classList.toggle('active', s === 2);
  document.getElementById('wdot1').className = 'step-dot' + (s > 1 ? ' done' : ' active');
  document.getElementById('wdot2').className = 'step-dot' + (s === 2 ? ' active' : '');
  document.getElementById('wordsStepLabel').textContent = `Paso ${s} de 2 — 3 Palabras`;
  document.getElementById('wordsStepTitle').textContent = s === 1 ? 'Aporta tus palabras' : 'Escribe tu historia';
}

/** Show received words in the modal and move to step 2. */
function _showReceivedWords(words) {
  const list = [words.first, words.second, words.third].filter(w => w);
  document.getElementById('receivedWordsList').innerHTML =
    list.map(w => `<span class="received-word">${w}</span>`).join('');
  setWordStep(2);
}

/** Called when the words modal opens — check if user already has words. */
async function initWordsModal() {
  resetWordsModal();
  document.getElementById('modalWords').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Show loading on step 1 while we check
  const continueBtn = document.querySelector('#wordsStep1 .btn-primary');
  if (continueBtn) { continueBtn.disabled = true; continueBtn.textContent = 'Comprobando...'; }

  try {
    const existing = await getCurrentUserWords();
    if (existing) {
      // User already has words assigned — skip straight to writing
      _showReceivedWords(existing);
    }
  } catch (e) {
    console.error('getCurrentUserWords error:', e);
    // On error, let the user proceed normally through step 1
  } finally {
    if (continueBtn) { continueBtn.disabled = false; continueBtn.textContent = 'Continuar →'; }
  }
}

/** Step 1 submit — contribute words and receive new ones from the API. */
async function submitWordsStep1() {
  const [first, second, third] = ['wordIn1', 'wordIn2', 'wordIn3']
    .map(id => document.getElementById(id).value.trim());
  if (!first || !second || !third) { showToast('Introduce las 3 palabras para continuar'); return; }

  const btn = document.querySelector('#wordsStep1 .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  try {
    const received = await addWords(first, second, third);
    _showReceivedWords(received);
  } catch (e) {
    console.error('addWords error:', e);
    showToast('No se pudieron enviar las palabras. Inténtalo de nuevo.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Continuar →'; }
  }
}

function submitWordsStory() {
  if (document.getElementById('wordsStoryText').value.trim().length < 30) {
    showToast('La historia debe tener al menos 30 caracteres'); return;
  }
  closeAllModals(); resetWordsModal(); showToast('¡Historia publicada! ✓');
}

// ─── COLABORATIVA ────────────────────────────────────────────────

function resetCollabModal() {
  _collabAssignedStory = null;
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

/** Called when the collab modal opens — fetch assignment from API. */
async function initCollabModal() {
  resetCollabModal();
  document.getElementById('modalCollab').classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    const { action, story } = await getUserCooperative();

    document.getElementById('collabAssignLoading').style.display = 'none';

    if (action === 'CONTINUE' && story) {
      // User must add a paragraph to an existing story
      _collabAssignedStory = story; // store for submitCollabParagraph
      document.getElementById('collabStepTitle').textContent = 'Continúa la historia';

      const contents = Array.isArray(story.content) ? story.content : [];

      // Title + paragraph count
      document.getElementById('collabContextTitle').textContent = story.title || 'Sin título';
      document.getElementById('collabContextMeta').textContent  =
        `${contents.length} párrafo${contents.length !== 1 ? 's' : ''}`;

      // Render all paragraphs with authors
      const parasEl = document.getElementById('collabContextParagraphs');
      if (!contents.length) {
        parasEl.innerHTML = '<p class="continue-empty">Sé el primero en añadir un párrafo.</p>';
      } else {
        parasEl.innerHTML = contents.map((c, i) => {
          const ini    = (c.author || '?').slice(0, 2).toUpperCase();
          const avatar = c.userImage
            ? `<img src="${c.userImage}" alt="${escHtml(c.author || '')}">`
            : ini;
          return `
            <div class="continue-para-block">
              <span class="continue-para-num">${String(i + 1).padStart(2, '0')}</span>
              <div class="continue-para-content">
                <p class="continue-para-text">${escHtml(c.text || '')}</p>
                <div class="continue-para-author">
                  <div class="continue-para-avatar">${avatar}</div>
                  <span class="continue-para-name">${escHtml(c.author || 'Anónimo')}</span>
                </div>
              </div>
            </div>`;
        }).join('');

        // Scroll to bottom so user sees the most recent paragraph
        setTimeout(() => { parasEl.scrollTop = parasEl.scrollHeight; }, 50);
      }

      document.getElementById('collabContinueUI').style.display = 'block';

    } else {
      // action === 'START' — user must begin a new story
      document.getElementById('collabStepTitle').textContent = '¡Te toca empezar! Crea una nueva historia';
      document.getElementById('collabStartUI').style.display = 'block';
    }

  } catch (e) {
    console.error('getUserCooperative error:', e);
    document.getElementById('collabAssignLoading').style.display = 'none';
    // Fallback: let the user start a new story
    document.getElementById('collabStepTitle').textContent = '¡Te toca empezar! Crea una nueva historia';
    document.getElementById('collabStartUI').style.display = 'block';
    showToast('No se pudo cargar la asignación. Puedes iniciar una historia nueva.');
  }
}

async function submitCollabParagraph() {
  const text = document.getElementById('collabContinueText').value.trim();
  if (text.length < 30) {
    showToast('El párrafo debe tener al menos 30 caracteres'); return;
  }
  if (!_collabAssignedStory) {
    showToast('Error: no hay historia asignada'); return;
  }

  const btn = document.querySelector('#collabContinueUI .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  try {
    const content = {
      text,
      author: session.alias || session.username || '',
      userId: session.userId || '',
    };
    await addCooperativeStory(
      _collabAssignedStory.id,
      _collabAssignedStory.title || '',
      content
    );
    _collabAssignedStory = null;
    closeAllModals();
    showToast('¡Párrafo añadido! ✓');
  } catch (e) {
    console.error('addCooperativeStory error:', e);
    showToast('Error al enviar el párrafo. Inténtalo de nuevo.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Añadir párrafo'; }
  }
}

function submitCollabNew() {
  if (!document.getElementById('collabNewTitle').value.trim()) {
    showToast('Escribe un título para la historia'); return;
  }
  if (document.getElementById('collabNewText').value.trim().length < 30) {
    showToast('El párrafo inicial debe tener al menos 30 caracteres'); return;
  }
  closeAllModals(); showToast('¡Historia iniciada! Otros escritores la continuarán ✓');
}

// ═══════════════════════════════════════════════════════════════════
//  HOME FEED
// ═══════════════════════════════════════════════════════════════════
const feedState = {
  latest:    { page: 0, loading: false, done: false },
  trending:  { page: 0, loading: false, done: false },
  following: { page: 0, loading: false, done: false },
};
const dashFeedState = {
  latest:    { page: 0, loading: false, done: false },
  trending:  { page: 0, loading: false, done: false },
  following: { page: 0, loading: false, done: false },
};
let homeFeedLoaded = false;

// ─── Meta tag updater ─────────────────────────────────────────────
const _defaultTitle = 'Ourstory — Historias que cobran vida';
const _defaultDesc  = 'Una red social literaria donde cada historia nace de la colaboración. Escribe, comparte y descubre narrativas únicas creadas entre muchas voces.';

function _updateMeta(title = _defaultTitle, description = _defaultDesc) {
  document.title = title;
  const set = (sel, val) => { const el = document.querySelector(sel); if (el) el.setAttribute('content', val); };
  set('meta[name="description"]',         description);
  set('meta[property="og:title"]',        title);
  set('meta[property="og:description"]',  description);
  set('meta[name="twitter:title"]',       title);
  set('meta[name="twitter:description"]', description);
  // Update og:url to current page URL (includes hash for story deep links)
  set('meta[property="og:url"]', location.href);
}

// ─── Infinite scroll setup ────────────────────────────────────────
// Sentinel div at the bottom of each panel. When it enters the
// viewport (with 500px of advance) we load the next page.
const _scrollObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const { type, prefix } = entry.target.dataset;
      if (prefix === 'dash') _doLoadMore(type, dashFeedState, 'dash');
      else                    _doLoadMore(type, feedState,     'feed');
    });
  },
  { rootMargin: '0px 0px 600px 0px', threshold: 0 }
);

function _attachSentinel(prefix, tabKey, type) {
  const panel = document.getElementById(
    prefix === 'dash' ? `dash-${tabKey}` : `feed-${tabKey}`
  );
  if (!panel) return;
  // Remove old sentinel if any
  panel.querySelector('.scroll-sentinel')?.remove();
  const sentinel = document.createElement('div');
  sentinel.className      = 'scroll-sentinel';
  sentinel.dataset.type   = type;
  sentinel.dataset.prefix = prefix;
  sentinel.style.cssText  = 'height:10px;width:100%;';
  panel.appendChild(sentinel);
  _scrollObserver.observe(sentinel);
}

async function _doLoadMore(type, state, prefix) {
  const tabKey = type.toLowerCase();
  const s      = state[tabKey];
  if (s.loading || s.done) return;
  s.loading = true; s.page += 1;

  // Show subtle spinner above the sentinel
  const panel = document.getElementById(
    prefix === 'dash' ? `dash-${tabKey}` : `feed-${tabKey}`
  );
  let spinner = panel?.querySelector('.infinite-spinner');
  if (!spinner && panel) {
    spinner = document.createElement('div');
    spinner.className = 'infinite-spinner';
    spinner.innerHTML = '<div class="loading-spinner"></div>';
    // Insert before sentinel so it shows above it
    const sentinel = panel.querySelector('.scroll-sentinel');
    sentinel ? panel.insertBefore(spinner, sentinel) : panel.appendChild(spinner);
  }
  if (spinner) spinner.style.display = 'flex';

  try {
    const stories = await getStoriesByType(type, s.page);
    if (!stories || !stories.length) {
      s.done = true;
      panel?.querySelector('.scroll-sentinel')?.remove();
      if (spinner) spinner.style.display = 'none';
      return;
    }
    const contentEl = document.getElementById(
      prefix === 'dash' ? `dash-${tabKey}-content` : `feed-${tabKey}-content`
    );
    const container = contentEl?.querySelector('.story-grid-3, .story-stream');
    if (container) container.insertAdjacentHTML('beforeend', stories.map(storyCardHTML).join(''));
  } catch (e) {
    console.error('Infinite scroll error:', e);
    s.page -= 1; // allow retry on next intersection
  } finally {
    s.loading = false;
    if (spinner) spinner.style.display = 'none';
  }
}

const _feedTabOrder = ['latest', 'trending', 'following'];

function switchFeedTab(tab, btn) {
  document.querySelectorAll('.feed-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.feed-tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('feed-' + tab).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadHomeFeed() {
  homeFeedLoaded = true;
  try {
    const feed = await getStories(0);
    if (session.isLoggedIn) {
      // Dashboard layout
      renderDashPanel('latest',    feed.latest);
      renderDashPanel('trending',  feed.trending);
      renderDashPanel('following', feed.following);
      renderDashStats(feed.stats);
      populateDashUserCard();
    } else {
      // Guest layout
      renderFeedPanel('latest',    feed.latest,    'grid');
      renderFeedPanel('trending',  feed.trending,  'grid');
      renderFeedPanel('following', feed.following, 'grid');
      renderHeroStats(feed.stats);
    }
  } catch (e) {
    console.error('Home feed error:', e);
    homeFeedLoaded = false;
    if (session.isLoggedIn) {
      ['latest','trending','following'].forEach(t => {
        const el = document.getElementById(`dash-${t}-content`);
        if (el) el.innerHTML = `<div class="feed-error"><p class="feed-error-text">No se pudo cargar.</p><button class="btn-secondary" onclick="loadHomeFeed()">Reintentar</button></div>`;
      });
    } else {
      ['latest', 'trending', 'following'].forEach(tab => renderFeedError(tab));
    }
  }
}

// ─── Dashboard panels ──────────────────────────────────────────
function renderDashPanel(tabKey, stories) {
  const contentEl = document.getElementById(`dash-${tabKey}-content`);
  const moreEl    = document.getElementById(`dash-${tabKey}-more`);
  if (!contentEl) return;

  // Reset pagination state for this tab
  dashFeedState[tabKey].page = 0;
  dashFeedState[tabKey].done = false;

  if (!stories.length) {
    contentEl.innerHTML = feedEmptyHTML(tabKey);
    if (moreEl) moreEl.style.display = 'none';
    return;
  }
  contentEl.innerHTML = `<div class="story-grid-3">${stories.map(storyCardHTML).join('')}</div>`;
  if (moreEl) moreEl.style.display = 'none'; // replaced by infinite scroll

  const TYPE_MAP = { latest: 'LATEST', trending: 'TRENDING', following: 'FOLLOWING' };
  _attachSentinel('dash', tabKey, TYPE_MAP[tabKey]);
}

function renderDashStats(stats) {
  if (!stats) return;
  const map = {
    'dashStatStories':    stats.totalStories,
    'dashStatUsers':      stats.totalUsers,
    'dashStatParagraphs': stats.totalCooperativeParagraphs,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val > 0) el.textContent = fmtNum(val);
  });
}

function populateDashUserCard() {
  const alias    = session.alias    || session.username || '';
  const bio      = session.biography || '';
  const imageUrl = session.imageUrl  || null;

  document.getElementById('dashName').textContent     = alias;
  document.getElementById('dashUsername').textContent = '@' + (session.username || '');
  document.getElementById('dashBio').textContent      = bio;

  const avatarEl = document.getElementById('dashAvatar');
  if (imageUrl) {
    avatarEl.innerHTML = `<img src="${imageUrl}" alt="${escHtml(alias)}">`;
  } else {
    const ini = alias.slice(0, 2).toUpperCase() || 'U';
    avatarEl.innerHTML = `<span class="dash-avatar-ini">${ini}</span>`;
  }

  // Stats come from the profile service — use cached session values if available
  // They'll be updated when profile loads; show dashes for now if missing
}

// ─── Dashboard tab switching ───────────────────────────────────
const _dashTabOrder = ['latest', 'trending', 'following'];

function switchDashTab(tab, btn) {
  document.querySelectorAll('.dash-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.dash-tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('dash-' + tab).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


function renderHeroStats(stats) {
  if (!stats) return;
  const targets = [
    { id: 'heroStatStories',    value: stats.totalStories },
    { id: 'heroStatUsers',      value: stats.totalUsers },
    { id: 'heroStatParagraphs', value: stats.totalCooperativeParagraphs },
  ];
  targets.forEach(({ id, value }, i) => {
    const el = document.getElementById(id);
    if (!el || !value) return;
    // Stagger each counter slightly
    setTimeout(() => _animateCounter(el, value), i * 120);
  });
}

/**
 * Animates a number from 0 to `target` over ~900ms using easeOutExpo.
 * Uses requestAnimationFrame for smooth 60fps counting.
 */
function _animateCounter(el, target) {
  const duration = 900;
  const start    = performance.now();

  function tick(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutExpo — fast at start, slows at the end
    const eased    = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const current  = Math.round(eased * target);
    el.textContent = fmtNum(current);
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

async function loadMoreStories(type) {
  await _doLoadMore(type, feedState, 'feed');
}

async function loadMoreDashStories(type) {
  await _doLoadMore(type, dashFeedState, 'dash');
}

function renderFeedPanel(tabKey, stories, layout) {
  const contentEl = document.getElementById(`feed-${tabKey}-content`);
  const moreEl    = document.getElementById(`feed-${tabKey}-more`);
  if (!contentEl) return;

  // Reset pagination state for this tab
  feedState[tabKey].page = 0;
  feedState[tabKey].done = false;

  if (!stories.length) {
    contentEl.innerHTML = feedEmptyHTML(tabKey);
    if (moreEl) moreEl.style.display = 'none';
    return;
  }

  // Guest view: show only first 6 stories, no infinite scroll, no like/save
  const isGuest    = !session.isLoggedIn;
  const displayed  = isGuest ? stories.slice(0, 6) : stories;
  const cls        = layout === 'stream' ? 'story-stream' : 'story-grid-3';
  contentEl.innerHTML = `<div class="${cls}">${displayed.map(s => storyCardHTML(s, isGuest)).join('')}</div>`;

  if (moreEl) moreEl.style.display = 'none';

  if (!isGuest) {
    // Attach infinite scroll sentinel only for logged-in users
    const TYPE_MAP = { latest: 'LATEST', trending: 'TRENDING', following: 'FOLLOWING' };
    _attachSentinel('feed', tabKey, TYPE_MAP[tabKey]);
  }
}

function renderFeedError(tabKey) {
  const contentEl = document.getElementById(`feed-${tabKey}-content`);
  if (!contentEl) return;
  contentEl.innerHTML = `<div class="feed-error"><p class="feed-error-text">No se pudo cargar el contenido.</p><button class="btn-secondary" onclick="retryFeedTab('${tabKey}')">Reintentar</button></div>`;
}

async function retryFeedTab(tabKey) {
  const contentEl = document.getElementById(`feed-${tabKey}-content`);
  if (contentEl) contentEl.innerHTML = `<div class="feed-loading"><div class="loading-spinner"></div>Cargando historias...</div>`;
  try {
    const feed = await getStories(0);
    const data = { latest: feed.latest, trending: feed.trending, following: feed.following };
    renderFeedPanel(tabKey, data[tabKey] || [], 'grid');
  } catch (e) { renderFeedError(tabKey); }
}

function feedEmptyHTML(tabKey) {
  const msgs = {
    latest:    'Aún no hay historias publicadas.',
    trending:  'No hay historias destacadas esta semana.',
    following: 'Las personas que sigues no han publicado historias aún.',
  };
  return `<div class="feed-empty"><div class="feed-empty-icon">✦</div><p class="feed-empty-text">${msgs[tabKey] || 'Sin historias.'}</p></div>`;
}

// ─── Animation helpers ────────────────────────────────────────────
const SPARK_COLORS = ['#f6366f','#ff8fab','#ffb3c1','#ff4d6d','#c9184a'];
const SPARK_DIRS   = [
  [-22,-22],[-28,-6],[-22,14],[-6,28],[14,22],
  [28,6],[22,-14],[6,-28],
];

function fireLikeAnim(btn) {
  btn.classList.add('animating-like');
  // Sparks
  SPARK_DIRS.forEach(([dx, dy], i) => {
    const s = document.createElement('span');
    s.className = 'spark';
    s.style.setProperty('--sx', dx + 'px');
    s.style.setProperty('--sy', dy + 'px');
    s.style.background = SPARK_COLORS[i % SPARK_COLORS.length];
    s.style.animationDelay = (i * 0.025) + 's';
    btn.appendChild(s);
    s.addEventListener('animationend', () => s.remove(), { once: true });
  });
  btn.addEventListener('animationend', () => btn.classList.remove('animating-like'), { once: true });
}

function fireSaveAnim(btn) {
  btn.classList.add('animating-save');
  // Expanding ring
  const ring = document.createElement('span');
  ring.className = 'save-ring';
  btn.appendChild(ring);
  ring.addEventListener('animationend', () => ring.remove(), { once: true });
  btn.addEventListener('animationend', () => btn.classList.remove('animating-save'), { once: true });
}

// ─── Feed cards ───────────────────────────────────────────────────
async function toggleLike(btn) {
  const sp      = btn.querySelector('span');
  const n       = parseInt(sp.textContent);
  const liked   = !btn.classList.contains('liked');
  const storyId = btn.closest('[data-id]')?.dataset?.id ?? null;
  btn.classList.toggle('liked');
  sp.textContent = liked ? n + 1 : n - 1;
  if (liked) fireLikeAnim(btn);
  try {
    if (liked) await addLike(storyId);
    else       await removeLike(storyId);
  } catch (e) {
    console.error('Like error:', e);
    btn.classList.toggle('liked'); sp.textContent = n;
    showToast('No se pudo actualizar el like. Inténtalo de nuevo.');
  }
}

async function saveStory(btn) {
  const saving  = !btn.classList.contains('liked');
  const storyId = btn.closest('[data-id]')?.dataset?.id ?? null;
  btn.classList.toggle('liked');
  if (saving) fireSaveAnim(btn);
  showToast(saving ? 'Historia guardada ✓' : 'Historia eliminada de guardados');
  try {
    if (saving) await saveStoryApi(storyId);
    else        await unsaveStoryApi(storyId);
  } catch (e) {
    console.error('Save error:', e);
    btn.classList.toggle('liked');
    showToast('No se pudo actualizar. Inténtalo de nuevo.');
  }
}

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
//  STORY DETAIL
// ═══════════════════════════════════════════════════════════════════
function handleCardClick(event, card) {
  // Interactive children stop propagation — if we reach here they didn't fire
  if (event.target.closest('.story-footer')) return;

  event.preventDefault(); // don't follow the href — we handle navigation ourselves
  const raw = card.getAttribute('data-story');
  if (!raw) return;
  try { openDetail(JSON.parse(raw.replace(/&#39;/g, "'"))); }
  catch (e) { console.error('Parse story:', e); }
}

function renderDetail(s) {
  document.getElementById('detailContent').innerHTML =
    s.isCooperative ? renderCollabDetail(s) : renderWordsDetail(s);
}

function renderWordsDetail(s) {
  const words       = s.words ? [s.words.first, s.words.second, s.words.third].filter(w => w?.length) : [];
  const wordPills   = words.map(w => `<span class="detail-word-badge">${escHtml(w)}</span>`).join('');
  const contentItem = Array.isArray(s.content) && s.content.length ? s.content[0] : null;
  const rawText     = contentItem ? (typeof contentItem === 'string' ? contentItem : contentItem.text || '') : (typeof s.content === 'string' ? s.content : '');
  const authorAvatar = buildAvatarHTML(s.userImage, s.author, 36, 'detail-author-avatar', 'detail-author-initials');
  const likedCls = s.userLiked ? ' liked' : '';
  const savedCls = s.userSaved ? ' liked' : '';
  const editBtn  = s.isCurrentUser
    ? `<button class="detail-collab-action" onclick="openEdit()"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar</button>`
    : '';
  return `
    <div class="detail-words-layout">
      <div class="detail-words-header">
        <div class="detail-words-top-meta">
          <span class="detail-words-date">${fmtDate(s.date)}</span>
          <div class="detail-words-actions-row">
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
            ${editBtn}
            <button class="detail-collab-action danger" onclick="openReportModal()">
              <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Reportar
            </button>
          </div>
        </div>
        <h1 class="detail-words-title">${escHtml(s.title || 'Sin título')}</h1>
        ${words.length ? `<div class="detail-word-pills-row">${wordPills}</div>` : ''}
        <div class="detail-words-author-row" onclick="openUserProfile('${s.userId}')">
          ${authorAvatar}
          <span class="detail-author-name">${escHtml(s.author || 'Anónimo')}</span>
        </div>
      </div>
      <div class="detail-words-body">${highlightWords(rawText, words)}</div>
    </div>`;
}

function renderCollabDetail(s) {
  const contents      = Array.isArray(s.content) ? s.content : [];
  const uniqueAuthors = [];
  const seen          = new Set();
  contents.forEach(c => { const key = c.userId || c.author; if (key && !seen.has(key)) { seen.add(key); uniqueAuthors.push(c); } });
  const stackHTML = uniqueAuthors.slice(0, 2).map(c => {
    const ini = (c.author || '?').slice(0, 2).toUpperCase();
    return c.userImage ? `<div class="ca"><img src="${c.userImage}" alt="${escHtml(c.author || '')}"></div>` : `<div class="ca">${ini}</div>`;
  }).join('');
  const authorsData = encodeURIComponent(JSON.stringify(uniqueAuthors.map(c => ({
    userId: c.userId, author: c.author, userImage: c.userImage || null,
  }))));
  const moreCount = uniqueAuthors.length > 2 ? `<span class="collab-authors-more">+${uniqueAuthors.length - 2}</span>` : '';
  const likedCls  = s.userLiked ? ' liked' : '';
  const savedCls  = s.userSaved ? ' liked' : '';
  const parasHTML = contents.map(c => {
    const avHTML = buildAvatarHTML(c.userImage, c.author, 30, 'collab-para-avatar', 'collab-para-avatar-ini');
    return `<div class="collab-para-block"><p class="collab-para-text">${escHtml(c.text || '')}</p><div class="collab-para-author" onclick="_prevScrollY=window.scrollY; openUserProfile('${c.userId}')" style="cursor:pointer;">${avHTML}<span class="collab-para-author-name">${escHtml(c.author || 'Anónimo')}</span>${c.date ? `<span class="collab-para-date">${fmtDate(c.date)}</span>` : ''}</div></div>`;
  }).join('');
  return `
    <div class="detail-collab-layout">
      <div class="detail-collab-header">
        <div class="detail-collab-top-meta">
          <span class="detail-collab-date">${fmtDate(s.date)}</span>
          <div class="detail-collab-actions-row">
            <button class="detail-collab-action${likedCls}" onclick="detailToggleLike(this)"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><span>${fmtNum(s.likes)}</span></button>
            <button class="detail-collab-action${savedCls}" onclick="detailToggleSave(this)"><svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><span>${s.userSaved ? 'Guardada' : 'Guardar'}</span></button>
            <button class="detail-collab-action" onclick="openShare()"><svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Compartir</button>
            <button class="detail-collab-action danger" onclick="openReportModal()"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Reportar</button>
          </div>
        </div>
        <h1 class="detail-collab-title">${escHtml(s.title || 'Sin título')}</h1>
        <button class="detail-collab-authors" onclick="openCollabAuthorsDialog('${authorsData}')" title="Ver autores">
          <div class="collab-avatar-stack">${stackHTML}</div>${moreCount}
          <span class="collab-authors-more" style="color:var(--gray-300);">${uniqueAuthors.length} autor${uniqueAuthors.length !== 1 ? 'es' : ''}</span>
        </button>
      </div>
      <div class="collab-paragraphs">${parasHTML}</div>
    </div>`;
}

async function detailToggleLike(btn) {
  const liked   = !btn.classList.contains('liked');
  const storyId = currentStory?.id ?? null;
  btn.classList.toggle('liked');
  if (liked) fireLikeAnim(btn);
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
    console.error('Like error:', e);
    btn.classList.toggle('liked');
    if (!currentStory?.isCooperative) { span.textContent = liked ? 'Me gusta' : 'Te gusta'; }
    else { const n = parseInt(span.textContent) || 0; span.textContent = liked ? n - 1 : n + 1; }
    if (currentStory) currentStory.userLiked = !liked;
    showToast('No se pudo actualizar el like. Inténtalo de nuevo.');
  }
}

async function detailToggleSave(btn) {
  const saving  = !btn.classList.contains('liked');
  const storyId = currentStory?.id ?? null;
  btn.classList.toggle('liked');
  if (saving) fireSaveAnim(btn);
  btn.querySelector('span').textContent = saving ? 'Guardada' : 'Guardar';
  if (currentStory) currentStory.userSaved = saving;
  showToast(saving ? 'Historia guardada ✓' : 'Historia eliminada de guardados');
  try {
    if (saving) await saveStoryApi(storyId);
    else        await unsaveStoryApi(storyId);
  } catch (e) {
    console.error('Save error:', e);
    btn.classList.toggle('liked');
    btn.querySelector('span').textContent = saving ? 'Guardar' : 'Guardada';
    if (currentStory) currentStory.userSaved = !saving;
    showToast('No se pudo actualizar. Inténtalo de nuevo.');
  }
}

function openShare() {
  const link = `${location.origin}${location.pathname}#detail/${currentStory?.id || ''}`;
  document.getElementById('shareLinkInput').value = link;
  openModal('share');
}

function shareVia(platform) {
  const link = encodeURIComponent(`${location.origin}${location.pathname}#detail/${currentStory?.id || ''}`);
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

function openReportModal() {
  // Reset state
  document.querySelectorAll('.report-option').forEach(b => b.classList.remove('selected'));
  document.getElementById('reportOtherWrap').style.display = 'none';
  document.getElementById('reportOtherText').value = '';
  document.getElementById('reportOtherErr').classList.remove('visible');
  const btn = document.getElementById('reportSubmitBtn');
  btn.disabled = true; btn.style.opacity = '0.4'; btn.style.cursor = 'not-allowed';
  btn.classList.remove('loading');
  openModal('report');
}

function selectReport(btn) {
  document.querySelectorAll('.report-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');

  const isOther = btn.dataset.other === 'true';
  document.getElementById('reportOtherWrap').style.display = isOther ? 'block' : 'none';
  document.getElementById('reportOtherErr').classList.remove('visible');

  const submitBtn = document.getElementById('reportSubmitBtn');
  submitBtn.disabled = false;
  submitBtn.style.opacity = '1';
  submitBtn.style.cursor  = 'pointer';
}

async function submitReport() {
  const selected = document.querySelector('.report-option.selected');
  if (!selected) return;

  const isOther = selected.dataset.other === 'true';
  const type    = parseInt(selected.dataset.type ?? '0');
  let cause     = '';

  if (isOther) {
    cause = document.getElementById('reportOtherText').value.trim();
    if (!cause) {
      document.getElementById('reportOtherErr').classList.add('visible');
      return;
    }
  }

  const btn = document.getElementById('reportSubmitBtn');
  btn.classList.add('loading'); btn.disabled = true;

  try {
    await reportStory({
      storyId: currentStory?.id || '',
      userId:  session.userId   || '',
      type,
      cause,
    });
    closeAllModals();
    showToast('Reporte enviado. Gracias por tu colaboración.');
  } catch (e) {
    console.error('Report error:', e);
    showToast('No se pudo enviar el reporte. Inténtalo de nuevo.');
  } finally {
    btn.classList.remove('loading'); btn.disabled = false;
  }
}

function openEdit() {
  if (!currentStory || currentStory.isCooperative || !currentStory.isCurrentUser) return;
  const contentItem = Array.isArray(currentStory.content) && currentStory.content.length ? currentStory.content[0] : null;
  const rawText = contentItem ? (typeof contentItem === 'string' ? contentItem : contentItem.text || '') : '';
  document.getElementById('editTitle').value           = currentStory.title || '';
  document.getElementById('editContent').value         = rawText;
  document.getElementById('editCharCount').textContent = rawText.length;
  openModal('edit');
}

function submitEdit() {
  const title   = document.getElementById('editTitle').value.trim();
  const content = document.getElementById('editContent').value.trim();
  if (!title)              { showToast('El título no puede estar vacío'); return; }
  if (content.length < 30) { showToast('El contenido debe tener al menos 30 caracteres'); return; }
  if (currentStory) {
    currentStory.title = title;
    if (Array.isArray(currentStory.content) && currentStory.content.length) currentStory.content[0] = { ...currentStory.content[0], text: content };
    else currentStory.content = [{ text: content }];
    renderDetail(currentStory);
  }
  closeAllModals(); showToast('Historia actualizada ✓');
}

// ═══════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 3000);
}

function updateCount(id, val) { document.getElementById(id).textContent = val.length; }

function fmtNum(n) {
  if (n == null) return '—';
  return n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n);
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function relDate(d) {
  const diff = Date.now() - new Date(d).getTime(), m = Math.floor(diff / 60000);
  if (m < 60) return `Hace ${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `Hace ${h}h` : `Hace ${Math.floor(h / 24)}d`;
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function stripAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function highlightWords(text, words) {
  if (!text) return '';
  const usedWords = new Set();
  const tokens = escHtml(text).split(/([\p{L}\p{N}]+)/u);
  const result = tokens.map(token => {
    if (!/^[\p{L}\p{N}]+$/u.test(token)) return token;
    const normToken = stripAccents(token).toLowerCase();
    for (const w of words) {
      if (!w || usedWords.has(w)) continue;
      if (normToken === stripAccents(w).toLowerCase()) {
        usedWords.add(w);
        return `<strong class="word-highlight">${token}</strong>`;
      }
    }
    return token;
  });
  return result.join('').split(/\n\n|\n/).filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');
}

function buildAvatarHTML(imageUrl, name, size, containerClass, initialsClass) {
  const ini = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (imageUrl) {
    return `<div class="${containerClass}" style="width:${size}px;height:${size}px;"><img src="${imageUrl}" alt="${escHtml(name || '')}"></div>`;
  }
  return `<div class="${containerClass}" style="width:${size}px;height:${size}px;"><span class="${initialsClass}">${ini}</span></div>`;
}

// ═══════════════════════════════════════════════════════════════════
//  SEARCH
// ═══════════════════════════════════════════════════════════════════
let _searchDebounce = null;
const RECENT_KEY    = 'os_recent_searches';
const MAX_RECENT    = 8;

// ─── Recent searches storage ──────────────────────────────────────
function _getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

function _saveRecent(list) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

function _addRecent(user) {
  // user = { id, username, userImage }
  let list = _getRecent().filter(u => u.id !== user.id); // deduplicate
  list.unshift(user);                                     // most recent first
  if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
  _saveRecent(list);
}

function removeRecentSearch(event, userId) {
  event.stopPropagation();
  const list = _getRecent().filter(u => u.id !== userId);
  _saveRecent(list);
  // Re-render — if input is empty show recents, otherwise keep results
  const term = document.getElementById('searchInput')?.value.trim();
  if (!term) _renderSearchEmpty();
  else _renderSearchResults(
    document.querySelectorAll('.search-result-item[data-id]')
      ? [] : [], // just re-render empty; results stay if user is still typing
    term
  );
  // Simpler: just re-render the empty state which shows updated recents
  if (!term) _renderSearchEmpty();
}

// ─── Modal open / reset ──────────────────────────────────────────
function openSearchModal() {
  openModal('search');
  // Reset state
  const input = document.getElementById('searchInput');
  if (input) { input.value = ''; }
  document.getElementById('searchClearBtn').style.display = 'none';
  _renderSearchEmpty();
  setTimeout(() => input?.focus(), 80);
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  input.value = '';
  document.getElementById('searchClearBtn').style.display = 'none';
  _renderSearchEmpty();
  input.focus();
  clearTimeout(_searchDebounce);
}

function onSearchInput(value) {
  document.getElementById('searchClearBtn').style.display = value.length ? 'flex' : 'none';
  clearTimeout(_searchDebounce);

  if (!value.trim()) {
    _renderSearchEmpty();
    return;
  }

  _renderSearchLoading();
  _searchDebounce = setTimeout(() => _doSearch(value.trim()), 300);
}

async function _doSearch(term) {
  _renderSearchLoading();
  try {
    const results = await searchUsers(term);
    _renderSearchResults(results, term);
  } catch (e) {
    console.error('Search error:', e);
    _renderSearchError();
  }
}

// ─── Avatar HTML helper ───────────────────────────────────────────
function _searchAvatarHTML(user) {
  const ini = (user.username || '?').slice(0, 2).toUpperCase();
  if (user.userImage) {
    return `<div class="search-result-avatar"><img src="${user.userImage}" alt="${escHtml(user.username || '')}"></div>`;
  }
  return `<div class="search-result-avatar">${ini}</div>`;
}

// ─── Result item HTML ─────────────────────────────────────────────
function _resultItemHTML(u, showRemove = false) {
  const isMe     = u.id === session.userId;
  const removeBtn = showRemove
    ? `<button class="search-remove-btn" onclick="removeRecentSearch(event,'${u.id}')" title="Eliminar">
         <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
       </button>`
    : `<svg class="search-chevron" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="1.5"><polyline points="9 18 15 12 9 6"/></svg>`;

  return `
    <div class="search-result-item" data-id="${u.id}" onclick="searchGoToProfile('${u.id}','${escHtml(u.username || '')}','${u.userImage || ''}')">
      ${_searchAvatarHTML(u)}
      <div class="search-result-info">
        <span class="search-result-username">@${escHtml(u.username || '')}</span>
        ${isMe ? '<span class="search-result-you">Tú</span>' : ''}
      </div>
      ${removeBtn}
    </div>`;
}

// ─── Render states ────────────────────────────────────────────────
function _renderSearchEmpty() {
  const recent  = _getRecent();
  const container = document.getElementById('searchResults');
  if (!recent.length) {
    container.innerHTML = `
      <div class="search-empty-state">
        <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" fill="none" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p>Escribe para buscar escritores</p>
      </div>`;
    return;
  }
  container.innerHTML = `
    <div class="search-section-label">Búsquedas recientes</div>
    ${recent.map(u => _resultItemHTML(u, true)).join('')}`;
}

function _renderSearchLoading() {
  document.getElementById('searchResults').innerHTML = `
    <div class="search-empty-state">
      <div class="loading-spinner" style="width:20px;height:20px;border-width:2px;"></div>
      <p>Buscando...</p>
    </div>`;
}

function _renderSearchError() {
  document.getElementById('searchResults').innerHTML = `
    <div class="search-empty-state">
      <p style="color:var(--red);">Error al buscar. Inténtalo de nuevo.</p>
    </div>`;
}

function _renderSearchResults(results, term) {
  const container = document.getElementById('searchResults');
  if (!results.length) {
    container.innerHTML = `
      <div class="search-empty-state">
        <p>No se encontraron usuarios para <strong>@${escHtml(term)}</strong></p>
      </div>`;
    return;
  }
  container.innerHTML = results.map(u => _resultItemHTML(u, false)).join('');
}

// ─── Navigate to profile + save to recents ────────────────────────
function searchGoToProfile(userId, username = '', userImage = '') {
  // Save to recents before navigating
  if (userId && username) {
    _addRecent({ id: userId, username, userImage: userImage || null });
  }
  closeAllModals();
  openUserProfile(userId);
}

// ═══════════════════════════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════════════════════════
function _applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next   = !isDark;
  _applyTheme(next);
  localStorage.setItem('os_theme', next ? 'dark' : 'light');
}

// Apply saved theme immediately (before first paint)
_applyTheme(localStorage.getItem('os_theme') === 'dark');

// ═══════════════════════════════════════════════════════════════════
//  BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════
Object.assign(window, {
  handleLogoClick, handleNavCta, logout, requireAuth,
  showPage, scrollToFeed, toggleTheme,
  togglePw, doLogin, openForgotModal, doForgotPassword,
  doRegister, resendVerification,
  switchProfileTab,
  confirmUnblock, confirmAction,
  openChangePasswordModal, doChangePassword,
  openBugReportModal, doSendBugReport,
  confirmLogout, doLogout,
  initEditProfilePage, onAvatarFileSelected, removeEditAvatar, doSaveProfile,
  openSearchModal, onSearchInput, clearSearch, searchGoToProfile, removeRecentSearch,
  openUserProfile, retryUserProfile, toggleFollowUser, toggleBlockUser,
  openModal, closeAllModals, openModalMode,
  submitWordsStep1, submitWordsStory,
  submitCollabParagraph, submitCollabNew,
  switchFeedTab, loadMoreStories, retryFeedTab,
  switchDashTab, loadMoreDashStories,
  toggleLike, saveStory,
  handleCardClick, goBack, detailToggleLike, detailToggleSave,
  openShare, shareVia, copyShareLink,
  selectReport, submitReport, openReportModal,
  openEdit, submitEdit,
  updateCount,
});

// ═══════════════════════════════════════════════════════════════════
//  INIT — boot from the current URL hash
// ═══════════════════════════════════════════════════════════════════
session.load();
updateNav();

document.addEventListener('DOMContentLoaded', () => {
  // Route after DOM is fully ready — handles shared links like index.html#detail/abc
  _route(location.hash || '#home');

  ['loginIdentifier', 'loginPassword'].forEach(id =>
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); }));
  document.getElementById('forgotEmail')?.addEventListener('keydown', e => { if (e.key === 'Enter') doForgotPassword(); });
  document.querySelectorAll('.modal-backdrop').forEach(b =>
    b.addEventListener('click', e => { if (e.target === b) closeAllModals(); }));
});
