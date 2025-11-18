// js/ui/spinner.js

/**
 * Wraps a button so that while an async action runs,
 * it shows a spinner and disables the button.
 */
export async function withButtonSpinner(btnId, action, defaultText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  const btnTextEl = btn.querySelector("span");
  const spinnerEl = btn.querySelector("svg");

  btn.disabled = true;
  spinnerEl?.classList.remove("hidden");
  if(btnTextEl) btnTextEl.textContent = "Processing...";

  try {
    await action();
  } catch (err) {
      console.error(`❌ Action failed on ${btnId}:`, err);
      // We don't alert here, we let the caller handle it (e.g., with a toast)
      throw err; 
  } finally {
      btn.disabled = false;
      spinnerEl?.classList.add("hidden");
      if(btnTextEl) btnTextEl.textContent = defaultText;
  }
}

/**
 * Returns the HTML for a spinner-enabled button.
 */
export function spinnerButton(id, defaultText, color = "green") {
  let colorClasses = 'bg-green-600 hover:bg-green-700'; // Default
  if (color === 'blue') {
      colorClasses = 'btn-primary'; // Use accounting app's style
  } else if (color === 'red') {
      colorClasses = 'btn-danger'; // Use accounting app's style
  }

  return `
    <button type="button" id="${id}" 
            class="${colorClasses} text-white px-4 py-2 rounded flex items-center justify-center gap-2 disabled:opacity-50">
      <span>${defaultText}</span>
      <svg class="hidden animate-spin h-5 w-5 text-white"
           xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10"
                stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
      </svg>
    </button>
  `;
}
