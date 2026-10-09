const SleepLog = require('../models/SleepLog');
const { lastNDaysRange, lastNDaysKeys, dayKey, formatMinutes } = require('./dateHelpers');

/**
 * Builds a zero-filled, per-sleep-day (night + daytime combined) summary
 * for the last `days` days, plus the raw log list and headline stats.
 * Shared by the Sleep page's history endpoint and the Analytics page's
 * sleep chart, so the two always agree on the same numbers.
 */
const buildSleepSummary = async (userId, days) => {
  const { start, end } = lastNDaysRange(days);

  const logs = await SleepLog.find({
    userId,
    date: { $gte: start, $lt: end },
  }).sort({ sleepTime: -1 });

  const byDay = {};
  logs.forEach((l) => {
    const key = dayKey(l.date);
    if (!byDay[key]) byDay[key] = { night: [], daytime: [] };
    byDay[key][l.sleepType].push(l);
  });

  const summaryByDay = lastNDaysKeys(days).map((date) => {
    const bucket = byDay[date] || { night: [], daytime: [] };
    const nightMinutes = bucket.night.reduce((s, l) => s + l.duration, 0);
    const daytimeMinutes = bucket.daytime.reduce((s, l) => s + l.duration, 0);
    const combinedMinutes = nightMinutes + daytimeMinutes;
    return {
      date,
      nightMinutes,
      daytimeMinutes,
      combinedMinutes,
      combinedFormatted: formatMinutes(combinedMinutes),
      nightCount: bucket.night.length,
      daytimeCount: bucket.daytime.length,
    };
  });

  // Averages/consistency are computed only over days that actually have a
  // sleep record - a day with nothing logged usually means "forgot to
  // log", not "slept zero hours", so it shouldn't drag the average down.
  const daysWithData = summaryByDay.filter((d) => d.combinedMinutes > 0);
  const avgMinutes =
    daysWithData.length > 0 ? daysWithData.reduce((s, d) => s + d.combinedMinutes, 0) / daysWithData.length : 0;

  let consistencyLabel = 'Not enough data';
  if (daysWithData.length >= 2) {
    const mean = avgMinutes;
    const variance = daysWithData.reduce((s, d) => s + (d.combinedMinutes - mean) ** 2, 0) / daysWithData.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev < 30) consistencyLabel = 'Very consistent';
    else if (stdDev < 60) consistencyLabel = 'Fairly consistent';
    else consistencyLabel = 'Irregular';
  }

  return {
    logs,
    summaryByDay,
    averageDuration: Math.round(avgMinutes),
    averageDurationFormatted: formatMinutes(avgMinutes),
    consistencyLabel,
  };
};

module.exports = { buildSleepSummary };
