import { initSupabase, enableMockMode, saveStore, deleteStore, updateStoreStatus, uploadPhoto, deletePhoto } from './api.js';
import { showToast, showConfirm } from './components.js';
import { renderFeedView, renderDetailView, renderSearchView, renderFormView, runSearch, renderFilterChips } from './views.js';
import { compressImage } from './utils.js';

// === CONFIG ===
// Supabaseダッシュボードの Settings > API から
// "Project URL" と "anon public" キーをコピーして、以下にそのまま貼り付けてください。
// （未設定のままだとモックデータ表示モードで動作します）
const SUPABASE_URL  = 'https://vcfaiiqxydeclygznbtp.supabase.co';
const SUPABASE_ANON = 'sb_publishable_mwMPOJMt7eheebaibnkXEA_13gX1X1B';

// === STATE ===
const state = {
  stores: [],
  totalCount: 0,
  currentView: 'feed',
  currentStoreId: null,
  filters: {},
  searchQuery: '',
  loading: false,
  page: 0,
};

// === ROUTER ===
function showView(name, params = {}) {
  const app = document.getElementById('app');
  state.currentView = name;
  state.page = 0;

  // Show/hide FAB and bottom nav
  const fab = document.getElementById('fab');
  const nav = document.getElementById('bottom-nav');
  if (fab) fab.style.display = (name === 'feed' || name === 'search') ? 'flex' : 'none';
  if (nav) {
    nav.querySelector('[data-tab="feed"]')?.classList.toggle('active', name === 'feed');
    nav.querySelector('[data-tab="search"]')?.classList.toggle('active', name === 'search');
  }

  try {
    if (name === 'feed') {
      renderFeedView(state, app);
    } else if (name === 'detail') {
      state.currentStoreId = params.storeId;
      renderDetailView(params.storeId, app);
    } else if (name === 'search') {
      renderSearchView(state, app);
    }
  } catch (e) {
    app.innerHTML = `<div style="padding:40px;text-align:center;">
      <div style="color:#EF4444;font-size:17px;font-weight:600;margin-bottom:8px;">エラーが発生しました</div>
      <div style="color:#737373;font-size:14px;">${e.message}</div>
      <button onclick="location.reload()" style="margin-top:16px;padding:10px 20px;background:#E1306C;color:#fff;border:none;border-radius:20px;font-size:14px;cursor:pointer;">再読み込み</button>
    </div>`;
  }
}

// === GLOBAL EVENT DELEGATION ===
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  if (action === 'go-feed') {
    showView('feed');
  } else if (action === 'go-search') {
    showView('search');
  } else if (action === 'open-store') {
    showView('detail', { storeId: el.dataset.storeId });
  } else if (action === 'open-form') {
    openForm(el.dataset.storeId || null);
  } else if (action === 'close-form') {
    closeForm();
  } else if (action === 'save-store') {
    await handleSaveStore(el);
  } else if (action === 'delete-store') {
    await handleDeleteStore(el.dataset.storeId);
  } else if (action === 'toggle-status') {
    await handleToggleStatus(el);
  } else if (action === 'set-status') {
    await handleSetStatus(el);
  } else if (action === 'set-rating') {
    handleSetRating(el);
  } else if (action === 'form-toggle-status') {
    handleFormToggleStatus(el);
  } else if (action === 'remove-existing-photo') {
    await handleRemoveExistingPhoto(el);
  } else if (action === 'set-filter') {
    handleSetFilter(el);
  } else if (action === 'reload') {
    showView(state.currentView);
  } else if (action === 'download-photo') {
    await handleDownloadPhoto(el.dataset.photoUrl);
  } else if (action === 'download-all-photos') {
    await handleDownloadAllPhotos(el.dataset.storeId);
  }
});

async function handleDownloadPhoto(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const ext = (blob.type.split('/')[1] || 'jpg').split('+')[0];
    const file = new File([blob], `photo-${Date.now()}.${ext}`, { type: blob.type });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    window.open(url, '_blank');
  }
}

async function handleDownloadAllPhotos(storeId) {
  const { getStore, getPhotoUrl } = await import('./api.js');
  const store = await getStore(storeId);
  const photos = (store?.photos || []).sort((a, b) => a.sort_order - b.sort_order);
  if (!photos.length) return;

  try {
    const zip = new JSZip();
    for (let i = 0; i < photos.length; i++) {
      const url = getPhotoUrl(photos[i]);
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = (blob.type.split('/')[1] || 'jpg').split('+')[0];
      zip.file(`photo-${i + 1}.${ext}`, blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipName = `${(store.name || 'photos').replace(/[\\/:*?"<>|]/g, '_')}.zip`;
    const file = new File([zipBlob], zipName, { type: 'application/zip' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }

    const objectUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    showToast('ダウンロードに失敗しました', 'error');
  }
}

// === FORM ===
let _formStore = null;
let _pendingPhotos = []; // { file, objectUrl, wrapEl }
let _removedPhotos = []; // { id, path }

async function openForm(storeId) {
  _pendingPhotos = [];
  _removedPhotos = [];

  let store = null;
  if (storeId) {
    try {
      const { getStore } = await import('./api.js');
      store = await getStore(storeId);
    } catch (e) {
      showToast('店舗データの取得に失敗しました', 'error');
      return;
    }
  }
  _formStore = store;
  renderFormView(store);

  // Wire photo input
  const fileInput = document.getElementById('photo-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', handlePhotoFileChange);
  }
}

function closeForm() {
  _pendingPhotos.forEach(p => URL.revokeObjectURL(p.objectUrl));
  _pendingPhotos = [];
  _removedPhotos = [];
  const modal = document.getElementById('store-form-modal');
  if (modal) modal.remove();
}

function handlePhotoFileChange(e) {
  const files = Array.from(e.target.files || []);
  const grid = document.getElementById('photo-upload-grid');
  if (!grid) return;

  files.forEach(file => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      showToast(`${file.name}: JPEG/PNG/WEBPのみ対応`, 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(`${file.name}: 10MB以内にしてください`, 'error');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const wrap = document.createElement('div');
    wrap.className = 'photo-thumb-wrap';
    wrap.innerHTML = `<img class="photo-thumb" src="${objectUrl}" alt="プレビュー" />
      <div class="photo-progress"><div class="photo-progress-bar photo-progress-indeterminate"></div></div>
      <button class="remove-btn" data-action="remove-pending-photo" type="button">✕</button>`;
    grid.appendChild(wrap);

    const pendingItem = { file, objectUrl, wrapEl: wrap };
    _pendingPhotos.push(pendingItem);

    wrap.querySelector('[data-action="remove-pending-photo"]').addEventListener('click', () => {
      URL.revokeObjectURL(objectUrl);
      _pendingPhotos = _pendingPhotos.filter(p => p !== pendingItem);
      wrap.remove();
    });

    // Compress in the background and swap the file used for upload once ready
    compressImage(file).then(compressed => {
      pendingItem.file = compressed;
      const bar = wrap.querySelector('.photo-progress-bar');
      bar?.classList.remove('photo-progress-indeterminate');
      if (bar) bar.style.width = '0%';
    });
  });
  e.target.value = '';
}

function handleSetRating(el) {
  const value = parseInt(el.dataset.value);
  const hiddenInput = document.getElementById('f-rating');
  if (hiddenInput) hiddenInput.value = value;
  const stars = document.querySelectorAll('#f-rating-stars .star-btn');
  stars.forEach((s, i) => {
    s.style.color = i < value ? '#F59E0B' : '#D4D4D4';
  });
}

function handleFormToggleStatus(el) {
  const field = el.dataset.field;
  const value = el.dataset.value;
  const pill = el.closest('.toggle-pill');
  if (!pill) return;
  pill.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.value === value));
}

async function handleRemoveExistingPhoto(el) {
  const photoId = el.dataset.photoId;
  const path = el.dataset.path;
  _removedPhotos.push({ id: photoId, path });
  el.closest('.photo-thumb-wrap')?.remove();
}

async function handleSaveStore(el) {
  const name    = document.getElementById('f-name')?.value.trim();
  const genre   = document.getElementById('f-genre')?.value;
  const area    = document.getElementById('f-area')?.value.trim();
  const rating  = parseInt(document.getElementById('f-rating')?.value || 0);
  const tUrl    = document.getElementById('f-tabelog-url')?.value.trim();
  const review  = document.getElementById('f-review')?.value.trim();

  const tPill = document.querySelector('.toggle-pill [data-field="tabelog_status"].active');
  const igPill = document.querySelector('.toggle-pill [data-field="instagram_status"].active');
  const tabelogStatus   = tPill?.dataset.value  || 'not_posted';
  const instagramStatus = igPill?.dataset.value || 'not_posted';

  if (!name)   { showToast('店名を入力してください', 'error'); return; }
  if (!genre)  { showToast('ジャンルを選択してください', 'error'); return; }
  if (!area)   { showToast('エリアを入力してください', 'error'); return; }
  if (!rating) { showToast('評価を選択してください', 'error'); return; }

  const saveBtn = document.getElementById('form-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '保存中...'; }

  try {
    const payload = {
      name, genre, area, rating,
      tabelog_url: tUrl || null,
      review_text: review || null,
      tabelog_status: tabelogStatus,
      instagram_status: instagramStatus,
    };
    if (_formStore?.id) payload.id = _formStore.id;

    const saved = await saveStore(payload);

    // Delete removed existing photos
    if (_removedPhotos.length) {
      await Promise.allSettled(_removedPhotos.map(p => deletePhoto(p.id, p.path)));
    }

    // Upload pending photos
    if (_pendingPhotos.length) {
      await Promise.allSettled(_pendingPhotos.map(async item => {
        const progressBar = item.wrapEl?.querySelector('.photo-progress-bar');
        try {
          await uploadPhoto(saved.id, item.file, pct => {
            if (progressBar) progressBar.style.width = `${pct}%`;
          });
          URL.revokeObjectURL(item.objectUrl);
        } catch (err) {
          showToast(`写真のアップロードに失敗: ${item.file.name}`, 'error');
        }
      }));
    }

    showToast(_formStore?.id ? '保存しました' : 'お店を追加しました');
    closeForm();
    showView('feed');
  } catch (e) {
    showToast('保存に失敗しました: ' + e.message, 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '保存する →'; }
  }
}

// === DELETE ===
async function handleDeleteStore(storeId) {
  const ok = await showConfirm('本当に削除しますか？この操作は取り消せません。');
  if (!ok) return;
  try {
    await deleteStore(storeId);
    showToast('削除しました');
    showView('feed');
  } catch (e) {
    showToast('削除に失敗しました: ' + e.message, 'error');
  }
}

// === STATUS TOGGLE (card badge) ===
async function handleToggleStatus(el) {
  const storeId  = el.dataset.storeId;
  const platform = el.dataset.platform;
  const current  = el.dataset.current;
  const next = current === 'posted' ? 'not_posted' : 'posted';
  const field = platform === 'tabelog' ? 'tabelog_status' : 'instagram_status';

  try {
    await updateStoreStatus(storeId, field, next);
    el.dataset.current = next;
    const posted = next === 'posted';
    const isTabelog = platform === 'tabelog';
    el.style.background = posted ? (isTabelog ? '#E85328' : '#E1306C') : '#D4D4D4';
    el.style.color = posted ? '#fff' : '#737373';
    el.lastChild.textContent = ' ' + (posted ? '投稿済み' : '未投稿');

    // Update state cache
    const s = state.stores.find(s => s.id === storeId);
    if (s) s[field] = next;
  } catch (e) {
    showToast('更新に失敗しました', 'error');
  }
}

// === STATUS TOGGLE (detail toggle pill) ===
async function handleSetStatus(el) {
  const pill = el.closest('.toggle-pill');
  if (!pill) return;
  const storeId  = pill.dataset.storeId;
  const platform = pill.dataset.platform;
  const value    = el.dataset.value;
  const field    = platform === 'tabelog' ? 'tabelog_status' : 'instagram_status';

  try {
    await updateStoreStatus(storeId, field, value);
    pill.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.value === value));
    showToast('ステータスを更新しました');
    // Update state cache
    const s = state.stores.find(s => s.id === storeId);
    if (s) s[field] = value;
  } catch (e) {
    showToast('更新に失敗しました', 'error');
  }
}

// === FILTER ===
function handleSetFilter(el) {
  const key   = el.dataset.key;
  const value = el.dataset.value || null;

  if (!value) {
    delete state.filters[key];
  } else {
    // If switching between rating/status chips, remove the previous one
    if (key === 'rating') state.filters.rating = parseInt(value);
    else if (key === 'status') state.filters.status = value;
    else state.filters[key] = value;

    if (!value) delete state.filters[key];
  }

  // Re-render filter chips
  const filterRow = document.querySelector('.filter-scroll');
  if (filterRow) filterRow.innerHTML = renderFilterChips(state);

  // Re-run search
  runSearch(state);
}

// === BOTTOM NAV ===
function renderChrome() {
  // Toast container
  if (!document.getElementById('toast-container')) {
    const tc = document.createElement('div');
    tc.id = 'toast-container';
    document.body.appendChild(tc);
  }

  // FAB
  if (!document.getElementById('fab')) {
    const fab = document.createElement('button');
    fab.id = 'fab';
    fab.setAttribute('aria-label', 'お店を追加');
    fab.dataset.action = 'open-form';
    fab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    document.body.appendChild(fab);
  }

  // Bottom nav
  if (!document.getElementById('bottom-nav')) {
    const nav = document.createElement('nav');
    nav.id = 'bottom-nav';
    nav.innerHTML = `
      <button class="nav-tab active" data-tab="feed" data-action="go-feed">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>ホーム</span>
      </button>
      <button class="nav-tab" data-tab="search" data-action="go-search">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>検索</span>
      </button>`;
    document.body.appendChild(nav);
  }
}

// === INIT ===
async function init() {
  const isMock = SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON === 'YOUR_SUPABASE_ANON_KEY';

  if (isMock) {
    enableMockMode();
  } else {
    initSupabase(SUPABASE_URL, SUPABASE_ANON);
  }

  renderChrome();
  showView('feed');
}

init();
