// js/modals/TeacherFinderModal.js
import { BaseModal } from './BaseModal.js';
import * as api from '../api.js';
import { NewClassModal } from './NewClassModal.js'; // <-- UPDATED IMPORT
import { showToast } from '../ui.js';

// --- Helpers (Unchanged) ---
function _isSlotAvailable(slotStart, slotEnd, availability) {
  if (!availability) return false;
  try {
    const [availStart, availEnd] = availability.split('-');
    return slotStart >= availStart && slotEnd <= availEnd;
  } catch (e) { return false; }
}
function _findClassAtSlot(day, slotStart, slotEnd, teacherClasses) {
  for (const cls of teacherClasses) {
    if (cls.days && cls.days.includes(day)) {
      const classTime = cls.dayTimes[day];
      if (!classTime) continue;
      try {
        const [classStart, classEnd] = classTime.split('-');
        if (slotStart < classEnd && slotEnd > classStart) return cls; 
      } catch (e) { }
    }
  }
  return null; 
}

export class TeacherFinderModal extends BaseModal {
  constructor(student, teachers, classes, onSave) {
    const title = student.id ? `Find Slot for ${student.name}` : `View Availability for ${student.name}`;
    super(title, { size: 'max-w-6xl', onSave });

    this.student = student;
    this.teachers = teachers;
    this.classes = classes;
    this.timeSlots = Array.from({ length: 14 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`);
    this.days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    this.state = {
      isOnline: false,
      scheduleType: 'mwf',
      teacherSearch: '', // <-- NEW
      languages: { English: false, Russian: false, Kyrgyz: false }
    };
    
    this.masterSchedule = this._buildMasterSchedule();
  }

  _buildMasterSchedule() {
    // ... (Identical to previous version) ...
    const schedule = new Map();
    const teacherClassMap = new Map();
    for (const teacher of this.teachers) teacherClassMap.set(teacher.id, this.classes.filter(c => c.teacherId === teacher.id));

    for (const slotStart of this.timeSlots) {
      const slotEnd = `${(parseInt(slotStart.split(':')[0]) + 1).toString().padStart(2, '0')}:00`;
      for (const day of this.days) {
        const slotKey = `${day}-${slotStart}`;
        const slotData = { availableNew: [], availableJoin: [], booked: [] };

        for (const teacher of this.teachers) {
          const availability = teacher.dayTimes ? teacher.dayTimes[day] : null;
          if (_isSlotAvailable(slotStart, slotEnd, availability)) {
            const teacherClasses = teacherClassMap.get(teacher.id);
            const existingClass = _findClassAtSlot(day, slotStart, slotEnd, teacherClasses);

            if (!existingClass) {
                slotData.availableNew.push(teacher);
            } else {
                const isGroup = existingClass.isGroup;
                const studentCount = existingClass.students?.length || 0;
                const hasSpace = studentCount < 10; 
                if (isGroup && hasSpace) slotData.availableJoin.push({ teacher, cls: existingClass });
                else slotData.booked.push(teacher);
            }
          }
        }
        schedule.set(slotKey, slotData);
      }
    }
    return schedule;
  }

  /**
   * --- ✨ NEW HELPER: Filter logic ---
   */
  _shouldShowTeacher(teacher) {
      // 1. Text Search
      if (this.state.teacherSearch) {
          if (!teacher.name.toLowerCase().includes(this.state.teacherSearch)) return false;
      }
      
      // 2. Online/Offline Preference
      // teacher.teachingMode can be 'online', 'offline', or 'both' (or undefined/'offline')
      const tMode = teacher.teachingMode || 'offline';
      if (this.state.isOnline) {
          // If Looking for Online: Hide teachers who ONLY do offline
          if (tMode === 'offline') return false;
      } else {
          // If Looking for Offline: Hide teachers who ONLY do online
          if (tMode === 'online') return false;
      }

      // 3. Language
      const activeLangs = Object.keys(this.state.languages).filter(k => this.state.languages[k]);
      if (activeLangs.length > 0) {
         const tLangs = (teacher.languages || '').toLowerCase();
         if (!activeLangs.some(lang => tLangs.includes(lang.toLowerCase()))) return false;
      }

      return true;
  }

  renderContent() {
    const titleText = this.student.id ? 
      `<span class="font-medium">Settings for new class:</span>` : 
      `<span class="font-medium text-blue-600">Viewing availability for: ${this.student.name}</span>`;

    return `
      <div class="border-b p-3 bg-gray-50 flex flex-col gap-3">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                ${titleText}
                <label class="flex items-center gap-2 cursor-pointer select-none bg-white border rounded px-2 py-1 shadow-sm">
                   <input type="checkbox" id="class-mode-toggle" class="form-checkbox text-blue-600" ${this.state.isOnline ? 'checked' : ''}>
                   <span class="font-medium">Online Class</span>
                </label>
            </div>
            <div class="flex items-center gap-2 filter-btn-group" data-filter-group="scheduleType">
                <span class="text-sm font-medium">Schedule:</span>
                <button class="filter-btn ${this.state.scheduleType === 'mwf' ? 'active' : ''}" data-value="mwf">Mon/Wed/Fri</button>
                <button class="filter-btn ${this.state.scheduleType === 'tts' ? 'active' : ''}" data-value="tts">Tue/Thu/Sat</button>
            </div>
        </div>

        <div class="flex items-center gap-6 text-sm border-t pt-2">
            
            <div class="relative">
                <span class="absolute left-2 top-1.5 text-gray-400">🔍</span>
                <input type="text" id="teacher-search-input" class="pl-7 pr-2 py-1 border rounded w-48" placeholder="Filter by teacher..." value="${this.state.teacherSearch}">
            </div>

            <div class="flex items-center gap-3">
                <span class="font-medium text-gray-600">Languages:</span>
                <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" class="lang-filter" value="English" ${this.state.languages.English ? 'checked' : ''}> English</label>
                <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" class="lang-filter" value="Russian" ${this.state.languages.Russian ? 'checked' : ''}> Russian</label>
                <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" class="lang-filter" value="Kyrgyz" ${this.state.languages.Kyrgyz ? 'checked' : ''}> Kyrgyz</label>
            </div>
        </div>
      </div>

      <div id="teacher-finder-timetable" class="overflow-auto max-h-[70vh]"></div>
      
      <div class="p-2 text-xs text-center text-gray-500 bg-gray-50 border-t flex justify-center gap-4">
        <span><span class="inline-block w-3 h-3 bg-blue-50 border border-blue-200 mr-1"></span> Open (Create New)</span>
        <span><span class="inline-block w-3 h-3 bg-green-100 border border-green-200 mr-1"></span> Existing Group (Join)</span>
        <span><span class="inline-block w-3 h-3 bg-red-50 border border-red-100 mr-1"></span> Booked</span>
      </div>
    `;
  }

  renderFooter() { return ''; }
  
  attachEventListeners() {
    this.renderTimetable(); 

    const modeToggle = this.modalEl.querySelector('#class-mode-toggle');
    modeToggle?.addEventListener('change', e => {
        this.state.isOnline = e.target.checked;
        this.renderTimetable(); // Re-render to filter teachers
    });

    const searchInput = this.modalEl.querySelector('#teacher-search-input');
    searchInput?.addEventListener('input', e => {
        this.state.teacherSearch = e.target.value.toLowerCase();
        this.renderTimetable();
    });

    const scheduleGroup = this.modalEl.querySelector('[data-filter-group="scheduleType"]');
    scheduleGroup?.addEventListener('click', e => {
        const btn = e.target.closest('.filter-btn');
        if (btn) {
            this.state.scheduleType = btn.dataset.value;
            scheduleGroup.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.renderTimetable();
        }
    });

    this.modalEl.querySelectorAll('.lang-filter').forEach(cb => {
        cb.addEventListener('change', (e) => {
            this.state.languages[e.target.value] = e.target.checked;
            this.renderTimetable(); 
        });
    });

    this.modalEl.querySelector('#teacher-finder-timetable').addEventListener('click', e => {
      const slot = e.target.closest('.timetable-slot.is-available');
      if (!slot) return;
      
      const day = slot.dataset.day;
      const time = slot.dataset.time;
      
      let daysInSchedule = [day];
      if (this.state.scheduleType === 'mwf' && ['Mon', 'Wed', 'Fri'].includes(day)) {
        daysInSchedule = ['Mon', 'Wed', 'Fri'];
      } else if (this.state.scheduleType === 'tts' && ['Tue', 'Thu', 'Sat'].includes(day)) {
        daysInSchedule = ['Tue', 'Thu', 'Sat'];
      }
      
      const daySlots = daysInSchedule.map(d => this.masterSchedule.get(`${d}-${time}`));

      // Filter available teachers using our shared filter logic
      let validNewTeachers = [];
      if (daySlots.every(ds => ds)) {
          const firstDayTeachers = daySlots[0].availableNew;
          validNewTeachers = firstDayTeachers
            .filter(t => this._shouldShowTeacher(t)) // Apply Filters
            .filter(t => daySlots.every(ds => ds.availableNew.some(other => other.id === t.id)));
      }

      let validJoinableClasses = [];
      if (daySlots[0] && daySlots[0].availableJoin.length > 0) {
          daySlots[0].availableJoin.forEach(item => {
             if (!this._shouldShowTeacher(item.teacher)) return; // Apply Filters

             const targetClassId = item.cls.id;
             const existsEverywhere = daySlots.every(ds => ds.availableJoin.some(j => j.cls.id === targetClassId));
             if (existsEverywhere) validJoinableClasses.push(item);
          });
      }
      
      if (validNewTeachers.length > 0 || validJoinableClasses.length > 0) {
        this._showSelectionModal(validNewTeachers, validJoinableClasses, daysInSchedule, time);
      }
    });
  }

  renderTimetable() {
    const timetableEl = this.modalEl.querySelector('#teacher-finder-timetable');
    
    let timeHeader = '<div class="timetable-header">Time</div>';
    this.days.forEach(day => timeHeader += `<div class="timetable-header">${day}</div>`);
    let gridHtml = timeHeader;

    for (const slotStart of this.timeSlots) {
      gridHtml += `<div class="timetable-time">${slotStart}</div>`;

      for (const day of this.days) {
        
        let daysToCheck = [day];
        let isScheduleDay = false;
        if (this.state.scheduleType === 'mwf') {
            if (['Mon', 'Wed', 'Fri'].includes(day)) { daysToCheck = ['Mon', 'Wed', 'Fri']; isScheduleDay = true; }
        } else if (this.state.scheduleType === 'tts') {
            if (['Tue', 'Thu', 'Sat'].includes(day)) { daysToCheck = ['Tue', 'Thu', 'Sat']; isScheduleDay = true; }
        }
        if (['Sun'].includes(day)) isScheduleDay = false;

        const slotData = this.masterSchedule.get(`${day}-${slotStart}`);

        let hasNewOption = false;
        let hasJoinOption = false;
        let isTotallyBooked = false;

        if (slotData) {
            // Filter slot data using the shared filter logic
            const filteredNew = slotData.availableNew.filter(t => this._shouldShowTeacher(t));
            const filteredJoin = slotData.availableJoin.filter(item => this._shouldShowTeacher(item.teacher));
            const filteredBooked = slotData.booked.filter(t => this._shouldShowTeacher(t)); 

            if (filteredNew.length > 0) hasNewOption = true;
            if (filteredJoin.length > 0) hasJoinOption = true;
            if (!hasNewOption && !hasJoinOption && filteredBooked.length > 0) isTotallyBooked = true;
        }

        let slotClass = 'is-off';
        let slotText = '';
        let disabled = 'disabled';

        if (isScheduleDay) { 
            if (hasNewOption || hasJoinOption) {
              slotClass = 'is-available'; 
              const totalCount = (slotData?.availableNew.filter(t => this._shouldShowTeacher(t)).length || 0) + 
                                 (slotData?.availableJoin.filter(i => this._shouldShowTeacher(i.teacher)).length || 0);
              slotText = `${totalCount} Open`;
              disabled = '';
              
              if (hasJoinOption && !hasNewOption) {
                   slotClass += ' bg-green-100 text-green-800 border-green-300 hover:bg-green-200';
                   slotText = 'Join Grp';
              } else if (hasJoinOption && hasNewOption) {
                   slotText += ' ⭐';
              }

            } else if (isTotallyBooked) {
              slotClass = 'is-booked';
              slotText = 'Booked';
            }
        }
        
        gridHtml += `
          <button class="timetable-slot ${slotClass}" data-day="${day}" data-time="${slotStart}" ${disabled}>${slotText}</button>
        `;
      }
    }
    timetableEl.innerHTML = `<div class="timetable-grid-full">${gridHtml}</div>`;
  }

  _showSelectionModal(newTeachers, joinableClasses, days, time) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: ${this.zIndex + 10};`;

    const newHtml = newTeachers.length > 0 ? `
        <div class="mb-4">
            <h4 class="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">Create New Class</h4>
            <div class="space-y-2">
                ${newTeachers.map(t => `
                    <button class="create-new-btn w-full text-left p-3 rounded-md border hover:bg-blue-50 flex justify-between items-center group" data-id="${t.id}">
                        <span class="font-medium text-gray-700 group-hover:text-blue-700">${t.name}</span>
                        <span class="text-xs text-blue-600 opacity-0 group-hover:opacity-100">Create →</span>
                    </button>
                `).join('')}
            </div>
        </div>
    ` : '';

    const joinHtml = joinableClasses.length > 0 ? `
        <div>
            <h4 class="text-sm font-bold text-green-600 uppercase tracking-wider mb-2">Join Existing Group</h4>
            <div class="space-y-2">
                ${joinableClasses.map(item => `
                    <button class="join-class-btn w-full text-left p-3 rounded-md border bg-green-50 border-green-200 hover:bg-green-100 flex justify-between items-center group" data-class-id="${item.cls.id}">
                        <div>
                            <div class="font-medium text-gray-800">${item.cls.displayName || item.cls.name}</div>
                            <div class="text-xs text-gray-500">Teacher: ${item.teacher.name}</div>
                        </div>
                        <div class="text-right">
                            <span class="text-xs font-bold bg-white text-green-800 px-2 py-1 rounded-full border border-green-200">
                                ${item.cls.students?.length || 0}/10
                            </span>
                        </div>
                    </button>
                `).join('')}
            </div>
        </div>
    ` : '';

    const scheduleString = days.join('/');

    overlay.innerHTML = `
      <div class="modal-content bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div class="p-5 border-b">
          <h3 class="text-lg font-semibold">Select Option</h3>
          <p class="text-sm text-gray-600">For ${scheduleString} @ ${time}</p>
        </div>
        <div class="p-6 overflow-y-auto">
          ${newHtml}
          ${newTeachers.length && joinableClasses.length ? '<hr class="my-4 border-gray-200">' : ''}
          ${joinHtml}
        </div>
        <div class="bg-gray-50 px-6 py-3 border-t text-right">
          <button class="cancel-btn btn-secondary">Cancel</button>
        </div>
      </div>
    `;

    const closeMiniModal = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeMiniModal(); });
    overlay.querySelector('.cancel-btn').addEventListener('click', closeMiniModal);

    overlay.querySelectorAll('.create-new-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const teacherId = btn.dataset.id;
            const teacher = this.teachers.find(t => t.id === teacherId);
            closeMiniModal();
            this._handleBookSlot(teacher, days, time);
        });
    });

    overlay.querySelectorAll('.join-class-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const classId = btn.dataset.classId;
            const cls = this.classes.find(c => c.id === classId);
            closeMiniModal();
            this._handleJoinClass(cls);
        });
    });

    document.body.appendChild(overlay);
  }

  async _handleBookSlot(teacher, days, time) {
    const classModal = new NewClassModal(
      this.student,
      teacher,
      days,
      time,
      this.state.isOnline,
      (newClassData) => {
        if (this.onSave) this.onSave(newClassData); 
        this.close();
      }
    );
    classModal.show();
  }

  async _handleJoinClass(cls) {
    const saveData = {
        studentData: { classId: cls.id },
        pendingClass: null 
    };
    if (this.onSave) this.onSave(saveData);
    this.close();
  }
}