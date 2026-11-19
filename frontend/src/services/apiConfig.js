/**
 * @module apiConfig
 * Centralized API configuration and URL builder for CollabLoop frontend.
 */

function resolveApiBase() {
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

  // 1. Explicit base URL with /api path included (e.g. https://collabloop-zov6.onrender.com/api or /api)
  const envBase = env.VITE_API_BASE_URL;
  if (envBase) {
    return envBase.replace(/\/+$/, '');
  }

  // 2. Base backend URL (e.g. https://collabloop-zov6.onrender.com or http://localhost:5000)
  const envUrl = env.VITE_API_URL || env.VITE_BACKEND_URL;
  if (envUrl) {
    const cleanUrl = envUrl.replace(/\/+$/, '');
    return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
  }

  // 3. Default to relative '/api'
  // In development: Vite dev proxy routes '/api' to local backend (http://localhost:5000)
  // In production (Vercel): vercel.json rewrites '/api/:path*' to deployed Render backend
  // Same-origin relative URLs prevent third-party cookie blocking in Brave, Safari, and Chrome.
  return '/api';
}

export const API_BASE = resolveApiBase();

const TOKEN_STORAGE_KEY = 'collabloop_token';

/**
 * Retrieves the stored JWT authentication token from localStorage.
 * @returns {string} The auth token, or empty string if not found.
 */
export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Stores the JWT authentication token into localStorage.
 * @param {string} token
 */
export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota or security errors in sandboxed contexts
  }
}

/**
 * Removes the stored JWT authentication token from localStorage.
 */
export function clearAuthToken() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Injects Authorization header with Bearer token if available.
 * @param {Record<string, string>} [customHeaders={}]
 * @returns {Record<string, string>}
 */
export function getAuthHeaders(customHeaders = {}) {
  const headers = { ...customHeaders };
  const token = getAuthToken();
  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

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

/**
 * Enhanced fetch wrapper that ensures credentials and auth headers are automatically included.
 * @param {string} path - API endpoint path
 * @param {RequestInit} [options={}] - Fetch options
 * @returns {Promise<Response>}
 */
export async function apiFetch(path, options = {}) {
  const url = buildApiUrl(path);
  const { headers: customHeaders, ...restOptions } = options;
  const isFormData = typeof FormData !== 'undefined' && restOptions.body instanceof FormData;
  const baseHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };
  const headers = getAuthHeaders({
    ...baseHeaders,
    ...(customHeaders || {}),
  });

  return fetch(url, {
    credentials: 'include',
    ...restOptions,
    headers,
  });
}

export default {
  API_BASE,
  buildApiUrl,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  getAuthHeaders,
  apiFetch,
};
