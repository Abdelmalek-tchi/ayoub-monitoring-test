const ConnectionManager = {
  STORAGE_KEY: 'barberpro_connection',

  load() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || null;
    } catch {
      return null;
    }
  },

  save(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  clear() {
    localStorage.removeItem(this.STORAGE_KEY);
  },

  async connect(url) {
    const cleanUrl = url.replace(/\/+$/, '');
    API.setBaseUrl(cleanUrl);
    // The API object now uses absolute URLs internally,
    // so we just need to call status to verify
    const resp = await fetch(`${cleanUrl}/api/status`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!resp.ok) throw new Error('Server not reachable');
    const status = await resp.json();
    const now = new Date().toISOString();
    this.save({ url: cleanUrl, lastConnected: now, serverName: status.app_name || 'BarberPro' });
    return status;
  },

  disconnect() {
    this.clear();
    window.location.href = 'index.html';
  },

  isSameOrigin() {
    return window.location.protocol === 'http:' || window.location.protocol === 'https:';
  },

  getOriginUrl() {
    return window.location.origin;
  },
};
