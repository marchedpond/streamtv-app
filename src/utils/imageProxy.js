/**
 * Image Proxy utility using images.weserv.nl
 * Resizes covers to ~300px width and converts to compressed WebP for Nintendo Switch & mobile
 */
export function getOptimizedImageUrl(originalUrl, width = 300) {
  if (!originalUrl) return '';

  const cleanUrl = originalUrl.trim();
  if (!cleanUrl || cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:')) {
    return cleanUrl;
  }

  // Prevent double proxying
  if (cleanUrl.includes('images.weserv.nl')) {
    return cleanUrl;
  }

  try {
    // Strip protocol if needed or encode full URL
    const targetUrl = cleanUrl.replace(/^https?:\/\//, '');
    return `https://images.weserv.nl/?url=${encodeURIComponent(targetUrl)}&w=${width}&output=webp&q=80`;
  } catch (err) {
    return cleanUrl;
  }
}

/**
 * Handle broken images gracefully with a placeholder
 */
export function handleImageError(e, fallbackText = '') {
  e.target.onerror = null; // Prevent infinite loop
  e.target.style.display = 'none';
  if (e.target.nextSibling) {
    e.target.nextSibling.style.display = 'flex';
  }
}
