(function initRemindersPage() {
  API.requireAuth();
  UI.renderSidebar();
  document.getElementById('today-date').textContent = UI.formatDateLong(new Date());

  let currentStatus = 'pending';

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatus = btn.dataset.status;
      loadReminders();
    });
  });

  document.getElementById('new-reminder-btn').addEventListener('click', () => {
    document.getElementById('reminder-modal-title').textContent = 'New reminder';
    document.getElementById('reminder-form').reset();
    document.getElementById('reminder-id').value = '';
    document.getElementById('reminder-date').value = todayStr();
    UI.openModal('reminder-modal');
  });

  document.getElementById('reminder-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('reminder-id').value;
    const payload = {
      title: document.getElementById('reminder-title').value.trim(),
      date: document.getElementById('reminder-date').value,
      time: document.getElementById('reminder-time').value,
      repeatType: document.getElementById('reminder-repeat').value,
    };

    try {
      if (id) {
        await API.put(`/reminders/${id}`, payload);
        UI.toast('Reminder updated');
      } else {
        await API.post('/reminders', payload);
        UI.toast('Reminder created');
      }
      UI.closeModal('reminder-modal');
      loadReminders();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  });

  function editReminder(r) {
    document.getElementById('reminder-modal-title').textContent = 'Edit reminder';
    document.getElementById('reminder-id').value = r._id;
    document.getElementById('reminder-title').value = r.title;
    document.getElementById('reminder-date').value = new Date(r.date).toISOString().slice(0, 10);
    document.getElementById('reminder-time').value = r.time;
    document.getElementById('reminder-repeat').value = r.repeatType;
    UI.openModal('reminder-modal');
  }

  async function setStatus(id, status) {
    try {
      await API.put(`/reminders/${id}`, { status });
      UI.toast(status === 'completed' ? 'Marked as completed' : 'Reminder dismissed');
      loadReminders();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  async function deleteReminder(id) {
    if (!confirm('Delete this reminder?')) return;
    try {
      await API.del(`/reminders/${id}`);
      UI.toast('Reminder deleted');
      loadReminders();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  const REPEAT_LABEL = { none: 'one-time', daily: 'daily', weekly: 'weekly', monthly: 'monthly' };
  const STATUS_BADGE = { pending: '', completed: '', dismissed: 'danger' };

  function renderReminders(reminders) {
    const container = document.getElementById('reminders-list');
    if (!reminders.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏰</div><h3>No reminders here</h3><p>Create a reminder for something important and never miss it.</p></div>`;
      return;
    }

    container.innerHTML = reminders
      .map(
        (r) => `
        <div class="list-row" data-id="${r._id}">
          <div>
            <div class="title">${UI.escapeHtml(r.title)}</div>
            <div class="meta">${UI.formatDate(r.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${r.time} · <span class="badge coral">${REPEAT_LABEL[r.repeatType]}</span> <span class="badge ${STATUS_BADGE[r.status]}">${r.status}</span></div>
          </div>
          <div class="row-actions">
            ${r.status === 'pending' ? '<button class="icon-btn complete-btn" title="Mark completed">✓</button><button class="icon-btn dismiss-btn" title="Dismiss">✕</button>' : ''}
            <button class="icon-btn edit-btn" title="Edit">✎</button>
            <button class="icon-btn danger delete-btn" title="Delete">🗑</button>
          </div>
        </div>`
      )
      .join('');

    container.querySelectorAll('.list-row').forEach((row) => {
      const reminder = reminders.find((r) => r._id === row.dataset.id);
      const completeBtn = row.querySelector('.complete-btn');
      const dismissBtn = row.querySelector('.dismiss-btn');
      if (completeBtn) completeBtn.addEventListener('click', () => setStatus(reminder._id, 'completed'));
      if (dismissBtn) dismissBtn.addEventListener('click', () => setStatus(reminder._id, 'dismissed'));
      row.querySelector('.edit-btn').addEventListener('click', () => editReminder(reminder));
      row.querySelector('.delete-btn').addEventListener('click', () => deleteReminder(reminder._id));
    });
  }

  async function loadReminders() {
    try {
      const res = await API.get('/reminders', currentStatus ? { status: currentStatus } : {});
      renderReminders(res.data.reminders);
      if (currentStatus === 'pending') {
        NotificationsHelper.checkReminders(res.data.reminders);
      }
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  loadReminders();
})();
