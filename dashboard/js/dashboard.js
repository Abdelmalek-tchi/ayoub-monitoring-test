// ── State ────────────────────────────────────────────────
let refreshInterval = null;
let refreshRate = 30000;
let revenueChart = null;
let chairChart = null;

let allTransactions = [];
let allCustomers = [];
let allProducts = [];

let transSortKey = 'timestamp';
let transSortDir = -1;
let custSortKey = 'spent';
let custSortDir = -1;
let prodSortKey = 'name';
let prodSortDir = 1;

// ── Utilities ────────────────────────────────────────────
function fmt(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('ar-DZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' د.ج';
}

function fd(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) {
    if (typeof d === 'string' && d.length >= 10) return d.substring(0, 10);
    return d;
  }
  return date.toLocaleDateString('ar-DZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── UI helpers ───────────────────────────────────────────
function showError(msg) {
  document.getElementById('errorState').style.display = 'block';
  document.getElementById('errorMessage').textContent = msg;
  document.querySelector('.dashboard-content').style.display = 'none';
  document.getElementById('loadingState').style.display = 'none';
}

function showLoading() {
  document.getElementById('loadingState').style.display = 'flex';
  document.querySelector('.dashboard-content').style.display = 'none';
  document.getElementById('errorState').style.display = 'none';
}

function showContent() {
  document.querySelector('.dashboard-content').style.display = 'block';
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'none';
}

function updateConnectionBadge(latency) {
  const badge = document.getElementById('connectionBadge');
  badge.querySelector('.dot').className = 'dot online';
  badge.querySelector('.conn-text').textContent = latency !== undefined ? `${latency}ms` : 'متصل';
  badge.querySelector('.conn-label').textContent = 'متصل';
}

function setConnectionOffline() {
  const badge = document.getElementById('connectionBadge');
  badge.querySelector('.dot').className = 'dot offline';
  badge.querySelector('.conn-text').textContent = 'غير متصل';
  badge.querySelector('.conn-label').textContent = 'معطل';
}

function updateLastSync() {
  document.getElementById('lastSync').textContent = `آخر تحديث: ${new Date().toLocaleTimeString('ar-DZ')}`;
}

// ── Stats Cards ──────────────────────────────────────────
function renderStatCards(data) {
  const avg = data.totals.transactions > 0 ? (data.totals.revenue / data.totals.transactions) : 0;
  document.getElementById('avgTransaction').textContent = `معدل المعاملة: ${fmt(avg)}`;

  const cards = [
    { label: 'إيرادات اليوم', value: fmt(data.daily.revenue), icon: 'fa-money-bill-wave' },
    { label: 'معاملات اليوم', value: data.daily.transactions, icon: 'fa-receipt' },
    { label: 'مواعيد اليوم', value: data.daily.appointments, icon: 'fa-calendar-check' },
    { label: 'إجمالي الزبائن', value: data.totals.customers, icon: 'fa-users' },
    { label: 'المنتجات', value: data.totals.products, icon: 'fa-box' },
    { label: 'إنذار المخزون', value: data.totals.low_stock, icon: 'fa-exclamation-triangle', cls: data.totals.low_stock > 0 ? 'negative' : '' },
    { label: 'إيرادات الشهر', value: fmt(data.monthly.revenue), icon: 'fa-calendar-alt' },
    { label: 'أرباح الشهر', value: fmt(data.monthly.profit), icon: 'fa-chart-line', cls: 'positive' },
  ];
  document.getElementById('statsGrid').innerHTML = cards.map(c => `
    <div class="glass stat-card">
      <div class="stat-label"><i class="fas ${c.icon}"></i> ${c.label}</div>
      <div class="stat-value ${c.cls || ''}">${c.value}</div>
    </div>
  `).join('');
}

// ── Charts ───────────────────────────────────────────────
async function renderCharts(days) {
  const stats = await API.getStatistics(days);
  renderRevenueChart(stats, days);
  renderChairChart(stats);
  renderPerChairBreakdown(stats);
}

function renderRevenueChart(stats, days) {
  const ctx = document.getElementById('revenueChart').getContext('2d');
  if (revenueChart) revenueChart.destroy();

  const revenue = stats.revenue_7days || [];
  const labels = revenue.map(r => r.date ? r.date.substring(5) : '');
  const values = revenue.map(r => Number(r.revenue) || 0);
  const counts = revenue.map(r => Number(r.transactions) || 0);

  revenueChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'الإيرادات (د.ج)',
          data: values,
          backgroundColor: 'rgba(108, 99, 255, 0.6)',
          borderColor: 'rgba(108, 99, 255, 1)',
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'y',
        },
        {
          label: 'المعاملات',
          data: counts,
          type: 'line',
          borderColor: 'rgba(76, 175, 80, 1)',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          pointBackgroundColor: 'rgba(76, 175, 80, 1)',
          pointRadius: 3,
          tension: 0.3,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#a0a0b0', font: { size: 11 } } },
      },
      scales: {
        x: { ticks: { color: '#6b6b80', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { beginAtZero: true, ticks: { color: '#6b6b80', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y1: { beginAtZero: true, position: 'right', ticks: { color: '#6b6b80', font: { size: 10 } }, grid: { display: false } },
      },
    },
  });
}

function renderChairChart(stats) {
  const ctx = document.getElementById('chairChart').getContext('2d');
  if (chairChart) chairChart.destroy();

  const chairs = stats.per_chair || [];
  const labels = chairs.map(c => c.name || c.worker || '');
  const values = chairs.map(c => Number(c.revenue || c.amount || 0));

  chairChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['لا توجد بيانات'],
      datasets: [{
        data: labels.length ? values : [1],
        backgroundColor: ['rgba(108, 99, 255, 0.7)','rgba(255, 152, 0, 0.7)','rgba(76, 175, 80, 0.7)','rgba(33, 150, 243, 0.7)','rgba(244, 67, 54, 0.7)','rgba(156, 39, 176, 0.7)','rgba(0, 188, 212, 0.7)'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#a0a0b0', font: { size: 10 }, padding: 8 } },
      },
    },
  });
}

function renderPerChairBreakdown(stats) {
  const chairs = stats.per_chair || [];
  const max = Math.max(...chairs.map(c => Number(c.revenue || c.amount || 0)), 1);
  document.getElementById('perChairBreakdown').innerHTML = chairs.map(c => {
    const val = Number(c.revenue || c.amount || 0);
    const pct = (val / max * 100).toFixed(1);
    return `<div class="per-chair-item"><span class="chair-name">${c.name || c.worker || ''}</span><div class="chair-bar"><div class="fill" style="width:${pct}%"></div></div><span class="chair-value">${fmt(val)}</span></div>`;
  }).join('');
}

// ── Tab System ───────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.getElementById(`tab-${name}`).style.display = 'block';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
}

// ── Transactions Tab ─────────────────────────────────────
function populateWorkerFilter() {
  const sel = document.getElementById('transWorkerFilter');
  const current = sel.value;
  const workers = [...new Set(allTransactions.map(t => t.worker).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">كل الكراسي</option>' + workers.map(w => `<option value="${w}">${w}</option>`).join('');
  sel.value = current;
}

function getFilteredTransactions() {
  const query = (document.getElementById('transSearch').value || '').toLowerCase();
  const worker = document.getElementById('transWorkerFilter').value;
  const period = document.getElementById('transFilter').value;
  const minAmt = parseFloat(document.getElementById('transMinAmount').value) || 0;
  const maxAmt = parseFloat(document.getElementById('transMaxAmount').value) || 0;
  const today = new Date().toISOString().substring(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().substring(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().substring(0, 10);

  return allTransactions.filter(t => {
    if (query && !(t.customer || '').toLowerCase().includes(query) && !(t.worker || '').toLowerCase().includes(query) && !String(t.id).includes(query)) return false;
    if (worker && t.worker !== worker) return false;
    if (period === 'today' && !(t.timestamp || '').startsWith(today)) return false;
    if (period === 'week' && (t.timestamp || '') < weekAgo) return false;
    if (period === 'month' && (t.timestamp || '') < monthAgo) return false;
    const amt = Number(t.amount) || 0;
    if (minAmt > 0 && amt < minAmt) return false;
    if (maxAmt > 0 && amt > maxAmt) return false;
    return true;
  });
}

function renderTransactions() {
  populateWorkerFilter();
  applyTransSort();
}

function applyTransSort() {
  const filtered = getFilteredTransactions();
  filtered.sort((a, b) => {
    let va = a[transSortKey] || '';
    let vb = b[transSortKey] || '';
    if (['amount', 'discount'].includes(transSortKey)) { va = Number(va); vb = Number(vb); }
    if (typeof va === 'string') return transSortDir * vb.localeCompare(va);
    return transSortDir * (vb - va);
  });

  const total = filtered.length;
  const totalAmt = filtered.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  document.getElementById('totalTransactions').textContent = `المجموع: ${fmt(totalAmt)} (${total} معاملة)`;

  const pageSize = parseInt(document.getElementById('transPageSize').value) || 15;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  let page = currentTransPage;
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  currentTransPage = page;

  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  document.getElementById('transactionsBody').innerHTML = pageItems.map(t => `
    <tr>
      <td>#${t.id}</td>
      <td>${t.customer || '—'}</td>
      <td>${t.worker || '—'}</td>
      <td>${fmt(t.amount)}</td>
      <td>${t.discount ? fmt(t.discount) : '—'}</td>
      <td>${fd(t.timestamp)}</td>
    </tr>
  `).join('');

  document.getElementById('transRangeInfo').textContent = total > 0 ? `عرض ${start + 1}-${Math.min(start + pageSize, total)} من ${total}` : '';
  renderPagination('transPagination', page, totalPages, p => { currentTransPage = p; applyTransSort(); });
}

let currentTransPage = 1;
let currentCustPage = 1;
let currentProdPage = 1;

// ── Customers Tab ────────────────────────────────────────
function getFilteredCustomers() {
  const query = (document.getElementById('custSearch').value || '').toLowerCase();
  const minVisits = parseInt(document.getElementById('custMinVisits').value) || 0;
  return allCustomers.filter(c => {
    if (query && !(c.name || '').toLowerCase().includes(query) && !(c.phone || '').includes(query)) return false;
    if (minVisits > 0 && (c.visits || 0) < minVisits) return false;
    return true;
  });
}

function renderCustomers() {
  applyCustSort();
}

function applyCustSort() {
  const filtered = getFilteredCustomers();
  filtered.sort((a, b) => {
    let va = a[custSortKey] || '';
    let vb = b[custSortKey] || '';
    if (['spent', 'visits'].includes(custSortKey)) { va = Number(va); vb = Number(vb); }
    if (typeof va === 'string') return custSortDir * vb.localeCompare(va);
    return custSortDir * (vb - va);
  });

  const total = filtered.length;
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  let page = currentCustPage;
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  currentCustPage = page;

  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  document.getElementById('customersBody').innerHTML = pageItems.map(c => `
    <tr>
      <td>${c.name}</td>
      <td>${c.phone || '—'}</td>
      <td>${c.visits || 0}</td>
      <td class="positive">${fmt(c.spent)}</td>
      <td>${c.last_visit ? fd(c.last_visit) : '—'}</td>
    </tr>
  `).join('');

  document.getElementById('custRangeInfo').textContent = total > 0 ? `عرض ${start + 1}-${Math.min(start + pageSize, total)} من ${total}` : '';
  renderPagination('custPagination', page, totalPages, p => { currentCustPage = p; applyCustSort(); });
  renderTopCustomersBar(filtered.slice(0, 10));
}

function renderTopCustomersBar(top) {
  const max = Math.max(...top.map(c => Number(c.spent) || 0), 1);
  document.getElementById('topCustomersChart').innerHTML = top.map(c => {
    const pct = ((Number(c.spent) || 0) / max * 100).toFixed(1);
    return `<div class="per-chair-item"><span class="chair-name" style="width:100px;">${c.name}</span><div class="chair-bar"><div class="fill" style="width:${pct}%;background:#ff9800;"></div></div><span class="chair-value">${fmt(c.spent)}</span></div>`;
  }).join('');
}

// ── Products Tab ─────────────────────────────────────────
function getFilteredProducts() {
  const query = (document.getElementById('prodSearch').value || '').toLowerCase();
  const stockFilter = document.getElementById('prodStockFilter').value;
  return allProducts.filter(p => {
    if (query && !(p.name || '').toLowerCase().includes(query)) return false;
    const qty = Number(p.quantity) || 0;
    if (stockFilter === 'low' && qty > 5) return false;
    if (stockFilter === 'instock' && qty <= 0) return false;
    if (stockFilter === 'out' && qty > 0) return false;
    return true;
  });
}

function renderProducts() {
  applyProdSort();
}

function applyProdSort() {
  const filtered = getFilteredProducts();
  filtered.sort((a, b) => {
    let va = a[prodSortKey] || '';
    let vb = b[prodSortKey] || '';
    if (['quantity', 'buy_price', 'sell_price'].includes(prodSortKey)) { va = Number(va); vb = Number(vb); }
    if (typeof va === 'string') return prodSortDir * vb.localeCompare(va);
    return prodSortDir * (vb - va);
  });

  const total = filtered.length;
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  let page = currentProdPage;
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  currentProdPage = page;

  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  document.getElementById('productsBody').innerHTML = pageItems.map(p => {
    const qty = Number(p.quantity) || 0;
    const profit = (Number(p.sell_price) || 0) - (Number(p.buy_price) || 0);
    const stockClass = qty <= 0 ? 'negative' : qty <= 5 ? 'warning' : '';
    return `<tr>
      <td>${p.name}</td>
      <td class="${stockClass}">${qty <= 0 ? 'نافد' : qty}</td>
      <td>${fmt(p.buy_price)}</td>
      <td>${fmt(p.sell_price)}</td>
      <td class="positive">${fmt(profit)}</td>
      <td>${p.category || '—'}</td>
      <td>${p.supplier || '—'}</td>
    </tr>`;
  }).join('');

  document.getElementById('prodRangeInfo').textContent = total > 0 ? `عرض ${start + 1}-${Math.min(start + pageSize, total)} من ${total}` : '';
  renderPagination('prodPagination', page, totalPages, p => { currentProdPage = p; applyProdSort(); });
}

// ── Pagination ───────────────────────────────────────────
function renderPagination(containerId, current, total, onClick) {
  const container = document.getElementById(containerId);
  if (total <= 1) { container.innerHTML = ''; return; }
  let html = `<button class="page-btn" ${current <= 1 ? 'disabled' : ''} data-p="${current - 1}">‹</button>`;
  const s = Math.max(1, Math.min(current - 2, total - 4));
  const e = Math.min(total, Math.max(current + 2, 5));
  for (let i = s; i <= e; i++) {
    html += `<button class="page-btn ${i === current ? 'active' : ''}" data-p="${i}">${i}</button>`;
  }
  html += `<button class="page-btn" ${current >= total ? 'disabled' : ''} data-p="${current + 1}">›</button>`;
  container.innerHTML = html;
  container.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.p);
      if (p >= 1 && p <= total) onClick(p);
    });
  });
}

// ── Export CSV ───────────────────────────────────────────
function exportCSV(rows, filename, cols) {
  const header = cols.map(c => c.label).join(',');
  const data = rows.map(r => cols.map(c => {
    let v = c.accessor(r);
    if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + header + '\n' + data], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportTransactions() {
  const rows = getFilteredTransactions();
  exportCSV(rows, 'transactions.csv', [
    { label: '#', accessor: r => r.id },
    { label: 'الزبون', accessor: r => r.customer || '' },
    { label: 'الكرسي', accessor: r => r.worker || '' },
    { label: 'المبلغ', accessor: r => r.amount },
    { label: 'الخصم', accessor: r => r.discount || 0 },
    { label: 'التاريخ', accessor: r => r.timestamp || '' },
  ]);
}

function exportCustomers() {
  const rows = getFilteredCustomers();
  exportCSV(rows, 'customers.csv', [
    { label: 'الاسم', accessor: r => r.name },
    { label: 'الهاتف', accessor: r => r.phone || '' },
    { label: 'الزيارات', accessor: r => r.visits || 0 },
    { label: 'الإنفاق', accessor: r => r.spent },
    { label: 'آخر زيارة', accessor: r => r.last_visit || '' },
  ]);
}

function exportProducts() {
  const rows = getFilteredProducts();
  exportCSV(rows, 'products.csv', [
    { label: 'الاسم', accessor: r => r.name },
    { label: 'الكمية', accessor: r => r.quantity || 0 },
    { label: 'سعر الشراء', accessor: r => r.buy_price || 0 },
    { label: 'سعر البيع', accessor: r => r.sell_price || 0 },
    { label: 'الفئة', accessor: r => r.category || '' },
    { label: 'المورد', accessor: r => r.supplier || '' },
  ]);
}

// ── Main Load ────────────────────────────────────────────
async function loadDashboard() {
  try {
    showLoading();
    const [dashboard, customers, products, transactions] = await Promise.all([
      API.getDashboard(),
      API.getCustomers(),
      API.getProducts(),
      API.getTransactions(),
    ]);

    allTransactions = transactions.transactions || [];
    allCustomers = customers.customers || [];
    allProducts = products.products || [];

    updateConnectionBadge(0);
    updateLastSync();
    renderStatCards(dashboard);

    const days = parseInt(document.getElementById('chartRange').value) || 7;
    const stats = await API.getStatistics(days);
    renderRevenueChart(stats, days);
    renderChairChart(stats);
    renderPerChairBreakdown(stats);

    renderTransactions();
    renderCustomers();
    renderProducts();
    showContent();
  } catch (err) {
    if (err.name === 'AbortError') return;
    setConnectionOffline();
    showError(err.message || 'فشل الاتصال بالخادم');
  }
}

// ── Auto Refresh ─────────────────────────────────────────
function startAutoRefresh(rate) {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshRate = rate;
  if (rate > 0) refreshInterval = setInterval(loadDashboard, rate);
}

// ── Init ─────────────────────────────────────────────────
function setupEventListeners() {
  document.getElementById('refreshBtn').addEventListener('click', loadDashboard);

  document.getElementById('refreshRate').addEventListener('change', e => {
    const rate = Number(e.target.value);
    localStorage.setItem('barberpro_refresh_rate', String(rate));
    startAutoRefresh(rate);
  });

  document.getElementById('disconnectBtn').addEventListener('click', () => ConnectionManager.disconnect());

  document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const cur = html.getAttribute('data-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    document.getElementById('themeToggle').innerHTML = next === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    localStorage.setItem('barberpro_theme', next);
  });

  document.getElementById('retryBtn').addEventListener('click', loadDashboard);

  // Chart range
  document.getElementById('chartRange').addEventListener('change', async e => {
    const days = parseInt(e.target.value);
    const stats = await API.getStatistics(days);
    renderRevenueChart(stats, days);
    renderChairChart(stats);
    renderPerChairBreakdown(stats);
  });

  // Tabs
  document.getElementById('tabBar').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (btn) switchTab(btn.dataset.tab);
  });

  // Transactions filters
  ['transSearch', 'transWorkerFilter', 'transFilter', 'transMinAmount', 'transMaxAmount'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => { currentTransPage = 1; applyTransSort(); });
    const el = document.getElementById(id);
    if (el.tagName === 'SELECT') el.addEventListener('change', () => { currentTransPage = 1; applyTransSort(); });
  });
  document.getElementById('transPageSize').addEventListener('change', () => { currentTransPage = 1; applyTransSort(); });

  // Customer filters
  document.getElementById('custSearch').addEventListener('input', () => { currentCustPage = 1; applyCustSort(); });
  document.getElementById('custMinVisits').addEventListener('change', () => { currentCustPage = 1; applyCustSort(); });

  // Product filters
  document.getElementById('prodSearch').addEventListener('input', () => { currentProdPage = 1; applyProdSort(); });
  document.getElementById('prodStockFilter').addEventListener('change', () => { currentProdPage = 1; applyProdSort(); });

  // Sortable columns
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const table = th.closest('.table-card');
      if (!table) return;
      const tabId = table.closest('.tab-content');
      if (!tabId) return;
      const key = th.dataset.sort;

      if (tabId.id === 'tab-transactions') {
        if (transSortKey === key) transSortDir *= -1; else { transSortKey = key; transSortDir = -1; }
        updateSortIcons(th, transSortDir);
        applyTransSort();
      } else if (tabId.id === 'tab-customers') {
        if (custSortKey === key) custSortDir *= -1; else { custSortKey = key; custSortDir = -1; }
        updateSortIcons(th, custSortDir);
        applyCustSort();
      } else if (tabId.id === 'tab-products') {
        if (prodSortKey === key) prodSortDir *= -1; else { prodSortKey = key; prodSortDir = 1; }
        updateSortIcons(th, prodSortDir);
        applyProdSort();
      }
    });
  });

  // Export buttons
  document.getElementById('exportTransBtn').addEventListener('click', exportTransactions);
  document.getElementById('exportCustBtn').addEventListener('click', exportCustomers);
  document.getElementById('exportProdBtn').addEventListener('click', exportProducts);
}

function updateSortIcons(th, dir) {
  th.closest('tr').querySelectorAll('.sortable i').forEach(i => { i.className = 'fas fa-sort'; });
  const icon = th.querySelector('i');
  if (icon) icon.className = dir === -1 ? 'fas fa-sort-down' : 'fas fa-sort-up';
}

async function initDashboard() {
  const saved = ConnectionManager.load();
  const originUrl = ConnectionManager.isSameOrigin() ? ConnectionManager.getOriginUrl() : null;

  if (originUrl) {
    document.getElementById('serverUrl').textContent = originUrl.replace(/^https?:\/\//, '');
  } else if (saved && saved.url) {
    document.getElementById('serverUrl').textContent = saved.url.replace(/^https?:\/\//, '');
  } else {
    window.location.href = 'index.html';
    return;
  }

  const savedTheme = localStorage.getItem('barberpro_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('themeToggle').innerHTML = savedTheme === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
  }

  setupEventListeners();
  await loadDashboard();
  const savedRate = localStorage.getItem('barberpro_refresh_rate');
  const rate = savedRate ? Number(savedRate) : 30000;
  document.getElementById('refreshRate').value = String(rate);
  startAutoRefresh(rate);
}

document.addEventListener('DOMContentLoaded', initDashboard);
