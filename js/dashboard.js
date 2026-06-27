/**
 * Dashboard stats and interactive charts visualizer
 */

import { 
  getLogs, 
  getStreak, 
  getMoodComparison, 
  getBestDayThisMonth, 
  getWeeklySummary, 
  saveWeeklySummary, 
  getWeekYearKey, 
  getProfile 
} from './storage.js';
import { generateWeeklyInsight } from './gemini.js';

let chart1 = null;
let chart2 = null;
let chart3 = null;
let chart4 = null;

export function initDashboard() {
  renderStatsRow();
  renderWeeklyInsightCard();
  renderCharts();
  renderCalendar();
}

function renderStatsRow() {
  const streak = getStreak();
  const comparison = getMoodComparison();
  const bestDay = getBestDayThisMonth();

  document.getElementById('stat-streak').innerText = `${streak} Days`;
  
  // Mood comparison direction
  const moodDiffSpan = document.getElementById('stat-mood-diff');
  if (comparison.diff > 0) {
    moodDiffSpan.innerHTML = `<span style="color:var(--success);">▲ +${comparison.diff}</span> vs last week`;
  } else if (comparison.diff < 0) {
    moodDiffSpan.innerHTML = `<span style="color:var(--error);">▼ ${comparison.diff}</span> vs last week`;
  } else {
    moodDiffSpan.innerHTML = `No change vs last week`;
  }

  // Best day display
  const bestDaySpan = document.getElementById('stat-best-day');
  if (bestDay) {
    const d = new Date(bestDay.date);
    const day = d.getDate();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    bestDaySpan.innerText = `${day} ${months[d.getMonth()]} (${bestDay.mood}/10 Mood)`;
  } else {
    bestDaySpan.innerText = 'No logs yet';
  }
}

async function renderWeeklyInsightCard() {
  const container = document.getElementById('weekly-insight-content');
  const logs = getLogs();
  
  if (logs.length < 3) {
    container.innerHTML = `<p style="color:var(--text-secondary); font-size:0.9rem;">Need at least 3 logs to generate weekly insights. Check-in consistently!</p>`;
    return;
  }

  const currentWeekKey = getWeekYearKey(new Date());
  const cached = getWeeklySummary();

  if (cached && cached.weekKey === currentWeekKey) {
    container.innerHTML = `<p style="color:var(--text-primary); font-size:0.95rem; line-height:1.5;">${cached.summary}</p>`;
    return;
  }

  // Otherwise load from Gemini and cache it
  container.innerHTML = `
    <div class="shimmer shimmer-text" style="width:100%;"></div>
    <div class="shimmer shimmer-text" style="width:90%;"></div>
    <div class="shimmer shimmer-text" style="width:75%;"></div>
  `;

  // Use the last 7 days of logs
  const last7DaysLogs = logs.slice(-7);
  const profile = getProfile();

  const insight = await generateWeeklyInsight(last7DaysLogs, profile);
  
  saveWeeklySummary(currentWeekKey, insight);
  container.innerHTML = `<p style="color:var(--text-primary); font-size:0.95rem; line-height:1.5;">${insight}</p>`;
}

function renderCharts() {
  const logs = getLogs();
  if (logs.length === 0) {
    document.getElementById('charts-container').style.display = 'none';
    document.getElementById('charts-empty-state').style.display = 'block';
    return;
  } else {
    document.getElementById('charts-container').style.display = 'block';
    document.getElementById('charts-empty-state').style.display = 'none';
  }

  const last14Logs = logs.slice(-14);
  const last7Logs = logs.slice(-7);
  const last30Logs = logs.slice(-30);

  // Destory existing charts to prevent memory leak / layout overlap
  if (chart1) chart1.destroy();
  if (chart2) chart2.destroy();
  if (chart3) chart3.destroy();
  if (chart4) chart4.destroy();

  // Chart 1: Daily Mood + Focus Trend (Line Chart)
  const ctx1 = document.getElementById('chart-mood-focus').getContext('2d');
  
  const focusMap = {
    "Couldn't focus": 1,
    "Scattered": 2,
    "Moderate": 3,
    "Sharp": 4,
    "In the zone": 5
  };

  chart1 = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: last14Logs.map(l => formatDateShort(l.date)),
      datasets: [
        {
          label: 'Mood Score (1-10)',
          data: last14Logs.map(l => l.mood),
          borderColor: '#6366F1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.3,
          yAxisID: 'y'
        },
        {
          label: 'Focus Quality (1-5)',
          data: last14Logs.map(l => focusMap[l.focus] || 3),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#94A3B8' } }
      },
      scales: {
        x: { grid: { color: '#334155' }, ticks: { color: '#94A3B8' } },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          min: 1,
          max: 10,
          grid: { color: '#334155' },
          ticks: { color: '#94A3B8' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 1,
          max: 5,
          grid: { drawOnChartArea: false },
          ticks: { color: '#94A3B8', stepSize: 1 }
        }
      }
    }
  });

  // Chart 2: Energy Pattern (Bar Chart)
  const ctx2 = document.getElementById('chart-energy').getContext('2d');
  const energyMap = { "Drained": 1, "Low": 2, "Okay": 3, "High": 4, "Charged": 5 };
  const energyColors = {
    1: '#EF4444', // Red
    2: '#F59E0B', // Amber
    3: '#EAB308', // Yellow
    4: '#10B981', // Green
    5: '#059669'  // Emerald
  };

  const energyVals = last7Logs.map(l => energyMap[l.energy] || 3);

  chart2 = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: last7Logs.map(l => formatDateShort(l.date)),
      datasets: [{
        label: 'Energy level (1-5)',
        data: energyVals,
        backgroundColor: energyVals.map(v => energyColors[v]),
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { color: '#334155' }, ticks: { color: '#94A3B8' } },
        y: { min: 1, max: 5, grid: { color: '#334155' }, ticks: { color: '#94A3B8', stepSize: 1 } }
      }
    }
  });

  // Extract stress triggers and positives from last 30 logs for frequency
  const triggerFreq = {};
  const positiveFreq = {};

  last30Logs.forEach(l => {
    (l.triggers || []).forEach(t => {
      const cleanT = t.toLowerCase().trim();
      if(cleanT) triggerFreq[cleanT] = (triggerFreq[cleanT] || 0) + 1;
    });
    (l.positives || []).forEach(p => {
      const cleanP = p.toLowerCase().trim();
      if(cleanP) positiveFreq[cleanP] = (positiveFreq[cleanP] || 0) + 1;
    });
  });

  // Render Horizontal Bar Chart for Triggers
  const triggerLabels = Object.keys(triggerFreq).sort((a,b) => triggerFreq[b] - triggerFreq[a]).slice(0, 5);
  const triggerData = triggerLabels.map(l => triggerFreq[l]);

  const ctx3 = document.getElementById('chart-stress-triggers').getContext('2d');
  chart3 = new Chart(ctx3, {
    type: 'bar',
    data: {
      labels: triggerLabels,
      datasets: [{
        label: 'Frequency',
        data: triggerData,
        backgroundColor: '#F59E0B',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { stepSize: 1, color: '#94A3B8' }, grid: { color: '#334155' } },
        y: { ticks: { color: '#94A3B8' }, grid: { display: false } }
      }
    }
  });

  // Render Horizontal Bar Chart for Positives
  const positiveLabels = Object.keys(positiveFreq).sort((a,b) => positiveFreq[b] - positiveFreq[a]).slice(0, 5);
  const positiveData = positiveLabels.map(l => positiveFreq[l]);

  const ctx4 = document.getElementById('chart-positives').getContext('2d');
  chart4 = new Chart(ctx4, {
    type: 'bar',
    data: {
      labels: positiveLabels,
      datasets: [{
        label: 'Frequency',
        data: positiveData,
        backgroundColor: '#10B981',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { stepSize: 1, color: '#94A3B8' }, grid: { color: '#334155' } },
        y: { ticks: { color: '#94A3B8' }, grid: { display: false } }
      }
    }
  });
}

function renderCalendar() {
  const container = document.getElementById('calendar-grid');
  container.innerHTML = '';

  const logs = getLogs();
  const logMap = {};
  logs.forEach(l => {
    logMap[l.date] = l;
  });

  // Generate last 30 calendar dates ending today
  const dates = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dates.push(d);
  }

  const moodColors = (mood) => {
    if (!mood) return '#334155'; // empty dot
    if (mood <= 3) return '#EF4444'; // bad
    if (mood <= 5) return '#F59E0B'; // low
    if (mood <= 7) return '#EAB308'; // okay
    if (mood <= 9) return '#10B981'; // good
    return '#6366F1'; // excellent
  };

  dates.forEach(d => {
    const dateStr = formatDateISO(d);
    const log = logMap[dateStr];
    
    const dot = document.createElement('button');
    dot.className = 'calendar-dot';
    dot.style.width = '24px';
    dot.style.height = '24px';
    dot.style.borderRadius = '50%';
    dot.style.border = 'none';
    dot.style.cursor = 'pointer';
    dot.style.backgroundColor = moodColors(log ? log.mood : null);
    dot.title = log ? `Date: ${dateStr}, Mood: ${log.mood}/10` : `No log for ${dateStr}`;

    dot.addEventListener('click', () => {
      showDayDetailModal(dateStr, log);
    });

    container.appendChild(dot);
  });
}

function showDayDetailModal(dateStr, log) {
  const modal = document.getElementById('custom-modal');
  const modalBody = document.getElementById('modal-body');
  
  if (!log) {
    modalBody.innerHTML = `
      <h3 style="margin-bottom:10px; color:var(--text-primary);">No Check-in</h3>
      <p style="color:var(--text-secondary); font-size:0.95rem;">You didn't log any check-in data for ${formatDateLabel(dateStr)}.</p>
    `;
  } else {
    modalBody.innerHTML = `
      <h3 style="margin-bottom:15px; color:var(--text-primary);">${formatDateLabel(dateStr)}</h3>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:15px; text-align:center;">
        <div style="background:var(--bg-primary); padding:8px; border-radius:8px;">
          <div style="font-size:0.7rem; color:var(--text-secondary);">Mood</div>
          <div style="font-weight:700; color:var(--accent-primary);">${log.mood}/10</div>
        </div>
        <div style="background:var(--bg-primary); padding:8px; border-radius:8px;">
          <div style="font-size:0.7rem; color:var(--text-secondary);">Energy</div>
          <div style="font-weight:600; color:var(--warning);">${log.energy}</div>
        </div>
        <div style="background:var(--bg-primary); padding:8px; border-radius:8px;">
          <div style="font-size:0.7rem; color:var(--text-secondary);">Focus</div>
          <div style="font-weight:600; color:var(--success);">${log.focus}</div>
        </div>
      </div>
      <div style="margin-bottom:15px;">
        <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:5px;">Journal Entry:</div>
        <p style="font-size:0.9rem; color:var(--text-primary); line-height:1.4; font-style:italic;">"${log.journal || 'No journal written'}"</p>
      </div>
      <div>
        <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:5px;">Triggers:</div>
        <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px;">
          ${(log.triggers || []).map(t => `<span style="background:rgba(245,158,11,0.2); color:#F59E0B; padding:3px 8px; border-radius:4px; font-size:0.75rem;">${t}</span>`).join('') || 'None'}
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:5px;">Positives:</div>
        <div style="display:flex; flex-wrap:wrap; gap:5px;">
          ${(log.positives || []).map(p => `<span style="background:rgba(16,185,129,0.2); color:#10B981; padding:3px 8px; border-radius:4px; font-size:0.75rem;">${p}</span>`).join('') || 'None'}
        </div>
      </div>
    `;
  }

  modal.classList.add('active');
}

function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${months[parseInt(m)-1]}`;
}

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${r}`;
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  return d.toLocaleDateString('en-IN', options);
}
