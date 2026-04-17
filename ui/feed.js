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
