(async function initDashboard() {
  API.requireAuth();
  UI.renderSidebar();

  document.getElementById('today-date').textContent = UI.formatDateLong(new Date());

  document.getElementById('enable-notifications-btn').addEventListener('click', async () => {
    const permission = await NotificationsHelper.requestPermission();
    if (permission === 'granted') UI.toast('Notifications enabled');
    else if (permission === 'unsupported') UI.toast('Notifications are not supported in this browser', 'warning');
    else UI.toast('Notifications permission was not granted', 'warning');
  });

  document.getElementById('qa-water').addEventListener('click', async () => {
    try {
      await API.post('/water', { amount: 250 });
      UI.toast('+250 ml logged');
      loadDashboard();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  });

  function renderReminders(reminders) {
    const container = document.getElementById('reminders-list');
    if (!reminders.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏰</div><p>No upcoming reminders. Create one to stay on top of what's next.</p></div>`;
      return;
    }
    container.innerHTML = reminders
      .map(
        (r) => `
        <div class="list-row">
          <div>
            <div class="title">${UI.escapeHtml(r.title)}</div>
            <div class="meta">${UI.formatDate(r.date)} · ${r.time}</div>
          </div>
          <span class="badge coral">${r.repeatType === 'none' ? 'one-time' : r.repeatType}</span>
        </div>`
      )
      .join('');
  }

  async function loadDashboard() {
    try {
      const res = await API.get('/dashboard');
      const d = res.data;

      const habitsPct = d.habits.total > 0 ? Math.round((d.habits.completed / d.habits.total) * 100) : 0;
      document.getElementById('stat-habits').textContent = `${d.habits.completed} / ${d.habits.total}`;
      document.getElementById('stat-habits-bar').style.width = `${habitsPct}%`;

      const waterPct = d.water.goal > 0 ? Math.min(100, Math.round((d.water.current / d.water.goal) * 100)) : 0;
      document.getElementById('stat-water').textContent = `${UI.formatMl(d.water.current)} / ${UI.formatMl(d.water.goal)}`;
      document.getElementById('stat-water-bar').style.width = `${waterPct}%`;

      document.getElementById('stat-sleep').textContent = d.sleep.durationFormatted || 'Not logged';

      document.getElementById('stat-expenses').textContent = UI.formatCurrency(d.expenses.total);

      renderReminders(d.reminders.upcoming);

      NotificationsHelper.checkReminders(d.reminders.upcoming);
      NotificationsHelper.goalWarning(waterPct, 'water');
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  async function loadInsights() {
    try {
      const res = await API.get('/analytics/insights');
      const insights = res.data.insights;
      if (insights.length > 0) {
        document.getElementById('insights-panel').style.display = 'block';
        document.getElementById('insights-list').innerHTML = insights.map((i) => `<li>${UI.escapeHtml(i)}</li>`).join('');
      }
    } catch {
      // Insights are a nice-to-have; fail silently if they can't load.
    }
  }

  loadDashboard();
  loadInsights();
})();
