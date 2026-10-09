(function initRemindersPage() {
  API.requireAuth();
  UI.renderSidebar();
  document.getElementById('today-date').textContent = UI.formatDateLong(new Date());

  let currentStatus = 'pending';
  let selectedWeekdays = new Set();

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

  // --- Recurrence UI: show/hide the right fields based on repeat type ---
  function updateRepeatFieldsVisibility() {
    const repeatType = document.getElementById('reminder-repeat').value;
    document.getElementById('weekly-days-field').style.display = repeatType === 'weekly' ? 'block' : 'none';
    document.getElementById('custom-dates-field').style.display = repeatType === 'custom' ? 'block' : 'none';
    document.getElementById('end-date-field').style.display = repeatType !== 'none' ? 'block' : 'none';
  }
  document.getElementById('reminder-repeat').addEventListener('change', updateRepeatFieldsVisibility);

  document.querySelectorAll('.weekday-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const day = Number(chip.dataset.day);
      if (selectedWeekdays.has(day)) {
        selectedWeekdays.delete(day);
        chip.classList.remove('active');
      } else {
        selectedWeekdays.add(day);
        chip.classList.add('active');
      }
    });
  });

  function resetWeekdayPicker() {
    selectedWeekdays = new Set();
    document.querySelectorAll('.weekday-chip').forEach((c) => c.classList.remove('active'));
  }

  function addCustomDateRow(value = '') {
    const list = document.getElementById('custom-dates-list');
    const row = document.createElement('div');
    row.className = 'custom-date-row';
    row.innerHTML = `<input type="date" class="custom-date-input" value="${value}" /><button type="button" class="icon-btn danger remove-date-btn">🗑</button>`;
    row.querySelector('.remove-date-btn').addEventListener('click', () => row.remove());
    list.appendChild(row);
  }

  document.getElementById('add-custom-date-btn').addEventListener('click', () => addCustomDateRow());

  function resetCustomDates() {
    document.getElementById('custom-dates-list').innerHTML = '';
  }

  function collectCustomDates() {
    return Array.from(document.querySelectorAll('.custom-date-input'))
      .map((i) => i.value)
      .filter(Boolean);
  }

  document.getElementById('new-reminder-btn').addEventListener('click', () => {
    document.getElementById('reminder-modal-title').textContent = 'New reminder';
    document.getElementById('reminder-form').reset();
    document.getElementById('reminder-id').value = '';
    document.getElementById('reminder-date').value = todayStr();
    document.getElementById('reminder-notifications-enabled').checked = true;
    resetWeekdayPicker();
    resetCustomDates();
    updateRepeatFieldsVisibility();
    UI.openModal('reminder-modal');
  });

  document.getElementById('reminder-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('reminder-id').value;
    const repeatType = document.getElementById('reminder-repeat').value;

    const payload = {
      title: document.getElementById('reminder-title').value.trim(),
      date: document.getElementById('reminder-date').value,
      time: document.getElementById('reminder-time').value,
      repeatType,
      repeatDays: repeatType === 'weekly' ? Array.from(selectedWeekdays) : [],
      customDates: repeatType === 'custom' ? collectCustomDates() : [],
      endDate: repeatType !== 'none' ? document.getElementById('reminder-end-date').value || null : null,
      notificationEnabled: document.getElementById('reminder-notifications-enabled').checked,
    };

    if (repeatType === 'custom' && payload.customDates.length === 0) {
      UI.toast('Add at least one custom date', 'error');
      return;
    }

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
    document.getElementById('reminder-end-date').value = r.endDate ? new Date(r.endDate).toISOString().slice(0, 10) : '';
    document.getElementById('reminder-notifications-enabled').checked = r.notificationEnabled !== false;

    resetWeekdayPicker();
    (r.repeatDays || []).forEach((day) => {
      selectedWeekdays.add(day);
      const chip = document.querySelector(`.weekday-chip[data-day="${day}"]`);
      if (chip) chip.classList.add('active');
    });

    resetCustomDates();
    (r.customDates || []).forEach((d) => addCustomDateRow(new Date(d).toISOString().slice(0, 10)));

    updateRepeatFieldsVisibility();
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

  const REPEAT_LABEL = { none: 'one-time', daily: 'daily', weekly: 'weekly', monthly: 'monthly', custom: 'custom dates' };
  const STATUS_BADGE = { pending: '', completed: '', dismissed: 'danger' };
  const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function repeatDescription(r) {
    if (r.repeatType === 'weekly' && r.repeatDays && r.repeatDays.length) {
      return `weekly on ${r.repeatDays.map((d) => WEEKDAY_NAMES[d]).join(', ')}`;
    }
    if (r.repeatType === 'custom') {
      return `${(r.customDates || []).length} custom date${(r.customDates || []).length === 1 ? '' : 's'}`;
    }
    return REPEAT_LABEL[r.repeatType] || r.repeatType;
  }

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
            <div class="meta">
              ${UI.formatDate(r.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${r.time}
              · <span class="badge coral">${repeatDescription(r)}</span>
              <span class="badge ${STATUS_BADGE[r.status]}">${r.status}</span>
              ${r.notificationEnabled === false ? '<span class="badge">Notifications off</span>' : ''}
            </div>
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
        NotificationsHelper.checkReminders(res.data.reminders.filter((r) => r.notificationEnabled !== false));
      }
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  loadReminders();
})();
