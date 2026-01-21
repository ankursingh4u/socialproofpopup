/**
 * Social Proof Widget
 * Displays purchase notification popups and product counters
 *
 * ARCHITECTURE: All config comes from Liquid/metafields - NO API calls needed!
 */

(function() {
  'use strict';

  class SocialProofWidget {
    constructor() {
      this.config = null;
      this.settings = null;
      this.container = null;
      this.counterElement = null;
      this.counterObserver = null;
      this.activityQueue = [];
      this.currentPopup = null;
      this.timeoutId = null;
      this.activityIndex = 0;
      // Dismiss tracking
      this.DISMISS_THRESHOLD = 3;
    }

    /**
     * Initialize the widget
     */
    init() {
      // Read configuration from embedded script (from Liquid/metafields)
      this.config = this.readConfig();
      if (!this.config) {
        console.warn('Social Proof Widget: Missing configuration');
        return;
      }

      // Settings come directly from embedded config (no API call!)
      this.settings = this.config.settings;
      if (!this.settings) {
        console.warn('Social Proof Widget: No settings in config');
        return;
      }

      // Get DOM containers
      this.container = document.getElementById('social-proof-container');
      if (!this.container) {
        console.warn('Social Proof Widget: Container not found');
        return;
      }

      // Load demo activities from embedded config
      this.activityQueue = this.config.demoActivities || [];

      // Set up container
      this.setupContainer();

      // Start showing popups if enabled
      if (this.settings.popupEnabled && this.shouldShowPopups()) {
        this.scheduleNextPopup(true);
      }

      // Show counter on product pages if enabled
      if (this.settings.counterEnabled && this.config.pageType === 'product' && this.config.productId) {
        this.showCounter();
      }

      // Show the container
      this.container.style.display = 'block';

      console.log('Social Proof Widget: initialized (metafield-based, no API calls)');
    }

    /**
     * Get dismiss count from localStorage
     */
    getDismissCount() {
      return parseInt(localStorage.getItem('spp_dismiss_count') || '0', 10);
    }

    /**
     * Increment dismiss count in localStorage
     */
    incrementDismissCount() {
      const count = this.getDismissCount() + 1;
      localStorage.setItem('spp_dismiss_count', count.toString());
      return count;
    }

    /**
     * Check if popups should be shown based on dismiss count
     */
    shouldShowPopups() {
      return this.getDismissCount() < this.DISMISS_THRESHOLD;
    }

    /**
     * Read configuration from embedded JSON script
     */
    readConfig() {
      const configScript = document.getElementById('social-proof-config');
      if (!configScript) return null;

      try {
        return JSON.parse(configScript.textContent);
      } catch (e) {
        console.error('Social Proof Widget: Invalid config JSON', e);
        return null;
      }
    }

    /**
     * Set up container positioning
     */
    setupContainer() {
      const position = this.settings.popupPosition || 'BOTTOM_LEFT';
      const positionClass = position.toLowerCase().replace('_', '-');
      this.container.className = positionClass;
    }

    /**
     * Schedule the next popup to show
     */
    scheduleNextPopup(isInitial = false) {
      const delay = isInitial
        ? this.settings.popupDelay * 1000
        : this.settings.popupDelay * 1000;

      this.timeoutId = setTimeout(() => {
        this.showPopup();
      }, delay);
    }

    /**
     * Get next activity from queue (cycles through)
     */
    getNextActivity() {
      if (this.activityQueue.length === 0) return null;

      const activity = this.activityQueue[this.activityIndex];
      this.activityIndex = (this.activityIndex + 1) % this.activityQueue.length;
      return activity;
    }

    /**
     * Show a popup notification
     */
    showPopup() {
      if (!this.shouldShowPopups()) return;

      const activity = this.getNextActivity();
      if (!activity) return;

      if (this.currentPopup) {
        this.currentPopup.remove();
      }

      const popup = this.createPopupElement(activity);
      this.container.appendChild(popup);
      this.currentPopup = popup;

      // Animation: entering -> visible
      popup.classList.add('spp-popup--entering');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          popup.classList.remove('spp-popup--entering');
          popup.classList.add('spp-popup--visible');
        });
      });

      // Schedule auto-hide
      const displayDuration = this.settings.displayDuration * 1000;
      setTimeout(() => {
        this.hidePopup();
      }, displayDuration);
    }

    /**
     * Create popup DOM element
     */
    createPopupElement(activity) {
      const position = (this.settings.popupPosition || 'BOTTOM_LEFT').toLowerCase().replace('_', '-');

      const popup = document.createElement('div');
      popup.className = `spp-popup spp-popup--${position}`;
      popup.id = 'spp-activity-popup';

      popup.innerHTML = `
        <button class="spp-popup-close" aria-label="Close">&times;</button>
        <div class="spp-popup-content">
          <img class="spp-popup-image" src="${this.escapeHtml(activity.productImage)}" alt="${this.escapeHtml(activity.productTitle)}" loading="lazy">
          <div class="spp-popup-text">
            <p class="spp-popup-title">Someone from <strong>${this.escapeHtml(activity.city)}</strong> just purchased</p>
            <p class="spp-popup-product">${this.escapeHtml(activity.productTitle)}</p>
            <p class="spp-popup-time">${activity.timeAgo}</p>
          </div>
        </div>
        <div class="spp-popup-verified">
          <span class="spp-verified-icon">&#10003;</span> Verified purchase
        </div>
      `;

      // Close button handler with dismiss tracking
      const closeBtn = popup.querySelector('.spp-popup-close');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.incrementDismissCount();
        this.hidePopup();
      });

      return popup;
    }

    /**
     * Hide the current popup
     */
    hidePopup() {
      if (!this.currentPopup) return;

      // Animation: visible -> exiting
      this.currentPopup.classList.remove('spp-popup--visible');
      this.currentPopup.classList.add('spp-popup--exiting');

      setTimeout(() => {
        if (this.currentPopup) {
          this.currentPopup.remove();
          this.currentPopup = null;
        }

        // Schedule next if not dismissed too many times
        if (this.shouldShowPopups()) {
          this.scheduleNextPopup();
        }
      }, 300);
    }

    /**
     * Find the Add to Cart button on the page
     */
    findAddToCartButton() {
      const selectors = [
        'form[action*="/cart/add"] button[type="submit"]',
        '.product-form__submit',
        'button[name="add"]',
        '.add-to-cart',
        '#AddToCart',
        '.btn-addtocart',
        '[data-add-to-cart]',
        '.product-form button[type="submit"]',
        '.shopify-payment-button',
        'form.product-form button'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
      }

      return null;
    }

    /**
     * Create counter DOM element
     */
    createCounterElement(count, timeframe) {
      const counter = document.createElement('div');
      counter.className = 'spp-counter';
      counter.setAttribute('data-product-id', this.config.productId);

      const timeframeText = timeframe || '24 hours';

      counter.innerHTML = `
        <span class="spp-counter-icon">&#128293;</span>
        <span class="spp-counter-text">
          <strong class="spp-counter-number">0</strong> people bought this in the last ${this.escapeHtml(timeframeText)}
        </span>
      `;

      return counter;
    }

    /**
     * Animate counter from 0 to target value
     */
    animateCounter(element, target, duration = 1500) {
      const start = performance.now();
      let lastValue = -1;

      const update = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(eased * target);

        if (currentValue !== lastValue) {
          lastValue = currentValue;
          element.textContent = currentValue;
        }

        if (progress < 1) {
          requestAnimationFrame(update);
        }
      };

      requestAnimationFrame(update);
    }

    /**
     * Set up IntersectionObserver for visibility-triggered animation
     */
    observeCounter(counterEl, count) {
      const numberEl = counterEl.querySelector('.spp-counter-number');
      if (!numberEl) return;

      this.counterObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          counterEl.classList.add('spp-counter--visible');
          this.animateCounter(numberEl, count);
          this.counterObserver.disconnect();
        }
      }, { threshold: 0.5 });

      this.counterObserver.observe(counterEl);
    }

    /**
     * Show counter badge on product page (demo data)
     */
    showCounter() {
      if (this.config.pageType !== 'product' || !this.config.productId) return;

      const addToCartBtn = this.findAddToCartButton();
      if (!addToCartBtn) {
        console.warn('Social Proof Widget: Add to Cart button not found');
        return;
      }

      // Demo counter - random number between 5-50
      const demoCount = Math.floor(Math.random() * 46) + 5;

      const counter = this.createCounterElement(demoCount, '24 hours');
      this.counterElement = counter;

      addToCartBtn.parentNode.insertBefore(counter, addToCartBtn.nextSibling);
      this.observeCounter(counter, demoCount);
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * Destroy the widget
     */
    destroy() {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      if (this.currentPopup) {
        this.currentPopup.remove();
      }
      if (this.container) {
        this.container.innerHTML = '';
        this.container.style.display = 'none';
      }
      if (this.counterObserver) {
        this.counterObserver.disconnect();
      }
      if (this.counterElement) {
        this.counterElement.remove();
      }
    }
  }

  // Initialize widget when DOM is ready
  function initWidget() {
    window.socialProofWidget = new SocialProofWidget();
    window.socialProofWidget.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    // Small delay to ensure Liquid has rendered
    setTimeout(initWidget, 100);
  }
})();
