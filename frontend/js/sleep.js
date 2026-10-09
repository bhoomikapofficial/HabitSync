(function initSleepPage() {
  API.requireAuth();
  UI.renderSidebar();
  document.getElementById('today-date').textContent = UI.formatDateLong(new Date());

  let chart = null;
  let logs = []; // flat list from /sleep/history, used for the History section

  function toDateInputValue(d) {
    return new Date(d).toISOString().slice(0, 10);
  }
  function toTimeInputValue(d) {
    const date = new Date(d);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function openCreateModal(type) {
    document.getElementById('sleep-modal-title').textContent = type === 'daytime' ? 'Log daytime sleep' : 'Log night sleep';
    document.getElementById('sleep-form').reset();
    document.getElementById('sleep-id').value = '';
    document.getElementById('sleep-type-input').value = type;

    const now = new Date();
    document.getElementById('sleep-date').value = toDateInputValue(now);
    document.getElementById('wake-date').value = toDateInputValue(now);
    UI.openModal('sleep-modal');
  }

  function openEditModal(log) {
    document.getElementById('sleep-modal-title').textContent = 'Edit sleep record';
    document.getElementById('sleep-id').value = log._id;
    document.getElementById('sleep-type-input').value = log.sleepType || 'night';
    document.getElementById('sleep-date').value = toDateInputValue(log.sleepTime);
    document.getElementById('sleep-time-input').value = toTimeInputValue(log.sleepTime);
    document.getElementById('wake-date').value = toDateInputValue(log.wakeTime);
    document.getElementById('wake-time-input').value = toTimeInputValue(log.wakeTime);
    UI.openModal('sleep-modal');
  }

  document.getElementById('log-sleep-btn').addEventListener('click', () => openCreateModal('night'));
  document.getElementById('log-nap-btn').addEventListener('click', () => openCreateModal('daytime'));

  document.getElementById('sleep-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('sleep-id').value;

    const sleepTime = new Date(`${document.getElementById('sleep-date').value}T${document.getElementById('sleep-time-input').value}:00`);
    const wakeTime = new Date(`${document.getElementById('wake-date').value}T${document.getElementById('wake-time-input').value}:00`);

    if (wakeTime <= sleepTime) {
      UI.toast('Wake time must be after sleep time', 'error');
      return;
    }

    const payload = {
      sleepType: document.getElementById('sleep-type-input').value,
      sleepTime: sleepTime.toISOString(),
      wakeTime: wakeTime.toISOString(),
    };

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

  function renderToday(data) {
    const { lastNight, durationFormatted, todayNaps, napsTotalFormatted } = data;

    if (lastNight) {
      document.getElementById('sleep-last').textContent = durationFormatted;
      document.getElementById('sleep-last-times').textContent = `${UI.formatTime(lastNight.sleepTime)} → ${UI.formatTime(lastNight.wakeTime)}`;
    } else {
      document.getElementById('sleep-last').textContent = '—';
      document.getElementById('sleep-last-times').textContent = 'No night sleep logged yet';
    }

    document.getElementById('sleep-naps-today').textContent = todayNaps.length ? napsTotalFormatted : '—';
    document.getElementById('sleep-naps-count').textContent = todayNaps.length
      ? `${todayNaps.length} nap${todayNaps.length > 1 ? 's' : ''} logged today`
      : 'No daytime sleep logged today';
  }

  function renderWeekTable(summaryByDay) {
    const tbody = document.getElementById('sleep-week-table');
    tbody.innerHTML = summaryByDay
      .slice()
      .reverse()
      .map(
        (d) => `
        <tr>
          <td>${UI.formatDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
          <td>${d.nightMinutes > 0 ? UI.formatMinutes(d.nightMinutes) : '—'}</td>
          <td>${d.daytimeMinutes > 0 ? UI.formatMinutes(d.daytimeMinutes) : '—'}</td>
          <td><strong>${d.combinedMinutes > 0 ? d.combinedFormatted : '—'}</strong></td>
        </tr>`
      )
      .join('');
  }

  function renderChart(summaryByDay) {
    const canvas = document.getElementById('sleep-chart');
    const labels = summaryByDay.map((d) => UI.formatDate(d.date));
    const nightValues = summaryByDay.map((d) => Math.round((d.nightMinutes / 60) * 10) / 10);
    const daytimeValues = summaryByDay.map((d) => Math.round((d.daytimeMinutes / 60) * 10) / 10);

    if (chart) {
      chart.destroy();
      chart = null;
    }
    chart = UI.renderChartSafely(canvas, () =>
      new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Night sleep (hrs)', data: nightValues, backgroundColor: '#3C5A78', borderRadius: 4, stack: 'sleep' },
            { label: 'Daytime sleep (hrs)', data: daytimeValues, backgroundColor: '#8FB3D9', borderRadius: 4, stack: 'sleep' },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true, position: 'bottom' } },
          scales: {
            y: { beginAtZero: true, stacked: true, grid: { color: '#DDE3DC' } },
            x: { stacked: true, grid: { display: false } },
          },
        },
      })
    );
  }

  function renderHistoryList() {
    const container = document.getElementById('sleep-list');
    if (!logs.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">☾</div><h3>No sleep logged yet</h3><p>Log a night's sleep or a daytime nap to start tracking.</p></div>`;
      return;
    }

    container.innerHTML = logs
      .map(
        (l) => `
        <div class="list-row" data-id="${l._id}">
          <div>
            <div class="title">
              ${UI.formatDate(l.sleepTime, { weekday: 'short', month: 'short', day: 'numeric' })}
              <span class="badge ${l.sleepType === 'daytime' ? 'sky' : 'indigo'}">${l.sleepType === 'daytime' ? 'Daytime' : 'Night'}</span>
            </div>
            <div class="meta">${UI.formatTime(l.sleepTime)} → ${UI.formatTime(l.wakeTime)} · ${UI.formatMinutes(l.duration)}</div>
          </div>
          <div class="row-actions">
            <button class="icon-btn edit-btn" title="Edit">✎</button>
            <button class="icon-btn danger delete-btn" title="Delete">🗑</button>
          </div>
        </div>`
      )
      .join('');

    container.querySelectorAll('.list-row').forEach((row) => {
      const id = row.dataset.id;
      const log = logs.find((l) => l._id === id);
      row.querySelector('.edit-btn').addEventListener('click', () => openEditModal(log));
      row.querySelector('.delete-btn').addEventListener('click', () => deleteLog(id));
    });
  }

  async function loadAll() {
    try {
      const [todayRes, historyRes] = await Promise.all([API.get('/sleep/today'), API.get('/sleep/history', { days: 7 })]);

      renderToday(todayRes.data);

      const { logs: historyLogs, summaryByDay, averageDurationFormatted, consistencyLabel } = historyRes.data;
      logs = historyLogs;

      document.getElementById('sleep-avg').textContent = averageDurationFormatted;
      document.getElementById('sleep-consistency').textContent = consistencyLabel;

      renderWeekTable(summaryByDay);
      renderChart(summaryByDay);
      renderHistoryList();
    } catch (err) {
      UI.toast(err.message, 'error');
      document.getElementById('sleep-list').innerHTML = '<div class="loading-row">Could not load sleep data.</div>';
    }
  }

  loadAll();
})();
