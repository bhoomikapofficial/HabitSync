(function initHabitsPage() {
  API.requireAuth();
  UI.renderSidebar();
  document.getElementById('today-date').textContent = UI.formatDateLong(new Date());

  let habits = [];
  const todayKey = () => new Date().toISOString().slice(0, 10);

  function openCreateModal() {
    document.getElementById('habit-modal-title').textContent = 'New habit';
    document.getElementById('habit-form').reset();
    document.getElementById('habit-id').value = '';
    UI.openModal('habit-modal');
  }

  function openEditModal(habit) {
    document.getElementById('habit-modal-title').textContent = 'Edit habit';
    document.getElementById('habit-id').value = habit._id;
    document.getElementById('habit-name').value = habit.name;
    document.getElementById('habit-description').value = habit.description || '';
    document.getElementById('habit-target').value = habit.target || '';
    document.getElementById('habit-frequency').value = habit.frequency;
    document.getElementById('habit-reminder').value = habit.reminderTime || '';
    UI.openModal('habit-modal');
  }

  document.getElementById('new-habit-btn').addEventListener('click', openCreateModal);

  document.getElementById('habit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('habit-id').value;
    const payload = {
      name: document.getElementById('habit-name').value.trim(),
      description: document.getElementById('habit-description').value.trim(),
      target: document.getElementById('habit-target').value.trim(),
      frequency: document.getElementById('habit-frequency').value,
      reminderTime: document.getElementById('habit-reminder').value || null,
    };

    const btn = document.getElementById('habit-submit-btn');
    btn.disabled = true;
    try {
      if (id) {
        await API.put(`/habits/${id}`, payload);
        UI.toast('Habit updated');
      } else {
        await API.post('/habits', payload);
        UI.toast('Habit created');
      }
      UI.closeModal('habit-modal');
      loadHabits();
    } catch (err) {
      UI.toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  async function toggleComplete(habit, checkbox) {
    try {
      await API.post(`/habits/${habit._id}/complete`, { completed: checkbox.checked, date: todayKey() });
      UI.toast(checkbox.checked ? `Marked "${habit.name}" complete` : `Unmarked "${habit.name}"`);
      loadHabits();
    } catch (err) {
      checkbox.checked = !checkbox.checked;
      UI.toast(err.message, 'error');
    }
  }

  async function deleteHabit(habit) {
    if (!confirm(`Delete "${habit.name}"? This also removes its history.`)) return;
    try {
      await API.del(`/habits/${habit._id}`);
      UI.toast('Habit deleted');
      loadHabits();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  async function openHistory(habit) {
    document.getElementById('history-modal-title').textContent = `${habit.name} — last 30 days`;
    document.getElementById('history-summary').textContent = 'Loading…';
    document.getElementById('history-list').innerHTML = '';
    UI.openModal('history-modal');

    try {
      const res = await API.get(`/habits/${habit._id}/history`, { days: 30 });
      const { completedCount, totalDays, completionPercentage, logs } = res.data;
      document.getElementById('history-summary').textContent =
        `${completedCount} of ${totalDays} days completed (${completionPercentage}%)`;

      if (!logs.length) {
        document.getElementById('history-list').innerHTML = '<p class="text-muted">No completions logged yet.</p>';
        return;
      }

      document.getElementById('history-list').innerHTML = logs
        .slice()
        .reverse()
        .map(
          (l) => `<div class="list-row">
            <span>${UI.formatDate(l.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span class="badge ${l.completed ? '' : 'danger'}">${l.completed ? 'Completed' : 'Missed'}</span>
          </div>`
        )
        .join('');
    } catch (err) {
      document.getElementById('history-summary').textContent = 'Could not load history.';
      UI.toast(err.message, 'error');
    }
  }

  function renderHabits() {
    const container = document.getElementById('habits-list');
    if (!habits.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">✓</div><h3>No habits yet</h3><p>Create your first habit to start tracking daily consistency.</p></div>`;
      return;
    }

    container.innerHTML = habits
      .map(
        (h) => `
        <div class="list-row" data-id="${h._id}">
          <div class="flex flex-gap" style="align-items:center;">
            <input type="checkbox" class="complete-checkbox" ${h._todayCompleted ? 'checked' : ''} style="width:18px;height:18px;" />
            <div>
              <div class="title">${UI.escapeHtml(h.name)}</div>
              <div class="meta">${h.target ? UI.escapeHtml(h.target) + ' · ' : ''}${h.frequency}${h.reminderTime ? ' · reminder ' + h.reminderTime : ''}</div>
            </div>
          </div>
          <div class="row-actions">
            <button class="icon-btn history-btn" title="History">▤</button>
            <button class="icon-btn edit-btn" title="Edit">✎</button>
            <button class="icon-btn danger delete-btn" title="Delete">🗑</button>
          </div>
        </div>`
      )
      .join('');

    container.querySelectorAll('.list-row').forEach((row) => {
      const id = row.dataset.id;
      const habit = habits.find((h) => h._id === id);

      row.querySelector('.complete-checkbox').addEventListener('change', (e) => toggleComplete(habit, e.target));
      row.querySelector('.history-btn').addEventListener('click', () => openHistory(habit));
      row.querySelector('.edit-btn').addEventListener('click', () => openEditModal(habit));
      row.querySelector('.delete-btn').addEventListener('click', () => deleteHabit(habit));
    });
  }

  async function loadHabits() {
    try {
      const [habitsRes, dashboardRes] = await Promise.all([API.get('/habits'), API.get('/dashboard')]);
      habits = habitsRes.data.habits;

      // Determine today's completion state per habit via each habit's
      // own history endpoint would be expensive; instead we rely on a
      // lightweight per-habit check using the dashboard's habit count is
      // not enough, so fetch today's logs directly per habit is avoided
      // by checking completion via a dedicated call only when needed.
      // Simpler: fetch today's status per habit from /habits/:id/history?days=1
      const withStatus = await Promise.all(
        habits.map(async (h) => {
          try {
            const hist = await API.get(`/habits/${h._id}/history`, { days: 1 });
            const todayLog = hist.data.logs.find((l) => l.date.slice(0, 10) === todayKey());
            return { ...h, _todayCompleted: Boolean(todayLog && todayLog.completed) };
          } catch {
            return { ...h, _todayCompleted: false };
          }
        })
      );

      habits = withStatus;
      renderHabits();
    } catch (err) {
      UI.toast(err.message, 'error');
      document.getElementById('habits-list').innerHTML = '<div class="loading-row">Could not load habits.</div>';
    }
  }

  loadHabits();
})();
