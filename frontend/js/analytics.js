(function initAnalyticsPage() {
  API.requireAuth();
  UI.renderSidebar();
  document.getElementById('today-date').textContent = UI.formatDateLong(new Date());

  const charts = {};

  function destroyIfExists(key) {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  }

  document.getElementById('range-select').addEventListener('change', loadAll);

  function currentDays() {
    return Number(document.getElementById('range-select').value);
  }

  async function loadInsights() {
    try {
      const res = await API.get('/analytics/insights');
      const insights = res.data.insights;
      const panel = document.getElementById('insights-panel');
      if (insights.length > 0) {
        panel.style.display = 'block';
        document.getElementById('insights-list').innerHTML = insights.map((i) => `<li>${UI.escapeHtml(i)}</li>`).join('');
      } else {
        panel.style.display = 'none';
      }
    } catch {
      // Non-critical
    }
  }

  async function loadHabitAnalytics() {
    try {
      const res = await API.get('/analytics/habits', { days: currentDays() });
      const { overallCompletionPercentage, perHabit, dailyCounts, days } = res.data;

      document.getElementById('habit-overall-pct').textContent = `${overallCompletionPercentage}%`;

      const listEl = document.getElementById('habit-per-list');
      if (!perHabit.length) {
        listEl.innerHTML = '<p class="text-muted">No active habits yet.</p>';
      } else {
        listEl.innerHTML = perHabit
          .map(
            (h) => `
            <div class="list-row">
              <span>${UI.escapeHtml(h.name)}</span>
              <span class="badge">${h.completionPercentage}%</span>
            </div>`
          )
          .join('');
      }

      // Build a full date range for the daily chart so empty days show as 0
      const labels = [];
      const values = [];
      const cursor = new Date();
      cursor.setUTCHours(0, 0, 0, 0);
      cursor.setUTCDate(cursor.getUTCDate() - (days - 1));
      for (let i = 0; i < days; i++) {
        const key = cursor.toISOString().slice(0, 10);
        labels.push(UI.formatDate(key));
        values.push(dailyCounts[key] || 0);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      destroyIfExists('habitsDaily');
      const ctx = document.getElementById('habits-daily-chart').getContext('2d');
      charts.habitsDaily = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Habits completed', data: values, backgroundColor: '#3F6F5E', borderRadius: 4 }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#DDE3DC' } }, x: { grid: { display: false } } },
        },
      });
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  async function loadWaterAnalytics() {
    try {
      const res = await API.get('/analytics/water', { days: currentDays() });
      const { dailyTotals, weeklyAverage, goal, goalMetDays } = res.data;

      document.getElementById('water-analytics-sub').textContent =
        `Average ${UI.formatMl(weeklyAverage)}/day · goal met ${goalMetDays}/${dailyTotals.length} days`;

      destroyIfExists('water');
      const ctx = document.getElementById('water-analytics-chart').getContext('2d');
      charts.water = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: dailyTotals.map((d) => UI.formatDate(d.date)),
          datasets: [
            { label: 'Water (ml)', data: dailyTotals.map((d) => d.total), backgroundColor: '#2E7DA6', borderRadius: 4 },
            {
              label: 'Goal',
              data: dailyTotals.map(() => goal),
              type: 'line',
              borderColor: '#C9832B',
              borderDash: [5, 5],
              pointRadius: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, grid: { color: '#DDE3DC' } }, x: { grid: { display: false } } },
        },
      });
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  async function loadSleepAnalytics() {
    try {
      const res = await API.get('/analytics/sleep', { days: currentDays() });
      const { byDay, averageDurationFormatted, consistencyLabel } = res.data;

      document.getElementById('sleep-analytics-sub').textContent = `Average ${averageDurationFormatted} · ${consistencyLabel}`;

      destroyIfExists('sleep');
      const ctx = document.getElementById('sleep-analytics-chart').getContext('2d');
      charts.sleep = new Chart(ctx, {
        type: 'line',
        data: {
          labels: byDay.map((d) => UI.formatDate(d.date)),
          datasets: [
            {
              label: 'Sleep (hours)',
              data: byDay.map((d) => Math.round((d.durationMinutes / 60) * 10) / 10),
              borderColor: '#4A5A9E',
              backgroundColor: 'rgba(74, 90, 158, 0.15)',
              fill: true,
              tension: 0.3,
              pointRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, grid: { color: '#DDE3DC' } }, x: { grid: { display: false } } },
        },
      });
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  async function loadExpenseAnalytics() {
    try {
      const res = await API.get('/analytics/expenses', { days: currentDays() });
      const { categoryTotals, monthTotal, budgetUtilization } = res.data;

      document.getElementById('expense-analytics-sub').textContent =
        `This month: ${UI.formatCurrency(monthTotal)}` + (budgetUtilization !== null ? ` · ${budgetUtilization}% of budget` : '');

      const labels = Object.keys(categoryTotals);
      const values = Object.values(categoryTotals);
      const colors = { Food: '#3F6F5E', Travel: '#2E7DA6', 'Shopping/Materials': '#C9832B', Education: '#4A5A9E', Entertainment: '#B45048', Other: '#8A8F87' };

      destroyIfExists('expense');
      const ctx = document.getElementById('expense-analytics-chart').getContext('2d');
      const parent = ctx.canvas.parentElement;

      if (!labels.length) {
        parent.innerHTML = '<p class="text-muted">No expenses recorded in this period.</p>';
        return;
      }

      charts.expense = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: labels.map((l) => colors[l] || '#8A8F87') }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } },
        },
      });
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  function loadAll() {
    loadHabitAnalytics();
    loadWaterAnalytics();
    loadSleepAnalytics();
    loadExpenseAnalytics();
  }

  loadAll();
  loadInsights();
})();
