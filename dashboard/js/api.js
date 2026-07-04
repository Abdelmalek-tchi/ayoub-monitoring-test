const API = {
  async _fetch(endpoint) {
    const resp = await fetch(endpoint, {
      headers: { 'Accept': 'application/json' },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status}: ${text || respStatusText(resp.status)}`);
    }
    return resp.json();
  },

  async getStatus() {
    return this._fetch('/api/status');
  },
  async getDashboard() {
    return this._fetch('/api/dashboard');
  },
  async getCustomers() {
    return this._fetch('/api/customers');
  },
  async getProducts() {
    return this._fetch('/api/products');
  },
  async getTransactions() {
    return this._fetch('/api/transactions');
  },
  async getStatistics(days) {
    return this._fetch(`/api/statistics?days=${days || 7}`);
  },
};

function respStatusText(code) {
  const m = { 404: 'Not Found', 500: 'Server Error', 503: 'Unavailable' };
  return m[code] || '';
}
