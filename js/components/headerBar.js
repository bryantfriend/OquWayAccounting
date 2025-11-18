import * as ui from '../ui.js';

/**
 * 🌐 Unified Top Header Bar — Inline Layout + Spin Animation + Smooth Fade
 */
export function createHeaderBar({ currentMonth, currentYear, timeRange, showReload = true }) {
  const monthLabel = getMonthLabel(currentMonth, currentYear);

  // ✅ Updated ranges: Week / Month / Year
  const ranges = [
    { key: 'weekly', label: '🗓️ Week' },
    { key: 'monthly', label: '📈 Month' },
    { key: 'yearly', label: '📅 Year' },
  ];

  return `
    <div class="month-header flex flex-wrap items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 mb-6">

      <!-- Left: Range Buttons -->
      <div class="flex flex-wrap items-center gap-2">
        ${ranges.map(
          (r) => `
          <button
            class="range-btn ${timeRange === r.key ? 'active' : ''}"
            data-range="${r.key}">
            ${r.label}
          </button>`
        ).join('')}
      </div>

      <!-- Right: Month Controls + Refresh -->
      <div class="flex items-center gap-2 sm:gap-3">
        <button id="prevMonthBtn"
          class="month-nav-btn bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md transition"
          title="Previous Month">⬅️</button>

        <button id="monthLabelBtn"
          class="month-label bg-blue-50 text-blue-700 px-4 py-1.5 rounded-md border border-blue-100 hover:bg-blue-100 font-medium transition"
          title="Click to change month">
          📆 ${monthLabel}
        </button>

        <button id="nextMonthBtn"
          class="month-nav-btn bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md transition"
          title="Next Month">➡️</button>

        ${
          showReload
            ? `
          <button id="reloadOverviewBtn"
            class="btn-secondary flex items-center gap-1 px-3 py-1.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 rounded-md shadow-sm transition"
            title="Reload Data">
            <span class="reload-icon inline-block">🔄</span>
            <span>Refresh</span>
          </button>`
            : ''
        }
      </div>
    </div>
  `;
}

/**
 * ⚙️ Attaches listeners for unified header bar
 * Adds fade-in/out on render transitions
 */
export function attachHeaderEvents(containerSelector, context, callbacks = {}) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const tryAttach = () => {
    const header = container.querySelector('.month-header');
    if (!header) return false;

    // Smooth fade handler
    const fadeOutIn = async (callback) => {
      container.classList.add('fade-out');
      await new Promise((r) => setTimeout(r, 200));
      await callback();
      container.classList.remove('fade-out');
      container.classList.add('fade-in');
      setTimeout(() => container.classList.remove('fade-in'), 250);
    };

    // --- Month navigation ---
    header.querySelector('#prevMonthBtn')?.addEventListener('click', () => {
      const { month, year } = shiftMonth(context.currentMonth, context.currentYear, -1);
      fadeOutIn(() => callbacks.onMonthChange?.(month, year));
    });

    header.querySelector('#nextMonthBtn')?.addEventListener('click', () => {
      const { month, year } = shiftMonth(context.currentMonth, context.currentYear, 1);
      fadeOutIn(() => callbacks.onMonthChange?.(month, year));
    });

    // --- Month label modal ---
    header.querySelector('#monthLabelBtn')?.addEventListener('click', () => {
      ui.openMonthModal(context.currentMonth, context.currentYear, (m, y) => {
        fadeOutIn(() => callbacks.onMonthChange?.(m, y));
      });
    });

    // --- Range buttons (now week/month/year) ---
    header.querySelectorAll('.range-btn')?.forEach((btn) => {
      btn.addEventListener('click', () =>
        fadeOutIn(() => callbacks.onRangeChange?.(btn.dataset.range))
      );
    });

    // --- Reload ---
    header.querySelector('#reloadOverviewBtn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const icon = btn.querySelector('.reload-icon');
      const label = btn.querySelector('span:last-child');
      btn.disabled = true;
      icon.classList.add('spin');
      label.textContent = 'Refreshing...';
      await fadeOutIn(async () => callbacks.onReload?.());
      icon.classList.remove('spin');
      label.textContent = 'Refresh';
      btn.disabled = false;
      ui.showToast('✅ Data refreshed successfully!');
    });

    return true;
  };

  // Retry logic for dynamic render
  if (!tryAttach()) {
    const observer = new MutationObserver(() => {
      if (tryAttach()) observer.disconnect();
    });
    observer.observe(container, { childList: true, subtree: true });
  }
}

/* --- Helpers --- */
function getMonthLabel(month, year) {
  return new Date(year, month).toLocaleString('en', { month: 'long', year: 'numeric' });
}

function shiftMonth(month, year, delta) {
  let newMonth = month + delta;
  let newYear = year;
  if (newMonth < 0) { newMonth = 11; newYear--; }
  else if (newMonth > 11) { newMonth = 0; newYear++; }
  return { month: newMonth, year: newYear };
}
