/**
 * Onboarding controller logic
 */

import { saveGeminiKey, saveProfile, setOnboarded } from './storage.js';
import { navigateTo } from './app.js';

export function initOnboarding() {
  const steps = document.querySelectorAll('.onboarding-step');
  const btnNext = document.getElementById('ob-next');
  const btnPrev = document.getElementById('ob-prev');
  const stepDots = document.querySelectorAll('.ob-dot');
  let currentStep = 0;

  function showStep(idx) {
    steps.forEach((step, sIdx) => {
      step.classList.toggle('active', sIdx === idx);
    });
    
    // Update dots
    stepDots.forEach((dot, dIdx) => {
      dot.classList.toggle('active', dIdx === idx);
    });

    // Toggle button visibilities/labels
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
      // Validate inputs if moving from last input steps
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
      // Complete onboarding
      const name = document.getElementById('ob-name').value.trim();
      const exam = document.getElementById('ob-exam').value;
      const examDate = document.getElementById('ob-date').value;
      const geminiKey = document.getElementById('ob-key').value.trim();

      saveProfile({ name, exam, examDate });
      saveGeminiKey(geminiKey);
      setOnboarded(true);
      
      // Navigate to Home/Check-in
      navigateTo('screen-home');
      // Hide onboarding UI container and show normal UI
      document.getElementById('screen-onboarding').classList.remove('active');
      document.getElementById('main-nav').style.display = 'flex';
      window.location.reload(); // Refresh to boot full layout
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

// Simple custom modal wrapper instead of standard alert
export function alertModal(msg) {
  const modal = document.getElementById('custom-modal');
  const modalBody = document.getElementById('modal-body');
  modalBody.innerHTML = `<p>${msg}</p><button class="btn btn-primary btn-secondary" style="margin-top:20px;" id="modal-ok-btn">OK</button>`;
  modal.classList.add('active');
  document.getElementById('modal-ok-btn').addEventListener('click', () => {
    modal.classList.remove('active');
  });
}
