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

