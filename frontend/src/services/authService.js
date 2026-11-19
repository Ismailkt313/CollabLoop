import { buildApiUrl, getAuthHeaders, setAuthToken, clearAuthToken } from './apiConfig.js';

async function request(path, options = {}) {
  const url = buildApiUrl(path);
  const { headers: customHeaders, ...restOptions } = options;
  const isFormData = typeof FormData !== 'undefined' && restOptions.body instanceof FormData;
  const baseHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };
  const headers = getAuthHeaders({
    ...baseHeaders,
    ...(customHeaders || {}),
  });

  const response = await fetch(url, {
    credentials: 'include',
    ...restOptions,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  const data = isJson ? await response.json().catch(() => ({})) : {};

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  if (!isJson) {
    throw new Error('Received unexpected non-JSON response from API server');
  }

  return data;
}

export const authService = {
  getAuthenticatedMember: () => null,
  async current() {
    try {
      const data = await request('/auth/me');
      if (data?.token) {
        setAuthToken(data.token);
      }
      return data?.user || null;
    } catch {
      return null;
    }
  },
  async register(form) {
    const data = await request('/auth/register', { method: 'POST', body: JSON.stringify(form) });
    if (data?.token) {
      setAuthToken(data.token);
    }
    return data;
  },
  async login(form) {
    const data = await request('/auth/login', { method: 'POST', body: JSON.stringify(form) });
    if (data?.token) {
      setAuthToken(data.token);
    }
    return data;
  },
  async checkUsername(username, options = {}) {
    const data = await request(`/auth/username-availability?username=${encodeURIComponent(username)}`, options);
    return Boolean(data.available);
  },
  async requestPasswordReset(email) {
    return request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  },
  async resetPassword(form) {
    return request('/auth/reset-password', { method: 'POST', body: JSON.stringify(form) });
  },
  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      clearAuthToken();
    }
  },
  async updateProfile(data) {
    return request('/users/me', { method: 'PATCH', body: JSON.stringify(data) });
  },
};

export default authService;
