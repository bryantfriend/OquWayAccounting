// js/ui.js
import * as api from './api.js';
import { auth } from '../firebase-init.js';
import { formatCurrency, debounce, createSpinner } from './utils.js';
import { Timestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

/* --- Modern Button Helpers --- */
export function createButton(label, color = 'gray', emoji = '') {
  const colors = {
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    green: 'bg-green-600 hover:bg-green-700 text-white',
    red: 'bg-red-600 hover:bg-red-700 text-white',
    gray: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
  };

  return `
    <button 
      class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 shadow-sm ${colors[color]}">
      ${emoji ? `${emoji}` : ''} ${label}
    </button>
  `;
}

export function createActionButton(type, dataId = '') {
  const styles = {
    edit: { color: 'blue', emoji: '✏️', label: 'Edit' },
    delete: { color: 'red', emoji: '🗑️', label: 'Delete' },
    save: { color: 'green', emoji: '💾', label: 'Save' },
  };
  const { color, emoji, label } = styles[type] || styles.edit;
  return `
    <button 
      data-id="${dataId}"
      class="action-btn-${type} ${color}-btn inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium ${getButtonClasses(color)}">
      ${emoji} ${label}
    </button>
  `;
}

function getButtonClasses(color) {
  switch (color) {
    case 'blue':
      return 'bg-blue-600 text-white hover:bg-blue-700 transition';
    case 'red':
      return 'bg-red-600 text-white hover:bg-red-700 transition';
    case 'green':
      return 'bg-green-600 text-white hover:bg-green-700 transition';
    default:
      return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  }
}


export function createTimeRangeToggle(activeRange = 'monthly') {
  const ranges = ['daily', 'weekly', 'monthly'];
  return `
    <div class="time-range-btn-group inline-flex rounded-md shadow-sm mb-6" role="group">
      ${ranges
        .map(
          (range) => `
        <button
          type="button"
          class="time-range-btn ${range === activeRange ? 'active' : ''}"
          data-range="${range}"
        >
          ${range.charAt(0).toUpperCase() + range.slice(1)}
        </button>
      `
        )
        .join('')}
    </div>
  `;
}

/**
 * Creates the HTML for a single statistic card.
 */
export function createStatCard(title, value, emoji = '', subtitle = '', modalType = null) {
  let formattedValue = value;
  let valueColor = 'text-gray-900';

  if (typeof value === 'number') {
    if (value < 0) {
      valueColor = 'text-red-600';
    }
    formattedValue = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'KGS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  const modalClass = modalType ? 'cursor-pointer' : '';
  const modalData = modalType ? `data-modal-type="${modalType}"` : '';

  return `
    <div class="stat-card ${modalClass} bg-white p-6 rounded-lg shadow-md transition-all duration-300 hover:shadow-lg" ${modalData}>
      <div class="flex justify-between items-start">
        <h3 class="text-sm font-medium text-gray-500 truncate">${title}</h3>
        <span class="text-2xl">${emoji}</span>
      </div>
      <p class="mt-1 text-3xl font-semibold ${valueColor}">${formattedValue}</p>
      ${subtitle ? `<p class="text-sm text-gray-500 mt-1">${subtitle}</p>` : ''}
    </div>
  `;
}

/**
 * Renders the full two-column layout for a feature tab.
 */
export function renderPageLayout(containerId, mainContentHtml, sidebarHtml) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2">
        ${mainContentHtml}
      </div>
      <div>
        ${sidebarHtml}
      </div>
    </div>
  `;
}

/**
 * Creates the HTML for the "Record New Payment" form.
 */
export function createPaymentForm() {
  const today = new Date().toISOString().split('T')[0];
  return `
    <div class="p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <h3 class="text-lg font-semibold mb-5 flex items-center gap-2 text-gray-800">
        💵 Record New Payment
      </h3>

      <div class="space-y-4">
        <div>
          <label for="studentSearchInput" class="block text-sm font-medium text-gray-700">👤 Student Name</label>
          <input type="text" id="studentSearchInput"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 transition"
            placeholder="Start typing..." autocomplete="off" />
          <div id="studentSearchResults" class="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 hidden shadow-lg max-h-60 overflow-y-auto"></div>
          <p id="studentSelectionFeedback" class="text-sm text-gray-600 mt-1 h-5"></p>
        </div>

        <input type="hidden" id="selectedStudentId" />

        <div>
          <label for="paymentAmount" class="block text-sm font-medium text-gray-700">💰 Amount (KGS)</label>
          <input id="paymentAmount" type="number"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 transition"
            placeholder="e.g., 5000" />
        </div>

        <div>
          <label for="paymentDate" class="block text-sm font-medium text-gray-700">📅 Date of Payment</label>
          <input id="paymentDate" type="date"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 transition"
            value="${today}" />
        </div>

        <div>
          <label for="paymentMethod" class="block text-sm font-medium text-gray-700">🏦 Method</label>
          <select id="paymentMethod"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 transition">
            <option value="cash">Cash</option>
            <option value="qr">QR</option>
            <option value="card">Card</option>
          </select>
        </div>
      </div>

      <div class="flex justify-end mt-6">
        <button id="savePaymentBtn"
          class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center gap-2 font-semibold transition">
          💾 Save Payment
        </button>
      </div>
    </div>
  `;
}


/**
 * Creates the HTML for the "Record New Expense" form.
 */
export async function createExpenseForm() {
  const locationId = localStorage.getItem('activeLocationId') || 'default';
  const categories = await api.getExpenseCategories(locationId);
  const today = new Date().toISOString().split('T')[0];

  const defaultColor = categories[0]?.color || '#9CA3AF';

  const categoryOptions = categories.length
    ? categories
      .map(
        (c) =>
          `<option value="${c.name}" data-color="${c.color}" style="color:${c.color};">${c.name}</option>`
      )
      .join('')
    : `<option disabled selected>No categories available</option>`;

  return `
    <div class="p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <h3 class="text-lg font-semibold mb-5 flex items-center gap-2 text-gray-800">
        💰 Record New Expense
      </h3>

      <div class="space-y-4">
        <div>
          <label for="expenseDescription" class="block text-sm font-medium text-gray-700">📝 Description</label>
          <input id="expenseDescription" type="text"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 transition"
            placeholder="e.g., Office Supplies or Equipment" />
        </div>

        <div>
          <label for="expenseAmount" class="block text-sm font-medium text-gray-700">💸 Amount (KGS)</label>
          <input id="expenseAmount" type="number"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 transition"
            placeholder="e.g., 25000" />
        </div>

        <div>
          <label for="expenseDate" class="block text-sm font-medium text-gray-700">📅 Date of Expense</label>
          <input id="expenseDate" type="date"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 transition"
            value="${today}" />
        </div>

        <div>
          <label for="expenseCategory" class="block text-sm font-medium text-gray-700 mb-1">📂 Category</label>
          <div class="flex items-center gap-3">
            <select id="expenseCategory" class="w-full p-2 border rounded">
              ${categoryOptions}
            </select>
            <div id="categoryColorPreview"
              class="w-6 h-6 rounded-full border border-gray-300 shadow-sm"
              style="background-color: ${defaultColor};"
              title="Category color"></div>
          </div>
          ${
            !categories.length
              ? `<p class="text-xs text-gray-500 mt-1 italic">
                  No categories found. Go to the <strong>Categories</strong> tab to add them.
                </p>`
              : ''
          }
        </div>
      </div>

      <div class="flex justify-end mt-6">
        <button id="saveExpenseBtn"
          class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center gap-2 font-semibold transition">
          💾 Save Expense
        </button>
      </div>
    </div>

    <script>
      const categorySelect = document.getElementById('expenseCategory');
      const colorPreview = document.getElementById('categoryColorPreview');
      if (categorySelect && colorPreview) {
        categorySelect.addEventListener('change', (e) => {
          const selectedOption = e.target.selectedOptions[0];
          const color = selectedOption?.dataset.color || '#9CA3AF';
          colorPreview.style.backgroundColor = color;
        });
      }
    </script>
  `;
}


/* --------------------------------------------------------------------------
   🌐 UNIFIED DASHBOARD HEADER + MONTH/YEAR MODAL
-------------------------------------------------------------------------- */

/**
 * Creates the unified toolbar for time-range and month navigation.
 */
export function createMonthHeader({ currentMonth, currentYear, activeRange }) {
  const monthLabel = new Date(currentYear, currentMonth).toLocaleString('en', { month: 'long', year: 'numeric' });
  return `
    <div class="bg-white shadow-sm rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
      <div class="flex space-x-2 mb-3 sm:mb-0">
        ${['daily', 'weekly', 'monthly'].map(range => `
          <button 
            class="range-btn px-3 py-1.5 rounded-md text-sm font-medium transition 
              ${activeRange === range ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}"
            data-range="${range}">
            ${range.charAt(0).toUpperCase() + range.slice(1)}
          </button>
        `).join('')}
      </div>
      <div class="flex items-center space-x-3">
        <button id="prevMonthBtn" class="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition">⬅</button>
        <button id="monthLabelBtn" class="font-semibold text-gray-800 text-lg px-3 py-1 rounded hover:bg-gray-100 transition" title="Click to change month/year">${monthLabel}</button>
        <button id="nextMonthBtn" class="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition">➡</button>
      </div>
    </div>
  `;
}

/**
 * Opens the modal for selecting a month and year.
 */
export function openMonthModal(currentMonth, currentYear, onApply) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const label = new Date(2000, i, 1).toLocaleString('en', { month: 'long' });
    return `<option value="${i}" ${i === currentMonth ? 'selected' : ''}>${label}</option>`;
  }).join('');

  const html = `
    <div class="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-2xl w-full max-w-md transform transition-all scale-100">
        <div class="p-6 border-b text-center">
          <h3 class="text-lg font-semibold text-gray-800">Select Month & Year</h3>
        </div>
        <div class="p-6 space-y-4">
          <div class="flex items-center space-x-3">
            <select id="monthSelect" class="flex-1 border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500">
              ${monthOptions}
            </select>
            <input id="yearInput" type="number" class="w-28 border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500" value="${currentYear}">
          </div>
        </div>
        <div class="bg-gray-50 px-6 py-3 flex justify-end space-x-3 border-t">
          <button id="cancelMonthBtn" class="bg-white py-2 px-4 border border-gray-300 rounded-md text-sm hover:bg-gray-100">Cancel</button>
          <button id="applyMonthBtn" class="bg-blue-600 text-white py-2 px-4 rounded-md text-sm hover:bg-blue-700">Apply</button>
        </div>
      </div>
    </div>
  `;

  modalContainer.innerHTML = html;

  const close = () => (modalContainer.innerHTML = '');

  // --- Events ---
  document.getElementById('cancelMonthBtn')?.addEventListener('click', close);
  modalContainer.querySelector('.fixed')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) close();
  });
  document.getElementById('applyMonthBtn')?.addEventListener('click', () => {
    const newMonth = parseInt(document.getElementById('monthSelect').value, 10);
    const newYear = parseInt(document.getElementById('yearInput').value, 10);
    if (Number.isFinite(newMonth) && Number.isFinite(newYear)) {
      onApply?.(newMonth, newYear);
      close();
    }
  });
}

/* --------------------------------------------------------------------------
   🌟 GLOBAL TOAST NOTIFICATIONS
-------------------------------------------------------------------------- */
export function showToast(message, type = 'success') {
  // Remove any existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add('show'), 50);

  // Auto-hide
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

export function showGlobalLoader(text = 'Loading...') {
  const overlay = document.getElementById('global-loading-overlay');
  const label = document.getElementById('loading-text');
  if (overlay) overlay.classList.remove('hidden');
  if (label) label.textContent = text;
}

export function hideGlobalLoader() {
  const overlay = document.getElementById('global-loading-overlay');
  if (overlay) overlay.classList.add('hidden');
}

/**
 * Creates the HTML for a single status pill.
 */
export function createStatusPill(text, type) {
  const colors = {
    paid: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    unpaid: 'bg-red-100 text-red-800',
    archived: 'bg-gray-100 text-gray-800',
  };
  return `<span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[type] || colors.archived}">
    ${text}
  </span>`;
}