/**
 * @module apiConfig
 * Centralized API configuration and URL builder for CollabLoop frontend.
 */

function resolveApiBase() {
  // 1. Explicit base URL with /api path included (e.g. https://collabloop-zov6.onrender.com/api)
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase) {
    return envBase.replace(/\/+$/, '');
  }

  // 2. Base backend URL (e.g. https://collabloop-zov6.onrender.com or http://localhost:5000)
  const envUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? import.meta.env.VITE_BACKEND_URL : null);
  if (envUrl) {
    const cleanUrl = envUrl.replace(/\/+$/, '');
    return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
  }

  // 3. In production, if no environment variable is provided, default directly to deployed Render backend
  if (import.meta.env.PROD) {
    return 'https://collabloop-zov6.onrender.com/api';
  }

  // 4. In development, use relative '/api' proxied by Vite to local Express server
  return '/api';
}

export const API_BASE = resolveApiBase();

/**
 * Builds a complete API URL from a given path, preventing duplicate or missing '/api' prefixes.
 *
 * @param {string} path - Endpoint path (e.g. '/auth/login', '/projects', or '/api/projects')
 * @returns {string} Fully resolved API URL
 */
export function buildApiUrl(path = '') {
  let cleanPath = String(path).trim();
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }
  // Strip redundant leading '/api' if caller provided it
  if (cleanPath.startsWith('/api/') || cleanPath === '/api') {
    cleanPath = cleanPath.slice(4);
  }
  return `${API_BASE}${cleanPath}`;
}

export default {
  API_BASE,
  buildApiUrl,
};
