import enTranslations from '../locales/en.json';
import esTranslations from '../locales/es.json';
import deTranslations from '../locales/de.json';
import frTranslations from '../locales/fr.json';

class I18nManager extends EventTarget {
  constructor() {
    super();
    this.currentLocale = 'en';
    this.translations = new Map();
    this.fallbackLocale = 'en';

    this.translations.set('en', enTranslations);
    this.translations.set('es', esTranslations);
    this.translations.set('de', deTranslations);
    this.translations.set('fr', frTranslations);
  }

  async loadLocale(locale) {
    if (this.translations.has(locale)) {
      return this.translations.get(locale);
    }

    try {
      if (locale === 'en') {
        this.translations.set(locale, enTranslations);
        return enTranslations;
      }
      if (locale === 'es') {
        this.translations.set(locale, esTranslations);
        return esTranslations;
      }
      if (locale === 'de') {
        this.translations.set(locale, deTranslations);
        return deTranslations;
      }
      if (locale === 'fr') {
        this.translations.set(locale, frTranslations);
        return frTranslations;
      }

      return this.translations.get(this.fallbackLocale) || {};
    } catch (error) {
      return this.translations.get(this.fallbackLocale) || {};
    }
  }

  setLocale(locale) {
    this.currentLocale = locale;
    this.dispatchEvent(new CustomEvent('locale-changed', { detail: { locale } }));
  }

  t(key, params = {}) {
    const translations = this.translations.get(this.currentLocale) || {};
    let translation = this.getNestedValue(translations, key);

    if (!translation) {
      const fallbackTranslations = this.translations.get(this.fallbackLocale) || {};
      translation = this.getNestedValue(fallbackTranslations, key);
    }

    if (!translation) {
      return key;
    }

    return this.replaceParams(translation, params);
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  replaceParams(str, params) {
    return str.replace(/\{\{(\w+)\}\}/g, (match, key) => params[key] || match);
  }

  formatNumber(number, options = {}) {
    return new Intl.NumberFormat(this.currentLocale, options).format(number);
  }

  formatDate(date, options = {}) {
    return new Intl.DateTimeFormat(this.currentLocale, options).format(date);
  }

  formatFileSize(bytes) {
    const units = ['bytes', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = parseFloat((bytes / k ** i).toFixed(2));
    return `${size} ${this.t(`units.${units[i]}`)}`;
  }
}

const i18n = new I18nManager();

export default i18n;
