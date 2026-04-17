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
