// Supabase API layer
import { MOCK_STORES, getMockPhotoUrl } from './mock.js';

let _supabase = null;
let _mockMode = false;
let _mockData = JSON.parse(JSON.stringify(MOCK_STORES)); // mutable copy
const BUCKET = 'store-photos';
const PAGE_SIZE = 20;

export function initSupabase(url, key) {
  _supabase = supabase.createClient(url, key);
  return _supabase;
}

export function enableMockMode() {
  _mockMode = true;
}

export function isMockMode() {
  return _mockMode;
}

// Mock photo URL resolver (used by components)
export { getMockPhotoUrl };

export function getClient() { return _supabase; }

// ── Stores ──────────────────────────────────────────────

function mockFilter(data, { genre, area, rating, status } = {}) {
  let r = [...data];
  if (genre)  r = r.filter(s => s.genre === genre);
  if (area)   r = r.filter(s => s.area.includes(area));
  if (rating) r = r.filter(s => s.rating >= rating);
  if (status === 'tabelog_not_posted')   r = r.filter(s => s.tabelog_status === 'not_posted');
  if (status === 'instagram_not_posted') r = r.filter(s => s.instagram_status === 'not_posted');
  if (status === 'any_not_posted')       r = r.filter(s => s.tabelog_status === 'not_posted' || s.instagram_status === 'not_posted');
  return r;
}

export async function loadStores({ page = 0, genre, area, rating, status } = {}) {
  if (_mockMode) {
    const filtered = mockFilter(_mockData, { genre, area, rating, status });
    const start = page * PAGE_SIZE;
    return { data: filtered.slice(start, start + PAGE_SIZE), count: filtered.length };
  }

  let q = _supabase
    .from('stores')
    .select('*, photos(id, storage_path, sort_order)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (genre)  q = q.eq('genre', genre);
  if (area)   q = q.ilike('area', `%${area}%`);
  if (rating) q = q.gte('rating', rating);
  if (status === 'tabelog_not_posted')   q = q.eq('tabelog_status', 'not_posted');
  if (status === 'instagram_not_posted') q = q.eq('instagram_status', 'not_posted');
  if (status === 'any_not_posted')
    q = q.or('tabelog_status.eq.not_posted,instagram_status.eq.not_posted');

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function searchStores(query) {
  if (_mockMode) {
    const q = query.toLowerCase();
    return _mockData.filter(s => s.name.toLowerCase().includes(q));
  }
  const { data, error } = await _supabase
    .from('stores')
    .select('*, photos(id, storage_path, sort_order)')
    .ilike('name', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function getStore(id) {
  if (_mockMode) {
    const store = _mockData.find(s => s.id === id);
    if (!store) throw new Error('Store not found');
    return store;
  }
  const { data, error } = await _supabase
    .from('stores')
    .select('*, photos(id, storage_path, sort_order)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function saveStore(store) {
  if (_mockMode) {
    const { photos: _p, ...payload } = store;
    if (payload.id) {
      const idx = _mockData.findIndex(s => s.id === payload.id);
      if (idx >= 0) _mockData[idx] = { ..._mockData[idx], ...payload };
      return _mockData[idx];
    } else {
      const newStore = { ...payload, id: String(Date.now()), photos: [], created_at: new Date().toISOString() };
      _mockData.unshift(newStore);
      return newStore;
    }
  }
  const { photos: _p, ...payload } = store;
  if (payload.id) {
    const { data, error } = await _supabase
      .from('stores')
      .update(payload)
      .eq('id', payload.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await _supabase
      .from('stores')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function updateStoreStatus(id, field, value) {
  if (_mockMode) {
    const store = _mockData.find(s => s.id === id);
    if (store) store[field] = value;
    return;
  }
  const { error } = await _supabase
    .from('stores')
    .update({ [field]: value })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteStore(id) {
  if (_mockMode) {
    _mockData = _mockData.filter(s => s.id !== id);
    return;
  }
  const { error } = await _supabase.from('stores').delete().eq('id', id);
  if (error) throw error;
}

// ── Photos ──────────────────────────────────────────────

export async function uploadPhoto(storeId, file, onProgress) {
  if (_mockMode) {
    if (onProgress) onProgress(100);
    const objectUrl = URL.createObjectURL(file);
    const newPhoto = { id: String(Date.now()), store_id: storeId, storage_path: null, sort_order: Date.now(), _mockUrl: objectUrl };
    const store = _mockData.find(s => s.id === storeId);
    if (store) store.photos.push(newPhoto);
    return newPhoto;
  }
  const ext = file.name.split('.').pop();
  const path = `${storeId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: upErr } = await _supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;
  if (onProgress) onProgress(100);

  const { data: dbData, error: dbErr } = await _supabase
    .from('photos')
    .insert({ store_id: storeId, storage_path: path, sort_order: Date.now() })
    .select()
    .single();
  if (dbErr) throw dbErr;
  return dbData;
}

export async function deletePhoto(photoId, storagePath) {
  if (_mockMode) {
    _mockData.forEach(s => { s.photos = s.photos.filter(p => p.id !== photoId); });
    return;
  }
  await _supabase.storage.from(BUCKET).remove([storagePath]);
  const { error } = await _supabase.from('photos').delete().eq('id', photoId);
  if (error) throw error;
}

export function getPhotoUrl(photo) {
  // photo can be a photo object (mock mode) or a storage path string (Supabase mode)
  if (typeof photo === 'object' && photo !== null) {
    if (photo._mockUrl) return photo._mockUrl;
    if (!photo.storage_path) return null;
    if (!_supabase) return null;
    const { data } = _supabase.storage.from(BUCKET).getPublicUrl(photo.storage_path);
    return data?.publicUrl || null;
  }
  // legacy: called with path string
  if (!photo) return null;
  if (!_supabase) return null;
  const { data } = _supabase.storage.from(BUCKET).getPublicUrl(photo);
  return data?.publicUrl || null;
}
