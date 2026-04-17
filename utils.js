/**
 * utils.js — Shared utility functions used across ui modules.
 * Import from here rather than duplicating in each module.
 */

export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 3000);
}

export function updateCount(id, val) {
  document.getElementById(id).textContent = val.length;
}

export function fmtNum(n) {
  if (n == null) return '—';
  return n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n);
}

export function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function relDate(d) {
  const diff = Date.now() - new Date(d).getTime(), m = Math.floor(diff / 60000);
  if (m < 60) return `Hace ${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `Hace ${h}h` : `Hace ${Math.floor(h / 24)}d`;
}

export function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

export function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function stripAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function highlightWords(text, words) {
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

export function buildAvatarHTML(imageUrl, name, size, containerClass, initialsClass) {
  const ini = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (imageUrl) {
    return `<div class="${containerClass}" style="width:${size}px;height:${size}px;"><img src="${imageUrl}" alt="${escHtml(name || '')}"></div>`;
  }
  return `<div class="${containerClass}" style="width:${size}px;height:${size}px;"><span class="${initialsClass}">${ini}</span></div>`;
}

export function openModal(id) {
  const el = document.getElementById('modal' + cap(id));
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

export function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  document.body.style.overflow = '';
}
