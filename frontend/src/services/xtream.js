/**
 * Service for interacting with Xtream Codes API
 * Uses /api_proxy for metadata and /api_stream for video streaming.
 * Completely hides credentials (username, password, server URLs) from client browser & eliminates Mixed Content blocking.
 */

import { getBackendUrl } from '../config';

export const getCredentials = () => {
  return {
    server: 'Servidor IPTV',
    user: 'Usuario Activo',
  };
};

const getApiEndpoint = () => {
  const backendUrl = getBackendUrl();
  return {
    url: `${backendUrl}/api_proxy`,
  };
};

// In-Memory Stream Cache
const streamCache = {
  live: null,
  vod: null,
  series: null,
};

const fetchJson = async (action = '', extraParams = '', timeoutMs = 25000) => {
  const { url } = getApiEndpoint();
  const fullUrl = action ? `${url}?action=${action}${extraParams}` : url;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const token = localStorage.getItem('streamtv_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(fullUrl, { 
      headers,
      signal: controller.signal 
    });
    clearTimeout(timer);

    if (response.status === 403) {
      window.dispatchEvent(new Event('auth-expired'));
    }

    if (!response.ok) {
      throw new Error('Servicio no disponible temporalmente.');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timer);
    throw new Error('No se pudo conectar con el servicio de televisión.');
  }
};

/**
 * Batch Helper to fetch categories sequentially in small chunks (max 3 concurrent)
 * Prevents triggering rate-limiting or server load blocks
 */
const batchFetchCategoryStreams = async (categories, fetchStreamFn, batchSize = 3, delayMs = 60) => {
  const allResults = [];
  for (let i = 0; i < categories.length; i += batchSize) {
    const chunk = categories.slice(i, i + batchSize);
    const chunkResults = await Promise.all(
      chunk.map((cat) => fetchStreamFn(cat.category_id).catch(() => []))
    );
    allResults.push(...chunkResults);

    if (i + batchSize < categories.length) {
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
  return allResults.flat().filter((item) => item && (item.stream_id || item.series_id));
};

export const authenticateAccount = async () => {
  return await fetchJson();
};

/**
 * Live TV API Calls
 */
export const getLiveCategories = async () => {
  return await fetchJson('get_live_categories');
};

export const getLiveStreams = async (categoryId = null) => {
  const extra = categoryId ? `&category_id=${categoryId}` : '';
  return await fetchJson('get_live_streams', extra);
};

export const getAllLiveStreams = async (categories = []) => {
  if (streamCache.live) return streamCache.live;

  try {
    const direct = await getLiveStreams();
    if (Array.isArray(direct) && direct.length > 0) {
      streamCache.live = direct;
      return direct;
    }
  } catch (err) {
    // Fallback to batched category fetch
  }

  if (categories && categories.length > 0) {
    const batched = await batchFetchCategoryStreams(categories, getLiveStreams);
    if (batched.length > 0) streamCache.live = batched;
    return batched;
  }

  return [];
};

export const getLiveStreamUrl = (streamId) => {
  const backendUrl = getBackendUrl();
  const token = localStorage.getItem('streamtv_token') || '';
  return `${backendUrl}/api_stream/live/${streamId}.m3u8?token=${token}`;
};

/**
 * VOD (Movies) API Calls
 */
export const getVodCategories = async () => {
  return await fetchJson('get_vod_categories');
};

export const getVodStreams = async (categoryId = null) => {
  const extra = categoryId ? `&category_id=${categoryId}` : '';
  return await fetchJson('get_vod_streams', extra);
};

export const getAllVodStreams = async (categories = []) => {
  if (streamCache.vod) return streamCache.vod;

  try {
    const direct = await getVodStreams();
    if (Array.isArray(direct) && direct.length > 0) {
      streamCache.vod = direct;
      return direct;
    }
  } catch (err) {
    // Fallback to batched category fetch
  }

  if (categories && categories.length > 0) {
    const batched = await batchFetchCategoryStreams(categories, getVodStreams);
    if (batched.length > 0) streamCache.vod = batched;
    return batched;
  }

  return [];
};

export const getVodInfo = async (vodId) => {
  return await fetchJson('get_vod_info', `&vod_id=${vodId}`);
};

export const getMovieStreamUrl = (streamId, containerExtension = 'mp4') => {
  const ext = containerExtension ? containerExtension.replace(/^\./, '') : 'mp4';
  const backendUrl = getBackendUrl();
  const token = localStorage.getItem('streamtv_token') || '';
  return `${backendUrl}/api_stream/movie/${streamId}.${ext}?token=${token}`;
};

/**
 * Series API Calls
 */
export const getSeriesCategories = async () => {
  return await fetchJson('get_series_categories');
};

export const getSeriesList = async (categoryId = null) => {
  const extra = categoryId ? `&category_id=${categoryId}` : '';
  return await fetchJson('get_series', extra);
};

export const getAllSeriesList = async (categories = []) => {
  if (streamCache.series) return streamCache.series;

  try {
    const direct = await getSeriesList();
    if (Array.isArray(direct) && direct.length > 0) {
      streamCache.series = direct;
      return direct;
    }
  } catch (err) {
    // Fallback to batched category fetch
  }

  if (categories && categories.length > 0) {
    const batched = await batchFetchCategoryStreams(categories, getSeriesList);
    if (batched.length > 0) streamCache.series = batched;
    return batched;
  }

  return [];
};

export const getSeriesInfo = async (seriesId) => {
  return await fetchJson('get_series_info', `&series_id=${seriesId}`);
};

export const getEpisodeStreamUrl = (streamId, containerExtension = 'mp4') => {
  const ext = containerExtension ? containerExtension.replace(/^\./, '') : 'mp4';
  const backendUrl = getBackendUrl();
  const token = localStorage.getItem('streamtv_token') || '';
  return `${backendUrl}/api_stream/series/${streamId}.${ext}?token=${token}`;
};
