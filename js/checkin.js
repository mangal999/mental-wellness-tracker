/**
 * Daily Check-in screen controller
 */

import { getLogForDate, saveLogForDate, getProfile, getLogs } from './storage.js';
import { extractTriggersAndPositives, buildSystemPrompt } from './gemini.js';
import { alertModal } from './onboarding.js';
import { initChatWithTodayResponse } from './chat.js';
import { navigateTo } from './app.js';

export function initCheckin() {
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

  // Handle Mood Slider Change
  moodSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    const emojiIdx = Math.min(Math.floor((val - 1)), emojis.length - 1);
    emojiDisplay.innerText = emojis[emojiIdx];
    emojiDisplay.classList.remove('emoji-bounce');
    void emojiDisplay.offsetWidth; // Trigger reflow
    emojiDisplay.classList.add('emoji-bounce');
  });

  // Handle Energy Select
  energyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      energyButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedEnergy = btn.dataset.value;
    });
  });

  // Handle Focus Select
  focusButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      focusButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFocus = btn.dataset.value;
    });
  });

  // Handle Journal Word limit
  journalInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (val.length > 1200) {
      e.target.value = val.substring(0, 1200);
    }
    charCounter.innerText = `${e.target.value.length} / 1200`;
  });

  // Check today's checkin status
  const todayStr = getTodayDateStr();
  const existingLog = getLogForDate(todayStr);

  if (existingLog) {
    showCompletedCheckinCard(existingLog);
  }

  // Handle Form Submission
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

    // Show AI loading state transition
    navigateTo('screen-chat');
    initChatWithTodayResponse({
      mood: moodVal,
      energy: selectedEnergy,
      focus: selectedFocus,
      journal: journalText
    });
  });
}

export function getTodayDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${r}`;
}

export function showCompletedCheckinCard(log) {
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
    initChatWithTodayResponse(log, true); // true indicates reload existing response
  });
}
