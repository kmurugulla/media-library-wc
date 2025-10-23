import { html } from 'lit';
import LocalizableElement from '../base-localizable.js';
import { getStyles } from '../../utils/get-styles.js';
import aiChatPanelStyles from './ai-chat-panel.css?inline';

class AiChatPanel extends LocalizableElement {
  static properties = {
    locale: { type: String },
    messages: { type: Array, state: true },
    inputValue: { type: String, state: true },
    isLoading: { type: Boolean, state: true },
    onClose: { type: Function },
  };

  static styles = getStyles(aiChatPanelStyles);

  constructor() {
    super();
    this.locale = 'en';
    this.messages = [];
    this.inputValue = '';
    this.isLoading = false;
    this.onClose = null;
  }

  handleClose() {
    if (this.onClose) {
      this.onClose();
    }
  }

  handleInput(e) {
    this.inputValue = e.target.value;
  }

  handleSubmit(e) {
    e.preventDefault();
    if (!this.inputValue.trim()) return;

    this.sendMessage(this.inputValue);
  }

  handleSuggestionClick(suggestion) {
    this.sendMessage(suggestion);
  }

  sendMessage(content) {
    // Add user message
    this.messages = [
      ...this.messages,
      { role: 'user', content },
    ];

    // Clear input
    this.inputValue = '';

    // Simulate AI response (placeholder for now)
    this.isLoading = true;
    setTimeout(() => {
      this.messages = [
        ...this.messages,
        { role: 'assistant', content: 'AI responses will appear here once the backend is connected.' },
      ];
      this.isLoading = false;
    }, 1000);
  }

  renderMessage(message) {
    const isUser = message.role === 'user';
    return html`
      <div class="message ${isUser ? 'message-user' : 'message-assistant'}">
        <div class="message-avatar">${isUser ? '👤' : '✨'}</div>
        <div class="message-content">${message.content}</div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="ai-chat-panel">
        <div class="chat-header">
          <div class="chat-header-content">
            <div class="sparkle-icon">✨</div>
            <h3>AI Agent</h3>
          </div>
          <button class="chat-close-btn" @click=${this.handleClose} aria-label="Close AI Agent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="chat-messages">
          ${this.messages.length === 0 ? html`
            <div class="chat-empty-state">
              <ul class="suggestions">
                <li @click=${() => this.handleSuggestionClick('Images without alt text')}>
                  Images without alt text
                </li>
                <li @click=${() => this.handleSuggestionClick('Largest images on homepage')}>
                  Largest images on homepage
                </li>
                <li @click=${() => this.handleSuggestionClick('Images using lazy loading')}>
                  Images using lazy loading
                </li>
                <li @click=${() => this.handleSuggestionClick('SEO improvements')}>
                  SEO improvements
                </li>
              </ul>
            </div>
          ` : html`
            ${this.messages.map((msg) => this.renderMessage(msg))}
          `}
          
          ${this.isLoading ? html`
            <div class="message message-assistant message-loading">
              <div class="message-avatar">✨</div>
              <div class="message-content">
                <div class="loading-dots">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        <form class="chat-input-form" @submit=${this.handleSubmit}>
          <input
            type="text"
            class="chat-input"
            placeholder="Ask a question..."
            .value=${this.inputValue}
            @input=${this.handleInput}
          />
          <button type="submit" class="chat-send-btn" ?disabled=${!this.inputValue.trim()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z"/>
            </svg>
          </button>
        </form>
      </div>
    `;
  }
}

customElements.define('ai-chat-panel', AiChatPanel);
