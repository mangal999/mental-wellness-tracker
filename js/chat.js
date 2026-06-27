/**
 * AI Companion response and interactive chat controller
 */

import { getProfile, getLogs, saveLogForDate } from './storage.js';
import { buildSystemPrompt, streamGeminiChat, extractTriggersAndPositives } from './gemini.js';
import { getTodayDateStr } from './checkin.js';

let sessionChatHistory = [];
let currentSystemPrompt = '';

export function initChatWithTodayResponse(todayEntry, isExisting = false) {
  const container = document.getElementById('chat-response-container');
  const chatInterface = document.getElementById('chat-interactive-interface');
  const chatInput = document.getElementById('chat-user-message');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const chatHistoryContainer = document.getElementById('chat-history');

  // Clear states
  chatHistoryContainer.innerHTML = '';
  chatInterface.style.display = 'none';
  sessionChatHistory = [];

  // Setup streaming placeholders
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
    // Just load stored response
    document.getElementById('ai-loading-shimmer').style.display = 'none';
    document.getElementById('ai-streamed-response').style.display = 'block';
    
    parseAndDistributeResponse(todayEntry.aiResponse);
    
    // Setup follow up interactivity
    chatInterface.style.display = 'block';
    setupInteractiveChat(todayEntry);
    return;
  }

  // Stream new response
  const profile = getProfile();
  const logs = getLogs();
  
  // Format history logs excluding today
  const todayStr = getTodayDateStr();
  const historyLogs = logs.filter(log => log.date !== todayStr);

  currentSystemPrompt = buildSystemPrompt(profile, historyLogs, todayEntry);

  const contents = [
    { role: 'user', parts: [{ text: "Analyze my status and give me guidance." }] }
  ];

  let accumulatedResponse = '';

  document.getElementById('ai-loading-shimmer').style.display = 'block';

  streamGeminiChat(
    contents,
    currentSystemPrompt,
    (chunk) => {
      // Hide shimmer on first chunk
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
          <button class="btn btn-primary" id="retry-btn">Try Again</button>
        </div>
      `;
      document.getElementById('retry-btn').addEventListener('click', () => {
        initChatWithTodayResponse(todayEntry, isExisting);
      });
    }
  ).then(async () => {
    // If complete successfully, save it in today's log
    if (accumulatedResponse) {
      // Extra step: trigger extraction of positive & negative features in background
      const extractions = await extractTriggersAndPositives(todayEntry.journal);
      
      const completeLog = {
        ...todayEntry,
        aiResponse: accumulatedResponse,
        triggers: extractions.triggers || [],
        positives: extractions.positives || []
      };

      saveLogForDate(todayStr, completeLog);
      
      // Update interactive follow-up capability
      chatInterface.style.display = 'block';
      setupInteractiveChat(completeLog);
    }
  });
}

function parseAndDistributeResponse(text) {
  // Identify the markers and split sections
  const whatsGoingOnIdx = text.indexOf("🔍 What's Going On");
  const whatToDoIdx = text.indexOf("🛠 What To Do Today");
  const rememberIdx = text.indexOf("✨ One Thing To Remember");

  let whatsGoingOnContent = '';
  let whatToDoContent = '';
  let rememberContent = '';

  const clean = (str) => {
    return str.replace(/^(🔍 What's Going On|🛠 What To Do Today|✨ One Thing To Remember)/i, '').trim();
  };

  if (whatsGoingOnIdx !== -1) {
    const end = (whatToDoIdx !== -1) ? whatToDoIdx : (rememberIdx !== -1 ? rememberIdx : text.length);
    whatsGoingOnContent = clean(text.substring(whatsGoingOnIdx, end));
  } else {
    // fallback if no section marker generated yet
    whatsGoingOnContent = text;
  }

  if (whatToDoIdx !== -1) {
    const end = (rememberIdx !== -1) ? rememberIdx : text.length;
    whatToDoContent = clean(text.substring(whatToDoIdx, end));
  }

  if (rememberIdx !== -1) {
    rememberContent = clean(text.substring(rememberIdx));
  }

  // Render to DOM
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
  
  // Re-bind to ensure no double-handlers
  const newSendBtn = chatSendBtn.cloneNode(true);
  chatSendBtn.parentNode.replaceChild(newSendBtn, chatSendBtn);

  // Initialize session conversation history
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

    // Stream helper
    const aiBubble = appendChatBubble('ai', '...');
    let answerText = '';

    streamGeminiChat(
      sessionChatHistory,
      currentSystemPrompt || buildSystemPrompt(getProfile(), getLogs().filter(l => l.date !== todayLog.date), todayLog),
      (chunk) => {
        if (aiBubble.innerText === '...') {
          aiBubble.innerHTML = '';
        }
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
    if (e.key === 'Enter') {
      handleSendMessage();
    }
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

// Basic markdown parsing for streamed text
function formatMarkdown(text) {
  if (!text) return '';
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*?)$/gm, '• $1')
    .replace(/\n/g, '<br>');
  return formatted;
}
