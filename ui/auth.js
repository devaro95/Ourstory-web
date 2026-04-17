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
