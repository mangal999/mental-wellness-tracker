/**
 * StudyMind Combined Client Scripts
 * Merged to bypass CORS file:// limits when double-clicking index.html
 */

// ==========================================
// 1. STORAGE UTILS (storage.js)
// ==========================================
const STORAGE_KEYS = {
  ONBOARDED: 'sm_onboarded',
  GEMINI_KEY: 'sm_gemini_key',
  PROFILE: 'sm_profile',
  LOGS: 'sm_logs',
  WEEKLY_SUMMARY: 'sm_weekly_summary'
};

function getGeminiKey() {
  return localStorage.getItem(STORAGE_KEYS.GEMINI_KEY) || '';
}

function saveGeminiKey(key) {
  localStorage.setItem(STORAGE_KEYS.GEMINI_KEY, key.trim());
}

function isOnboarded() {
  return localStorage.getItem(STORAGE_KEYS.ONBOARDED) === 'true';
}

function setOnboarded(val) {
  localStorage.setItem(STORAGE_KEYS.ONBOARDED, val ? 'true' : 'false');
}

function getProfile() {
  const profile = localStorage.getItem(STORAGE_KEYS.PROFILE);
  return profile ? JSON.parse(profile) : null;
}

function saveProfile(profile) {
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
}

function getLogs() {
  const logs = localStorage.getItem(STORAGE_KEYS.LOGS);
  return logs ? JSON.parse(logs) : [];
}

function saveLogs(logs) {
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
}

function getLogForDate(dateStr) {
  const logs = getLogs();
  return logs.find(log => log.date === dateStr) || null;
}

function saveLogForDate(dateStr, logData) {
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
  
  logs.sort((a, b) => new Date(a.date) - new Date(b.date));
  saveLogs(logs);
}

function getWeeklySummary() {
  const summary = localStorage.getItem(STORAGE_KEYS.WEEKLY_SUMMARY);
  return summary ? JSON.parse(summary) : null;
}

function saveWeeklySummary(weekKey, summaryText) {
  localStorage.setItem(STORAGE_KEYS.WEEKLY_SUMMARY, JSON.stringify({ weekKey, summary: summaryText }));
}

function getStreak() {
  const logs = getLogs();
  if (logs.length === 0) return 0;

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

  if (!logDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
    todayStr = formatDate(checkDate);
    if (!logDates.has(todayStr)) {
      return 0;
    }
  }

  while (logDates.has(formatDate(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

function getMoodComparison() {
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

function getBestDayThisMonth() {
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
      const combined = log.mood + focusVal * 2;
      if (combined > highestScore) {
        highestScore = combined;
        bestLog = log;
      }
    }
  });

  return bestLog;
}

function getWeekYearKey(d = new Date()) {
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

// ==========================================
// 2. GEMINI API SERVICE (gemini.js)
// ==========================================
function buildSystemPrompt(profile, moodHistory, todayEntry) {
  const exam = profile.exam || 'Competitive Exam';
  const examDate = profile.examDate || '';
  const name = profile.name || 'Student';

  let daysRemainingStr = '';
  if (examDate) {
    const diff = new Date(examDate) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    daysRemainingStr = days > 0 ? `${days} days remaining` : 'Exam date is passed/today';
  }

  let historyStr = '';
  if (moodHistory && moodHistory.length > 0) {
    historyStr = moodHistory.slice(-7).map(h => {
      return `- Date: ${h.date}, Mood: ${h.mood}/10, Energy: ${h.energy}, Focus: ${h.focus}, Journal: "${h.journal}"`;
    }).join('\n');
  } else {
    historyStr = 'No previous logs available.';
  }

  const todayStr = `- Mood: ${todayEntry.mood}/10, Energy: ${todayEntry.energy}, Focus: ${todayEntry.focus}, Journal: "${todayEntry.journal}"`;

  return `You are StudyMind, a calm and intelligent AI study companion for Indian competitive exam students. You are like a wise senior who has been through it all. Your job is to help the student understand exactly what is draining their energy or focus, explain the root cause clearly in simple language, and give them 2–3 specific, practical actions they can take today to feel better and study more effectively. Your advice must always be tailored to their exam type and what they wrote. You track patterns across days and call them out when you see them. You are warm but direct. You never give empty encouragement. You always end with one honest, powerful line that makes the student feel capable. Never mention doctors, therapy, or helplines. This is purely about helping them perform and feel better as a student.

Profile Details:
- Student Name: ${name}
- Exam Target: ${exam}
- Exam Date: ${examDate} (${daysRemainingStr})

Past 7 Days History:
${historyStr}

Today's Check-in:
${todayStr}

Format your response strictly under these 3 specific sections:
🔍 What's Going On
[Your root cause analysis of their mental focus, energy, and patterns over the past week. Be direct, clear, and highlight possible connections.]

🛠 What To Do Today
[2-3 concrete, exam-relevant physical or cognitive actions today based on their needs/routine/patterns. Reference their exam prep context specifically.]

✨ One Thing To Remember
[A single honest, powerful line of motivation tailored to their exact state today.]`;
}

async function streamGeminiChat(contents, systemInstruction, onChunk, onError) {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    onError(new Error("API Key is missing. Please set it in Settings/Onboarding."));
    return;
  }

  // Format Gemini-like history into standard Mistral chat messages
  const mistralMessages = [{ role: 'system', content: systemInstruction }];
  contents.forEach(item => {
    let roleName = item.role === 'model' ? 'assistant' : 'user';
    let textContent = item.parts?.[0]?.text || '';
    mistralMessages.push({ role: roleName, content: textContent });
  });

  const url = `https://api.mistral.ai/v1/chat/completions`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: mistralMessages,
        stream: true
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep partial line in buffer

      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned || cleaned === 'data: [DONE]') continue;
        if (cleaned.startsWith('data: ')) {
          try {
            const dataObj = JSON.parse(cleaned.substring(6));
            const contentPart = dataObj.choices?.[0]?.delta?.content;
            if (contentPart) {
              onChunk(contentPart);
            }
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    onError(err);
  }
}

async function extractTriggersAndPositives(journalText) {
  const apiKey = getGeminiKey();
  if (!apiKey) return { triggers: [], positives: [] };

  const url = `https://api.mistral.ai/v1/chat/completions`;

  const prompt = `From this journal entry, extract up to 4 stress triggers (things causing difficulty) and up to 3 positive factors (things that helped or went well). Return only a JSON object: { "triggers": [strings], "positives": [strings] }. Use short 2–4 word labels. If nothing is clearly positive, return empty array. Do not include markdown formatting like \`\`\`json. Return only the raw JSON.
  
  Journal Entry: "${journalText}"`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) throw new Error(`Extraction failed: ${response.status}`);
    const data = await response.json();
    const textResult = data.choices?.[0]?.message?.content;
    if (textResult) {
      return JSON.parse(textResult.trim());
    }
  } catch (e) {
    console.error("Failed trigger extraction:", e);
  }
  return { triggers: [], positives: [] };
}

async function generateWeeklyInsight(logs7Days, profile) {
  const apiKey = getGeminiKey();
  if (!apiKey) return "API Key is required to generate weekly insights.";

  const url = `https://api.mistral.ai/v1/chat/completions`;

  const logsStr = logs7Days.map(log => 
    `- Date: ${log.date}, Mood: ${log.mood}/10, Energy: ${log.energy}, Focus: ${log.focus}, Triggers: [${(log.triggers || []).join(', ')}], Positives: [${(log.positives || []).join(', ')}], Journal: "${log.journal}"`
  ).join('\n');

  const prompt = `You are StudyMind, a wise study mentor. Provide a short, powerful weekly insight analysis (max 120 words) for a student preparing for the ${profile.exam} exam, based on their last 7 days of logs.
  
  Format:
  - Paragraph 1: Highlight the biggest pattern (e.g. how energy and focus related) and the most recurring stress trigger.
  - Paragraph 2: One direct action recommendation and one encouraging line.
  
  Data:
  ${logsStr}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error("Weekly summary fetch failed");
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Unable to extract summary.";
  } catch (e) {
    console.error(e);
    return "Failed to load weekly analysis. Check your connection or API Key.";
  }
}

function splitJsonObjects(str) {
  const results = [];
  let braceCount = 0;
  let startIdx = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        if (braceCount === 0) startIdx = i;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && startIdx !== -1) {
          results.push(str.substring(startIdx, i + 1));
          startIdx = -1;
        }
      }
    }
  }
  return results;
}

// ==========================================
// 3. ONBOARDING (onboarding.js)
// ==========================================
function initOnboarding() {
  const steps = document.querySelectorAll('.onboarding-step');
  const btnNext = document.getElementById('ob-next');
  const btnPrev = document.getElementById('ob-prev');
  const stepDots = document.querySelectorAll('.ob-dot');
  let currentStep = 0;

  function showStep(idx) {
    steps.forEach((step, sIdx) => {
      step.classList.toggle('active', sIdx === idx);
    });
    stepDots.forEach((dot, dIdx) => {
      dot.classList.toggle('active', dIdx === idx);
    });

    if (idx === 0) {
      btnPrev.style.display = 'none';
      btnNext.innerText = 'Next';
    } else if (idx === steps.length - 1) {
      btnPrev.style.display = 'inline-flex';
      btnNext.innerText = 'Get Started';
    } else {
      btnPrev.style.display = 'inline-flex';
      btnNext.innerText = 'Next';
    }
  }

  btnNext.addEventListener('click', () => {
    if (currentStep < steps.length - 1) {
      if (currentStep === 1) {
        const name = document.getElementById('ob-name').value.trim();
        const exam = document.getElementById('ob-exam').value;
        const date = document.getElementById('ob-date').value;
        if (!name || !exam || !date) {
          alertModal("Please fill out your name, choose target exam, and pick target date.");
          return;
        }
      }
      if (currentStep === 2) {
        const key = document.getElementById('ob-key').value.trim();
        if (!key) {
          alertModal("Please enter your Gemini API Key. You can get a free one from Google AI Studio.");
          return;
        }
      }
      currentStep++;
      showStep(currentStep);
    } else {
      const name = document.getElementById('ob-name').value.trim();
      const exam = document.getElementById('ob-exam').value;
      const examDate = document.getElementById('ob-date').value;
      const geminiKey = document.getElementById('ob-key').value.trim();

      saveProfile({ name, exam, examDate });
      saveGeminiKey(geminiKey);
      setOnboarded(true);
      
      navigateTo('screen-home');
      document.getElementById('screen-onboarding').classList.remove('active');
      document.getElementById('main-nav').style.display = 'flex';
      window.location.reload();
    }
  });

  btnPrev.addEventListener('click', () => {
    if (currentStep > 0) {
      currentStep--;
      showStep(currentStep);
    }
  });

  showStep(0);
}

function alertModal(msg) {
  const modal = document.getElementById('custom-modal');
  const modalBody = document.getElementById('modal-body');
  modalBody.innerHTML = `<p>${msg}</p><button class="btn btn-primary btn-secondary" style="margin-top:20px;" id="modal-ok-btn">OK</button>`;
  modal.classList.add('active');
  document.getElementById('modal-ok-btn').addEventListener('click', () => {
    modal.classList.remove('active');
  });
}

// ==========================================
// 4. DAILY CHECK-IN (checkin.js)
// ==========================================
function initCheckin() {
  const moodSlider = document.getElementById('mood-slider');
  const emojiDisplay = document.getElementById('emoji-display');
  const energyButtons = document.querySelectorAll('#energy-group .btn-choice');
  const focusButtons = document.querySelectorAll('#focus-group .btn-choice');
  const journalInput = document.getElementById('journal-input');
  const charCounter = document.getElementById('char-counter');
  const checkinForm = document.getElementById('checkin-form');

  let selectedEnergy = '';
  let selectedFocus = '';

  const emojis = ['😰', '😟', '😐', '😐', '🙂', '🙂', '😊', '😊', '😊', '🔥'];

  moodSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    const emojiIdx = Math.min(Math.floor((val - 1)), emojis.length - 1);
    emojiDisplay.innerText = emojis[emojiIdx];
    emojiDisplay.classList.remove('emoji-bounce');
    void emojiDisplay.offsetWidth;
    emojiDisplay.classList.add('emoji-bounce');
  });

  energyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      energyButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedEnergy = btn.dataset.value;
    });
  });

  focusButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      focusButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFocus = btn.dataset.value;
    });
  });

  journalInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (val.length > 1200) {
      e.target.value = val.substring(0, 1200);
    }
    charCounter.innerText = `${e.target.value.length} / 1200`;
  });

  const todayStr = getTodayDateStr();
  const existingLog = getLogForDate(todayStr);

  if (existingLog) {
    showCompletedCheckinCard(existingLog);
  }

  checkinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedEnergy) {
      alertModal("Please select your energy level today.");
      return;
    }
    if (!selectedFocus) {
      alertModal("Please select your focus quality today.");
      return;
    }

    const moodVal = parseInt(moodSlider.value);
    const journalText = journalInput.value.trim();

    navigateTo('screen-chat');
    initChatWithTodayResponse({
      mood: moodVal,
      energy: selectedEnergy,
      focus: selectedFocus,
      journal: journalText
    });
  });
}

function getTodayDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${r}`;
}

function showCompletedCheckinCard(log) {
  const container = document.getElementById('checkin-container');
  container.innerHTML = `
    <div class="card fade-in">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
        <h3 style="font-size:1.1rem; color:var(--text-primary);">Today's Check-in Complete</h3>
        <span style="font-size:1.5rem;">✨</span>
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:15px; text-align:center;">
        <div style="background:var(--bg-primary); padding:10px; border-radius:8px;">
          <div style="font-size:0.75rem; color:var(--text-secondary);">Mood</div>
          <div style="font-size:1.2rem; font-weight:700; margin-top:5px; color:var(--accent-primary);">${log.mood}/10</div>
        </div>
        <div style="background:var(--bg-primary); padding:10px; border-radius:8px;">
          <div style="font-size:0.75rem; color:var(--text-secondary);">Energy</div>
          <div style="font-size:0.95rem; font-weight:600; margin-top:8px; color:var(--warning);">${log.energy}</div>
        </div>
        <div style="background:var(--bg-primary); padding:10px; border-radius:8px;">
          <div style="font-size:0.75rem; color:var(--text-secondary);">Focus</div>
          <div style="font-size:0.95rem; font-weight:600; margin-top:8px; color:var(--success);">${log.focus}</div>
        </div>
      </div>
      ${log.journal ? `<p style="font-size:0.9rem; color:var(--text-secondary); line-height:1.4; margin-bottom:15px; font-style:italic;">"${log.journal}"</p>` : ''}
      <button class="btn btn-primary" id="btn-continue-chat">Continue Chatting</button>
    </div>
  `;

  document.getElementById('btn-continue-chat').addEventListener('click', () => {
    navigateTo('screen-chat');
    initChatWithTodayResponse(log, true);
  });
}

// ==========================================
// 5. CHAT SCREEN (chat.js)
// ==========================================
let sessionChatHistory = [];
let currentSystemPrompt = '';

function initChatWithTodayResponse(todayEntry, isExisting = false) {
  const container = document.getElementById('chat-response-container');
  const chatInterface = document.getElementById('chat-interactive-interface');
  const chatInput = document.getElementById('chat-user-message');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const chatHistoryContainer = document.getElementById('chat-history');

  chatHistoryContainer.innerHTML = '';
  chatInterface.style.display = 'none';
  sessionChatHistory = [];

  container.innerHTML = `
    <div id="ai-loading-shimmer" class="card">
      <div class="shimmer shimmer-title"></div>
      <div class="shimmer shimmer-text"></div>
      <div class="shimmer shimmer-text" style="width: 80%;"></div>
      <br>
      <div class="shimmer shimmer-title" style="width: 40%;"></div>
      <div class="shimmer shimmer-text"></div>
      <div class="shimmer shimmer-text" style="width: 70%;"></div>
    </div>
    <div id="ai-streamed-response" style="display:none;">
      <div class="ai-section card" id="section-whatsgoingon">
        <div class="ai-section-title">🔍 What's Going On</div>
        <div class="ai-section-body" id="body-whatsgoingon"></div>
      </div>
      <div class="ai-section card" id="section-whattodo">
        <div class="ai-section-title">🛠 What To Do Today</div>
        <div class="ai-section-body" id="body-whattodo"></div>
      </div>
      <div class="ai-section card" id="section-remember">
        <div class="ai-section-title">✨ One Thing To Remember</div>
        <div class="ai-section-body" id="body-remember" style="font-weight: 500; font-style: italic; color: var(--text-primary);"></div>
      </div>
    </div>
    <div id="ai-error-container" style="display:none;"></div>
  `;

  if (isExisting) {
    document.getElementById('ai-loading-shimmer').style.display = 'none';
    document.getElementById('ai-streamed-response').style.display = 'block';
    parseAndDistributeResponse(todayEntry.aiResponse);
    chatInterface.style.display = 'block';
    setupInteractiveChat(todayEntry);
    return;
  }

  const profile = getProfile();
  const logs = getLogs();
  const todayStr = getTodayDateStr();
  const historyLogs = logs.filter(log => log.date !== todayStr);

  currentSystemPrompt = buildSystemPrompt(profile, historyLogs, todayEntry);

  const contents = [{ role: 'user', parts: [{ text: "Analyze my status and give me guidance." }] }];
  let accumulatedResponse = '';

  document.getElementById('ai-loading-shimmer').style.display = 'block';

  streamGeminiChat(
    contents,
    currentSystemPrompt,
    (chunk) => {
      const shimmer = document.getElementById('ai-loading-shimmer');
      if (shimmer && shimmer.style.display !== 'none') {
        shimmer.style.display = 'none';
        document.getElementById('ai-streamed-response').style.display = 'block';
      }
      accumulatedResponse += chunk;
      parseAndDistributeResponse(accumulatedResponse);
    },
    async (error) => {
      console.error(error);
      const loadingShimmer = document.getElementById('ai-loading-shimmer');
      if (loadingShimmer) loadingShimmer.style.display = 'none';
      const errorCard = document.getElementById('ai-error-container');
      errorCard.style.display = 'block';
      errorCard.innerHTML = `
        <div class="error-card">
          <p>Unable to connect with StudyMind AI. Check your API Key or Network status.</p>
          <div style="margin: 15px 0; text-align: left;">
            <label for="error-api-key" style="font-size: 0.8rem; color: var(--text-secondary);">Update Mistral API Key</label>
            <input type="password" id="error-api-key" placeholder="Enter key..." style="margin-bottom:10px; width: 100%;">
            <button class="btn btn-primary" id="error-save-key-btn" style="padding: 8px 16px; font-size: 0.85rem; width: auto;">Save Key</button>
          </div>
          <button class="btn btn-primary btn-secondary" id="retry-btn">Try Again</button>
        </div>
      `;
      const errKeyInput = document.getElementById('error-api-key');
      if (errKeyInput) {
        errKeyInput.value = getGeminiKey();
      }
      document.getElementById('error-save-key-btn').addEventListener('click', () => {
        const newKey = errKeyInput.value.trim();
        if (newKey) {
          saveGeminiKey(newKey);
          alertModal("API Key updated successfully!");
        }
      });
      document.getElementById('retry-btn').addEventListener('click', () => {
        initChatWithTodayResponse(todayEntry, isExisting);
      });
    }
  ).then(async () => {
    if (accumulatedResponse) {
      const extractions = await extractTriggersAndPositives(todayEntry.journal);
      const completeLog = {
        ...todayEntry,
        aiResponse: accumulatedResponse,
        triggers: extractions.triggers || [],
        positives: extractions.positives || []
      };
      saveLogForDate(todayStr, completeLog);
      chatInterface.style.display = 'block';
      setupInteractiveChat(completeLog);
    }
  });
}

function parseAndDistributeResponse(text) {
  const whatsGoingOnIdx = text.indexOf("🔍 What's Going On");
  const whatToDoIdx = text.indexOf("🛠 What To Do Today");
  const rememberIdx = text.indexOf("✨ One Thing To Remember");

  let whatsGoingOnContent = '';
  let whatToDoContent = '';
  let rememberContent = '';

  const clean = (str) => str.replace(/^(🔍 What's Going On|🛠 What To Do Today|✨ One Thing To Remember)/i, '').trim();

  if (whatsGoingOnIdx !== -1) {
    const end = (whatToDoIdx !== -1) ? whatToDoIdx : (rememberIdx !== -1 ? rememberIdx : text.length);
    whatsGoingOnContent = clean(text.substring(whatsGoingOnIdx, end));
  } else {
    whatsGoingOnContent = text;
  }

  if (whatToDoIdx !== -1) {
    const end = (rememberIdx !== -1) ? rememberIdx : text.length;
    whatToDoContent = clean(text.substring(whatToDoIdx, end));
  }

  if (rememberIdx !== -1) {
    rememberContent = clean(text.substring(rememberIdx));
  }

  const body1 = document.getElementById('body-whatsgoingon');
  const body2 = document.getElementById('body-whattodo');
  const body3 = document.getElementById('body-remember');

  if (body1) body1.innerHTML = formatMarkdown(whatsGoingOnContent);
  if (body2) body2.innerHTML = formatMarkdown(whatToDoContent);
  if (body3) body3.innerHTML = formatMarkdown(rememberContent);
}

function setupInteractiveChat(todayLog) {
  const chatInput = document.getElementById('chat-user-message');
  const chatSendBtn = document.getElementById('chat-send-btn');
  
  const newSendBtn = chatSendBtn.cloneNode(true);
  chatSendBtn.parentNode.replaceChild(newSendBtn, chatSendBtn);

  sessionChatHistory = [
    { role: 'user', parts: [{ text: `Today I submitted mood: ${todayLog.mood}, focus: ${todayLog.focus}, energy: ${todayLog.energy}, journal: "${todayLog.journal}".` }] },
    { role: 'model', parts: [{ text: todayLog.aiResponse }] }
  ];

  const handleSendMessage = () => {
    const text = chatInput.value.trim();
    if (!text) return;

    appendChatBubble('user', text);
    chatInput.value = '';
    sessionChatHistory.push({ role: 'user', parts: [{ text: text }] });

    const aiBubble = appendChatBubble('ai', '...');
    let answerText = '';

    streamGeminiChat(
      sessionChatHistory,
      currentSystemPrompt || buildSystemPrompt(getProfile(), getLogs().filter(l => l.date !== todayLog.date), todayLog),
      (chunk) => {
        if (aiBubble.innerText === '...') aiBubble.innerHTML = '';
        answerText += chunk;
        aiBubble.innerHTML = formatMarkdown(answerText);
        const chatHist = document.getElementById('chat-history');
        chatHist.scrollTop = chatHist.scrollHeight;
      },
      (err) => {
        aiBubble.innerText = "StudyMind failed to respond. Let's try again.";
      }
    ).then(() => {
      if (answerText) {
        sessionChatHistory.push({ role: 'model', parts: [{ text: answerText }] });
      }
    });
  };

  newSendBtn.addEventListener('click', handleSendMessage);
  chatInput.onkeydown = (e) => {
    if (e.key === 'Enter') handleSendMessage();
  };
}

function appendChatBubble(sender, text) {
  const chatHistoryContainer = document.getElementById('chat-history');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender} fade-in`;
  bubble.innerHTML = formatMarkdown(text);
  chatHistoryContainer.appendChild(bubble);
  chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
  return bubble;
}

function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*?)$/gm, '• $1')
    .replace(/\n/g, '<br>');
}

// ==========================================
// 6. DASHBOARD (dashboard.js)
// ==========================================
let chart1 = null;
let chart2 = null;
let chart3 = null;
let chart4 = null;

function initDashboard() {
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
  
  const moodDiffSpan = document.getElementById('stat-mood-diff');
  if (comparison.diff > 0) {
    moodDiffSpan.innerHTML = `<span style="color:var(--success);">▲ +${comparison.diff}</span> vs last week`;
  } else if (comparison.diff < 0) {
    moodDiffSpan.innerHTML = `<span style="color:var(--error);">▼ ${comparison.diff}</span> vs last week`;
  } else {
    moodDiffSpan.innerHTML = `No change vs last week`;
  }

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

  container.innerHTML = `
    <div class="shimmer shimmer-text" style="width:100%;"></div>
    <div class="shimmer shimmer-text" style="width:90%;"></div>
    <div class="shimmer shimmer-text" style="width:75%;"></div>
  `;

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

  if (chart1) chart1.destroy();
  if (chart2) chart2.destroy();
  if (chart3) chart3.destroy();
  if (chart4) chart4.destroy();

  const ctx1 = document.getElementById('chart-mood-focus').getContext('2d');
  const focusMap = { "Couldn't focus": 1, "Scattered": 2, "Moderate": 3, "Sharp": 4, "In the zone": 5 };

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
      plugins: { legend: { labels: { color: '#94A3B8' } } },
      scales: {
        x: { grid: { color: '#334155' }, ticks: { color: '#94A3B8' } },
        y: { type: 'linear', display: true, position: 'left', min: 1, max: 10, grid: { color: '#334155' }, ticks: { color: '#94A3B8' } },
        y1: { type: 'linear', display: true, position: 'right', min: 1, max: 5, grid: { drawOnChartArea: false }, ticks: { color: '#94A3B8', stepSize: 1 } }
      }
    }
  });

  const ctx2 = document.getElementById('chart-energy').getContext('2d');
  const energyMap = { "Drained": 1, "Low": 2, "Okay": 3, "High": 4, "Charged": 5 };
  const energyColors = { 1: '#EF4444', 2: '#F59E0B', 3: '#EAB308', 4: '#10B981', 5: '#059669' };
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
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#334155' }, ticks: { color: '#94A3B8' } },
        y: { min: 1, max: 5, grid: { color: '#334155' }, ticks: { color: '#94A3B8', stepSize: 1 } }
      }
    }
  });

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

  const triggerLabels = Object.keys(triggerFreq).sort((a,b) => triggerFreq[b] - triggerFreq[a]).slice(0, 5);
  const triggerData = triggerLabels.map(l => triggerFreq[l]);

  const ctx3 = document.getElementById('chart-stress-triggers').getContext('2d');
  chart3 = new Chart(ctx3, {
    type: 'bar',
    data: {
      labels: triggerLabels,
      datasets: [{ label: 'Frequency', data: triggerData, backgroundColor: '#F59E0B', borderRadius: 4 }]
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

  const positiveLabels = Object.keys(positiveFreq).sort((a,b) => positiveFreq[b] - positiveFreq[a]).slice(0, 5);
  const positiveData = positiveLabels.map(l => positiveFreq[l]);

  const ctx4 = document.getElementById('chart-positives').getContext('2d');
  chart4 = new Chart(ctx4, {
    type: 'bar',
    data: {
      labels: positiveLabels,
      datasets: [{ label: 'Frequency', data: positiveData, backgroundColor: '#10B981', borderRadius: 4 }]
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
  logs.forEach(l => { logMap[l.date] = l; });

  const dates = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dates.push(d);
  }

  const moodColors = (mood) => {
    if (!mood) return '#334155';
    if (mood <= 3) return '#EF4444';
    if (mood <= 5) return '#F59E0B';
    if (mood <= 7) return '#EAB308';
    if (mood <= 9) return '#10B981';
    return '#6366F1';
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

    dot.addEventListener('click', () => { showDayDetailModal(dateStr, log); });
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

// ==========================================
// 7. MAIN CONTROLLER & ROUTER (app.js + library)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  if (!isOnboarded() || !getGeminiKey()) {
    showOnboardingFlow();
  } else {
    document.getElementById('screen-onboarding').classList.remove('active');
    document.getElementById('main-nav').style.display = 'flex';
    setupNavigation();
    navigateTo('screen-home');
    initCheckin();
  }

  document.getElementById('modal-close-btn').addEventListener('click', () => {
    document.getElementById('custom-modal').classList.remove('active');
  });

  const apiKeyInput = document.getElementById('settings-api-key');
  const saveApiKeyBtn = document.getElementById('btn-save-api-key');
  if (apiKeyInput) {
    apiKeyInput.value = getGeminiKey(); // reads storage sm_gemini_key
  }
  if (saveApiKeyBtn && apiKeyInput) {
    saveApiKeyBtn.addEventListener('click', () => {
      const newKey = apiKeyInput.value.trim();
      if (!newKey) {
        alertModal("Please enter a valid API key.");
        return;
      }
      saveGeminiKey(newKey);
      alertModal("API Key updated successfully!");
    });
  }

  const resetBtn = document.getElementById('btn-reset-app');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm("Are you sure you want to reset StudyMind? All your local logs and settings will be deleted.")) {
        localStorage.clear();
        window.location.reload();
      }
    });
  }
}

function showOnboardingFlow() {
  document.getElementById('screen-onboarding').classList.add('active');
  document.getElementById('main-nav').style.display = 'none';
  initOnboarding();
}

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetScreenId = item.dataset.target;
      if (!targetScreenId) return;

      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      navigateTo(targetScreenId);

      if (targetScreenId === 'screen-home') {
        initCheckin();
      } else if (targetScreenId === 'screen-dashboard') {
        initDashboard();
      } else if (targetScreenId === 'screen-library') {
        renderLibrary();
      }
    });
  });
}

function navigateTo(screenId) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => {
    if (screen.id === screenId) {
      screen.classList.add('active');
    } else {
      screen.classList.remove('active');
    }
  });
}

function renderLibrary() {
  const profile = getProfile();
  const examType = profile ? profile.exam : 'NEET';
  const libraryContent = document.getElementById('library-accordion-container');
  
  document.getElementById('library-exam-title').innerText = `${examType} Resources`;
  const examData = LIBRARY_DATA[examType] || LIBRARY_DATA.NEET;
  
  libraryContent.innerHTML = `
    ${renderAccordionSection('Focus Techniques', 'focus', examData.focus)}
    ${renderAccordionSection('Energy Management', 'energy', examData.energy)}
    ${renderAccordionSection('Stress Release', 'stress', examData.stress)}
    ${renderAccordionSection('Study Strategy', 'strategy', examData.strategy)}
    ${renderAccordionSection('Mind Reset', 'reset', examData.reset)}
  `;

  const accordions = libraryContent.querySelectorAll('.accordion');
  accordions.forEach(acc => {
    const header = acc.querySelector('.accordion-header');
    header.addEventListener('click', () => {
      const isActive = acc.classList.contains('active');
      accordions.forEach(a => a.classList.remove('active'));
      if (!isActive) acc.classList.add('active');
    });
  });
}

function renderAccordionSection(title, type, items) {
  if (!items || items.length === 0) return '';
  const itemsHtml = items.map(item => `
    <div style="margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 15px;">
      <h4 style="color:var(--text-primary); font-size:1rem; margin-bottom:8px;">${item.title}</h4>
      <ul style="margin-left: 20px; color:var(--text-secondary); margin-bottom: 12px; font-size:0.9rem; display:flex; flex-direction:column; gap:6px;">
        ${item.bullets.map(b => `<li>${b}</li>`).join('')}
      </ul>
      <div style="background:rgba(99, 102, 241, 0.15); border-left:3px solid var(--accent-primary); padding:10px; border-radius:4px;">
        <span style="font-size:0.75rem; text-transform:uppercase; color:var(--accent-primary); font-weight:700; display:block; margin-bottom:3px;">Try this today</span>
        <p style="font-size:0.85rem; color:var(--text-primary); margin:0;">${item.tryThis}</p>
      </div>
    </div>
  `).join('');

  return `
    <div class="accordion">
      <div class="accordion-header">${title}</div>
      <div class="accordion-content">${itemsHtml}</div>
    </div>
  `;
}
/**
 * Library Content structured resource library mapping
 */

const LIBRARY_DATA = {
  // NEET specific recommendations
  NEET: {
    focus: [
      {
        title: "Active Recall for Biology Diagrams",
        bullets: [
          "Cover diagram labels with sticky notes.",
          "Redraw pathways from memory without looking at reference.",
          "Explain mechanism processes to a classmate or out loud.",
          "Identify and correct errors immediately."
        ],
        tryThis: "Label the heart circulatory path from memory right now on a blank paper."
      },
      {
        title: "NEET Pomodoro Adaptation",
        bullets: [
          "45 mins study (mimicking NEET section length) + 10 mins physical reset.",
          "Do not check your phone during the break.",
          "Focus entirely on one subject (e.g. Physics formulas) in a block.",
          "Track completed cycles in a notebook."
        ],
        tryThis: "Complete 1 cycle of 45-mins focusing purely on chemistry mechanisms."
      }
    ],
    energy: [
      {
        title: "Physiological Reset for Long Study Hours",
        bullets: [
          "Stand up and stretch your hamstrings every 90 minutes.",
          "Drink 300ml water at the start of every session.",
          "Avoid heavy carbohydrate meals before mock tests.",
          "Get morning sunlight for 10 minutes before starting."
        ],
        tryThis: "Take a deep breath, stand up, and stretch towards your toes for 30 seconds."
      }
    ],
    stress: [
      {
        title: "Decompressing Concept Overload",
        bullets: [
          "Write down the three concepts causing anxiety right now.",
          "Break each into tiny 10-minute revision units.",
          "Remind yourself: learning takes repetition, it is normal to forget.",
          "Do a 4-7-8 breathing cycle for 2 minutes."
        ],
        tryThis: "Do 3 cycles of 4-7-8 breathing: Inhale for 4s, Hold for 7s, Exhale for 8s."
      }
    ],
    strategy: [
      {
        title: "Weak Subject Physics Management",
        bullets: [
          "Solve 10 MCQ problems from weak chapters first thing in the morning.",
          "Keep a dedicated formula error log book.",
          "Focus on direct application formulas rather than complex derivations.",
          "Analyze wrong answers carefully before moving on."
        ],
        tryThis: "Open your error log and review the last 3 wrong questions."
      }
    ],
    reset: [
      {
        title: "Brain Reset after a Failed Mock Test",
        bullets: [
          "Close the books. Step away from your desk completely.",
          "Remember: a mock test is a diagnostic tool, not the final verdict.",
          "Write down the exact topics you got wrong without judgment.",
          "Walk for 15 minutes before opening any book again."
        ],
        tryThis: "Take a 15-minute walk outside without headphones."
      }
    ]
  },

  // JEE specific recommendations
  JEE: {
    focus: [
      {
        title: "Deep Problem Solving Sprints",
        bullets: [
          "Set a timer for 60 minutes.",
          "Choose 15 tough JEE Advanced-level math/physics problems.",
          "Focus entirely on structure/logic of the solution rather than speed.",
          "Write down any key tricks or insights learned."
        ],
        tryThis: "Spend 30 minutes solving 5 integration problems without looking at solutions."
      },
      {
        title: "Active Revision for Chemistry Equations",
        bullets: [
          "Create visual mechanism maps for Organic chemistry.",
          "Test yourself on naming reactions in reverse order.",
          "Review inorganic properties tables daily for 15 minutes.",
          "Explain the coordination chemistry rules to your room walls."
        ],
        tryThis: "Write down the reaction mechanisms for Aldol condensation from memory."
      }
    ],
    energy: [
      {
        title: "Physical Energy for JEE Marathon Sessions",
        bullets: [
          "Hydrate well; dehydration lowers your problem-solving accuracy.",
          "Keep posture erect to avoid screen fatigue.",
          "Do a 2-minute dynamic arm swing reset during study transitions.",
          "Limit caffeine intake past 4 PM to protect deep sleep."
        ],
        tryThis: "Roll your shoulders backward 10 times and drink a glass of water."
      }
    ],
    stress: [
      {
        title: "Relieving Aptitude Anxiety",
        bullets: [
          "Acknowledge that initial steps in tough math problems often fail.",
          "Use a scratch pad to brain-dump half-baked thoughts; don't do it in head.",
          "Keep physical workspace clean to lower cognitive load.",
          "Take a deep breath and let go of comparison with top scorers."
        ],
        tryThis: "Write down 2 complex topics you've successfully learned so far."
      }
    ],
    strategy: [
      {
        title: "JEE Mock Analysis Protocol",
        bullets: [
          "Classify mistakes into: Silly errors, Conceptual gaps, or Time issues.",
          "Solve every missed question yourself without checking the key first.",
          "Redo the calculations for wrong questions slowly.",
          "Review formulas for the most-tested topics weekly."
        ],
        tryThis: "Review your latest mock paper and identify 3 silly mistakes."
      }
    ],
    reset: [
      {
        title: "Emergency Reset on Burnout",
        bullets: [
          "If equations start blurring, shut down your laptop/books.",
          "Do a physical chore (wash dishes, arrange room) for 15 minutes.",
          "Unplug from Telegram study groups for 24 hours.",
          "Rest your eyes in a dark room for 10 minutes."
        ],
        tryThis: "Close your eyes and sit silently in complete darkness for 5 minutes."
      }
    ]
  },

  // CAT specific recommendations
  CAT: {
    focus: [
      {
        title: "Reading Comprehension Stamina",
        bullets: [
          "Read 1 editorial (Aeon or The Hindu) without looking away once.",
          "Summarize key arguments in 1 sentence immediately after reading.",
          "Track reading speed and focus dips.",
          "Do not re-read sentences; practice trust in initial scanning."
        ],
        tryThis: "Read a long article now and write down its core thesis in 10 words."
      },
      {
        title: "Data Interpretation Focus Sprints",
        bullets: [
          "Solve 2 complex DILR sets under strict time limit (24 mins).",
          "Ensure zero distractions; put phone in another room.",
          "Read table headers and footnote constraints very carefully first.",
          "Write clean, organized notes on scratch sheets."
        ],
        tryThis: "Set timer for 12 minutes and crack one complex logical reasoning grid."
      }
    ],
    energy: [
      {
        title: "Cognitive Stamina Management",
        bullets: [
          "CAT is a speed & aptitude test; mental agility requires premium sleep.",
          "Avoid sugar crashes; eat whole foods or nuts during prep intervals.",
          "Keep your eyes fresh by looking at distant objects every 20 mins.",
          "Stand up and do 10 squats to boost brain blood flow."
        ],
        tryThis: "Stand up and perform 10 bodyweight squats to recharge blood flow."
      }
    ],
    stress: [
      {
        title: "Coping with Time Pressure Panic",
        bullets: [
          "Remind yourself: you do not need to solve all questions to get 99 percentile.",
          "Practice the art of 'skipping' hard questions instantly (under 45s).",
          "Perform 3 belly breaths when you see the timer running red.",
          "Normalize mock scores fluctuations; focus on process."
        ],
        tryThis: "Solve 5 QA questions, forcing yourself to skip any that takes over 1 minute."
      }
    ],
    strategy: [
      {
        title: "DILR & QA Selection Strategy",
        bullets: [
          "Spend the first 2 minutes scanning sets to rank them by difficulty.",
          "Choose the easiest set first to build momentum.",
          "Keep an error log of shortcuts you forgot under stress.",
          "Revise formula templates for speed arithmetic daily."
        ],
        tryThis: "Revise your percentage-to-fraction conversions chart now."
      }
    ],
    reset: [
      {
        title: "Burnout Reset for Working Aspirants",
        bullets: [
          "If balancing office and CAT prep is draining, take a 1-day study break.",
          "Sleep for 8 solid hours without alarms if possible.",
          "Do some light aerobic exercise (jogging, cycling).",
          "Re-align goals: slow consistency beats weekend cramming."
        ],
        tryThis: "Turn off all study reminders and commit to a 8-hour deep sleep tonight."
      }
    ]
  },

  // CUET specific recommendations
  CUET: {
    focus: [
      {
        title: "Active Learning for Domain Subjects",
        bullets: [
          "Summarize NCERT chapters into bulleted index cards.",
          "Practice matching questions from previous years' trends.",
          "Explain concepts to a peer using simple metaphors.",
          "Self-test on definitions and timelines."
        ],
        tryThis: "Draft a 5-bullet summary of a key domain chapter from memory."
      }
    ],
    energy: [
      {
        title: "Sustaining High Energy",
        bullets: [
          "Drink clean water and avoid sugary drinks.",
          "Get at least 7.5 hours of sleep to consolidate NCERT facts.",
          "Take a 5-minute movement break every 40 minutes.",
          "Eat fresh fruit before study sessions."
        ],
        tryThis: "Eat a serving of fresh fruit or nuts to fuel your next study block."
      }
    ],
    stress: [
      {
        title: "Handling Syllabus Breadth",
        bullets: [
          "List down the chapters you need to cover.",
          "Focus on one chapter at a time; ignore the bulk of the list.",
          "Practice deep breathing when feeling overwhelmed.",
          "Celebrate completing small, daily study goals."
        ],
        tryThis: "Write down the single most important chapter to read tomorrow and block out everything else."
      }
    ],
    strategy: [
      {
        title: "General Test & Language Strategy",
        bullets: [
          "Practice vocabulary cards daily for 15 minutes.",
          "Solve 10 reasoning questions to improve speed.",
          "Analyze incorrect options to understand standard traps.",
          "Review basic grammar rules regularly."
        ],
        tryThis: "Solve 5 quick logical reasoning questions right now."
      }
    ],
    reset: [
      {
        title: "Quick Reset on Stress",
        bullets: [
          "Step away from your desk and sit in a comfortable spot.",
          "Do a 3-minute mindfulness breathing exercise.",
          "Listen to a relaxing instrumental track.",
          "Wash your face with cold water to refresh your senses."
        ],
        tryThis: "Wash your face with cold water and stretch your neck."
      }
    ]
  },

  // GATE specific recommendations
  GATE: {
    focus: [
      {
        title: "Technical Calculation Focus Sprints",
        bullets: [
          "Solve 10 numerical answer type (NAT) questions under strict time limits.",
          "Double-check units and decimals carefully before calculating.",
          "Draft logical steps neatly on paper to avoid calculation errors.",
          "Limit use of Virtual Calculator to simulate actual exam environment."
        ],
        tryThis: "Solve 5 numerical questions using only the official GATE virtual calculator app."
      }
    ],
    energy: [
      {
        title: "Stamina for Complex Calculations",
        bullets: [
          "Keep physical workspace uncluttered to lower cognitive load.",
          "Take a 5-minute walking break after every 50 minutes of calculation.",
          "Eat complex carbohydrates to maintain steady brain energy.",
          "Maintain a consistent sleep-wake schedule."
        ],
        tryThis: "Stand up and walk around for 5 minutes, focusing on distant objects."
      }
    ],
    stress: [
      {
        title: "Managing Math & Analytical Stress",
        bullets: [
          "Remind yourself: solving core engineering questions requires patience.",
          "Keep an error log of calculation slip-ups and unit mistakes.",
          "Take slow, deep breaths to restore concentration when stuck.",
          "Focus on mastering fundamental concepts rather than memorizing formulas."
        ],
        tryThis: "Review your formula notes for 10 minutes and list the 3 you most often forget."
      }
    ],
    strategy: [
      {
        title: "Virtual Calculator Mastery",
        bullets: [
          "Practice standard math operations exclusively on the virtual calculator.",
          "Develop speed in entering equations with brackets and parentheses.",
          "Avoid manual calculation shortcuts that might introduce errors.",
          "Optimize question selection: attempt high-scoring technical questions first."
        ],
        tryThis: "Compute a complex fractions/exponential equation on the virtual calculator."
      }
    ],
    reset: [
      {
        title: "Reset After an Overwhelming Study Block",
        bullets: [
          "Leave your desk and do a light physical task.",
          "Rest your eyes and focus on breathing slowly.",
          "Unplug from online forums and study discussions for a few hours.",
          "Re-evaluate your study plan and break it down into smaller steps."
        ],
        tryThis: "Sit in a quiet space and take 10 slow, deep belly breaths."
      }
    ]
  },

  // UPSC specific recommendations
  UPSC: {
    focus: [
      {
        title: "Long-haul Consistency & Focus",
        bullets: [
          "Use a structured Pomodoro pattern (50 mins study / 10 mins break).",
          "Read current affairs with active note-taking (mind-maps).",
          "Avoid multitasking; focus on one GS paper per session.",
          "Maintain a clean, organized study space."
        ],
        tryThis: "Set a timer for 50 minutes and read one standard GS text without checking notifications."
      }
    ],
    energy: [
      {
        title: "Sustained Stamina for Long Days",
        bullets: [
          "Get 7-8 hours of quality sleep to retain facts and logic.",
          "Stay hydrated and take short walks during breaks.",
          "Incorporate light exercise or yoga into your daily routine.",
          "Eat nutritious, balanced meals to prevent fatigue."
        ],
        tryThis: "Drink a tall glass of water and stretch your spine for 1 minute."
      }
    ],
    stress: [
      {
        title: "Handling Syllabus Overwhelm",
        bullets: [
          "Focus on standard sources; avoid collecting excessive study material.",
          "Break down major subjects into daily, manageable tasks.",
          "Practice daily journaling to vent anxieties and maintain clarity.",
          "Remember that consistency is key; small efforts add up."
        ],
        tryThis: "Write down the single most important topic to cover tomorrow and hide other books."
      }
    ],
    strategy: [
      {
        title: "Answer Writing and Revision",
        bullets: [
          "Write 1 high-quality GS answer daily and self-evaluate.",
          "Revise core subjects (Polity, History, Economy) periodically.",
          "Focus on connecting current affairs with static syllabus concepts.",
          "Use flowcharts and diagrams to structure answers effectively."
        ],
        tryThis: "Write a 150-word answer on a current topic and review it against standard guidelines."
      }
    ],
    reset: [
      {
        title: "Quick Reset on Burnout",
        bullets: [
          "Shut your books and take a complete break for a few hours.",
          "Engage in a hobby or walk in nature without thinking about the exam.",
          "Connect with supportive friends or family members.",
          "Remind yourself of your initial motivation and purpose."
        ],
        tryThis: "Step away from your desk and sit quietly with a hot beverage, enjoying the moment."
      }
    ]
  }
};
