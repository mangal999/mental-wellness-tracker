/**
 * Main application routing, lifecycle, and component mounting
 */

import { isOnboarded, getProfile, getGeminiKey } from './storage.js';
import { initOnboarding } from './onboarding.js';
import { initCheckin } from './checkin.js';
import { initDashboard } from './dashboard.js';
import { LIBRARY_DATA } from './library-data.js';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // Check onboarding status
  if (!isOnboarded() || !getGeminiKey()) {
    showOnboardingFlow();
  } else {
    // Show main navigation and active default screen
    document.getElementById('screen-onboarding').classList.remove('active');
    document.getElementById('main-nav').style.display = 'flex';
    setupNavigation();
    
    // Default screen is Home
    navigateTo('screen-home');
    initCheckin();
  }

  // Setup modal close handler
  document.getElementById('modal-close-btn').addEventListener('click', () => {
    document.getElementById('custom-modal').classList.remove('active');
  });

  // Setup reset settings capability in library
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

      // Update nav active styles
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      navigateTo(targetScreenId);

      // Trigger respective screen initializations
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

export function navigateTo(screenId) {
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
  
  // Format items
  libraryContent.innerHTML = `
    ${renderAccordionSection('Focus Techniques', 'focus', examData.focus)}
    ${renderAccordionSection('Energy Management', 'energy', examData.energy)}
    ${renderAccordionSection('Stress Release', 'stress', examData.stress)}
    ${renderAccordionSection('Study Strategy', 'strategy', examData.strategy)}
    ${renderAccordionSection('Mind Reset', 'reset', examData.reset)}
  `;

  // Bind accordion actions
  const accordions = libraryContent.querySelectorAll('.accordion');
  accordions.forEach(acc => {
    const header = acc.querySelector('.accordion-header');
    header.addEventListener('click', () => {
      const isActive = acc.classList.contains('active');
      accordions.forEach(a => a.classList.remove('active'));
      if (!isActive) {
        acc.classList.add('active');
      }
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
      <div class="accordion-content">
        ${itemsHtml}
      </div>
    </div>
  `;
}
