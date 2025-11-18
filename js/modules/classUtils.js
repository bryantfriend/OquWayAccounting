// js/modules/classUtils.js

/**
 * Pads a number with a leading zero if it's less than 10.
 */
export function pad(num) {
  return String(num).padStart(2, "0");
}

/**
 * Sets up controls for a single spinner (hour or minute).
 */
export function setupSpinner(input, display, upBtn, downBtn, min, max, step, isPad, wrap) {
  let currentValue = parseInt(input.value);

  const update = (value) => {
    currentValue = value;
    input.value = currentValue;
    display.textContent = isPad ? pad(currentValue) : currentValue;
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
    e.preventDefault(); // Stop the page from scrolling
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
export function createTimePicker(idPrefix, label, initialHour, initialMinute) {
  return `
    <div class="text-center">
      <label class="block text-sm font-medium text-gray-700 mb-1">${label}</label>
      <div class="flex justify-center items-center gap-2">
        <div class="flex flex-col items-center">
          <button type="button" id="${idPrefix}-hour-up"
                  class="p-1 w-10 bg-blue-500 hover:bg-blue-600 text-white rounded-t-md shadow-sm active:scale-95 transition">▲</button>
          <span id="${idPrefix}-hour-display"
                class="text-3xl font-mono bg-gray-100 border-x border-gray-300 w-16 text-center py-1">
            ${pad(initialHour)} 
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
            ${pad(initialMinute)}
          </span>
          <input type="hidden" id="${idPrefix}-min-input" value="${initialMinute}">
          <button type="button" id="${idPrefix}-min-down"
                  class="p-1 w-10 bg-blue-500 hover:bg-blue-600 text-white rounded-b-md shadow-sm active:scale-95 transition">▼</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * 🕰️ Generate compact emoji-style name
 */
export function generateDisplayName(dayTimes, selectedDays, isOnline, isGroup) {
  if (selectedDays.size === 0) {
    return "";
  }

  // 1. Get earliest hour
  let earliestHour = 24;
  let hasTime = false;
  const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  for (const day of dayOrder) {
    if (selectedDays.has(day)) {
      const time = dayTimes[day];
      if (time) {
        const startHour = parseInt(time.split(":")[0]);
        if (startHour < earliestHour) {
          earliestHour = startHour;
        }
        hasTime = true;
      }
    }
  }
  const hour = hasTime ? earliestHour : "?";

  // 2. Get day abbreviations in correct order
  const dayAbbr = dayOrder
    .filter(d => selectedDays.has(d))
    .map(d => (d === "Thu" ? "Th" : d.charAt(0)))
    .join("");

  // 3. Get icons
  const modeIcon = isOnline ? "💻" : "🛖";
  const groupIcon = isGroup ? "👥" : "👤";

  return `🕰️${hour} ${dayAbbr || "?"} ${modeIcon}${groupIcon}`;
}

/**
 * Generate Class Code Function
 */
export function generateClassCode(dayTimes, selectedDays, isOnline, isGroup, grade) {
  // 1. Mode
  const mode = isOnline ? "on" : "off";

  // 2. Group Type
  const type = isGroup ? "grp" : "ind"; // <-- This now correctly handles 'false'

  // 3. Level (Sanitized)
  const level = grade.trim().toLowerCase().replace(/\s+/g, "") || "lvl";

  // 4. Time
  let earliestStart = 2400; // 24:00 as a number
  let latestEnd = 0;      // 00:00 as a number
  let hasTime = false;

  selectedDays.forEach(day => {
      const timeRange = dayTimes[day];
      if (timeRange) {
          hasTime = true;
          const [start, end] = timeRange.split('-');
          const startNum = parseInt(start.replace(':', ''));
          const endNum = parseInt(end.replace(':', ''));

          if (startNum < earliestStart) earliestStart = startNum;
          if (endNum > latestEnd) latestEnd = endNum;
      }
  });
  
  // Default if no time is set
  const timeStr = hasTime
      ? `${String(earliestStart).padStart(4, '0')}${String(latestEnd).padStart(4, '0')}`
      : "00000000";

  // 5. Combine
  return `${timeStr}-${mode}-${type}-${level}`;
}