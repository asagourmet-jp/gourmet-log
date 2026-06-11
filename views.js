import { loadStores, searchStores, getStore, getPhotoUrl } from './api.js';

function photoUrl(photo) {
  return getPhotoUrl(photo) || '';
}
import { renderStoreCard, renderSkeletonCard, renderStars, renderStatusBadge, escHtml } from './components.js';

const GENRES = ['ラーメン','寿司','焼肉','イタリアン','フレンチ','カフェ','居酒屋','その他'];

// ── Feed View ────────────────────────────────────────────

export async function renderFeedView(state, container) {
  container.innerHTML = `
    <div style="padding-bottom:72px;">
      <!-- Header -->
      <div style="position:sticky;top:0;background:#fff;border-bottom:1px solid #DBDBDB;height:44px;display:flex;align-items:center;padding:0 16px;z-index:50;justify-content:space-between;">
        <span style="font-size:13px;font-weight:700;letter-spacing:.15em;color:#262626;">GOURMET LOG</span>
        <div style="display:flex;gap:12px;">
          <button data-action="go-search" style="background:none;border:none;cursor:pointer;color:#262626;padding:4px;">
            <i data-lucide="search" width="20" height="20"></i>
          </button>
        </div>
      </div>

      <!-- Skeleton while loading -->
      <div id="feed-grid" style="padding:12px;display:grid;gap:12px;grid-template-columns:1fr;">
        ${[1,2,3].map(() => renderSkeletonCard()).join('')}
      </div>

      <!-- Load more trigger -->
      <div id="load-more-trigger" style="height:40px;"></div>
    </div>`;

  lucide.createIcons();

  // Load data
  try {
    const { data, count } = await loadStores({ page: state.page, ...state.filters });
    state.stores = data;
    state.totalCount = count;
    renderFeedGrid(state, document.getElementById('feed-grid'));
    setupInfiniteScroll(state, document.getElementById('load-more-trigger'));
  } catch (e) {
    document.getElementById('feed-grid').innerHTML = renderErrorState(e);
  }
}

function renderFeedGrid(state, gridEl) {
  if (!state.stores.length && state.page === 0) {
    gridEl.innerHTML = `<div class="welcome-state">
      <div style="font-size:60px;">🍽️</div>
      <div style="font-size:17px;font-weight:600;color:#262626;">まだお店が登録されていません</div>
      <div style="font-size:14px;color:#737373;">最初のお店を追加しましょう</div>
      <button data-action="open-form" style="padding:12px 28px;background:var(--accent);color:#fff;border:none;border-radius:24px;font-size:15px;font-weight:600;cursor:pointer;margin-top:4px;">＋ お店を追加する</button>
    </div>`;
    return;
  }

  // Responsive columns via JS
  const cols = window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1;
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  gridEl.innerHTML = state.stores.map(s => renderStoreCard(s)).join('');

  // Init carousel dots for each card
  gridEl.querySelectorAll('.carousel-track').forEach(track => {
    const slides = track.querySelectorAll('.carousel-slide');
    if (slides.length <= 1) return;
    const card = track.closest('.store-card');
    const dotContainer = card?.querySelector('div[style*="justify-content:center"]');
    if (!dotContainer) return;
    const dots = dotContainer.querySelectorAll('span');
    track.addEventListener('scroll', () => {
      const idx = Math.round(track.scrollLeft / track.offsetWidth);
      dots.forEach((d, i) => { d.style.background = i === idx ? '#262626' : '#D4D4D4'; });
    }, { passive: true });
  });
}

function setupInfiniteScroll(state, trigger) {
  if (!trigger) return;
  const observer = new IntersectionObserver(async entries => {
    if (!entries[0].isIntersecting) return;
    if (state.loading) return;
    const loaded = state.stores.length;
    if (loaded >= state.totalCount) return;
    state.loading = true;
    state.page++;
    try {
      const { data } = await loadStores({ page: state.page, ...state.filters });
      state.stores = [...state.stores, ...data];
      const grid = document.getElementById('feed-grid');
      if (grid) {
        const frag = document.createElement('div');
        frag.innerHTML = data.map(s => renderStoreCard(s)).join('');
        while (frag.firstChild) grid.appendChild(frag.firstChild);
      }
    } finally {
      state.loading = false;
    }
  }, { rootMargin: '200px' });
  observer.observe(trigger);
}

function renderErrorState(err) {
  return `<div style="padding:40px;text-align:center;">
    <div style="color:#EF4444;font-size:15px;margin-bottom:8px;">⚠️ 読み込みに失敗しました</div>
    <div style="color:#737373;font-size:13px;">${escHtml(err.message)}</div>
    <button data-action="reload" style="margin-top:16px;padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:20px;font-size:14px;cursor:pointer;">再試行</button>
  </div>`;
}

// ── Detail View ──────────────────────────────────────────

export async function renderDetailView(storeId, container) {
  container.innerHTML = `<div style="padding-bottom:80px;" class="view-enter">
    <div style="padding:40px;text-align:center;">${renderSkeletonCard()}</div>
  </div>`;

  let store;
  try {
    store = await getStore(storeId);
  } catch (e) {
    container.innerHTML = `<div style="padding:40px;text-align:center;color:#EF4444;">読み込み失敗: ${escHtml(e.message)}</div>`;
    return;
  }

  const photos = (store.photos || []).sort((a, b) => a.sort_order - b.sort_order);

  const carouselHtml = photos.length
    ? `<div style="position:relative;">
        <div class="carousel-track" id="detail-carousel" style="height:100vw;max-height:420px;">
          ${photos.map((p, i) => {
            const url = photoUrl(p);
            return `<div class="carousel-slide${i === 0 ? ' active' : ''}" style="height:inherit;">
              <img src="${url}" loading="lazy" style="width:100%;height:100%;object-fit:cover;background:#f0f0f0;" />
            </div>`;
          }).join('')}
        </div>
        ${photos.length > 1 ? `<div id="detail-dots" style="position:absolute;bottom:10px;left:0;right:0;display:flex;justify-content:center;gap:5px;">
          ${photos.map((_, i) => `<span style="width:7px;height:7px;border-radius:50%;background:${i === 0 ? '#fff' : 'rgba(255,255,255,0.5)'};transition:background 0.2s;"></span>`).join('')}
        </div>` : ''}
        <button data-action="go-feed" style="position:absolute;top:12px;left:12px;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.4);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;">
          <i data-lucide="arrow-left" width="18" height="18"></i>
        </button>
        <button data-action="open-form" data-store-id="${store.id}" style="position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.4);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;">
          <i data-lucide="pencil" width="16" height="16"></i>
        </button>
      </div>`
    : `<div style="width:100%;height:200px;background:#F0F0F0;display:flex;align-items:center;justify-content:center;position:relative;">
        <span style="color:#A8A8A8;">写真なし</span>
        <button data-action="go-feed" style="position:absolute;top:12px;left:12px;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.2);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#262626;">
          <i data-lucide="arrow-left" width="18" height="18"></i>
        </button>
      </div>`;

  container.innerHTML = `<div style="padding-bottom:80px;" class="view-enter">
    ${carouselHtml}
    <div style="padding:16px;display:flex;flex-direction:column;gap:14px;">
      <!-- Name & meta -->
      <div>
        <div class="text-title">${escHtml(store.name)}</div>
        <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
          <span style="padding:4px 12px;background:#F5F5F5;border-radius:20px;font-size:13px;color:#737373;">${escHtml(store.genre)}</span>
          <span style="padding:4px 12px;background:#F5F5F5;border-radius:20px;font-size:13px;color:#737373;">${escHtml(store.area)}</span>
        </div>
        <div style="margin-top:8px;">${renderStars(store.rating)}</div>
      </div>

      <hr style="border:none;border-top:1px solid #DBDBDB;" />

      <!-- Status toggles -->
      <div>
        <div style="font-size:13px;font-weight:600;color:#737373;margin-bottom:10px;">投稿ステータス</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid #DBDBDB;border-radius:12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="width:28px;height:28px;background:#E85328;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;">T</span>
              <span style="font-size:15px;font-weight:500;">食べログ</span>
            </div>
            <div class="toggle-pill" data-store-id="${store.id}" data-platform="tabelog">
              <button class="${store.tabelog_status === 'not_posted' ? 'active' : ''}" data-action="set-status" data-value="not_posted">未投稿</button>
              <button class="${store.tabelog_status === 'posted' ? 'active' : ''}" data-action="set-status" data-value="posted">投稿済み</button>
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid #DBDBDB;border-radius:12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="width:28px;height:28px;background:#E1306C;border-radius:6px;display:flex;align-items:center;justify-content:center;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="#fff" stroke="none"/></svg>
              </span>
              <span style="font-size:15px;font-weight:500;">Instagram</span>
            </div>
            <div class="toggle-pill" data-store-id="${store.id}" data-platform="instagram">
              <button class="${store.instagram_status === 'not_posted' ? 'active' : ''}" data-action="set-status" data-value="not_posted">未投稿</button>
              <button class="${store.instagram_status === 'posted' ? 'active' : ''}" data-action="set-status" data-value="posted">投稿済み</button>
            </div>
          </div>
        </div>
      </div>

      ${store.tabelog_url ? `<div>
        <div style="font-size:13px;font-weight:600;color:#737373;margin-bottom:6px;">食べログURL</div>
        <a href="${escHtml(store.tabelog_url)}" target="_blank" rel="noopener"
          style="display:flex;align-items:center;gap:6px;font-size:14px;color:var(--accent);text-decoration:none;word-break:break-all;">
          <i data-lucide="external-link" width="14" height="14"></i>
          ${escHtml(store.tabelog_url)}
        </a>
      </div>` : ''}

      ${store.review_text ? `<div>
        <div style="font-size:13px;font-weight:600;color:#737373;margin-bottom:6px;">口コミメモ</div>
        <p style="font-size:15px;color:#262626;line-height:1.65;white-space:pre-wrap;">${escHtml(store.review_text)}</p>
      </div>` : ''}

      <!-- All photos grid -->
      ${photos.length ? `<div>
        <div style="font-size:13px;font-weight:600;color:#737373;margin-bottom:8px;">すべての写真 (${photos.length}枚)</div>
        <div class="detail-photo-grid">
          ${photos.map(p => `<div style="position:relative;">
            <img src="${photoUrl(p)}" loading="lazy" alt="写真" style="aspect-ratio:1;object-fit:cover;width:100%;display:block;" />
            <button data-action="download-photo" data-photo-url="${escHtml(photoUrl(p))}"
              style="position:absolute;bottom:6px;right:6px;width:28px;height:28px;border-radius:50%;border:none;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;"
              aria-label="写真をダウンロード">
              <i data-lucide="download" width="15" height="15"></i>
            </button>
          </div>`).join('')}
        </div>
      </div>` : ''}
    </div>

    <!-- Action bar -->
    <div style="position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #DBDBDB;padding:12px 16px;display:flex;gap:12px;z-index:100;">
      <button data-action="delete-store" data-store-id="${store.id}"
        style="flex:1;padding:13px;border-radius:12px;border:1.5px solid #EF4444;background:#fff;color:#EF4444;font-size:15px;font-weight:600;cursor:pointer;">削除</button>
      <button data-action="open-form" data-store-id="${store.id}"
        style="flex:2;padding:13px;border-radius:12px;border:none;background:var(--accent);color:#fff;font-size:15px;font-weight:600;cursor:pointer;">編集する</button>
    </div>
  </div>`;

  lucide.createIcons();

  // Carousel dot sync
  const carousel = document.getElementById('detail-carousel');
  const dots = document.getElementById('detail-dots');
  if (carousel && dots && photos.length > 1) {
    const dotEls = dots.querySelectorAll('span');
    carousel.addEventListener('scroll', () => {
      const idx = Math.round(carousel.scrollLeft / carousel.offsetWidth);
      dotEls.forEach((d, i) => {
        d.style.background = i === idx ? '#fff' : 'rgba(255,255,255,0.5)';
      });
    }, { passive: true });
  }
}

// ── Search View ──────────────────────────────────────────

export function renderSearchView(state, container) {
  container.innerHTML = `<div style="padding-bottom:72px;" class="view-enter">
    <div style="position:sticky;top:0;background:#fff;border-bottom:1px solid #DBDBDB;padding:10px 16px;z-index:50;">
      <div style="display:flex;align-items:center;background:#EFEFEF;border-radius:24px;padding:0 14px;gap:8px;">
        <i data-lucide="search" width="16" height="16" style="color:#737373;flex-shrink:0;"></i>
        <input id="search-input" type="search" placeholder="お店を検索..."
          style="flex:1;border:none;background:none;padding:11px 0;font-size:15px;outline:none;color:#262626;"
          autocomplete="off" value="${escHtml(state.searchQuery || '')}" />
      </div>
    </div>

    <!-- Filter chips -->
    <div class="filter-scroll" style="padding:10px 16px;display:flex;gap:8px;">
      ${renderFilterChips(state)}
    </div>

    <div id="search-results" style="padding:0 12px;display:grid;gap:12px;grid-template-columns:1fr;"></div>
  </div>`;

  lucide.createIcons();

  const input = document.getElementById('search-input');
  input.addEventListener('input', async e => {
    state.searchQuery = e.target.value.trim();
    await runSearch(state);
  });

  // run initial search
  runSearch(state);
}

function renderFilterChips(state) {
  const f = state.filters || {};
  const chips = [
    { label: '全てのジャンル', key: 'genre', value: null },
    ...GENRES.map(g => ({ label: g, key: 'genre', value: g })),
    { label: '★3以上', key: 'rating', value: 3 },
    { label: '★4以上', key: 'rating', value: 4 },
    { label: '★5のみ', key: 'rating', value: 5 },
    { label: '未投稿あり', key: 'status', value: 'any_not_posted' },
    { label: '食べログ未', key: 'status', value: 'tabelog_not_posted' },
    { label: 'IG未', key: 'status', value: 'instagram_not_posted' },
  ];
  return chips.map(c => {
    const active = f[c.key] === c.value || (c.value === null && !f[c.key]);
    return `<button class="chip${active ? ' active' : ''}" data-action="set-filter" data-key="${c.key}" data-value="${c.value ?? ''}">${escHtml(c.label)}</button>`;
  }).join('');
}

async function runSearch(state) {
  const resultsEl = document.getElementById('search-results');
  if (!resultsEl) return;
  resultsEl.innerHTML = [1,2,3].map(() => renderSkeletonCard()).join('');

  try {
    let data;
    if (state.searchQuery) {
      data = await searchStores(state.searchQuery);
      // apply client-side filters
      const f = state.filters || {};
      if (f.genre)  data = data.filter(s => s.genre === f.genre);
      if (f.rating) data = data.filter(s => s.rating >= f.rating);
      if (f.status === 'tabelog_not_posted')   data = data.filter(s => s.tabelog_status === 'not_posted');
      if (f.status === 'instagram_not_posted') data = data.filter(s => s.instagram_status === 'not_posted');
      if (f.status === 'any_not_posted')       data = data.filter(s => s.tabelog_status === 'not_posted' || s.instagram_status === 'not_posted');
    } else {
      const res = await loadStores({ page: 0, ...state.filters });
      data = res.data;
    }

    const cols = window.innerWidth >= 640 ? 2 : 1;
    resultsEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    if (!data.length) {
      resultsEl.innerHTML = `<div style="padding:40px;text-align:center;color:#737373;font-size:14px;">該当するお店が見つかりませんでした</div>`;
      return;
    }
    resultsEl.innerHTML = `<div style="padding:4px 4px 8px;font-size:13px;color:#737373;">${data.length}件</div>` + data.map(s => renderStoreCard(s)).join('');
  } catch (e) {
    resultsEl.innerHTML = `<div style="padding:40px;text-align:center;color:#EF4444;font-size:14px;">読み込み失敗: ${escHtml(e.message)}</div>`;
  }
}

export { runSearch, renderFilterChips };

// ── Form View ────────────────────────────────────────────

export function renderFormView(store = null) {
  const isEdit = !!store?.id;
  const title = isEdit ? 'お店を編集' : 'お店を追加';

  const modal = document.createElement('div');
  modal.className = 'modal-full';
  modal.id = 'store-form-modal';
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #DBDBDB;position:sticky;top:0;background:#fff;z-index:10;">
      <span style="font-size:17px;font-weight:600;">${title}</span>
      <button data-action="close-form" style="background:none;border:none;cursor:pointer;padding:6px;">
        <i data-lucide="x" width="20" height="20"></i>
      </button>
    </div>

    <div style="padding:16px;display:flex;flex-direction:column;gap:20px;padding-bottom:100px;">
      <!-- Photos -->
      <div>
        <label class="form-label">写真をアップロード</label>
        <div id="photo-upload-grid" class="photo-grid" style="margin-bottom:8px;"></div>
        <label for="photo-file-input" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border:1.5px dashed #DBDBDB;border-radius:10px;cursor:pointer;font-size:14px;color:#737373;">
          <i data-lucide="plus" width="16" height="16"></i> 写真を選択
        </label>
        <input type="file" id="photo-file-input" accept="image/jpeg,image/png,image/webp" multiple style="display:none;" />
      </div>

      <!-- Name -->
      <div>
        <label class="form-label">店名 <span style="color:#E1306C;">*</span></label>
        <input type="text" id="f-name" class="form-input" placeholder="例: 一蘭 渋谷店" value="${escHtml(store?.name || '')}" />
      </div>

      <!-- Genre -->
      <div>
        <label class="form-label">ジャンル <span style="color:#E1306C;">*</span></label>
        <select id="f-genre" class="form-input">
          <option value="">選択してください</option>
          ${GENRES.map(g => `<option value="${g}" ${store?.genre === g ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
      </div>

      <!-- Area -->
      <div>
        <label class="form-label">エリア <span style="color:#E1306C;">*</span></label>
        <input type="text" id="f-area" class="form-input" placeholder="例: 渋谷、新宿" value="${escHtml(store?.area || '')}" />
      </div>

      <!-- Rating -->
      <div>
        <label class="form-label">自分の評価 <span style="color:#E1306C;">*</span></label>
        <div id="f-rating-stars" style="display:flex;">
          ${[1,2,3,4,5].map(i => `<button class="star-btn" data-action="set-rating" data-value="${i}" type="button"
            style="color:${i <= (store?.rating || 0) ? '#F59E0B' : '#D4D4D4'};">★</button>`).join('')}
        </div>
        <input type="hidden" id="f-rating" value="${store?.rating || 0}" />
      </div>

      <!-- Tabelog URL -->
      <div>
        <label class="form-label">食べログURL</label>
        <input type="url" id="f-tabelog-url" class="form-input" placeholder="https://tabelog.com/..." value="${escHtml(store?.tabelog_url || '')}" />
      </div>

      <!-- Status -->
      <div>
        <label class="form-label">投稿ステータス</label>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:14px;color:#262626;">食べログ</span>
            <div class="toggle-pill">
              <button type="button" class="${(store?.tabelog_status ?? 'not_posted') === 'not_posted' ? 'active' : ''}"
                data-action="form-toggle-status" data-field="tabelog_status" data-value="not_posted">未投稿</button>
              <button type="button" class="${store?.tabelog_status === 'posted' ? 'active' : ''}"
                data-action="form-toggle-status" data-field="tabelog_status" data-value="posted">投稿済み</button>
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:14px;color:#262626;">Instagram</span>
            <div class="toggle-pill">
              <button type="button" class="${(store?.instagram_status ?? 'not_posted') === 'not_posted' ? 'active' : ''}"
                data-action="form-toggle-status" data-field="instagram_status" data-value="not_posted">未投稿</button>
              <button type="button" class="${store?.instagram_status === 'posted' ? 'active' : ''}"
                data-action="form-toggle-status" data-field="instagram_status" data-value="posted">投稿済み</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Review -->
      <div>
        <label class="form-label" style="display:flex;justify-content:space-between;">
          <span>口コミメモ</span>
          <span id="review-count" style="color:#A8A8A8;">0 / 500文字</span>
        </label>
        <textarea id="f-review" class="form-input" rows="4" maxlength="500" placeholder="感想、メモを入力..."
          style="resize:none;line-height:1.6;">${escHtml(store?.review_text || '')}</textarea>
      </div>
    </div>

    <!-- Sticky footer -->
    <div class="form-footer">
      <button data-action="close-form" style="flex:1;padding:13px;border-radius:12px;border:1.5px solid #DBDBDB;background:#fff;font-size:15px;cursor:pointer;color:#737373;">キャンセル</button>
      <button id="form-save-btn" data-action="save-store" data-store-id="${store?.id || ''}"
        style="flex:2;padding:13px;border-radius:12px;border:none;background:var(--accent);color:#fff;font-size:15px;font-weight:600;cursor:pointer;">保存する →</button>
    </div>`;

  document.body.appendChild(modal);
  lucide.createIcons({ attrs: { 'stroke-width': 2 } });

  // Review char counter
  const reviewEl = document.getElementById('f-review');
  const reviewCount = document.getElementById('review-count');
  if (reviewEl && reviewCount) {
    reviewCount.textContent = `${reviewEl.value.length} / 500文字`;
    reviewEl.addEventListener('input', () => {
      reviewCount.textContent = `${reviewEl.value.length} / 500文字`;
    });
  }

  // Render existing photos
  if (store?.photos?.length) {
    const grid = document.getElementById('photo-upload-grid');
    store.photos.forEach(p => {
      const url = photoUrl(p);
      const wrap = document.createElement('div');
      wrap.className = 'photo-thumb-wrap';
      wrap.dataset.photoId = p.id;
      wrap.dataset.storagePath = p.storage_path;
      wrap.innerHTML = `<img class="photo-thumb" src="${url}" alt="写真" />
        <button class="remove-btn" data-action="remove-existing-photo" data-photo-id="${p.id}" data-path="${p.storage_path}">✕</button>`;
      grid.appendChild(wrap);
    });
  }

  return modal;
}
