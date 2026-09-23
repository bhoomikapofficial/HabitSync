const { formatMinutes } = require('./dateHelpers');

/**
 * Generates simple, predefined-rule insights from a week's worth of
 * aggregated data. Each function is defensive against missing/empty data
 * so the dashboard never breaks for a brand-new user.
 */

function sleepInsight(sleepLogs) {
  if (!sleepLogs || sleepLogs.length === 0) return null;
  const totalMinutes = sleepLogs.reduce((sum, l) => sum + (l.duration || 0), 0);
  const avg = totalMinutes / sleepLogs.length;
  return `Your average sleep this week is ${formatMinutes(avg)}.`;
}

function expenseCategoryInsight(expenses) {
  if (!expenses || expenses.length === 0) return null;
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  if (total <= 0) return null;

  const byCategory = {};
  expenses.forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });

  const [topCategory, topAmount] = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  const percent = Math.round((topAmount / total) * 100);

  return `Your ${topCategory} expenses represent ${percent}% of your total spending this month.`;
}

function waterGoalInsight(dailyTotals, goalMl) {
  if (!dailyTotals || dailyTotals.length === 0 || !goalMl) return null;
  const daysMet = dailyTotals.filter((total) => total >= goalMl).length;
  return `You completed your water goal on ${daysMet} of the last ${dailyTotals.length} days.`;
}

function habitConsistencyInsight(completionRate, habitName) {
  if (completionRate === null || completionRate === undefined) return null;
  const pct = Math.round(completionRate * 100);
  if (habitName) {
    return `You completed "${habitName}" on ${pct}% of the days this week.`;
  }
  return `Your overall habit completion rate this week is ${pct}%.`;
}

function budgetWarningInsight(spent, budget) {
  if (!budget || budget <= 0) return null;
  const pct = Math.round((spent / budget) * 100);
  if (pct >= 100) return `You have exceeded your monthly budget (${pct}% used).`;
  if (pct >= 90) return `You have used ${pct}% of your monthly budget. Consider slowing down on spending.`;
  if (pct >= 80) return `You have used ${pct}% of your monthly budget.`;
  return null;
}

/**
 * Combines all available insights into a single ordered array of
 * human-readable strings, skipping any that could not be generated due
 * to insufficient data.
 */
function buildInsights({ sleepLogs, expenses, waterDailyTotals, waterGoalMl, habitCompletionRate, monthlySpent, monthlyBudget }) {
  const insights = [
    sleepInsight(sleepLogs),
    expenseCategoryInsight(expenses),
    waterGoalInsight(waterDailyTotals, waterGoalMl),
    habitConsistencyInsight(habitCompletionRate),
    budgetWarningInsight(monthlySpent, monthlyBudget),
  ].filter(Boolean);

  return insights;
}

module.exports = {
  sleepInsight,
  expenseCategoryInsight,
  waterGoalInsight,
  habitConsistencyInsight,
  budgetWarningInsight,
  buildInsights,
};
