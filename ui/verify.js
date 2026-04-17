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

