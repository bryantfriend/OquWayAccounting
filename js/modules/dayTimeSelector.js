// js/modules/dayTimeSelector.js
// NO IMPORTS NEEDED

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Module-level state
let state = {
  dayTimes: {},
  selectedDays: new Set(),
  containerEl: null
};

/**
 * Creates the raw HTML for the day/time selector component.
 * This now generates the button-based UI.
 * @returns {string} HTML string
 */
export function createDayTimeSelector() {
  return `
    <label class="block font-semibold mt-2">Days of the Week</label>
    <p class="text-xs text-gray-500 mb-2">Click a day to set its time.</p>
    <div class="flex flex-wrap gap-2 mb-2">
      ${DAYS.map(d => `
        <div class="day-wrapper flex flex-col items-center w-16">
          <button type="button"
                  data-day="${d}"
                  class="day-btn relative px-3 py-1 w-full text-center border rounded text-sm transition
                         hover:shadow-md transform hover:-translate-y-0.5
                         bg-gray-100 hover:bg-blue-100"
                  title="Set time for ${d}">
            ${d}
          </button>
          <span class="day-time text-xs text-blue-700 font-medium h-4 mt-1"></span>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Initializes the selector, sets initial data, and attaches all listeners.
 * @param {HTMLElement} container - The DOM element containing the selector HTML.
 * @param {object} initialData - Optional. { days: [...], dayTimes: {...} }
 */
export function initDayTimeSelector(container, initialData = {}) {
  state.containerEl = container;
  state.dayTimes = initialData.dayTimes || {};
  state.selectedDays = new Set(initialData.days || []);

  // Attach listeners
  state.containerEl.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _showTimeModal(btn.dataset.day);
    });
  });

  // Render initial state
  _refreshDayButtons();
}

/**
 * Gets the current data from the selector.
 * @returns {object} { days: [...], dayTimes: {...} }
 */
export function getDayTimeData() {
  return {
    days: Array.from(state.selectedDays),
    dayTimes: state.dayTimes
  };
}

/**
 * (Private) Refreshes the button styles and time text from the module state.
 */
function _refreshDayButtons() {
  if (!state.containerEl) return;

  state.containerEl.querySelectorAll('.day-wrapper').forEach(wrapper => {
    const btn = wrapper.querySelector('.day-btn');
    const timeSpan = wrapper.querySelector('.day-time');
    const day = btn.dataset.day;
    const time = state.dayTimes[day];
    
    if (state.selectedDays.has(day) && time) {
      btn.classList.add("bg-blue-500", "text-white", "shadow-inner");
      btn.classList.remove("bg-gray-100", "hover:bg-blue-100");
      btn.setAttribute("title", `${day}: ${time}`);
      timeSpan.textContent = time;
    } else {
      btn.classList.remove("bg-blue-500", "text-white", "shadow-inner");
      btn.classList.add("bg-gray-100", "hover:bg-blue-100");
      btn.setAttribute("title", `Set time for ${day}`);
      timeSpan.textContent = "";
      if (state.selectedDays.has(day) && !time) {
        state.selectedDays.delete(day);
      }
    }
  });
}

/**
 * (Private) Shows the modal for a specific day.
 */
function _showTimeModal(day) {
  const existingTime = state.dayTimes[day] || "09:00-10:00";
  const [start, end] = existingTime.split("-");
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);

  const modal = document.createElement("div");
  modal.id = "time-modal";
  modal.className =
    "fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 transition-opacity duration-300";

  modal.innerHTML = `
    <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative transform scale-95 transition-all duration-300">
      <button id="time-modal-close"
              class="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-lg
                     text-gray-500 hover:text-red-500 hover:scale-110 transition-all">
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>
      </button>

      <h2 class="text-xl font-bold text-center mb-5 text-gray-800">
        Select Time for <span class="text-blue-600">${day}</span>
      </h2>

      <div class="flex justify-around items-start mb-6 gap-4">
        ${_createTimePicker("start", "Start Time", startH, startM)}
        ${_createTimePicker("end", "End Time", endH, endM)}
      </div>

      <div class="flex justify-between items-center space-x-2">
        <button id="time-modal-remove"
                class="flex-1 px-4 py-2 rounded-lg text-white font-semibold
                       bg-gradient-to-r from-red-500 to-red-600
                       hover:from-red-600 hover:to-red-700
                       shadow-md hover:shadow-lg transform hover:scale-105 transition-all">
          🗑 Remove Day
        </button>
        <button id="time-modal-cancel"
                class="flex-1 px-4 py-2 rounded-lg text-gray-700 font-semibold
                       bg-gray-200 hover:bg-gray-300
                       shadow-sm hover:shadow-md transform hover:scale-105 transition-all">
          🚫 Cancel
        </button>
        <button id="time-modal-save"
                class="flex-1 px-4 py-2 rounded-lg text-white font-semibold
                       bg-gradient-to-r from-green-500 to-green-600
                       hover:from-green-600 hover:to-green-700
                       shadow-md hover:shadow-lg transform hover:scale-105 transition-all">
          ✅ Save
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // --- Add Spinner Logic ---
  _setupSpinner(
    modal.querySelector("#start-hour-input"),
    modal.querySelector("#start-hour-display"),
    modal.querySelector("#start-hour-up"),
    modal.querySelector("#start-hour-down"),
    7, 22, 1, true, true // 07-22, pad, wrap
  );
  _setupSpinner(
    modal.querySelector("#start-min-input"),
    modal.querySelector("#start-min-display"),
    modal.querySelector("#start-min-up"),
    modal.querySelector("#start-min-down"),
    0, 55, 5, true, true // 00-55, step 5, pad, wrap
  );
  _setupSpinner(
    modal.querySelector("#end-hour-input"),
    modal.querySelector("#end-hour-display"),
    modal.querySelector("#end-hour-up"),
    modal.querySelector("#end-hour-down"),
    7, 22, 1, true, true
  );
  _setupSpinner(
    modal.querySelector("#end-min-input"),
    modal.querySelector("#end-min-display"),
    modal.querySelector("#end-min-up"),
    modal.querySelector("#end-min-down"),
    0, 55, 5, true, true
  );

  // --- Modal Animations ---
  setTimeout(() => {
    modal.classList.remove("opacity-0");
    modal.querySelector("div").classList.remove("scale-95");
  }, 10);

  // --- Button Listeners ---
  const closeModal = () => {
    modal.classList.add("opacity-0");
    modal.querySelector("div").classList.add("scale-95");
    setTimeout(() => modal.remove(), 300);
  };

  modal.querySelector("#time-modal-close").addEventListener("click", closeModal);
  modal.querySelector("#time-modal-cancel").addEventListener("click", closeModal);

  modal.querySelector("#time-modal-remove").addEventListener("click", () => {
    delete state.dayTimes[day];
    state.selectedDays.delete(day);
    _refreshDayButtons(); // Update UI
    closeModal();
  });

  modal.querySelector("#time-modal-save").addEventListener("click", () => {
    const newStartH = _pad(modal.querySelector("#start-hour-input").value);
    const newStartM = _pad(modal.querySelector("#start-min-input").value);
    const newEndH = _pad(modal.querySelector("#end-hour-input").value);
    const newEndM = _pad(modal.querySelector("#end-min-input").value);

    const timeRange = `${newStartH}:${newStartM}-${newEndH}:${newEndM}`;

    state.dayTimes[day] = timeRange;
    state.selectedDays.add(day);
    _refreshDayButtons(); // Update UI
    closeModal();
  });
}


// -------------------------------------------------------------------
// --- INTERNAL HELPER FUNCTIONS (Copied from adminUtils.js) ---
// -------------------------------------------------------------------

/**
 * Pads a number with a leading zero if it's less than 10.
 */
function _pad(num) {
  return String(num).padStart(2, "0");
}

/**
 * Sets up controls for a single spinner (hour or minute).
 */
function _setupSpinner(input, display, upBtn, downBtn, min, max, step, isPad, wrap) {
  let currentValue = parseInt(input.value);

  const update = (value) => {
    currentValue = value;
    input.value = currentValue;
    display.textContent = isPad ? _pad(currentValue) : currentValue;
  };

  upBtn.addEventListener("click", () => _increment());
  downBtn.addEventListener("click", () => _decrement());

  const _increment = () => {
    let newValue = currentValue + step;
    if (newValue > max) {
      newValue = wrap ? min : max;
    }
    update(newValue);
  };

  const _decrement = () => {
    let newValue = currentValue - step;
    if (newValue < min) {
      newValue = wrap ? max : min;
    }
    update(newValue);
  };

  const wheelHandler = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      _increment();
    } else {
      _decrement();
    }
  };

  display.addEventListener("wheel", wheelHandler);
  upBtn.addEventListener("wheel", wheelHandler);
  downBtn.addEventListener("wheel", wheelHandler);

  update(currentValue); // Initial display
}

/**
 * Creates the HTML for one time picker (e.g., "Start Time").
 */
function _createTimePicker(idPrefix, label, initialHour, initialMinute) {
  return `
    <div class="text-center">
      <label class="block text-sm font-medium text-gray-700 mb-1">${label}</label>
      <div class="flex justify-center items-center gap-2">
        <div class="flex flex-col items-center">
          <button type="button" id="${idPrefix}-hour-up"
                  class="p-1 w-10 bg-blue-500 hover:bg-blue-600 text-white rounded-t-md shadow-sm active:scale-95 transition">▲</button>
          <span id="${idPrefix}-hour-display"
                class="text-3xl font-mono bg-gray-100 border-x border-gray-300 w-16 text-center py-1">
            ${_pad(initialHour)} 
          </span>
          <input type="hidden" id="${idPrefix}-hour-input" value="${initialHour}">
          <button type="button" id="${idPrefix}-hour-down"
                  class="p-1 w-10 bg-blue-500 hover:bg-blue-600 text-white rounded-b-md shadow-sm active:scale-95 transition">▼</button>
        </div>

        <span class="text-3xl font-bold pb-2">:</span>

        <div class="flex flex-col items-center">
          <button type="button" id="${idPrefix}-min-up"
                  class="p-1 w-10 bg-blue-500 hover:bg-blue-600 text-white rounded-t-md shadow-sm active:scale-95 transition">▲</button>
          <span id="${idPrefix}-min-display"
                class="text-3xl font-mono bg-gray-100 border-x border-gray-300 w-16 text-center py-1">
            ${_pad(initialMinute)}
          </span>
          <input type="hidden" id="${idPrefix}-min-input" value="${initialMinute}">
          <button type="button" id="${idPrefix}-min-down"
                  class="p-1 w-10 bg-blue-500 hover:bg-blue-600 text-white rounded-b-md shadow-sm active:scale-95 transition">▼</button>
        </div>
      </div>
    </div>
  `;
}