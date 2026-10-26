import api from './api';

export const authService = {
  async login(username, password) {
    const data = await api.post('/auth/login', { username, password });
    if (data.token) {
      localStorage.setItem('inventory_token', data.token);
      localStorage.setItem('inventory_user', JSON.stringify(data.user));
    }
    return data;
  },

  logout() {
    localStorage.removeItem('inventory_token');
    localStorage.removeItem('inventory_user');
  },

  getCurrentUser() {
    const raw = localStorage.getItem('inventory_user');
    return raw ? JSON.parse(raw) : null;
  },

  isAuthenticated() {
    return !!localStorage.getItem('inventory_token');
  },

  async verifyToken() {
    return api.get('/auth/me');
  }
};
