(function initWaterPage() {
  API.requireAuth();
  UI.renderSidebar();
  document.getElementById('today-date').textContent = UI.formatDateLong(new Date());

  let chart = null;

  document.querySelectorAll('.quick-add').forEach((btn) => {
    btn.addEventListener('click', () => addWater(Number(btn.dataset.amount)));
  });

  document.getElementById('custom-add-btn').addEventListener('click', () => {
    document.getElementById('custom-water-form').reset();
    UI.openModal('custom-water-modal');
  });

  document.getElementById('custom-water-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById('custom-water-amount').value);
    UI.closeModal('custom-water-modal');
    await addWater(amount);
  });

  document.getElementById('edit-goal-btn').addEventListener('click', () => {
    document.getElementById('goal-amount').value = API.getUser()?.waterGoalMl || 3000;
    UI.openModal('goal-modal');
  });

  document.getElementById('goal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const goalMl = Number(document.getElementById('goal-amount').value);
    try {
      await API.put('/water/goal', { goalMl });
      const user = API.getUser();
      if (user) {
        user.waterGoalMl = goalMl;
        API.setSession(API.getToken(), user);
      }
      UI.toast('Water goal updated');
      UI.closeModal('goal-modal');
      loadToday();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  });

  async function addWater(amount) {
    if (!amount || amount <= 0) return;
    try {
      await API.post('/water', { amount });
      UI.toast(`+${amount} ml logged`);
      loadToday();
      loadHistory();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  async function deleteLog(id) {
    try {
      await API.del(`/water/${id}`);
      UI.toast('Entry removed');
      loadToday();
      loadHistory();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  function renderLogList(logs) {
    const container = document.getElementById('water-log-list');
    if (!logs.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">◎</div><p>No water logged yet today.</p></div>`;
      return;
    }
    container.innerHTML = logs
      .slice()
      .reverse()
      .map(
        (l) => `
        <div class="list-row" data-id="${l._id}">
          <div>
            <div class="title">${UI.formatMl(l.amount)}</div>
            <div class="meta">${UI.formatTime(l.timestamp)}</div>
          </div>
          <button class="icon-btn danger delete-log-btn">🗑</button>
        </div>`
      )
      .join('');

    container.querySelectorAll('.list-row').forEach((row) => {
      row.querySelector('.delete-log-btn').addEventListener('click', () => deleteLog(row.dataset.id));
    });
  }

  async function loadToday() {
    try {
      const res = await API.get('/water');
      const { logs, total, goal } = res.data;
      const pct = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0;

      document.getElementById('water-today').textContent = `${UI.formatMl(total)} / ${UI.formatMl(goal)}`;
      document.getElementById('water-today-bar').style.width = `${pct}%`;

      renderLogList(logs);
      NotificationsHelper.goalWarning(pct, 'water');
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  async function loadHistory() {
    try {
      const res = await API.get('/water/history', { days: 7 });
      const { dailyTotals, goal } = res.data;

      const labels = dailyTotals.map((d) => UI.formatDate(d.date));
      const values = dailyTotals.map((d) => d.total);

      const ctx = document.getElementById('water-chart').getContext('2d');
      if (chart) chart.destroy();
      chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Water (ml)',
              data: values,
              backgroundColor: '#2E7DA6',
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#DDE3DC' } },
            x: { grid: { display: false } },
          },
        },
      });
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  loadToday();
  loadHistory();
})();
