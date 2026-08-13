/**
 * History Service for "Continuar Viendo"
 * Syncs Movies and Series left in-progress ("a medias") across all devices using Neon PostgreSQL API
 */

import { getBackendUrl } from '../config';

const LOCAL_STORAGE_KEY = 'streamtv_watch_history';

const getLocalHistory = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return list.filter((i) => {
      const isVodOrSeries = i.item_type === 'vod' || i.item_type === 'series';
      const inProgress = i.progress_seconds >= 3 && (!i.duration_seconds || i.progress_seconds < i.duration_seconds - 20);
      return isVodOrSeries && inProgress;
    });
  } catch (err) {
    return [];
  }
};

const saveLocalHistory = (item) => {
  if (item.item_type === 'live') return;

  try {
    const list = getLocalHistory();
    const compositeId = `${item.item_type || 'vod'}_${item.item_id}`;
    const filtered = list.filter((i) => i.id !== compositeId);

    const isFinished = item.duration_seconds > 0 && item.progress_seconds >= item.duration_seconds - 20;
    const isTooShort = item.progress_seconds < 3;

    if (!isFinished && !isTooShort) {
      const newItem = {
        id: compositeId,
        ...item,
        updated_at: new Date().toISOString(),
      };
      filtered.unshift(newItem);
    }

    const trimmed = filtered.slice(0, 20);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('LocalStorage history save error:', err);
  }
};

/**
 * Fetch watch history (Neon DB API with localStorage fallback)
 */
export const fetchWatchHistory = async () => {
  const localItems = getLocalHistory();
  const backendUrl = getBackendUrl();
  const token = localStorage.getItem('streamtv_token');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${backendUrl}/api/history`, { 
      headers,
      signal: controller.signal 
    });
    clearTimeout(timeoutId);

    if (res.status === 403) {
      window.dispatchEvent(new Event('auth-expired'));
    }

    const contentType = res.headers.get('content-type');
    if (res.ok && contentType && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        return data.history;
      }
    }
  } catch (err) {
    // Local fallback
  }

  return localItems;
};

/**
 * Save / Upsert watch progress
 */
export const saveWatchProgress = async (itemData) => {
  const {
    item_id,
    item_type = 'vod',
    title,
    subtitle,
    poster,
    stream_url,
    progress_seconds = 0,
    duration_seconds = 0,
  } = itemData;

  if (!item_id || !stream_url || item_type === 'live') return;

  const payload = {
    item_id: String(item_id),
    item_type,
    title,
    subtitle,
    poster,
    stream_url,
    progress_seconds: Number(progress_seconds) || 0,
    duration_seconds: Number(duration_seconds) || 0,
  };

  saveLocalHistory(payload);

  const backendUrl = getBackendUrl();
  const token = localStorage.getItem('streamtv_token');

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 6000);

    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    await fetch(`${backendUrl}/api/history`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    // Non-blocking error
  }
};
