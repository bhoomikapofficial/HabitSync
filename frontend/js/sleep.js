(function initSleepPage() {
  API.requireAuth();
  UI.renderSidebar();
  document.getElementById('today-date').textContent = UI.formatDateLong(new Date());

  let chart = null;

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  document.getElementById('log-sleep-btn').addEventListener('click', () => {
    document.getElementById('sleep-modal-title').textContent = 'Log sleep';
    document.getElementById('sleep-form').reset();
    document.getElementById('sleep-id').value = '';
    document.getElementById('sleep-date').value = todayStr();
    document.getElementById('wake-date').value = todayStr();
    document.getElementById('sleep-time-input').value = '23:00';
    document.getElementById('wake-time-input').value = '06:30';
    UI.openModal('sleep-modal');
  });

  document.getElementById('sleep-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('sleep-id').value;
    const sleepDate = document.getElementById('sleep-date').value;
    const sleepTimeVal = document.getElementById('sleep-time-input').value;
    const wakeDate = document.getElementById('wake-date').value;
    const wakeTimeVal = document.getElementById('wake-time-input').value;

    const sleepTime = new Date(`${sleepDate}T${sleepTimeVal}:00`);
    const wakeTime = new Date(`${wakeDate}T${wakeTimeVal}:00`);

    if (wakeTime <= sleepTime) {
      UI.toast('Wake time must be after sleep time', 'error');
      return;
    }

    const payload = { sleepTime: sleepTime.toISOString(), wakeTime: wakeTime.toISOString(), date: wakeDate };

    try {
      if (id) {
        await API.put(`/sleep/${id}`, payload);
        UI.toast('Sleep record updated');
      } else {
        await API.post('/sleep', payload);
        UI.toast('Sleep record saved');
      }
      UI.closeModal('sleep-modal');
      loadAll();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  });

  async function deleteLog(id) {
    if (!confirm('Delete this sleep record?')) return;
    try {
      await API.del(`/sleep/${id}`);
      UI.toast('Sleep record deleted');
      loadAll();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  function editLog(log) {
    document.getElementById('sleep-modal-title').textContent = 'Edit sleep record';
    document.getElementById('sleep-id').value = log._id;
    const sleepDate = new Date(log.sleepTime);
    const wakeDate = new Date(log.wakeTime);
    document.getElementById('sleep-date').value = sleepDate.toISOString().slice(0, 10);
    document.getElementById('sleep-time-input').value = sleepDate.toTimeString().slice(0, 5);
    document.getElementById('wake-date').value = wakeDate.toISOString().slice(0, 10);
    document.getElementById('wake-time-input').value = wakeDate.toTimeString().slice(0, 5);
    UI.openModal('sleep-modal');
  }

  async function loadToday() {
    try {
      const res = await API.get('/sleep/today');
      const { log, durationFormatted } = res.data;
      document.getElementById('sleep-last').textContent = durationFormatted || 'Not logged';
      document.getElementById('sleep-last-times').textContent = log
        ? `${UI.formatTime(log.sleepTime)} → ${UI.formatTime(log.wakeTime)}`
        : 'Log tonight\'s sleep to see it here';
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  async function loadHistory() {
    try {
      const res = await API.get('/sleep/history', { days: 7 });
      const { logs, averageDurationFormatted, consistencyLabel } = res.data;

      document.getElementById('sleep-avg').textContent = averageDurationFormatted;
      document.getElementById('sleep-consistency').textContent = consistencyLabel;

      const labels = logs.map((l) => UI.formatDate(l.date));
      const values = logs.map((l) => Math.round((l.duration / 60) * 10) / 10);

      const ctx = document.getElementById('sleep-chart').getContext('2d');
      if (chart) chart.destroy();
      chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Sleep (hours)',
              data: values,
              borderColor: '#4A5A9E',
              backgroundColor: 'rgba(74, 90, 158, 0.15)',
              fill: true,
              tension: 0.3,
              pointRadius: 4,
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

      const list = document.getElementById('sleep-list');
      if (!logs.length) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">☾</div><p>No sleep records yet. Log tonight's sleep to get started.</p></div>`;
        return;
      }
      list.innerHTML = logs
        .slice()
        .reverse()
        .map(
          (l) => `
          <div class="list-row" data-id="${l._id}">
            <div>
              <div class="title">${UI.formatMinutes(l.duration)}</div>
              <div class="meta">${UI.formatDate(l.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${UI.formatTime(l.sleepTime)} → ${UI.formatTime(l.wakeTime)}</div>
            </div>
            <div class="row-actions">
              <button class="icon-btn edit-btn">✎</button>
              <button class="icon-btn danger delete-btn">🗑</button>
            </div>
          </div>`
        )
        .join('');

      list.querySelectorAll('.list-row').forEach((row) => {
        const log = logs.find((l) => l._id === row.dataset.id);
        row.querySelector('.edit-btn').addEventListener('click', () => editLog(log));
        row.querySelector('.delete-btn').addEventListener('click', () => deleteLog(log._id));
      });
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  function loadAll() {
    loadToday();
    loadHistory();
  }

  loadAll();
})();
