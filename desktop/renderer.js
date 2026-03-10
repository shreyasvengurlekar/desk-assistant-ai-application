// renderer.js

let currentPreview = [];
let selectedFiles = new Set();
let isListening = false;
let tourStep = 0;
let ollamaStep = 0;
let isOllamaReady = false;

const tourSteps = [
  {
    title: "Welcome to Desk Assistant AI",
    content: "Your professional productivity partner for file management and organization.",
  },
  {
    title: "Privacy First",
    content: "Your files stay on your device. All scanning and analysis happen 100% locally on your machine. No cloud uploads.",
  },
  {
    title: "Choose Scan Folders",
    content: "By default, I scan Desktop, Downloads, and Documents. You can also add Pictures, Videos, or the entire computer in Settings.",
  },
  {
    title: "Smarter Scanning",
    content: "Note that scanning your entire computer will be more comprehensive but slower than scanning selected folders.",
  },
  {
    title: "Approval System",
    content: "I always show a preview before important file actions. Nothing changes without your explicit approval, and everything is undoable.",
  },
  {
    title: "AI Chat & Search",
    content: "Find files using natural language. Try: 'Find the invoice from last Tuesday' or 'Organize my downloads'.",
  },
  {
    title: "Voice Commands",
    content: "Use the mic button for English push-to-talk voice commands. I'll listen and type for you.",
  },
  {
    title: "Settings & Personalization",
    content: "Customize themes, enable real-time monitoring, or set file size thresholds in the Preferences section.",
  }
];

function startTour() {
  const overlay = document.getElementById('onboardingOverlay');
  if (!localStorage.getItem('hasSeenTour') || tourStep > 0) {
    overlay.style.display = 'flex';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.style.opacity = '1', 10);
    updateTourStep();
  }
}

function updateTourStep() {
  const step = tourSteps[tourStep];
  const content = document.getElementById('onboardingStepContent');
  if (!content) return;

  content.innerHTML = `
    <div class="setup-step" style="text-align: center; animation: fadeIn 0.3s ease-out;">
      <div class="logo-container large" style="margin: 0 auto 20px;">
        <img src="assets/icon.png" alt="Logo" class="logo">
      </div>
      <h2 style="margin-bottom: 12px; color: var(--text);">${step.title}</h2>
      <p style="color: var(--muted); line-height: 1.6;">${step.content}</p>
    </div>
  `;

  const nextBtn = document.getElementById('nextStep');
  if (tourStep === tourSteps.length - 1) {
    nextBtn.innerText = "Get Started";
    nextBtn.className = "btn-primary";
  } else {
    nextBtn.innerText = "Next Step";
    nextBtn.className = "btn-primary";
  }
}

function nextTourStep() {
  if (tourStep < tourSteps.length - 1) {
    tourStep++;
    updateTourStep();
  } else {
    finishTour();
  }
}

function skipTour() {
  finishTour();
}

function finishTour() {
  document.getElementById('onboardingOverlay').style.display = 'none';
  localStorage.setItem('hasSeenTour', 'true');
  tourStep = 0;
}

// Helpers
function formatFileSize(bytes) {
  if (bytes === undefined || bytes === null || bytes === 0) return '0 KB';
  
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;

  if (bytes < mb) {
    const val = bytes / kb;
    // For very small files, show at least 0.1 KB
    if (val < 0.1) return '0.1 KB';
    // For small files < 100KB, show 1 decimal, else round
    return (val < 100 ? parseFloat(val.toFixed(1)) : Math.round(val)) + ' KB';
  } else if (bytes < gb) {
    const val = bytes / mb;
    return parseFloat(val.toFixed(1)) + ' MB';
  } else {
    const val = bytes / gb;
    return parseFloat(val.toFixed(1)) + ' GB';
  }
}

// Navigation logic
function showPage(pageId) {
  const navLinks = document.querySelectorAll('.nav a');
  navLinks.forEach(link => {
    if (link.dataset.page === pageId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  const title = document.querySelector('.crumb');
  const icon = document.querySelector('.page-title .icon');
  
  if (title) title.innerText = pageId.charAt(0).toUpperCase() + pageId.slice(1);
  
  const icons = {
    dashboard: '🏠',
    activity: '🧾',
    suggestions: '💡',
    preferences: '⚙️',
    about: 'ℹ️'
  };
  if (icon) icon.innerText = icons[pageId] || '📄';

  const pages = ['dashboard', 'activity', 'suggestions', 'preferences', 'about'];
  pages.forEach(p => {
    const el = document.getElementById(p + 'Page');
    if (el) el.style.display = (p === pageId) ? 'flex' : 'none';
  });

  if (pageId === 'activity') loadActivityLog();
}

async function loadActivityLog() {
  const filterEl = document.getElementById('logFilter');
  const filter = filterEl ? filterEl.value : 'all';
  const content = document.getElementById('activityContent');
  if (!content) return;

  content.innerHTML = '<div class="thinking-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';

  try {
    const logs = await window.deskAI.getActivityLog(filter);
    content.innerHTML = '';
    
    if (!logs || logs.length === 0) {
      content.innerHTML = '<div class="empty-state">No history found.</div>';
      return;
    }

    const timeline = document.createElement('div');
    timeline.className = 'activity-timeline';
    timeline.style.cssText = 'display: flex; flex-direction: column; gap: 16px; padding: 10px;';

    logs.forEach(log => {
      const entry = document.createElement('div');
      entry.className = 'timeline-entry';
      entry.style.cssText = `
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px 16px;
        display: flex;
        gap: 16px;
        align-items: flex-start;
        position: relative;
        box-shadow: var(--shadow);
      `;

      const date = new Date(log.date).toLocaleString();
      const icon = log.type === 'Rename' ? '📝' : log.type === 'Delete' ? '🗑️' : log.type === 'Merge' ? '🔗' : '📅';
      
      entry.innerHTML = `
        <div style="font-size: 20px; background: var(--bg); padding: 8px; border-radius: 10px;">${icon}</div>
        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="font-size: 14px; color: var(--accent);">${log.type}</strong>
            <span style="font-size: 11px; color: var(--muted2);">${date}</span>
          </div>
          <div style="font-size: 13px; font-weight: 500;">${log.old_name} → ${log.new_name}</div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.file_path}">${log.file_path}</div>
        </div>
      `;
      timeline.appendChild(entry);
    });

    content.appendChild(timeline);
  } catch (err) {
    content.innerHTML = '<div class="empty-state">Failed to load activity log.</div>';
  }
}

// Chat Logic
function addMessage(text, sender = 'user', isThinking = false) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  // Remove helper suggestions if any message is added
  const helpers = document.getElementById('chatHelpers');
  if (helpers) helpers.remove();

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  
  if (isThinking) {
    bubble.id = 'thinkingBubble';
    bubble.className += ' thinking-bubble';
    bubble.innerHTML = `
      <span>Desk Assistant AI is thinking...</span>
      <div class="thinking-dots">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    `;
  } else {
    bubble.innerText = text;
  }

  container.appendChild(bubble);
  scrollToBottom();
  return bubble;
}

function showChatHelpers() {
  const container = document.getElementById('chatMessages');
  if (!container || container.children.length > 0) return;

  const helpers = document.createElement('div');
  helpers.id = 'chatHelpers';
  helpers.className = 'chat-helpers';
  helpers.innerHTML = `
    <div class="ai-greeting-startup" style="margin-bottom: 20px;">
      <div class="chat-bubble ai">
        Hello! I’m ready to help you manage your files. Try a quick action above or type a command.
      </div>
    </div>
    <p>Try asking me:</p>
    <div class="helper-chips">
      <div class="helper-chip" onclick="handleQuickAction('downloads')">Organize Downloads</div>
      <div class="helper-chip" onclick="handleQuickAction('duplicates')">Find Duplicates</div>
      <div class="helper-chip" onclick="handleQuickAction('largeFiles')">Large Files</div>
      <div class="helper-chip" onclick="handleQuickAction('resume')">Resume Finder</div>
      <div class="helper-chip" onclick="handleQuickAction('cleanDesktop')">Clean Desktop</div>
    </div>
  `;
  container.appendChild(helpers);
}

function handleLocalCommand(input) {
  const cmd = input.toLowerCase().trim();
  
  const greetings = ['hi', 'hello', 'hey', 'hello there'];
  if (greetings.includes(cmd)) {
    return "Hello! How can I help you with your files today?";
  }
  
  if (cmd === 'thanks' || cmd === 'thank you') {
    return "You're welcome! Let me know if you need anything else.";
  }
  
  if (cmd === 'help' || cmd === 'what can you do' || cmd === 'what can you do?') {
    return "I can help you organize your files locally. You can ask me to organize downloads, find resume files, check for duplicates, or identify large files over your selected limit.";
  }
  
  return null;
}

function scrollToBottom() {
  const container = document.getElementById('chatMessages');
  if (container) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  }
}

function removeThinking() {
  const bubble = document.getElementById('thinkingBubble');
  if (bubble) bubble.remove();
}

async function askAssistant() {
  const inputEl = document.getElementById("userInput");
  const input = inputEl.value.trim();
  if (!input) return;

  // Ensure the user sees the chat when an action is triggered
  showPage('dashboard');

  addMessage(input, 'user');
  
  inputEl.value = "";
  inputEl.style.height = 'auto'; // Reset textarea height
  
  // Auto-collapse suggestions to free space
  const grid = document.getElementById('suggestionsGrid');
  if (grid && !grid.classList.contains('collapsed')) {
    toggleSuggestions();
  }

  // Check for local replies first
  const localReply = handleLocalCommand(input);
  if (localReply) {
    setTimeout(() => {
      addMessage(localReply, 'ai');
    }, 300);
    return;
  }

  if (!isOllamaReady) {
    addMessage("Ollama is not ready. Please check your setup in Preferences or complete the AI onboarding.", 'ai');
    return;
  }
  
  addMessage('', 'ai', true);

  try {
    const rawResponse = await window.deskAI.aiCommand(input);
    removeThinking();
    
    let response;
    try {
      const start = rawResponse.indexOf('{');
      const end = rawResponse.lastIndexOf('}');
      const cleanJson = (start !== -1 && end !== -1) ? rawResponse.substring(start, end + 1) : rawResponse;
      response = JSON.parse(cleanJson);
    } catch (e) {
      console.error("AI JSON Parse Error:", e, "Raw:", rawResponse);
      response = { intent: 'none', message: "Sorry, I could not understand that command." };
    }

    // Natural message mapping if needed (defense in depth)
    let displayMessage = response.message;
    if (response.intent === 'organize_downloads') displayMessage = "I found items in your Downloads folder and prepared suggestions for organizing them.";
    else if (response.intent === 'find_duplicates') displayMessage = "I've scanned your folders and found some duplicate files for you to review.";
    else if (response.intent === 'find_large_files') displayMessage = "Here are the large files I found based on your size threshold.";
    else if (response.intent === 'find_resume') displayMessage = "I've located possible resume files in your scanned folders.";

    addMessage(displayMessage, 'ai');
    
    if (response.intent && response.intent !== 'none') {
      handleIntent(response.intent, input);
    }
  } catch (err) {
    removeThinking();
    addMessage("AI connection failed. Please ensure Ollama is running.", 'ai');
  }
}

function handleIntent(intent, originalInput) {
  const mapping = {
    'organize_downloads': 'downloads',
    'organize_desktop': 'desktop',
    'organize_both': 'both',
    'find_duplicates': 'duplicates',
    'find_large_files': 'largeFiles',
    'find_resume': 'resume',
    'clean_desktop': 'cleanDesktop',
    'show_recent': 'recent'
  };

  if (mapping[intent]) {
    handleQuickAction(mapping[intent]);
  } else if (intent === 'open_file' || intent === 'open_location') {
    handleQuickAction('search', originalInput);
  }
}

function sendPrompt(text) {
  const inputEl = document.getElementById("userInput");
  if (inputEl) {
    // Process as AI command
    inputEl.value = text;
    askAssistant();
  }
}

// Notifications Logic
function toggleNotifications() {
  const panel = document.getElementById('notifPanel');
  panel.classList.toggle('active');
}

function addNotification(text) {
  const list = document.getElementById('notifList');
  const badge = document.getElementById('notifBadge');
  
  if (list.querySelector('.empty-state')) list.innerHTML = '';
  
  const item = document.createElement('div');
  item.className = 'notif-item';
  item.innerText = text;
  list.prepend(item);
  
  if (badge) badge.style.display = 'block';
}

function clearNotifications() {
  const list = document.getElementById('notifList');
  const badge = document.getElementById('notifBadge');
  list.innerHTML = '<div class="empty-state">No notifications right now.</div>';
  if (badge) badge.style.display = 'none';
}

// Smart Suggestions UI
function toggleSuggestions() {
  const grid = document.getElementById('suggestionsGrid');
  const toggle = document.getElementById('suggestionsToggle');
  if (!grid || !toggle) return;
  const isCollapsed = grid.classList.toggle('collapsed');
  toggle.innerText = isCollapsed ? '▲' : '▼';
  
  // Persist collapsed state for the current session
  sessionStorage.setItem('suggestionsCollapsed', isCollapsed);
}

async function refreshSuggestions() {
  try {
    const stats = await window.deskAI.getSystemStats();
    updateStat('messyFilesCount', stats.messy, "messy file names");
    updateStat('duplicatesCount', stats.duplicates, "duplicates found");
    updateStat('largeFilesCount', stats.large, "large files (>500MB)");
    updateStat('resumesCount', stats.resumes, "resume files found");

    if (stats.messy > 0 || stats.duplicates > 0 || stats.large > 0) {
      const badge = document.getElementById('notifBadge');
      if (badge) badge.style.display = 'block';
    }

    // Auto-collapse if session already has it collapsed
    if (sessionStorage.getItem('suggestionsCollapsed') === 'true') {
      const grid = document.getElementById('suggestionsGrid');
      const toggle = document.getElementById('suggestionsToggle');
      if (grid && toggle) {
        grid.classList.add('collapsed');
        toggle.innerText = '▲';
      }
    }
  } catch (err) {
    console.error("Stats refresh failed", err);
  }
}

function addSuggestionCard(fileData) {
  const grid = document.getElementById('suggestionsGrid');
  if (!grid) return;

  const analysis = fileData.analysis;
  const card = document.createElement('div');
  card.className = 'suggestion-item monitoring-event';
  
  let suggestionHTML = '';
  if (analysis && analysis.suggestion) {
    suggestionHTML = `
      <div class="suggestion-tag">${analysis.suggestion} Suggestion</div>
      <p class="suggestion-reason">${analysis.reason}</p>
    `;
  } else {
    suggestionHTML = `<p class="suggestion-reason">This file already looks organized.</p>`;
  }

  const fileSize = formatFileSize(fileData.size);
  const fileTime = new Date(fileData.time).toLocaleString();

  card.innerHTML = `
    <span class="suggestion-icon">${analysis?.type === 'resume' ? '📄' : analysis?.type === 'installer' ? '📦' : '🆕'}</span>
    <div class="suggestion-info" style="width: 100%;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <span class="file-name" title="${fileData.name}">${fileData.name}</span>
        <button class="dismiss-btn" onclick="this.closest('.suggestion-item').remove(); checkSuggestionsEmptyState();">✕</button>
      </div>
      <div class="file-meta">
        <span>${fileSize}</span> • <span>${fileTime}</span>
      </div>
      ${suggestionHTML}
      <div class="card-actions" style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
        <button class="card-btn mini primary" onclick="openFile('${fileData.path.replace(/\\/g, '\\\\')}')">Open</button>
        <button class="card-btn mini" onclick="openLocation('${fileData.path.replace(/\\/g, '\\\\')}')">Location</button>
        ${analysis?.suggestion === 'Rename' ? `<button class="card-btn mini success" onclick="sendPrompt('Rename ${fileData.name}')">Rename</button>` : ''}
        <button class="card-btn mini secondary" onclick="this.closest('.suggestion-item').remove(); checkSuggestionsEmptyState();">Ignore</button>
      </div>
    </div>
  `;
  
  grid.prepend(card);
  
  // Ensure the grid is visible if we have a new suggestion
  if (grid.classList.contains('collapsed')) {
    toggleSuggestions();
  }

  // Update system status
  const statusText = document.getElementById('systemStatusText');
  if (statusText) statusText.innerText = `New file: ${fileData.name}`;
  
  checkSuggestionsEmptyState();
}
function updateStat(id, val, label) {
  const el = document.getElementById(id);
  if (el) {
    el.innerText = val || 0;
    const item = el.closest('.suggestion-item');
    if (!item) return;
    
    if (val === 0) {
      item.style.display = 'none'; // Hide if 0 to keep dashboard clean
    } else {
      item.style.display = 'flex';
      item.style.opacity = '1';
      item.title = `${val} ${label} detected`;
    }
  }
  
  // Check if all suggestions are 0 to show empty state
  checkSuggestionsEmptyState();
}

function checkSuggestionsEmptyState() {
  const grid = document.getElementById('suggestionsGrid');
  if (!grid) return;
  const items = grid.querySelectorAll('.suggestion-item');
  let visibleCount = 0;
  items.forEach(item => {
    if (item.style.display !== 'none') visibleCount++;
  });

  updateStatus('suggestionsStatus', `${visibleCount} Suggestions`, visibleCount > 0 ? 'on' : 'off');

  let emptyMsg = document.getElementById('suggestionsEmptyMsg');
  if (visibleCount === 0) {
    if (!emptyMsg) {
      emptyMsg = document.createElement('div');
      emptyMsg.id = 'suggestionsEmptyMsg';
      emptyMsg.className = 'empty-state';
      emptyMsg.innerHTML = '<span class="empty-icon">✨</span><p>All filenames look organized. No duplicates or large files found.</p>';
      grid.appendChild(emptyMsg);
    }
    emptyMsg.style.display = 'block';
  } else if (emptyMsg) {
    emptyMsg.style.display = 'none';
  }
}

// Preferences Custom Input
function toggleCustomSizeInput() {
  const select = document.getElementById('prefLargeThreshold');
  const wrap = document.getElementById('customSizeInputWrap');
  wrap.style.display = (select.value === 'custom') ? 'flex' : 'none';
}

// External Links
function openExternalLink(url, anchor = '') {
  let finalUrl = url;
  if (anchor) {
    finalUrl += (url.includes('#') ? '' : '#') + anchor;
  }
  window.deskAI.openExternal(finalUrl);
}

function showModal(type) {
  if (type === 'privacy') {
    openExternalLink('https://deskassistantai.vercel.app/privacy');
  } else if (type === 'terms') {
    openExternalLink('https://deskassistantai.vercel.app/terms');
  } else {
    const titles = { privacy: "Privacy Policy", terms: "Terms of Service" };
    const content = {
      privacy: "Your data stays local. We do not collect or transmit any file information.",
      terms: "Use this tool responsibly for local file management."
    };
    alert(`${titles[type]}\n\n${content[type]}`);
  }
}

// Mic / Voice UI
function togglePTT() {
  const btn = document.getElementById('micBtn');
  const status = document.getElementById('micStatus');
  
  if (!isListening) {
    startSpeechRecognition();
  } else {
    stopSpeechRecognition();
  }
}

function startSpeechRecognition() {
  const btn = document.getElementById('micBtn');
  const status = document.getElementById('micStatus');
  const userInput = document.getElementById('userInput');

  if (!('webkitSpeechRecognition' in window)) {
    addMessage("Voice command is not available right now.", 'ai');
    return;
  }
  
  try {
    window.recognition = new webkitSpeechRecognition();
    window.recognition.lang = 'en-US';
    window.recognition.continuous = false;
    window.recognition.interimResults = false;

    window.recognition.onstart = () => {
      isListening = true;
      btn.classList.add('listening');
      status.innerText = "Listening...";
    };

    window.recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      if (userInput) userInput.value = text;
      stopSpeechRecognition();
    };

    window.recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === 'not-allowed') {
        addMessage("Microphone access required for voice commands.", 'ai');
      } else {
        addMessage("Voice command is not available right now.", 'ai');
      }
      stopSpeechRecognition();
    };

    window.recognition.onend = () => {
      isListening = false;
      btn.classList.remove('listening');
      status.innerText = "";
    };

    window.recognition.start();
  } catch (err) {
    console.error("Failed to start speech recognition:", err);
    addMessage("Voice command is not available right now.", 'ai');
  }
}

function stopSpeechRecognition() {
  if (window.recognition) {
    try {
      window.recognition.stop();
    } catch (e) {}
  }
}

// Existing Quick Action Flow (preserved)
async function handleQuickAction(action, query = '') {
  const flow = document.getElementById('smartActionFlow');
  flow.style.display = 'none';

  // Map action IDs to user-friendly display names for the chat bubble
  const actionNames = {
    'downloads': 'Organize Downloads',
    'desktop': 'Organize Desktop',
    'both': 'Organize All',
    'duplicates': 'Find Duplicate Files',
    'largeFiles': 'Find Large Files',
    'resume': 'Find Resume Files',
    'cleanDesktop': 'Clean Desktop',
    'recent': 'Show Recent Files',
    'search': `Search for "${query}"`
  };

  // Add user message to chat
  addMessage(actionNames[action] || action, 'user');

  // Auto-collapse suggestions to free space
  const grid = document.getElementById('suggestionsGrid');
  if (grid && !grid.classList.contains('collapsed')) {
    toggleSuggestions();
  }

  addMessage('', 'ai', true); // Thinking indicator for scan

  try {
    const res = await window.deskAI.quickAction(action, query);
    removeThinking();

    if (res.preview && res.preview.length > 0) {
      currentPreview = res.preview;
      
      // Natural messages for quick actions
      const messages = {
        'downloads': "I've analyzed your Downloads folder and found these items to organize:",
        'desktop': "I've scanned your Desktop and found these items that could be organized:",
        'both': "I've checked both your Desktop and Downloads for items to organize:",
        'duplicates': `I've detected ${res.preview.length} duplicate files in your folders:`,
        'largeFiles': `I found these large files that exceed your threshold:`,
        'resume': `I've located these possible resume files:`,
        'cleanDesktop': "Here are the items I suggest cleaning from your desktop:",
        'recent': "Here are your most recently modified files:"
      };
      
      const displayMsg = messages[action] || `I found ${res.preview.length} items. Here they are:`;
      const aiMsg = addMessage(displayMsg, 'ai');
      
      const cardContainer = document.createElement('div');
      cardContainer.className = 'chat-result-grid';

      res.preview.forEach(file => {
        const card = createFileCard(file, action);
        cardContainer.appendChild(card);
      });

      aiMsg.appendChild(cardContainer);
      
      // Only show action flow if it's an actionable preview (like renames)
      if (action.includes('downloads') || action.includes('desktop') || action.includes('both')) {
        flow.style.display = 'flex';
      }
    } else {
      const emptyMessages = {
        'downloads': "Your Downloads folder already looks organized.",
        'desktop': "Your Desktop is already clean! No cluttered files found to organize.",
        'duplicates': "No duplicate files found.",
        'largeFiles': "I couldn't find any files above your selected size limit.",
        'resume': "I could not find any resume files.",
        'cleanDesktop': "Your desktop already looks organized."
      };
      addMessage(emptyMessages[action] || res.error || "I couldn't find any matching files.", 'ai');
    }
  } catch (err) {
    removeThinking();
    console.error("Quick Action Error:", err);
    addMessage("I could not complete that action right now.", 'ai');
  }
}

function createFileCard(file, type) {
  const card = document.createElement('div');
  card.className = 'file-result-card';

  const fileName = file.name || path.basename(file.from || file.path || '');
  const filePath = file.path || file.from || '';
  const fileSize = formatFileSize(file.size);
  const fileDate = file.date ? new Date(file.date).toLocaleDateString() : 'Unknown date';

  card.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 20px;">📄</span>
      <div style="overflow: hidden;">
        <div style="font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${fileName}">${fileName}</div>
        <div style="font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${filePath}">${filePath}</div>
      </div>
    </div>
    <div style="display: flex; gap: 12px; font-size: 11px; color: var(--muted2);">
      <span>💾 ${fileSize}</span>
      <span>📅 ${fileDate}</span>
    </div>
    <div style="display: flex; gap: 8px; margin-top: 4px;">
      <button class="card-btn mini primary" onclick="openFile('${filePath.replace(/\\/g, '\\\\')}')">Open</button>
      <button class="card-btn mini" onclick="openLocation('${filePath.replace(/\\/g, '\\\\')}')">Location</button>
      ${type === 'duplicates' ? `<button class="card-btn mini danger" onclick="deleteFile('${filePath.replace(/\\/g, '\\\\')}')">Delete</button>` : ''}
    </div>
  `;
  return card;
}

function openFile(path) { window.deskAI.openFile(path); }
function openLocation(path) { window.deskAI.openLocation(path); }
function deleteFile(path) {
  if (confirm("Move this file to Recycle Bin?")) {
    window.deskAI.deleteFile(path);
    addNotification("File moved to Recycle Bin");
    refreshSuggestions();
  }
}

async function approveAction() {
  const flow = document.getElementById('smartActionFlow');
  flow.style.display = 'none';
  addMessage("Applying changes...", 'ai', true);
  try {
    const res = await window.deskAI.applyRename(currentPreview);
    removeThinking();
    addMessage(`Success! Processed ${res.doneCount} files.`, 'ai');
    document.getElementById('undoBtn').style.display = 'inline-block';
    addNotification(`Renamed ${res.doneCount} files.`);
    refreshSuggestions();
  } catch (err) {
    removeThinking();
    addMessage("Failed to apply changes.", 'ai');
  }
}

function cancelAction() {
  document.getElementById('smartActionFlow').style.display = 'none';
  currentPreview = [];
  addMessage("Action cancelled.", 'ai');
}

async function undoLast() {
  document.getElementById('undoBtn').style.display = 'none';
  try {
    await window.deskAI.undoRename();
    addMessage("Last action undone.", 'ai');
    addNotification("Undo completed.");
    refreshSuggestions();
  } catch (err) {
    addMessage("Undo failed.", 'ai');
  }
}

// Ollama Setup (preserved logic)
const ollamaSteps = [
  { title: "Step 1: Welcome", content: "Welcome to Desk Assistant AI. To use AI chat, you need Ollama." },
  { title: "Step 2: Privacy", content: "Ollama runs locally. Your data stays on your computer." },
  { title: "Step 3: Install", content: "Download Ollama from the official site.", action: { label: "Download", onClick: "openOllamaWebsite()" } },
  { title: "Step 4: Model", content: "Run 'ollama run phi3' in your terminal." },
  { title: "Step 5: Test", content: "Click below to test connection.", action: { label: "Test", onClick: "testOllamaStatus()" } },
  { title: "Step 6: Ready!", content: "AI is ready to use." }
];

function startOllamaSetup() {
  if (!localStorage.getItem('hasSeenOllamaSetup') || ollamaStep > 0) {
    document.getElementById('ollamaSetupOverlay').style.display = 'flex';
    updateOllamaStep();
  }
}

function updateOllamaStep() {
  const step = ollamaSteps[ollamaStep];
  const content = document.getElementById('ollamaSetupContent');
  content.innerHTML = `<div class="setup-step"><h2>${step.title}</h2><p>${step.content}</p></div>`;
  if (step.action) {
    const btn = document.createElement('button');
    btn.className = 'btn-primary';
    btn.innerText = step.action.label;
    btn.onclick = () => window[step.action.onClick]();
    content.appendChild(btn);
  }
  document.getElementById('nextOllama').innerText = (ollamaStep === ollamaSteps.length - 1) ? "Finish" : "Next";
}

function nextOllamaStep() {
  if (ollamaStep < ollamaSteps.length - 1) {
    ollamaStep++;
    updateOllamaStep();
  } else {
    document.getElementById('ollamaSetupOverlay').style.display = 'none';
    localStorage.setItem('hasSeenOllamaSetup', 'true');
  }
}

async function testOllamaStatus() {
  const banner = document.getElementById('ollamaSettingsStatus');
  try {
    const res = await window.deskAI.checkOllamaStatus();
    isOllamaReady = (res.status === 'ready');
    if (banner) {
      banner.innerText = res.message;
      banner.className = `ollama-status-banner ${res.status === 'ready' ? 'ready' : 'warning'}`;
    }
    updateLimitedMode(isOllamaReady);
    updateStatus('aiStatus', isOllamaReady ? 'AI Ready' : 'Limited Mode', isOllamaReady ? 'on' : 'warn');
  } catch (err) {
    isOllamaReady = false;
    updateLimitedMode(false);
    updateStatus('aiStatus', 'Limited Mode', 'warn');
  }
}

function updateLimitedMode(ready) {
  isOllamaReady = ready;
  const banner = document.getElementById('limitedModeBanner');
  if (!ready && !banner) {
    const b = document.createElement('div');
    b.id = 'limitedModeBanner';
    b.className = 'limited-mode-banner';
    b.innerText = "AI features disabled. Please install Ollama.";
    document.getElementById('chatInterface').prepend(b);
  } else if (ready && banner) {
    banner.remove();
  }
}

function openOllamaWebsite() { window.deskAI.openOllamaWebsite(); }

// Preferences Logic
async function saveSetting(key, value) {
  try {
    const res = await window.deskAI.saveSetting(key, value);
    if (key === 'prefMonitor') {
      if (value) {
        const startRes = await window.deskAI.startWatcher();
        if (startRes && !startRes.success) {
          addNotification(startRes.error || "File monitoring failed to start.");
          document.getElementById('prefMonitor').checked = false;
          updateStatus('monitoringStatus', 'Monitoring Off', 'off');
          return;
        }
        updateStatus('monitoringStatus', 'Monitoring On', 'on');
      } else {
        await window.deskAI.stopWatcher();
        updateStatus('monitoringStatus', 'Monitoring Off', 'off');
      }
    }
  } catch (err) {
    console.error(`Failed to save setting ${key}:`, err);
  }
}

function updateStatus(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `status-${type}`;
  el.innerHTML = `<span class="dot-status"></span> ${text}`;
}

async function loadSettings() {
  try {
    const boot = await window.deskAI.getSetting('prefBoot');
    if (boot !== null) document.getElementById('prefBoot').checked = boot;

    const monitor = await window.deskAI.getSetting('prefMonitor');
    if (monitor !== null) {
      document.getElementById('prefMonitor').checked = monitor;
      if (monitor) {
        const startRes = await window.deskAI.startWatcher();
        if (startRes && !startRes.success) {
          updateStatus('monitoringStatus', 'Monitoring Off', 'off');
          addNotification(startRes.error || "File monitoring failed to start.");
        } else {
          updateStatus('monitoringStatus', 'Monitoring On', 'on');
        }
      } else {
        updateStatus('monitoringStatus', 'Monitoring Off', 'off');
      }
    } else {
      updateStatus('monitoringStatus', 'Monitoring Off', 'off');
    }

    const notify = await window.deskAI.getSetting('prefNotify');
    if (notify !== null) document.getElementById('prefNotify').checked = notify;

    const threshold = await window.deskAI.getSetting('prefLargeThreshold');
    if (threshold !== null) {
      document.getElementById('prefLargeThreshold').value = threshold;
      toggleCustomSizeInput();
    }

    const deleteMethod = await window.deskAI.getSetting('prefDeleteMethod');
    if (deleteMethod !== null) document.getElementById('prefDeleteMethod').value = deleteMethod;

    const customSize = await window.deskAI.getSetting('customSizeVal');
    if (customSize !== null) document.getElementById('customSizeVal').value = customSize;

    const customUnit = await window.deskAI.getSetting('customSizeUnit');
    if (customUnit !== null) document.getElementById('customSizeUnit').value = customUnit;

    // Scan locations
    const scanDesktop = await window.deskAI.getSetting('scanDesktop');
    if (scanDesktop !== null) document.getElementById('scanDesktop').checked = scanDesktop;
    const scanDownloads = await window.deskAI.getSetting('scanDownloads');
    if (scanDownloads !== null) document.getElementById('scanDownloads').checked = scanDownloads;
    const scanDocuments = await window.deskAI.getSetting('scanDocuments');
    if (scanDocuments !== null) document.getElementById('scanDocuments').checked = scanDocuments;
    const scanPictures = await window.deskAI.getSetting('scanPictures');
    if (scanPictures !== null) document.getElementById('scanPictures').checked = scanPictures;
    const scanVideos = await window.deskAI.getSetting('scanVideos');
    if (scanVideos !== null) document.getElementById('scanVideos').checked = scanVideos;
    const scanFull = await window.deskAI.getSetting('scanFull');
    if (scanFull !== null) document.getElementById('scanFull').checked = scanFull;

  } catch (err) {
    console.error("Failed to load settings:", err);
    addNotification("Settings could not be loaded. Using defaults.");
  }
}

// Initialization
window.addEventListener("DOMContentLoaded", async () => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  showPage('dashboard');
  startOllamaSetup();
  startTour();
  refreshSuggestions();
  testOllamaStatus();
  
  await loadSettings();

  // Quick Action Helpers
function reviewMessyNames() {
  handleQuickAction('downloads'); // Or a specific messy name scan if available
}

function findDuplicates() {
  handleQuickAction('duplicates');
}

function showLargeFiles() {
  handleQuickAction('largeFiles');
}

function findMyResume() {
  handleQuickAction('resume');
}

// Initial Greeting & Helpers
  setTimeout(() => {
    const chat = document.getElementById('chatMessages');
    if (chat && chat.children.length === 0) {
      showChatHelpers();
    }
  }, 1000);

  window.deskAI.onFileEvent((data) => {
    // Show in-app notification
    addNotification(`${data.event.charAt(0).toUpperCase() + data.event.slice(1)}: ${data.name}`);
    
    // Add suggestion card if it's an 'added' event
    if (data.event === 'added') {
      addSuggestionCard(data);
    }
    
    // Refresh stats to reflect changes
    refreshSuggestions();
  });

  // Add change listeners for settings
  document.getElementById('prefBoot').addEventListener('change', (e) => saveSetting('prefBoot', e.target.checked));
  document.getElementById('prefMonitor').addEventListener('change', (e) => saveSetting('prefMonitor', e.target.checked));
  document.getElementById('prefNotify').addEventListener('change', (e) => saveSetting('prefNotify', e.target.checked));
  document.getElementById('prefLargeThreshold').addEventListener('change', (e) => saveSetting('prefLargeThreshold', e.target.value));
  document.getElementById('prefDeleteMethod').addEventListener('change', (e) => saveSetting('prefDeleteMethod', e.target.value));
  document.getElementById('customSizeVal').addEventListener('input', (e) => saveSetting('customSizeVal', e.target.value));
  document.getElementById('customSizeUnit').addEventListener('change', (e) => saveSetting('customSizeUnit', e.target.value));

  // Scan Location Listeners
  document.getElementById('scanDesktop').addEventListener('change', (e) => saveSetting('scanDesktop', e.target.checked));
  document.getElementById('scanDownloads').addEventListener('change', (e) => saveSetting('scanDownloads', e.target.checked));
  document.getElementById('scanDocuments').addEventListener('change', (e) => saveSetting('scanDocuments', e.target.checked));
  document.getElementById('scanPictures').addEventListener('change', (e) => saveSetting('scanPictures', e.target.checked));
  document.getElementById('scanVideos').addEventListener('change', (e) => saveSetting('scanVideos', e.target.checked));
  document.getElementById('scanFull').addEventListener('change', (e) => {
    saveSetting('scanFull', e.target.checked);
    if (e.target.checked) {
      addNotification("Scanning the full computer may take more time.");
    }
  });

  const userInput = document.getElementById('userInput');
  userInput.addEventListener('focus', () => {
    if (document.querySelector('.nav a.active').dataset.page !== 'dashboard') {
      showPage('dashboard');
    }
  });

  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askAssistant();
    }
  });

  userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if (this.scrollHeight > 150) {
      this.style.overflowY = 'scroll';
    } else {
      this.style.overflowY = 'hidden';
    }
  });

  // Global click listener to close notifications
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('notifPanel');
    const notifBtn = document.querySelector('.icon-btn[title="Notifications"]');
    
    if (panel && panel.classList.contains('active')) {
      // If click is outside panel and outside the notification button
      if (!panel.contains(e.target) && !notifBtn.contains(e.target)) {
        panel.classList.remove('active');
      }
    }
  });
});

// Global exposure
window.showPage = showPage;
window.sendPrompt = sendPrompt;
window.toggleSuggestions = toggleSuggestions;
window.toggleNotifications = toggleNotifications;
window.clearNotifications = clearNotifications;
window.toggleCustomSizeInput = toggleCustomSizeInput;
window.openExternalLink = openExternalLink;
window.showModal = showModal;
window.togglePTT = togglePTT;
window.approveAction = approveAction;
window.cancelAction = cancelAction;
window.undoLast = undoLast;
window.startOllamaSetup = startOllamaSetup;
window.nextOllamaStep = nextOllamaStep;
window.nextTourStep = nextTourStep;
window.skipTour = skipTour;
window.startTour = startTour;
window.testOllamaStatus = testOllamaStatus;
window.openOllamaWebsite = openOllamaWebsite;
window.toggleTheme = () => {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
};
