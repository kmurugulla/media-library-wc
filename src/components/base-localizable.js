import { LitElement } from 'lit';
import i18n from '../utils/i18n.js';

class LocalizableElement extends LitElement {
  constructor() {
    super();
    this.t = i18n.t.bind(i18n);
    this.formatNumber = i18n.formatNumber.bind(i18n);
    this.formatDate = i18n.formatDate.bind(i18n);
    this.formatFileSize = i18n.formatFileSize.bind(i18n);
  }

  connectedCallback() {
    super.connectedCallback();
    i18n.addEventListener('locale-changed', this.handleLocaleChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    i18n.removeEventListener('locale-changed', this.handleLocaleChange);
  }

  handleLocaleChange = () => {
    this.requestUpdate();
  };
}

export default LocalizableElement;
