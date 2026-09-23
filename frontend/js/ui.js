/**
 * Shared UI helpers used across every authenticated page: toast
 * notifications, small formatting utilities, and the sidebar shell.
 */
const UI = (() => {
  function ensureToastStack() {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }

  function toast(message, type = 'success', duration = 4000) {
    const stack = ensureToastStack();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  function formatDate(date, opts = { month: 'short', day: 'numeric' }) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(undefined, opts);
  }

  function formatDateLong(date) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function formatTime(date) {
    if (!date) return '—';
    return new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function formatCurrency(amount) {
    const n = Number(amount) || 0;
    return `₹${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  function formatMl(ml) {
    const n = Number(ml) || 0;
    if (n >= 1000) return `${(n / 1000).toFixed(2).replace(/\.00$/, '')} L`;
    return `${n} ml`;
  }

  function formatMinutes(mins) {
    const m = Math.max(0, Math.round(Number(mins) || 0));
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return `${h}h ${rem}m`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function openModal(id) {
    document.getElementById(id).classList.add('open');
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove('open');
  }

  const NAV_ITEMS = [
    { href: 'dashboard.html', icon: '▣', label: 'Dashboard' },
    { href: 'habits.html', icon: '✓', label: 'Habits' },
    { href: 'water.html', icon: '◎', label: 'Water' },
    { href: 'sleep.html', icon: '☾', label: 'Sleep' },
    { href: 'expenses.html', icon: '₹', label: 'Expenses' },
    { href: 'reminders.html', icon: '⏰', label: 'Reminders' },
    { href: 'analytics.html', icon: '▤', label: 'Analytics' },
  ];

  /**
   * Renders the sidebar shell into #sidebar-root, highlighting the link
   * matching the current page's filename.
   */
  function renderSidebar() {
    const root = document.getElementById('sidebar-root');
    if (!root) return;

    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const user = API.getUser();

    const navHtml = NAV_ITEMS.map(
      (item) => `
        <a class="nav-link ${item.href === currentPage ? 'active' : ''}" href="${item.href}">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-text">${item.label}</span>
        </a>`
    ).join('');

    root.innerHTML = `
      <div class="wordmark">HabitSync</div>
      <nav>${navHtml}</nav>
      <div class="sidebar-footer">
        <span class="user-name">${escapeHtml(user ? user.name : '')}</span>
        <button class="btn-ghost" id="logout-btn" style="padding-left:0;">Log out</button>
      </div>
    `;

    document.getElementById('logout-btn').addEventListener('click', async () => {
      try {
        await API.post('/auth/logout');
      } catch {
        // ignore - logging out locally regardless of server response
      }
      API.clearSession();
      window.location.href = 'index.html';
    });
  }

  return {
    toast,
    formatDate,
    formatDateLong,
    formatTime,
    formatCurrency,
    formatMl,
    formatMinutes,
    escapeHtml,
    openModal,
    closeModal,
    renderSidebar,
  };
})();
