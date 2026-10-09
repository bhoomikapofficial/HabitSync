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
      const { todayTotal, monthTotal, budget, budgetUtilization, budgetDifference, budgetWarning, categoryBreakdown } = res.data;

      document.getElementById('expense-today').textContent = UI.formatCurrency(todayTotal);
      document.getElementById('expense-month').textContent = UI.formatCurrency(monthTotal);
      document.getElementById('expense-budget').textContent = budget > 0 ? UI.formatCurrency(budget) : 'Not set';
      document.getElementById('budget-bar').style.width = `${Math.min(100, budgetUtilization || 0)}%`;
      document.getElementById('budget-bar').className = `progress-fill ${(budgetUtilization || 0) >= 90 ? 'danger' : 'amber'}`;

      const diffEl = document.getElementById('expense-budget-diff');
      if (budgetDifference === null || budgetDifference === undefined) {
        diffEl.textContent = 'Set a budget to see how much you have left';
      } else if (budgetDifference >= 0) {
        diffEl.textContent = `${UI.formatCurrency(budgetDifference)} left this month`;
      } else {
        diffEl.textContent = `${UI.formatCurrency(Math.abs(budgetDifference))} over budget`;
      }

      const warningCard = document.getElementById('budget-warning-card');
      if (budgetWarning) {
        warningCard.style.display = 'block';
        document.getElementById('budget-warning-text').textContent = budgetWarning;
        NotificationsHelper.budgetWarning(budgetWarning);
      } else {
        warningCard.style.display = 'none';
      }

      // Category doughnut chart. The canvas element itself is never
      // removed from the DOM (only shown/hidden alongside a plain-text
      // empty state) so the chart keeps working correctly on every
      // subsequent refresh, including after a month with zero expenses.
      const labels = Object.keys(categoryBreakdown);
      const values = Object.values(categoryBreakdown);
      const canvas = document.getElementById('category-chart');
      const emptyEl = document.getElementById('category-chart-empty');
      if (categoryChart) {
        categoryChart.destroy();
        categoryChart = null;
      }

      if (labels.length === 0) {
        canvas.style.display = 'none';
        emptyEl.style.display = 'block';
      } else {
        canvas.style.display = 'block';
        emptyEl.style.display = 'none';
        try {
          const ctx = canvas.getContext('2d');
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
        } catch (chartErr) {
          canvas.style.display = 'none';
          emptyEl.style.display = 'block';
          emptyEl.textContent = 'Could not render the chart.';
        }
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

      const canvas = document.getElementById('daily-chart');
      if (dailyChart) {
        dailyChart.destroy();
        dailyChart = null;
      }
      dailyChart = UI.renderChartSafely(canvas, () =>
        new Chart(canvas.getContext('2d'), {
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
        })
      );
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
