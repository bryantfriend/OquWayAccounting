// js/modals/ClassFinderModal.js
import { BaseModal } from './BaseModal.js';
import { TeacherFinderModal } from './TeacherFinderModal.js';
import { debounce } from '../utils.js';

export class ClassFinderModal extends BaseModal {
  constructor(student, classes, students, teachers, onSave) {
    super('Find a Class', { size: 'max-w-6xl', onSave });

    this.student = student;
    this.allClasses = classes;
    this.allStudents = students;
    this.allTeachers = teachers;
    this.filteredClasses = [];

    // State for filters and sorting
    this.state = {
      filters: { search: '', mode: 'all', days: 'all' },
      sort: { field: 'name', direction: 'asc' }
    };

    // Calculate fullness once
    this.fullnessMap = new Map();
    for (const s of this.allStudents) {
      if (s.classId) {
        this.fullnessMap.set(s.classId, (this.fullnessMap.get(s.classId) || 0) + 1);
      }
    }
    
    // --- NEW: Color map for teacher avatars ---
    this.teacherColors = {};
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'];
    this.allTeachers.forEach((teacher, index) => {
      this.teacherColors[teacher.id] = colors[index % colors.length];
    });
  }

  // --- NEW: Helper for teacher avatars ---
  _getTeacherAvatar(teacher) {
    if (!teacher) {
      return `<div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-500" title="Unassigned">?</div>`;
    }
    const initials = teacher.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const color = this.teacherColors[teacher.id] || '#9ca3af';
    return `
      <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style="background-color: ${color}" title="${teacher.name}">
        ${initials}
      </div>
    `;
  }

  renderContent() {
    const isNewStudent = !this.student?.id;
    const disabledClass = isNewStudent ? 'opacity-50 cursor-not-allowed' : '';
    
    return `
      <div id="class-finder-filters" class="flex flex-wrap items-center gap-3 p-3 bg-gray-50 border-b">
        <div class="relative flex-grow w-full sm:w-auto">
          <input type="text" id="class-filter-search" class="p-2 pl-10 border rounded w-full" placeholder="Search name or teacher...">
          <span class="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>
        
        <div class="filter-btn-group" data-filter-group="mode">
          <button class="filter-btn active" data-value="all">All</button>
          <button class="filter-btn" data-value="offline">Offline</button>
          <button class="filter-btn" data-value="online">Online</button>
        </div>
        <div class="filter-btn-group" data-filter-group="days">
          <button class="filter-btn active" data-value="all">All Days</button>
          <button class="filter-btn" data-value="mwf">Mon/Wed/Fri</button>
          <button class="filter-btn" data-value="tts">Tue/Thu/Sat</button>
        </div>
      </div>
      
      <div id="class-finder-table-container" class="max-h-[60vh] overflow-y-auto p-0">
        <table id="class-finder-table" class="w-full">
          <thead class="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th class="sortable p-4 text-left text-xs font-semibold text-gray-600 uppercase" data-sort="name">Class</th>
              <th class="sortable p-4 text-left text-xs font-semibold text-gray-600 uppercase" data-sort="teacher">Teacher</th>
              <th class="sortable p-4 text-left text-xs font-semibold text-gray-600 uppercase" data-sort="schedule">Schedule</th>
              <th class="sortable p-4 text-left text-xs font-semibold text-gray-600 uppercase" data-sort="fullness">Fullness</th>
              <th class="p-4"></th>
            </tr>
          </thead>
          <tbody id="class-finder-tbody">
            </tbody>
        </table>
      </div>
    `;
  }

  // No footer buttons needed
  renderFooter() { return ''; }

  // ---
  // --- BUG FIX: renderList() was moved from inside attachEventListeners() to be its own method ---
  // ---

  renderList() {
    const { search, mode, days } = this.state.filters;
    const filterLower = search.toLowerCase();
    const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const getSortableSchedule = (cls) => {
      return (cls.days || [])
        .sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
        .map(day => `${dayOrder.indexOf(day)}-${cls.dayTimes[day] || ''}`)
        .join(' ');
    };

    this.filteredClasses = this.allClasses
      .filter(cls => {
        if (!cls.isGroup) return false;
        if (filterLower.length > 0) {
          const teacher = this.allTeachers.find(t => t.id === cls.teacherId);
          if (
            !(cls.name.toLowerCase().includes(filterLower)) &&
            !(cls.displayName || '').toLowerCase().includes(filterLower) &&
            !(teacher?.name || '').toLowerCase().includes(filterLower)
          ) return false;
        }
        if (mode === 'online' && !cls.isOnline) return false;
        if (mode === 'offline' && cls.isOnline) return false;
        const classDays = cls.days || [];
        if (days === 'mwf' && !(classDays.includes('Mon') || classDays.includes('Wed') || classDays.includes('Fri'))) return false;
        if (days === 'tts' && !(classDays.includes('Tue') || classDays.includes('Thu') || classDays.includes('Sat'))) return false;
        return true;
      })
      .sort((a, b) => {
        const { field, direction } = this.state.sort;
        const dir = direction === 'asc' ? 1 : -1;
        let valA, valB;
        switch (field) {
          case 'name':
            valA = (a.displayName || a.name).toLowerCase();
            valB = (b.displayName || b.name).toLowerCase();
            break;
          case 'teacher':
            valA = this.allTeachers.find(t => t.id === a.teacherId)?.name.toLowerCase() || 'zzz';
            valB = this.allTeachers.find(t => t.id === b.teacherId)?.name.toLowerCase() || 'zzz';
            break;
          case 'schedule':
            valA = getSortableSchedule(a);
            valB = getSortableSchedule(b);
            break;
          case 'fullness':
            valA = this.fullnessMap.get(a.id) || 0;
            valB = this.fullnessMap.get(b.id) || 0;
            break;
          default: valA = 0; valB = 0;
        }
        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
      });

    const rowsHtml = this.filteredClasses.map(cls => {
      const studentCount = this.fullnessMap.get(cls.id) || 0;
      const maxStudents = 10;
      const percentage = Math.min((studentCount / maxStudents) * 100, 100);
      const isFull = studentCount >= maxStudents;
      const teacher = this.allTeachers.find(t => t.id === cls.teacherId);
      const scheduleHtml = (cls.days || [])
        .sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
        .map(day => `<div class="whitespace-nowrap">${day}: ${cls.dayTimes[day] || '?'}</div>`)
        .join('');

      // --- NEW: Better "Full" button state ---
      const btnDisabled = isFull ? 'disabled' : '';
      const btnClass = isFull ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary';
      const btnText = isFull ? 'Full' : 'Select';

      return `
        <tr class="hover:bg-gray-50">
          <td class="p-4 border-b">
            <div class="font-medium">${cls.displayName || cls.name}</div>
            <div class="text-sm text-gray-500">${cls.isOnline ? '💻 Online' : '🛖 Offline'}</div>
          </td>
          <td class="p-4 border-b">
            <div class="flex items-center gap-2">
              ${this._getTeacherAvatar(teacher)}
              <span class="text-sm">${teacher?.name || 'N/A'}</span>
            </div>
          </td>
          <td class="p-4 border-b text-xs text-gray-600">${scheduleHtml || 'No schedule'}</td>
          <td class="p-4 border-b">
            <div class="fullness-bar-container">
              <div class="fullness-bar-track">
                <div class="fullness-bar-fill ${isFull ? 'is-full' : ''}" style="width: ${percentage}%;"></div>
              </div>
              <span class="text-sm font-medium">${studentCount}/${maxStudents}</span>
            </div>
          </td>
          <td class="p-4 border-b text-right">
            <button class="${btnClass} py-1 px-3 select-class-btn" data-id="${cls.id}" ${btnDisabled}>
              ${btnText}
            </button>
          </td>
        </tr>
      `;
    }).join('');
    
    // --- NEW: Better empty state ---
    const emptyHtml = `
      <tr>
        <td colspan="5" class="p-10 text-center text-gray-500">
          <span class="text-3xl">🤷</span>
          <p class="mt-2 font-medium">No matching classes found</p>
          <p class="text-sm">Try adjusting your search or filters.</p>
        </td>
      </tr>
    `;

    this.modalEl.querySelector('#class-finder-tbody').innerHTML = rowsHtml || emptyHtml;
    
    this.modalEl.querySelectorAll('th.sortable').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.sort === this.state.sort.field) {
        th.classList.add(this.state.sort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
      }
    });
  }

  attachEventListeners() {
    this.renderList(); // Initial render
    
    // --- FILTERS ---
    this.modalEl.querySelector('#class-filter-search').addEventListener('input', debounce((e) => {
      this.state.filters.search = e.target.value;
      this.renderList();
    }, 300));

    this.modalEl.querySelectorAll('.filter-btn-group').forEach(group => {
      group.addEventListener('click', e => {
        const btn = e.target.closest('.filter-btn');
        if (btn) {
          const filterGroup = group.dataset.filterGroup;
          this.state.filters[filterGroup] = btn.dataset.value;
          group.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.renderList();
        }
      });
    });

    // --- SORTING ---
    this.modalEl.querySelector('thead').addEventListener('click', e => {
      const th = e.target.closest('th.sortable');
      if (th) {
        const field = th.dataset.sort;
        if (this.state.sort.field === field) {
          this.state.sort.direction = this.state.sort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sort.field = field;
          this.state.sort.direction = 'asc';
        }
        this.renderList();
      }
    });

    // --- ROW SELECTION ---
    this.modalEl.querySelector('#class-finder-tbody').addEventListener('click', (e) => {
      const selectBtn = e.target.closest('.select-class-btn');
      if (selectBtn && !selectBtn.disabled) {
        const classId = selectBtn.dataset.id;
        const selectedClass = this.allClasses.find(c => c.id === classId);
        if (selectedClass && this.onSave) {
          this.onSave(selectedClass); // Run the callback
          this.close();
        }
      }
    });
  }
}