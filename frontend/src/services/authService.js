import { buildApiUrl } from './apiConfig.js';

async function request(path, options = {}) {
  const url = buildApiUrl(path);
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
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
      return (await request('/auth/me')).user;
    } catch {
      return null;
    }
  },
  async register(form) {
    return request('/auth/register', { method: 'POST', body: JSON.stringify(form) });
  },
  async login(form) {
    return request('/auth/login', { method: 'POST', body: JSON.stringify(form) });
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
    await request('/auth/logout', { method: 'POST' });
  },
  async updateProfile(data) {
    return request('/users/me', { method: 'PATCH', body: JSON.stringify(data) });
  },
};

export default authService;
