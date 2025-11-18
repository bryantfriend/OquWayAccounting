// js/modals/BaseModal.js
import { showToast, showGlobalLoader, hideGlobalLoader } from '../ui.js';

// Static counter to ensure new modals always appear on top
let zIndexCounter = 60;

/**
 * Base class for all modals in the application.
 * Handles shell creation, z-index, show/hide, and close events.
 */
export class BaseModal {
  /**
   * @param {string} title - The title to display in the modal header.
   * @param {object} options - Configuration options.
   * @param {string} options.size - 'max-w-md', 'max-w-lg', 'max-w-2xl', 'max-w-6xl'
   */
  constructor(title, options = {}) {
    this.title = title;
    this.size = options.size || 'max-w-2xl';
    this.onSave = options.onSave || null;
    this.onClose = options.onClose || null;

    this.zIndex = zIndexCounter;
    zIndexCounter += 10; // Increment for the next modal

    this.modalEl = this._createShell();
    this._attachShellEvents();
  }

  /**
   * Creates the modal's outer shell and overlay.
   * @returns {HTMLElement} The modal overlay element.
   * @private
   */
  _createShell() {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.zIndex = this.zIndex;
    
    // Using Tailwind classes via a class list for clarity
    modalOverlay.classList.add(
      'fixed', 'inset-0', 'bg-gray-900', 'bg-opacity-70', 
      'flex', 'items-center', 'justify-center', 'p-4'
    );

    modalOverlay.innerHTML = `
      <div class="modal-content bg-white rounded-lg shadow-2xl w-full ${this.size} flex flex-col max-h-[90vh]">
        <div class="p-5 border-b flex justify-between items-center">
          <h3 class="text-lg font-semibold">${this.title}</h3>
          <button class="close-btn text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        
        <div class="modal-body p-6 overflow-y-auto">
        </div>
        
        <div class="bg-gray-50 px-6 py-3 border-t text-right space-x-3">
          <button class="cancel-btn btn-secondary">Cancel</button>
          ${this.renderFooter()}
        </div>
      </div>
    `;
    return modalOverlay;
  }

  /**
   * Attaches close events to the shell.
   * @private
   */
  _attachShellEvents() {
    // Click close button
    this.modalEl.querySelector('.close-btn').addEventListener('click', () => {
      this.close();
    });

    // Click cancel button
    this.modalEl.querySelector('.cancel-btn').addEventListener('click', () => {
      this.close();
    });

    // Click on overlay to close
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });
  }

  /**
   * (Abstract) Child classes MUST override this.
   * @returns {string} The HTML for the modal's body.
   */
  renderContent() {
    throw new Error('Modal must implement renderContent()');
  }

  /**
   * (Optional) Child classes can override this to add save buttons.
   * @returns {string} The HTML for the modal's footer buttons (e.g., "Save").
   */
  renderFooter() {
    return ''; // No save button by default
  }

  /**
   * (Optional) Child classes MUST override this to attach their listeners.
   */
  attachEventListeners() {
    // Child class will add its own listeners here
  }

  /**
   * Appends the modal to the DOM and makes it visible.
   */
show() {
    // 1. Inject content *now* that the child constructor has finished
    const body = this.modalEl.querySelector('.modal-body');
    if (body) {
        body.innerHTML = this.renderContent();
    }

    // 2. Append the fully built modal to the DOM
    document.body.appendChild(this.modalEl);
    
    // 3. Attach listeners *after* the element is in the DOM
    this.attachEventListeners();
  }

  /**
   * Removes the modal from the DOM and cleans up z-index.
   */
  close() {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
    zIndexCounter -= 10; // Decrement z-index
    if (this.onClose) {
      this.onClose();
    }
  }

  // --- UI Helpers (proxied for convenience) ---
  showToast(message, type = 'success') {
    showToast(message, type);
  }
  showLoader(text = 'Loading...') {
    showGlobalLoader(text);
  }
  hideLoader() {
    hideGlobalLoader();
  }
}
