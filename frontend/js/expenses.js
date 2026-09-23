(function initExpensesPage() {
  API.requireAuth();
  UI.renderSidebar();
  document.getElementById('today-date').textContent = UI.formatDateLong(new Date());

  let categoryChart = null;
  let dailyChart = null;
  let currentExpenses = [];

  const CATEGORY_COLORS = {
    Food: '#3F6F5E',
    Travel: '#2E7DA6',
    'Shopping/Materials': '#C9832B',
    Education: '#4A5A9E',
    Entertainment: '#B45048',
    Other: '#8A8F87',
  };

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  document.getElementById('new-expense-btn').addEventListener('click', () => {
    document.getElementById('expense-modal-title').textContent = 'Add expense';
    document.getElementById('expense-form').reset();
    document.getElementById('expense-id').value = '';
    document.getElementById('expense-date').value = todayStr();
    UI.openModal('expense-modal');
  });

  document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('expense-id').value;
    const payload = {
      amount: Number(document.getElementById('expense-amount').value),
      category: document.getElementById('expense-category').value,
      description: document.getElementById('expense-description').value.trim(),
      date: document.getElementById('expense-date').value,
    };

    try {
      if (id) {
        await API.put(`/expenses/${id}`, payload);
        UI.toast('Expense updated');
      } else {
        await API.post('/expenses', payload);
        UI.toast('Expense added');
      }
      UI.closeModal('expense-modal');
      loadAll();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  });

  function editExpense(exp) {
    document.getElementById('expense-modal-title').textContent = 'Edit expense';
    document.getElementById('expense-id').value = exp._id;
    document.getElementById('expense-amount').value = exp.amount;
    document.getElementById('expense-category').value = exp.category;
    document.getElementById('expense-description').value = exp.description || '';
    document.getElementById('expense-date').value = new Date(exp.date).toISOString().slice(0, 10);
    UI.openModal('expense-modal');
  }

  async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    try {
      await API.del(`/expenses/${id}`);
      UI.toast('Expense deleted');
      loadAll();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  document.getElementById('edit-budget-btn').addEventListener('click', () => {
    document.getElementById('budget-amount').value = API.getUser()?.monthlyBudget || '';
    UI.openModal('budget-modal');
  });

  document.getElementById('budget-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const monthlyBudget = Number(document.getElementById('budget-amount').value);
    try {
      await API.put('/expenses/budget', { monthlyBudget });
      const user = API.getUser();
      if (user) {
        user.monthlyBudget = monthlyBudget;
        API.setSession(API.getToken(), user);
      }
      UI.toast('Budget updated');
      UI.closeModal('budget-modal');
      loadAll();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  });

  document.getElementById('category-filter').addEventListener('change', renderExpenseList);

  function renderExpenseList() {
    const filter = document.getElementById('category-filter').value;
    const list = document.getElementById('expenses-list');
    const filtered = filter ? currentExpenses.filter((e) => e.category === filter) : currentExpenses;

    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">₹</div><p>No expenses recorded for this filter yet.</p></div>`;
      return;
    }

    list.innerHTML = filtered
      .map(
        (exp) => `
        <div class="list-row" data-id="${exp._id}">
          <div>
            <div class="title">${UI.escapeHtml(exp.description) || exp.category}</div>
            <div class="meta">${UI.formatDate(exp.date)} · <span class="badge">${exp.category}</span></div>
          </div>
          <div class="flex flex-gap" style="align-items:center;">
            <span class="amount">${UI.formatCurrency(exp.amount)}</span>
            <div class="row-actions">
              <button class="icon-btn edit-btn">✎</button>
              <button class="icon-btn danger delete-btn">🗑</button>
            </div>
          </div>
        </div>`
      )
      .join('');

    list.querySelectorAll('.list-row').forEach((row) => {
      const exp = currentExpenses.find((e) => e._id === row.dataset.id);
      row.querySelector('.edit-btn').addEventListener('click', () => editExpense(exp));
      row.querySelector('.delete-btn').addEventListener('click', () => deleteExpense(exp._id));
    });
  }

  async function loadSummary() {
    try {
      const res = await API.get('/expenses/summary');
      const { todayTotal, monthTotal, budget, budgetUtilization, budgetWarning, categoryBreakdown } = res.data;

      document.getElementById('expense-today').textContent = UI.formatCurrency(todayTotal);
      document.getElementById('expense-month').textContent = UI.formatCurrency(monthTotal);
      document.getElementById('expense-budget').textContent = budget > 0 ? UI.formatCurrency(budget) : 'Not set';
      document.getElementById('budget-bar').style.width = `${Math.min(100, budgetUtilization || 0)}%`;
      document.getElementById('budget-bar').className = `progress-fill ${(budgetUtilization || 0) >= 90 ? 'danger' : 'amber'}`;

      const warningCard = document.getElementById('budget-warning-card');
      if (budgetWarning) {
        warningCard.style.display = 'block';
        document.getElementById('budget-warning-text').textContent = budgetWarning;
        NotificationsHelper.budgetWarning(budgetWarning);
      } else {
        warningCard.style.display = 'none';
      }

      // Category doughnut chart
      const labels = Object.keys(categoryBreakdown);
      const values = Object.values(categoryBreakdown);
      const ctx = document.getElementById('category-chart').getContext('2d');
      if (categoryChart) categoryChart.destroy();

      if (labels.length === 0) {
        ctx.canvas.parentElement.innerHTML = '<p class="text-muted">No expenses recorded this month yet.</p>';
      } else {
        categoryChart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{ data: values, backgroundColor: labels.map((l) => CATEGORY_COLORS[l] || '#8A8F87') }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } },
          },
        });
      }
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  async function loadDailyChart() {
    try {
      const res = await API.get('/analytics/expenses', { days: 30 });
      const { dailyTotals } = res.data;

      const labels = dailyTotals.map((d) => UI.formatDate(d.date));
      const values = dailyTotals.map((d) => d.total);

      const ctx = document.getElementById('daily-chart').getContext('2d');
      if (dailyChart) dailyChart.destroy();
      dailyChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Spending (₹)',
              data: values,
              borderColor: '#C9832B',
              backgroundColor: 'rgba(201, 131, 43, 0.15)',
              fill: true,
              tension: 0.25,
              pointRadius: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#DDE3DC' } },
            x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } },
          },
        },
      });
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  async function loadExpenses() {
    try {
      const res = await API.get('/expenses');
      currentExpenses = res.data.expenses;

      const select = document.getElementById('category-filter');
      select.innerHTML =
        '<option value="">All categories</option>' + res.data.categories.map((c) => `<option value="${c}">${c}</option>`).join('');

      renderExpenseList();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  function loadAll() {
    loadSummary();
    loadDailyChart();
    loadExpenses();
  }

  loadAll();
})();
