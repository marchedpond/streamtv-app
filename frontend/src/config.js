export const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  if (typeof window !== 'undefined' && (window.location.port === '3000' || window.location.port === '5173')) {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';
};
