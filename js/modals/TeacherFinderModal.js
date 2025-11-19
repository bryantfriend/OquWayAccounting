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
        `<span class="font-medium text-gray-700">Finding class for: <strong>${this.student.name}</strong></span>` : 
        `<span class="font-medium text-blue-600">Browsing Availability (Prospective)</span>`;

    return `
      <div class="border-b bg-white shadow-sm z-10 relative">
        <div class="flex items-center justify-between p-3 border-b border-gray-100">
            <div>${titleText}</div>
            
            <div class="flex items-center gap-2 filter-btn-group" data-filter-group="scheduleType">
                <span class="text-sm font-medium text-gray-600">Schedule:</span>
                <button class="filter-btn px-4 py-1.5 rounded-md text-sm font-medium transition ${this.state.scheduleType === 'mwf' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}" data-value="mwf">Mon/Wed/Fri</button>
                <button class="filter-btn px-4 py-1.5 rounded-md text-sm font-medium transition ${this.state.scheduleType === 'tts' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}" data-value="tts">Tue/Thu/Sat</button>
            </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 p-3 bg-gray-50">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Filters:</span>
            
            <div class="filter-chip ${this.state.isOnline ? 'active' : ''}" id="mode-chip">
               <span>${this.state.isOnline ? '💻 Online' : '🛖 Offline'}</span>
            </div>

            <div class="h-6 w-px bg-gray-300 mx-2"></div> <div class="filter-chip lang-filter ${this.state.languages.English ? 'active' : ''}" data-value="English">
               <span>🇺🇸 English</span>
            </div>
            <div class="filter-chip lang-filter ${this.state.languages.Russian ? 'active' : ''}" data-value="Russian">
               <span>🇷🇺 Russian</span>
            </div>
            <div class="filter-chip lang-filter ${this.state.languages.Kyrgyz ? 'active' : ''}" data-value="Kyrgyz">
               <span>🇰🇬 Kyrgyz</span>
            </div>

            <div class="ml-auto relative">
                <span class="absolute left-2 top-1.5 text-gray-400">🔍</span>
                <input type="text" id="teacher-search-input" 
                       class="pl-7 pr-3 py-1.5 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none w-48 transition-all" 
                       placeholder="Search teacher..." value="${this.state.teacherSearch}">
            </div>
        </div>
      </div>

      <div id="teacher-finder-timetable" class="overflow-auto max-h-[65vh] bg-white"></div>
      
      <div class="p-2 text-xs text-center text-gray-500 bg-gray-50 border-t flex justify-center gap-6">
        <span><span class="w-3 h-3 rounded-full bg-blue-50 border border-blue-300"></span> Open (Create New)</span>
        <span><span class="w-3 h-3 rounded-full bg-green-100 border border-green-400"></span> Existing Group (Join)</span>
        <span><span class="w-3 h-3 rounded-full bg-red-50 border border-red-100"></span> Booked/Unavailable</span>
      </div>
    `;
  }

  renderFooter() { return ''; }
  
attachEventListeners() {
    this.renderTimetable(); 

    // --- Mode Toggle (Chip) ---
    const modeChip = this.modalEl.querySelector('#mode-chip');
    modeChip?.addEventListener('click', () => {
        this.state.isOnline = !this.state.isOnline;
        modeChip.classList.toggle('active', this.state.isOnline);
        modeChip.querySelector('span').textContent = this.state.isOnline ? '💻 Online' : '🛖 Offline';
        
        this.renderTimetable();
    });

    // --- Teacher Search Filter ---
    const searchInput = this.modalEl.querySelector('#teacher-search-input');
    searchInput?.addEventListener('input', e => {
        this.state.teacherSearch = e.target.value.toLowerCase();
        this.renderTimetable();
    });

    // --- Schedule Type Toggle ---
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

    // --- Language Filters (Chips Handler) ---
    this.modalEl.querySelectorAll('.lang-filter').forEach(chip => {
        chip.addEventListener('click', () => {
            const lang = chip.dataset.value;
            this.state.languages[lang] = !this.state.languages[lang];
            
            chip.classList.toggle('active', this.state.languages[lang]);
            this.renderTimetable(); 
        });
    });

    // --- Helper to check filters (must be the same as the one in renderTimetable) ---
    const passesFilters = (teacher) => {
        if (this.state.teacherSearch && !teacher.name.toLowerCase().includes(this.state.teacherSearch)) return false;
        const activeLangs = Object.keys(this.state.languages).filter(k => this.state.languages[k]);
        if (activeLangs.length > 0) {
           const tLangs = (teacher.languages || '').toLowerCase();
           if (!activeLangs.some(lang => tLangs.includes(lang.toLowerCase()))) return false;
        }
        const tMode = teacher.teachingMode || 'offline';
        if (this.state.isOnline && tMode === 'offline') return false;
        if (!this.state.isOnline && tMode === 'online') return false;
        return true;
    };
    
    // --- Helper to check class mode match ---
    const modeFilterCheck = (item) => {
        const classIsOnline = item.cls.isOnline || false;
        if (this.state.isOnline && !classIsOnline) return false;
        if (!this.state.isOnline && classIsOnline) return false;
        return true;
    };


    // --- 5. Grid Click Handler (The Core Logic) ---
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

      // --- A. FIND NEW TEACHERS ---
      let validNewTeachers = [];
      if (daySlots.every(ds => ds)) {
          const firstDayTeachers = daySlots[0].availableNew;
          validNewTeachers = firstDayTeachers
            .filter(t => passesFilters(t))
            .filter(t => daySlots.every(ds => ds.availableNew.some(other => other.id === t.id)));
      }

      // --- B. FIND JOINABLE CLASSES ---
      let validJoinableClasses = [];
      const currentDaySlot = this.masterSchedule.get(`${day}-${time}`);
      
      if (currentDaySlot && currentDaySlot.availableJoin.length > 0) {
          validJoinableClasses = currentDaySlot.availableJoin.filter(item => {
              return passesFilters(item.teacher) && modeFilterCheck(item);
          });
      }
      
      if (validNewTeachers.length > 0 || validJoinableClasses.length > 0) {
        // Success: Open the selection modal
        this._showSelectionModal(validNewTeachers, validJoinableClasses, daysInSchedule, time);
      } else {
        // Failure: Provide explicit feedback
        showToast('The selected filters hide all available teachers for this slot. Adjust your Language/Mode filters.', 'warning');
      }
    });
  }

renderTimetable() {
    const timetableEl = this.modalEl.querySelector('#teacher-finder-timetable');
    
    let timeHeader = '<div class="timetable-header">Time</div>';
    this.days.forEach(day => timeHeader += `<div class="timetable-header">${day}</div>`);
    let gridHtml = timeHeader;

    // --- Helper to check class mode match ---
    const modeFilterCheck = (item) => {
        const classIsOnline = item.cls.isOnline || false;
        // If we want Online, only show Online classes
        if (this.state.isOnline && !classIsOnline) return false; 
        // If we want Offline, only show Offline classes
        if (!this.state.isOnline && classIsOnline) return false; 
        return true;
    };
    
    // Helper to check filters (must be the same as the one in attachEventListeners)
    const passesFilters = (teacher) => {
        if (this.state.teacherSearch && !teacher.name.toLowerCase().includes(this.state.teacherSearch)) return false;
        const activeLangs = Object.keys(this.state.languages).filter(k => this.state.languages[k]);
        if (activeLangs.length > 0) {
           const tLangs = (teacher.languages || '').toLowerCase();
           if (!activeLangs.some(lang => tLangs.includes(lang.toLowerCase()))) return false;
        }
        const tMode = teacher.teachingMode || 'offline';
        if (this.state.isOnline && tMode === 'offline') return false;
        if (!this.state.isOnline && tMode === 'online') return false;
        return true;
    };


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
            // Apply Teacher and Mode Filters to available slots
            const filteredNew = slotData.availableNew.filter(t => passesFilters(t));
            const filteredJoin = slotData.availableJoin.filter(item => passesFilters(item.teacher) && modeFilterCheck(item));
            const filteredBooked = slotData.booked.filter(t => passesFilters(t));

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
              const totalCount = (slotData?.availableNew.filter(passesFilters).length || 0) + 
                                 (slotData?.availableJoin.filter(item => passesFilters(item.teacher) && modeFilterCheck(item)).length || 0);
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
        
        gridHtml += `<button class="timetable-slot ${slotClass}" data-day="${day}" data-time="${slotStart}" ${disabled}>${slotText}</button>`;
      }
    }
    timetableEl.innerHTML = `<div class="timetable-grid-full">${gridHtml}</div>`;
  }

_showSelectionModal(newTeachers, joinableClasses, days, time) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    // Use blur and higher z-index for focus
    overlay.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: ${this.zIndex + 10}; backdrop-filter: blur(2px);`;

    const scheduleString = days.join('/');
    const studentName = this.student.name || 'Prospective Student';
    
    // --- 1. Build "Join Existing Group" Content (Left/Green) ---
    const groupsContent = joinableClasses.length > 0 ? `
        <div class="space-y-3 p-5">
            ${joinableClasses.map(item => `
                <button class="join-class-btn w-full text-left p-3 rounded-xl border border-green-200 bg-white shadow-sm hover:shadow-md hover:border-green-400 transition group relative overflow-hidden" data-class-id="${item.cls.id}">
                    <div class="absolute left-0 top-0 bottom-0 w-1 bg-green-400"></div>
                    <div class="pl-2">
                        <div class="font-bold text-gray-800">${item.cls.displayName || item.cls.name}</div>
                        <div class="text-xs text-gray-500 mt-1">Teacher: <span class="font-medium text-gray-700">${item.teacher.name}</span></div>
                        <div class="flex items-center gap-2 mt-2">
                           <span class="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                ${item.cls.students?.length || 0}/10 Students
                           </span>
                           <span class="text-xs text-green-600 font-medium">Click to Join →</span>
                        </div>
                    </div>
                </button>
            `).join('')}
        </div>
    ` : `
        <div class="h-full flex flex-col items-center justify-center text-center text-gray-400 p-4">
           <span class="text-3xl mb-2">🤷‍♂️</span>
           <p class="text-sm">No joinable groups match this criteria.</p>
        </div>
    `;

    // --- 2. Build "Create New Class" Content (Right/Blue) ---
    const individualContent = newTeachers.length > 0 ? `
        <div class="space-y-2 p-5">
            ${newTeachers.map(t => `
                <button class="create-new-btn w-full text-left p-2.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition flex items-center justify-between group" data-id="${t.id}">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                            ${t.name.substring(0,2).toUpperCase()}
                        </div>
                        <span class="font-medium text-gray-700 group-hover:text-blue-800">${t.name}</span>
                    </div>
                    <span class="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity text-xl">⊕</span>
                </button>
            `).join('')}
        </div>
    ` : `
        <div class="text-center text-gray-400 py-10 p-5">
           <p class="text-sm">No teachers available to create a new class.</p>
        </div>
    `;

    // --- 3. Assemble Final Modal Structure ---
    overlay.innerHTML = `
      <div class="modal-content bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col" style="height: 500px;">
        
        <div class="p-4 border-b flex justify-between items-center bg-gray-50">
          <div>
             <h3 class="text-lg font-bold text-gray-800">Assign Student: ${studentName}</h3>
             <p class="text-sm text-gray-500">Slot: <span class="font-medium text-gray-800">${scheduleString} @ ${time}</span></p>
          </div>
          <button class="cancel-btn text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        <div class="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 overflow-hidden">
            
            <div class="bg-green-50/30 overflow-y-auto flex flex-col">
                <h4 class="text-xs font-bold text-green-700 uppercase tracking-wider px-5 pt-5 flex items-center gap-2">
                    <span>👥 Join Existing Group</span>
                    <span class="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full text-[10px]">${joinableClasses.length}</span>
                </h4>
                ${groupsContent}
            </div>

            <div class="bg-white overflow-y-auto flex flex-col">
                <h4 class="text-xs font-bold text-blue-600 uppercase tracking-wider px-5 pt-5 flex items-center gap-2">
                    <span>👤 Start New Class (Individual or Group)</span>
                    <span class="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full text-[10px]">${newTeachers.length}</span>
                </h4>
                ${individualContent}
            </div>
        </div>
      </div>
    `;

    // --- 4. Attach Listeners ---
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
