// js/modules/classEditorModal.js
import { BaseModal } from '../modals/BaseModal.js';
import * as api from '../api.js';
import { spinnerButton, withButtonSpinner } from '../ui/spinner.js';
import {
  pad,
  setupSpinner,
  createTimePicker,
  generateDisplayName,
  generateClassCode,
} from '../modules/classUtils.js';

export class ClassEditorModal extends BaseModal {
  constructor(cls, teachers, onSave) {
    const title = cls ? `Edit: ${cls.name}` : 'Add New Class';
    super(title, { size: 'max-w-xl', onSave });

    this.cls = cls;
    this.teachers = teachers; // Teachers are passed in
    this.dayTimes = cls?.dayTimes || {};
    this.selectedDays = new Set(cls?.days || []);
    this.isAutoNameEnabled = true;

    // We must bind 'this' for methods used as callbacks
    this.refreshDayButtons = this.refreshDayButtons.bind(this);
    this.updateAutoName = this.updateAutoName.bind(this);
    this._handleSave = this._handleSave.bind(this);
  }

  renderContent() {
    // ADAPTED: Populate teacher options from `this.teachers`
    const teacherOptions = this.teachers.map(t =>
      `<option value="${t.id}" ${this.cls?.teacherId === t.id ? 'selected' : ''}>
         ${t.name}
       </option>`
    ).join('');

    const dayButtonsHtml = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      .map(
        d => `
        <div class="day-wrapper flex flex-col items-center w-16"> 
          <button type="button"
                  data-day="${d}"
                  class="day-btn relative px-3 py-1 w-full text-center border rounded text-sm transition
                         hover:shadow-md transform hover:-translate-y-0.5
                         ${this.selectedDays.has(d)
                           ? "bg-blue-500 text-white shadow-inner"
                           : "bg-gray-100 hover:bg-blue-100"}"
                  title="Set time for ${d}">
            ${d}
          </button>
          <span class="day-time text-xs text-blue-700 font-medium h-4 mt-1">
            ${this.dayTimes[d] || ""}
          </span>
        </div>`
      )
      .join("");

    return `
      <div class="space-y-3">
        <label class="block font-semibold">Class Name <span class="text-red-500">*</span></label>
        <div class="flex items-center gap-2 mb-1">
          <input id="clsName"
                 class="flex-1 border px-3 py-2 rounded"
                 value="${this.cls?.name || ""}"
                 placeholder="e.g. 🕰️9 MWF 💻👥">
          <button id="resetNameBtn" type="button" title="Reset to auto-generated name"
                  class="p-2 bg-gray-200 hover:bg-gray-300 rounded-full transition duration-150
                         text-lg leading-none transform hover:scale-110 active:scale-95">
            ↻
          </button>
        </div>
        <p id="errorName" class="text-red-500 text-sm hidden">Name is required</p>

        <label class="block font-semibold">Subject <span class="text-red-500">*</span></label>
        <input id="clsSubject" class="w-full border px-3 py-2 rounded mb-1"
               value="${this.cls?.subject || ""}">
        <p id="errorSubject" class="text-red-500 text-sm hidden">Subject is required</p>

        <label class="block font-semibold">Language <span class="text-red-500">*</span></label>
        <input id="clsLanguage" class="w-full border px-3 py-2 rounded mb-1"
               value="${this.cls?.language || ""}">
        <p id="errorLanguage" class="text-red-500 text-sm hidden">Language is required</p>

        <label class="block font-semibold">Grade Level <span class="text-red-500">*</span></label>
        <input id="clsGrade" class="w-full border px-3 py-2 rounded mb-1"
               value="${this.cls?.gradeLevel || ""}">
        <p id="errorGrade" class="text-red-500 text-sm hidden">Grade level is required</p>
        
        <label class="block font-semibold">Class Code <span class="text-red-500">*</span></label>
        <div class="flex gap-2 items-center mb-1">
          <input id="clsCode"
                 class="flex-1 border px-3 py-2 rounded"
                 value="${this.cls?.classCode || ""}"
                 placeholder="Auto-generated...">
          <button id="regenCodeBtn" type="button"
                  class="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-2 rounded text-sm font-medium">
            🔁 Generate
          </button>
        </div>
        <p id="errorCode" class="text-red-500 text-sm hidden">Class code is required</p>

        <label class="block font-semibold">Mode</label>
        <select id="clsOnline" class="w-full border px-3 py-2 rounded mb-1">
          <option value="offline" ${this.cls?.isOnline ? "" : "selected"}>🛖 Offline</option>
          <option value="online" ${this.cls?.isOnline ? "selected" : ""}>💻 Online</option>
        </select>

        <label class="block font-semibold">Group Type</label>
        <select id="clsGroup" class="w-full border px-3 py-2 rounded mb-1">
          <option value="group" ${this.cls?.isGroup !== false ? "selected" : ""}>👥 Group</option>
          <option value="individual" ${this.cls?.isGroup === false ? "selected" : ""}>👤 Individual</option>
        </select>
        
        <label class="block font-semibold mt-2">Days of the Week</label>
        <p class="text-xs text-gray-500 mb-2">Click a day to set its time.</p>
        <div id="daysPicker" class="flex flex-wrap gap-2 mb-2">
          ${dayButtonsHtml}
        </div>
        
        <label class="block font-semibold">Assigned Teacher</label>
        <select id="clsTeacher" class="flex-1 border px-3 py-2 rounded w-full">
          <option value="">-- Select Teacher --</option>
          ${teacherOptions}
        </select>
      </div>
    `;
  }

  renderFooter() {
    // ADAPTED: Use spinnerButton from our new UI file
    return spinnerButton("saveBtn", "💾 Save", "blue");
  }

  attachEventListeners() {
    // We must query elements from `this.modalEl`
    const dayWrappers = this.modalEl.querySelectorAll("#daysPicker .day-wrapper");
    
    // Attach listener to the button *inside* the wrapper
    dayWrappers.forEach(wrapper => {
      const btn = wrapper.querySelector(".day-btn");
      btn.addEventListener("click", () => {
        // Use `this` to call the method
        this.showTimeModal(btn.dataset.day);
      });
    });

    // === Auto-name Listeners ===
    this.modalEl.querySelector("#clsName").addEventListener("input", () => {
      this.isAutoNameEnabled = false; 
    });
    this.modalEl.querySelector("#resetNameBtn").addEventListener("click", () => {
      this.isAutoNameEnabled = true;
      this.updateAutoName();
    });
    this.modalEl.querySelector("#clsOnline").addEventListener("change", this.updateAutoName);
    this.modalEl.querySelector("#clsGroup").addEventListener("change", this.updateAutoName);
    this.modalEl.querySelector("#regenCodeBtn").addEventListener("click", () => this._generateCodeAction());

    // === Save Button ===
    this.modalEl.querySelector("#saveBtn")?.addEventListener("click", () => {
        withButtonSpinner("saveBtn", this._handleSave, "💾 Save");
    });

    this.updateAutoName(); // Initial call
  }

  /**
   * Refreshes the styling of the day buttons and their time labels.
   */
  refreshDayButtons() {
    const dayWrappers = this.modalEl.querySelectorAll("#daysPicker .day-wrapper"); 
    dayWrappers.forEach(wrapper => { 
      const btn = wrapper.querySelector(".day-btn");
      const timeSpan = wrapper.querySelector(".day-time");
      const day = btn.dataset.day;
      const time = this.dayTimes[day];
      
      if (this.selectedDays.has(day) && time) {
        btn.classList.add("bg-blue-500", "text-white", "shadow-inner");
        btn.classList.remove("bg-gray-100", "hover:bg-blue-100");
        btn.setAttribute("title", `${day}: ${time}`);
        timeSpan.textContent = time;
      } else {
        btn.classList.remove("bg-blue-500", "text-white", "shadow-inner");
        btn.classList.add("bg-gray-100", "hover:bg-blue-100");
        btn.setAttribute("title", `Set time for ${day}`);
        timeSpan.textContent = "";
        if (this.selectedDays.has(day) && !time) {
          this.selectedDays.delete(day);
        }
      }
    });
  }

  /**
   * Shows the time selection modal.
   * This is adapted from your ClassEditor.js
   */
  showTimeModal(day) {
    const existingTime = this.dayTimes[day] || "09:00-10:00";
    const [start, end] = existingTime.split("-");
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);

    const timeModal = document.createElement("div");
    timeModal.className = "fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4"; // Higher z-index

    timeModal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-xl font-bold text-center mb-5 text-gray-800">
          Select Time for <span class="text-blue-600">${day}</span>
        </h2>
        <div class="flex justify-around items-start mb-6 gap-4">
          ${createTimePicker("start", "Start Time", startH, startM)}
          ${createTimePicker("end", "End Time", endH, endM)}
        </div>
        <div class="flex justify-between items-center space-x-2">
          <button id="time-modal-remove" class="btn-danger-secondary">🗑 Remove Day</button>
          <button id="time-modal-cancel" class="btn-secondary">🚫 Cancel</button>
          <button id="time-modal-save" class="btn-primary">✅ Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(timeModal);

    // --- Add Spinner Logic ---
    setupSpinner(timeModal.querySelector("#start-hour-input"), timeModal.querySelector("#start-hour-display"), timeModal.querySelector("#start-hour-up"), timeModal.querySelector("#start-hour-down"), 7, 22, 1, true, true);
    setupSpinner(timeModal.querySelector("#start-min-input"), timeModal.querySelector("#start-min-display"), timeModal.querySelector("#start-min-up"), timeModal.querySelector("#start-min-down"), 0, 55, 5, true, true);
    setupSpinner(timeModal.querySelector("#end-hour-input"), timeModal.querySelector("#end-hour-display"), timeModal.querySelector("#end-hour-up"), timeModal.querySelector("#end-hour-down"), 7, 22, 1, true, true);
    setupSpinner(timeModal.querySelector("#end-min-input"), timeModal.querySelector("#end-min-display"), timeModal.querySelector("#end-min-up"), timeModal.querySelector("#end-min-down"), 0, 55, 5, true, true);
    
    const closeModal = () => timeModal.remove();

    timeModal.querySelector("#time-modal-cancel").addEventListener("click", closeModal);
    
    timeModal.querySelector("#time-modal-remove").addEventListener("click", () => {
      delete this.dayTimes[day];
      this.selectedDays.delete(day);
      this.refreshDayButtons(); 
      this.updateAutoName();   
      closeModal();
    });

    timeModal.querySelector("#time-modal-save").addEventListener("click", () => {
      const newStartH = pad(timeModal.querySelector("#start-hour-input").value);
      const newStartM = pad(timeModal.querySelector("#start-min-input").value);
      const newEndH = pad(timeModal.querySelector("#end-hour-input").value);
      const newEndM = pad(timeModal.querySelector("#end-min-input").value);
      const timeRange = `${newStartH}:${newStartM}-${newEndH}:${newEndM}`;

      this.dayTimes[day] = timeRange;
      this.selectedDays.add(day); 
      this.refreshDayButtons(); 
      this.updateAutoName();   
      closeModal();
    });
  }

  /**
   * Updates the Class Name input field if auto-name is enabled.
   */
  updateAutoName() {
    if (!this.isAutoNameEnabled) return;

    const nameInput = this.modalEl.querySelector("#clsName");
    const onlineInput = this.modalEl.querySelector("#clsOnline");
    const groupInput = this.modalEl.querySelector("#clsGroup");
    if (!nameInput || !onlineInput || !groupInput) return;

    const isOnline = onlineInput.value === "online";
    const isGroup = groupInput.value === "group";

    nameInput.value = generateDisplayName(
      this.dayTimes,
      this.selectedDays,
      isOnline,
      isGroup
    );
  }

  /**
   * Click handler for the "Generate Code" button
   */
  _generateCodeAction() {
    const onlineInput = this.modalEl.querySelector("#clsOnline");
    const groupInput = this.modalEl.querySelector("#clsGroup");
    const gradeInput = this.modalEl.querySelector("#clsGrade");
    const codeInput = this.modalEl.querySelector("#clsCode");

    if (!onlineInput || !groupInput || !gradeInput || !codeInput) return;

    codeInput.value = generateClassCode(
      this.dayTimes,
      this.selectedDays,
      onlineInput.value === "online",
      groupInput.value === "group",
      gradeInput.value
    );
  }

  /**
   * Handles validation and saving of the class.
   */
  async _handleSave() {
    // --- 1. Get All Elements ---
    const nameInput = this.modalEl.querySelector("#clsName");
    const subjectInput = this.modalEl.querySelector("#clsSubject");
    const langInput = this.modalEl.querySelector("#clsLanguage");
    const gradeInput = this.modalEl.querySelector("#clsGrade");
    const codeInput = this.modalEl.querySelector("#clsCode");
    const onlineInput = this.modalEl.querySelector("#clsOnline");
    const groupInput = this.modalEl.querySelector("#clsGroup");
    const teacherSelect = this.modalEl.querySelector("#clsTeacher");
    const selectedTeacherId = teacherSelect.value;
    const selectedTeacherName = teacherSelect.options[teacherSelect.selectedIndex]?.text.trim() || "";

    // --- 2. Validation ---
    let isValid = true;
    const validate = (input, errorId) => {
      const errorEl = this.modalEl.querySelector(`#${errorId}`);
      if (!input.value.trim()) {
        errorEl.classList.remove("hidden");
        input.classList.add("border-red-500");
        isValid = false;
      } else {
        errorEl.classList.add("hidden");
        input.classList.remove("border-red-500");
      }
    };
    
    validate(nameInput, "errorName");
    validate(subjectInput, "errorSubject");
    validate(langInput, "errorLanguage");
    validate(gradeInput, "errorGrade");
    validate(codeInput, "errorCode");

    if (!isValid) {
      this.showToast('Please fix the errors on the form.', 'error');
      // Must throw an error to stop withButtonSpinner's 'finally' block
      throw new Error('Validation failed');
    }

    // --- 3. Data Assembly ---
    const days = Array.from(this.selectedDays);
    const isOnline = onlineInput.value === "online";
    const isGroup = groupInput.value === "group";

    const data = {
      name: nameInput.value.trim(),
      subject: subjectInput.value.trim(),
      language: langInput.value.trim(),
      gradeLevel: gradeInput.value.trim(),
      classCode: codeInput.value.trim(),
      isOnline: isOnline,
      isGroup: isGroup,
      teacherId: selectedTeacherId,
      teacherName: selectedTeacherName,
      days: days, 
      dayTimes: this.dayTimes,
      displayName: generateDisplayName(this.dayTimes, this.selectedDays, isOnline, isGroup),
      // Set students array if it's a new class
      students: this.cls?.students || [],
    };

    // --- 4. Call API ---
    try {
      if (this.cls?.id) {
        await api.updateClass(this.cls.id, data);
      } else {
        await api.saveClass(data);
      }
      
      if (this.onSave) {
        this.onSave(); // Run the callback from classes.js
      }
      this.close(); // Close this modal
      
    } catch (error) {
      console.error('Failed to save class:', error);
      this.showToast(`Error: ${error.message}`, 'error');
      throw error; // Re-throw to be caught by withButtonSpinner
    }
  }
}