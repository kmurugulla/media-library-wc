// examples/ai-chat/scripts.js

const CONFIG = {
  workerUrl: 'https://medialibrary-ai.kiran-murugulla.workers.dev',
  apiKey: '', // TODO: Add your API key here or load from environment
};

let currentSiteKey = null;
let messages = [];
let isStreaming = false;

// DOM elements
const siteSelect = document.getElementById('site-select');
const siteInfo = document.getElementById('site-info');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const suggestedPrompts = document.getElementById('suggested-prompts');
const promptsList = document.getElementById('prompts-list');

// Initialize
async function init() {
  await loadSites();
  setupEventListeners();
  renderEmptyState();
}

// Load available sites from D1
async function loadSites() {
  try {
    const response = await fetch(`${CONFIG.workerUrl}/api/ai/sites`, { headers: { 'X-API-Key': CONFIG.apiKey } });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const sites = data.sites || [];

    siteSelect.innerHTML = '<option value="">-- Select a site --</option>';

    sites.forEach((site) => {
      const option = document.createElement('option');
      option.value = site.site_key;
      option.textContent = `${site.site_key} (${site.count} images)`;
      siteSelect.appendChild(option);
    });

    if (sites.length === 0) {
      siteSelect.innerHTML = '<option value="">No sites found</option>';
    } else if (sites.length > 0) {
      siteSelect.value = sites[0].site_key;
      currentSiteKey = sites[0].site_key;
      handleSiteChange();
    }
  } catch (error) {
    console.error('Failed to load sites:', error);
    siteSelect.innerHTML = '<option value="">Error loading sites</option>';
  }
}

// Setup event listeners
function setupEventListeners() {
  siteSelect.addEventListener('change', handleSiteChange);
  chatForm.addEventListener('submit', handleSubmit);
  chatInput.addEventListener('input', handleInputChange);
  chatInput.addEventListener('keydown', handleKeyDown);

  // Auto-resize textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = `${chatInput.scrollHeight}px`;
  });
}

// Handle site selection
function handleSiteChange() {
  currentSiteKey = siteSelect.value;
  messages = [];

  if (currentSiteKey) {
    siteInfo.textContent = `${currentSiteKey}`;
    sendBtn.disabled = false;
    loadSuggestedPrompts();
    renderEmptyState();
  } else {
    siteInfo.textContent = '';
    sendBtn.disabled = true;
    suggestedPrompts.style.display = 'none';
    renderEmptyState();
  }
}

// Load suggested prompts
async function loadSuggestedPrompts() {
  try {
    const response = await fetch(`${CONFIG.workerUrl}/api/suggested-questions`);

    if (!response.ok) {
      suggestedPrompts.style.display = 'none';
      return;
    }

    const data = await response.json();

    const allQuestions = [];
    data.categories.forEach((category) => {
      category.questions.forEach((question) => {
        allQuestions.push(question);
      });
    });

    promptsList.innerHTML = allQuestions.slice(0, 6).map((question) => `
      <button class="prompt-button" data-prompt="${escapeHtml(question)}">
        ${escapeHtml(question)}
      </button>
    `).join('');

    document.querySelectorAll('.prompt-button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const { prompt } = btn.dataset;
        if (prompt && !isStreaming) {
          chatInput.value = prompt;
          sendMessage(prompt);
        }
      });
    });

    suggestedPrompts.style.display = 'block';
  } catch (error) {
    suggestedPrompts.style.display = 'none';
  }
}

// Handle form submit
function handleSubmit(e) {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (message && !isStreaming) {
    sendMessage(message);
  }
}

// Handle input change
function handleInputChange() {
  sendBtn.disabled = !chatInput.value.trim() || isStreaming || !currentSiteKey;
}

// Handle keyboard shortcuts
function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSubmit(e);
  }
}

// Send message to AI
async function sendMessage(content) {
  if (!currentSiteKey) {
    alert('Please select a site first');
    return;
  }

  // Add user message
  messages.push({ role: 'user', content });
  chatInput.value = '';
  chatInput.style.height = 'auto';
  renderMessages();

  // Add streaming assistant message
  messages.push({ role: 'assistant', content: '', streaming: true });
  renderMessages();

  isStreaming = true;
  sendBtn.disabled = true;

  try {
    const response = await fetch(`${CONFIG.workerUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': CONFIG.apiKey,
      },
      body: JSON.stringify({
        query: content,
        siteKey: currentSiteKey,
        conversationHistory: messages
          .filter((m) => !m.streaming && !m.error)
          .slice(-4)
          .map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let imageResults = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            updateStreamingMessage(parsed);
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    finalizeStreamingMessage();
  } catch (error) {
    console.error('Error sending message:', error);
    messages[messages.length - 1] = {
      role: 'assistant',
      content: `Error: ${error.message}. Please try again.`,
      error: true,
    };
    renderMessages();
  } finally {
    isStreaming = false;
    sendBtn.disabled = !chatInput.value.trim() || !currentSiteKey;
  }
}

// Update streaming message
function updateStreamingMessage(data) {
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.streaming) {
    lastMessage.content += data.chunk || '';
    lastMessage.tool = data.tool || lastMessage.tool;
    lastMessage.count = data.count !== undefined ? data.count : lastMessage.count;

    if (data.images && Array.isArray(data.images)) {
      lastMessage.images = data.images;
    }

    if (data.done && lastMessage.images) {
      lastMessage.streaming = false;
    }

    renderMessages();
  }
}

// Finalize streaming message
function finalizeStreamingMessage() {
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.streaming) {
    delete lastMessage.streaming;
    renderMessages();
  }
}

// Render empty state
function renderEmptyState() {
  if (messages.length > 0) return;

  chatMessages.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">✨</div>
      <h1>How can I help you today?</h1>
      ${currentSiteKey ? `
        <div class="suggestions-grid">
          <button class="suggestion-card" data-question="Which images are missing alt text?">
            Which images are missing alt text?
          </button>
          <button class="suggestion-card" data-question="Show me the largest images">
            Show me the largest images
          </button>
          <button class="suggestion-card" data-question="Find images that need lazy loading">
            Find images that need lazy loading
          </button>
          <button class="suggestion-card" data-question="What are the main SEO issues?">
            What are the main SEO issues?
          </button>
        </div>
      ` : '<p style="color: var(--text-secondary);">Select a site to get started</p>'}
    </div>
  `;

  // Add click handlers to suggestions
  if (currentSiteKey) {
    document.querySelectorAll('.suggestion-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const { question } = btn.dataset;
        if (question) sendMessage(question);
      });
    });
  }
}

// Render messages
function renderMessages() {
  if (messages.length === 0) {
    renderEmptyState();
    return;
  }

  chatMessages.innerHTML = messages
    .map((msg) => renderMessage(msg))
    .join('');

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Render image grid with pagination
function renderImageGrid(images, initialLimit = 12) {
  const gridId = `grid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  let visibleCount = Math.min(initialLimit, images.length);

  const renderCards = (count) => images.slice(0, count).map((img) => {
    const getFileType = (url) => {
      const ext = url.split('?')[0].split('.').pop().toUpperCase();
      const typeMap = {
        JPG: 'JPG',
        JPEG: 'JPEG',
        PNG: 'PNG',
        GIF: 'GIF',
        WEBP: 'WEBP',
        SVG: 'SVG',
        MP4: 'MP4',
        WEBM: 'WEBM',
        MOV: 'MOV',
      };
      return typeMap[ext] || ext;
    };

    const fileType = getFileType(img.url);
    const occCount = img.occurrences || 1;
    const isVideo = ['MP4', 'WEBM', 'MOV'].includes(fileType);

    const mediaElement = isVideo
      ? `<video 
           src="${escapeHtml(img.url)}" 
           muted
           loop
           preload="metadata"
           onmouseover="this.play()" 
           onmouseout="this.pause()"
           onerror="this.parentElement.innerHTML='<div class=\\'image-error\\'>❌<br><small>Failed to load</small></div>'"
         ></video>`
      : `<img 
           src="${escapeHtml(img.url)}" 
           alt=""
           loading="lazy"
           onerror="this.parentElement.innerHTML='<div class=\\'image-error\\'>❌<br><small>Failed to load</small></div>'"
         />`;

    return `
      <div class="image-card" data-url="${escapeHtml(img.url)}">
        <div class="image-card-preview">
          ${mediaElement}
          <div class="image-card-overlay">
            <div class="image-card-type">${fileType}</div>
            <div class="image-card-size">${img.width}×${img.height}px</div>
            <div class="image-card-count">${occCount}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const showMoreBtn = visibleCount < images.length
    ? `<button class="show-more-btn" data-grid="${gridId}" data-visible="${visibleCount}">
         Show ${Math.min(12, images.length - visibleCount)} more images
       </button>`
    : '';

  setTimeout(() => {
    const btn = document.querySelector(`[data-grid="${gridId}"]`);
    if (btn) {
      btn.addEventListener('click', () => {
        const currentVisible = parseInt(btn.dataset.visible, 10);
        const newVisible = Math.min(currentVisible + 12, images.length);
        const gridContainer = btn.previousElementSibling;

        gridContainer.innerHTML = renderCards(newVisible);
        btn.dataset.visible = newVisible;

        if (newVisible >= images.length) {
          btn.remove();
        } else {
          btn.textContent = `Show ${Math.min(12, images.length - newVisible)} more images`;
        }

        attachImageCardHandlers();
      });
    }
    attachImageCardHandlers();
  }, 100);

  return `
    <div class="image-grid-container">
      <div class="image-grid" id="${gridId}">
        ${renderCards(visibleCount)}
      </div>
      ${showMoreBtn}
    </div>
  `;
}

// Attach handlers to image cards
function attachImageCardHandlers() {
  document.querySelectorAll('.image-card').forEach((card) => {
    card.addEventListener('click', () => {
      const url = card.dataset.url;
      if (url) {
        window.open(url, '_blank');
      }
    });
  });
}

// Render single message
function renderMessage(msg) {
  const isUser = msg.role === 'user';
  const wrapperClass = isUser ? 'user' : 'assistant';
  const avatar = isUser ? '👤' : '✨';

  if (msg.error) {
    return `
      <div class="message-wrapper ${wrapperClass}">
        <div class="message ${msg.role}">
          <div class="message-avatar">${avatar}</div>
          <div class="message-content">
            <div class="message-error">${escapeHtml(msg.content)}</div>
          </div>
        </div>
      </div>
    `;
  }

  let meta = '';
  if (msg.tool || msg.count) {
    const parts = [];
    if (msg.tool) parts.push(`Tool: ${msg.tool}`);
    if (msg.count) parts.push(`${msg.count} items`);
    meta = `<div class="message-meta">${parts.join(' • ')}</div>`;
  }

  let imagesHtml = '';
  if (msg.images && msg.images.length > 0) {
    imagesHtml = renderImageGrid(msg.images);
  }

  return `
    <div class="message-wrapper ${wrapperClass}">
      <div class="message ${msg.role} ${msg.streaming ? 'streaming' : ''}">
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
          <div class="message-text">${escapeHtml(msg.content)}</div>
          ${meta}
          ${imagesHtml}
        </div>
      </div>
    </div>
  `;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start the app
init();
