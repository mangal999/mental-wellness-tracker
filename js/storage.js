/**
 * Storage management for StudyMind
 */

export const STORAGE_KEYS = {
  ONBOARDED: 'sm_onboarded',
  GEMINI_KEY: 'sm_gemini_key',
  PROFILE: 'sm_profile',
  LOGS: 'sm_logs',
  WEEKLY_SUMMARY: 'sm_weekly_summary'
};

export function getGeminiKey() {
  return localStorage.getItem(STORAGE_KEYS.GEMINI_KEY) || '';
}

export function saveGeminiKey(key) {
  localStorage.setItem(STORAGE_KEYS.GEMINI_KEY, key.trim());
}

export function isOnboarded() {
  return localStorage.getItem(STORAGE_KEYS.ONBOARDED) === 'true';
}

export function setOnboarded(val) {
  localStorage.setItem(STORAGE_KEYS.ONBOARDED, val ? 'true' : 'false');
}

export function getProfile() {
  const profile = localStorage.getItem(STORAGE_KEYS.PROFILE);
  return profile ? JSON.parse(profile) : null;
}

export function saveProfile(profile) {
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
}

export function getLogs() {
  const logs = localStorage.getItem(STORAGE_KEYS.LOGS);
  return logs ? JSON.parse(logs) : [];
}

export function saveLogs(logs) {
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
}

export function getLogForDate(dateStr) {
  const logs = getLogs();
  return logs.find(log => log.date === dateStr) || null;
}

export function saveLogForDate(dateStr, logData) {
  const logs = getLogs();
  const idx = logs.findIndex(log => log.date === dateStr);
  
  const logEntry = {
    date: dateStr,
    mood: logData.mood,
    energy: logData.energy,
    focus: logData.focus,
    journal: logData.journal || '',
    aiResponse: logData.aiResponse || '',
    triggers: logData.triggers || [],
    positives: logData.positives || []
  };

  if (idx !== -1) {
    logs[idx] = logEntry;
  } else {
    logs.push(logEntry);
  }
  
  // Sort logs chronological
  logs.sort((a, b) => new Date(a.date) - new Date(b.date));
  saveLogs(logs);
}

export function getWeeklySummary() {
  const summary = localStorage.getItem(STORAGE_KEYS.WEEKLY_SUMMARY);
  return summary ? JSON.parse(summary) : null;
}

export function saveWeeklySummary(weekKey, summaryText) {
  localStorage.setItem(STORAGE_KEYS.WEEKLY_SUMMARY, JSON.stringify({ weekKey, summary: summaryText }));
}

// Calculate streak
export function getStreak() {
  const logs = getLogs();
  if (logs.length === 0) return 0;

  // We want to count consecutive calendar days starting from today (or yesterday) backwards
  const logDates = new Set(logs.map(log => log.date));
  const today = new Date();
  
  const formatDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const r = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${r}`;
  };

  let streak = 0;
  let checkDate = new Date(today);
  let todayStr = formatDate(checkDate);

  // If there is no entry today, check if there was one yesterday to continue the streak
  if (!logDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
    todayStr = formatDate(checkDate);
    if (!logDates.has(todayStr)) {
      return 0; // Streak broken or not started
    }
  }

  // Iterate backwards
  while (logDates.has(formatDate(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

// Get average mood this week vs last week
export function getMoodComparison() {
  const logs = getLogs();
  if (logs.length === 0) return { thisWeek: 0, lastWeek: 0, diff: 0 };

  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  
  const parseDateStr = (str) => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const thisWeekLogs = [];
  const lastWeekLogs = [];

  logs.forEach(log => {
    const logDate = parseDateStr(log.date);
    const diffDays = Math.floor((now - logDate) / oneDay);
    if (diffDays >= 0 && diffDays < 7) {
      thisWeekLogs.push(log.mood);
    } else if (diffDays >= 7 && diffDays < 14) {
      lastWeekLogs.push(log.mood);
    }
  });

  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const thisWeekAvg = avg(thisWeekLogs);
  const lastWeekAvg = avg(lastWeekLogs);

  return {
    thisWeek: Number(thisWeekAvg.toFixed(1)),
    lastWeek: Number(lastWeekAvg.toFixed(1)),
    diff: Number((thisWeekAvg - lastWeekAvg).toFixed(1))
  };
}

// Best day this month (highest combined mood + focus)
export function getBestDayThisMonth() {
  const logs = getLogs();
  if (logs.length === 0) return null;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const parseDateStr = (str) => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const focusMap = {
    "Couldn't focus": 1,
    "Scattered": 2,
    "Moderate": 3,
    "Sharp": 4,
    "In the zone": 5
  };

  let bestLog = null;
  let highestScore = -1;

  logs.forEach(log => {
    const logDate = parseDateStr(log.date);
    if (logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear) {
      const focusVal = focusMap[log.focus] || 3;
      const combined = log.mood + focusVal * 2; // scale focus to 10 max
      if (combined > highestScore) {
        highestScore = combined;
        bestLog = log;
      }
    }
  });

  return bestLog;
}

export function getWeekYearKey(d = new Date()) {
  // Get calendar week string format: YYYY-Www
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
