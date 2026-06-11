import { getPhotoUrl } from './api.js';

function photoUrl(photo) {
  return getPhotoUrl(photo) || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
}

// ── Status Badge ─────────────────────────────────────────

export function renderStatusBadge(platform, status, storeId) {
  const posted = status === 'posted';
  const isTabelog = platform === 'tabelog';
  const bgColor = posted
    ? (isTabelog ? '#E85328' : '#E1306C')
    : '#D4D4D4';
  const textColor = posted ? '#fff' : '#737373';
  const label = posted ? '投稿済み' : '未投稿';
  const icon = isTabelog
    ? `<span style="font-size:11px;font-weight:700;">T</span>`
    : `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>`;

  return `<button
    class="status-badge"
    style="background:${bgColor};color:${textColor};"
    data-action="toggle-status"
    data-store-id="${storeId}"
    data-platform="${platform}"
    data-current="${status}"
  >${icon} ${label}</button>`;
}

// ── Star Display ─────────────────────────────────────────

export function renderStars(rating, interactive = false, name = 'rating') {
  let html = '<div style="display:flex;align-items:center;">';
  for (let i = 1; i <= 5; i++) {
    const filled = i <= rating;
    if (interactive) {
      html += `<button class="star-btn" data-action="set-rating" data-value="${i}" type="button"
        style="color:${filled ? '#F59E0B' : '#D4D4D4'};">★</button>`;
    } else {
      html += `<span style="font-size:16px;color:${filled ? '#F59E0B' : '#D4D4D4'};">★</span>`;
    }
  }
  html += `<span style="font-size:13px;color:#737373;margin-left:4px;">${rating}/5</span>`;
  html += '</div>';
  return html;
}

// ── Store Card ───────────────────────────────────────────

export function renderStoreCard(store) {
  const photos = (store.photos || []).sort((a, b) => a.sort_order - b.sort_order);
  const hasPhotos = photos.length > 0;

  const carouselSlides = hasPhotos
    ? photos.map((p, i) => {
        const url = photoUrl(p);
        return `<div class="carousel-slide${i === 0 ? ' active' : ''}">
          <img src="${url}" alt="写真" loading="lazy"
            style="width:100%;aspect-ratio:1;object-fit:cover;background:#f0f0f0;" />
        </div>`;
      }).join('')
    : `<div class="carousel-slide active">
        <div style="width:100%;aspect-ratio:1;background:#F0F0F0;display:flex;align-items:center;justify-content:center;">
          <span style="color:#A8A8A8;font-size:13px;">写真なし</span>
        </div>
      </div>`;

  const dotsHtml = photos.length > 1
    ? `<div style="display:flex;justify-content:center;gap:4px;padding:6px 0;">
        ${photos.map((_, i) => `<span style="width:6px;height:6px;border-radius:50%;background:${i === 0 ? '#262626' : '#D4D4D4'};transition:background 0.2s;"></span>`).join('')}
      </div>`
    : '';

  const reviewText = store.review_text || '';
  const shortReview = reviewText.length > 60 ? reviewText.slice(0, 60) + '...' : reviewText;

  return `<div class="store-card" data-action="open-store" data-store-id="${store.id}">
    <div style="position:relative;">
      <div class="carousel-track" data-carousel="${store.id}">
        ${carouselSlides}
      </div>
      <div style="position:absolute;top:8px;right:8px;display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
        ${renderStatusBadge('tabelog', store.tabelog_status, store.id)}
        ${renderStatusBadge('instagram', store.instagram_status, store.id)}
      </div>
    </div>
    ${dotsHtml}
    <div style="padding:10px 12px 12px;">
      ${renderStars(store.rating)}
      <div class="text-heading" style="margin-top:4px;">${escHtml(store.name)}</div>
      <div style="font-size:13px;color:#737373;margin-top:2px;">${escHtml(store.genre)} · ${escHtml(store.area)}</div>
      ${shortReview ? `<div style="font-size:13px;color:#737373;margin-top:6px;line-height:1.5;">
        ${escHtml(shortReview)}
        ${reviewText.length > 60 ? `<span style="color:var(--accent);font-size:12px;" data-action="open-store" data-store-id="${store.id}">続きを読む</span>` : ''}
      </div>` : ''}
    </div>
  </div>`;
}

// ── Skeleton Card ────────────────────────────────────────

export function renderSkeletonCard() {
  return `<div class="store-card" style="overflow:hidden;">
    <div class="skeleton" style="width:100%;aspect-ratio:1;border-radius:0;"></div>
    <div style="padding:12px;display:flex;flex-direction:column;gap:8px;">
      <div class="skeleton" style="height:14px;width:60%;"></div>
      <div class="skeleton" style="height:18px;width:80%;"></div>
      <div class="skeleton" style="height:13px;width:50%;"></div>
    </div>
  </div>`;
}

// ── Toast ────────────────────────────────────────────────

export function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── Confirm Dialog ───────────────────────────────────────

export function showConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `<div class="dialog-box">
      <p style="font-size:15px;font-weight:600;margin-bottom:8px;">確認</p>
      <p style="font-size:14px;color:#737373;margin-bottom:20px;">${message}</p>
      <div style="display:flex;gap:10px;">
        <button id="dlg-cancel" style="flex:1;padding:12px;border-radius:10px;border:1.5px solid #DBDBDB;font-size:15px;background:#fff;cursor:pointer;">キャンセル</button>
        <button id="dlg-ok" style="flex:1;padding:12px;border-radius:10px;border:none;font-size:15px;background:#EF4444;color:#fff;font-weight:600;cursor:pointer;">削除する</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#dlg-cancel').addEventListener('click', () => { overlay.remove(); resolve(false); });
    overlay.querySelector('#dlg-ok').addEventListener('click', () => { overlay.remove(); resolve(true); });
  });
}

// ── Helpers ──────────────────────────────────────────────

export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function setupCarouselDots(trackEl, store) {
  const slides = trackEl.querySelectorAll('.carousel-slide');
  const dotsEl = trackEl.closest('.store-card')?.querySelectorAll('[data-carousel-dot]');
  if (slides.length <= 1) return;

  trackEl.addEventListener('scroll', () => {
    const idx = Math.round(trackEl.scrollLeft / trackEl.offsetWidth);
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    if (dotsEl) {
      dotsEl.forEach((d, i) => {
        d.style.background = i === idx ? '#262626' : '#D4D4D4';
      });
    }
  }, { passive: true });
}
