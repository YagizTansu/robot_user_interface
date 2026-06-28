const trimTrailingSlash = (url: string) => url.replace(/\/$/, '');

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL
  ? trimTrailingSlash(import.meta.env.VITE_BACKEND_URL)
  : `http://${window.location.hostname}:3000`;
