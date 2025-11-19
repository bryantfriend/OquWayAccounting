// js/modules/classes.js
import * as api from '../api.js';
import * as ui from '../ui.js';
import { ClassViewModal } from '../modals/ClassViewModal.js';
import { ClassEditorModal } from '../modals/ClassEditorModal.js';
import { debounce } from '../utils.js';

const container = document.getElementById('tab-classes');
let state = {
  classes: [],
  teachers: [],
  filteredClasses: [],
  filters: {
    search: '',
    teacher: 'all',
    mode: 'all', // Now filters by 'online', 'offline', or 'both'
    schedulePattern: 'all', // NEW: 'mwf', 'tts', or 'all'
    type: 'all'
  },
  sort: 'name-asc'
};

export async function init() {
  await render();
}

async function render() {
  if (!container) return;
  ui.showGlobalLoader('Loading classes...');
  try {
    const [classes, teachers] = await Promise.all([
      api.getClasses(),
      api.getUsersByRole('teacher')
    ]);

    state.classes = classes;
    state.teachers = teachers.sort((a, b) => a.name.localeCompare(b.name));

    renderDashboardUI();
    bindEvents();
    applyFiltersAndSort();
    renderClassList();

  } catch (error) {
    console.error("Error rendering classes dashboard:", error);
    container.innerHTML = `<p class="text-red-500">Error loading classes.</p>`;
  } finally {
    ui.hideGlobalLoader();
  }
}

function renderDashboardUI() {
  const teacherOptions = state.teachers
    .map(t => `<option value="${t.id}">${t.name}</option>`)
    .join("");

  container.innerHTML = `
    <div class="mb-4 p-4 bg-white rounded-lg shadow-sm border space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label for="classSearch" class="block text-sm font-medium text-gray-700">Search</label>
          <input type="text" id="classSearch" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2" placeholder="Find by name, code, subject...">
        </div>
        <div>
          <label for="teacherFilter" class="block text-sm font-medium text-gray-700">Teacher</label>
          <select id="teacherFilter" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2">
            <option value="all">All Teachers</option>
            ${teacherOptions}
          </select>
        </div>
        <div>
          <label for="typeFilter" class="block text-sm font-medium text-gray-700">Type</label>
          <select id="typeFilter" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2">
            <option value="all">All Types</option>
            <option value="group">Group 👥</option>
            <option value="individual">Individual 👤</option>
          </select>
        </div>
        <div>
          <label for="sortClasses" class="text-sm font-medium text-gray-700">Sort by:</label>
          <select id="sortClasses" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm p-2">
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="students-desc">Students (Most)</option>
            <option value="students-asc">Students (Fewest)</option>
            <option value="teacher-asc">Teacher (A-Z)</option>
          </select>
        </div>
      </div>

      <div class="border-t pt-4 flex flex-wrap items-center gap-3" id="pillFilters">
        <span class="text-sm font-medium text-gray-700 mr-2">Quick Filters:</span>

        <button class="filter-chip mode-pill ${state.filters.mode === 'all' ? 'active' : ''}" data-filter-group="mode" data-value="all">🌐 All Modes</button>
        <button class="filter-chip mode-pill ${state.filters.mode === 'online' ? 'active' : ''}" data-filter-group="mode" data-value="online">💻 Online</button>
        <button class="filter-chip mode-pill ${state.filters.mode === 'offline' ? 'active' : ''}" data-filter-group="mode" data-value="offline">🛖 Offline</button>

        <div class="h-6 w-px bg-gray-300 mx-1"></div> <button class="filter-chip schedule-pill ${state.filters.schedulePattern === 'all' ? 'active' : ''}" data-filter-group="schedulePattern" data-value="all">📅 All Schedules</button>
        <button class="filter-chip schedule-pill ${state.filters.schedulePattern === 'mwf' ? 'active' : ''}" data-filter-group="schedulePattern" data-value="mwf">Mon, Wed, Fri</button>
        <button class="filter-chip schedule-pill ${state.filters.schedulePattern === 'tts' ? 'active' : ''}" data-filter-group="schedulePattern" data-value="tts">Tue, Thu, Sat</button>
      </div>
    </div>
    
    <div class="mb-4 flex justify-end items-center">
      <button id="addClassBtn" class="btn-primary">
        + Add Class
      </button>
    </div>

    <div id="classListContainer" class="grid grid-cols-1 gap-4">
    </div>
  `;
}

function bindEvents() {
  // Traditional Dropdown Listeners
  const dropdownFilters = ['#classSearch', '#teacherFilter', '#typeFilter', '#sortClasses'];
  dropdownFilters.forEach(sel => {
    container.querySelector(sel)?.addEventListener('input', debounce(handleFilterChange, 300));
  });
  
  // --- NEW: Pill Filter Listeners ---
  const pillContainer = container.querySelector('#pillFilters');
  pillContainer?.addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-chip');
    if (pill) {
      const group = pill.dataset.filterGroup;
      const value = pill.dataset.value;

      // 1. Set the new state value
      state.filters[group] = value;
      
      // 2. Toggle active class visually
      pillContainer.querySelectorAll(`[data-filter-group="${group}"]`).forEach(b => b.classList.remove('active'));
      pill.classList.add('active');

      // 3. Re-render
      applyFiltersAndSort();
      renderClassList();
    }
  });

  container.querySelector("#addClassBtn")?.addEventListener("click", () => {
    // This will open the new ClassEditorModal
    const modal = new ClassEditorModal(null, state.teachers, async () => {
        ui.showToast('Class saved!', 'success');
        await render(); // Full refresh
    });
    modal.show();
  });
}

function handleFilterChange() {
  state.filters.search = container.querySelector('#classSearch').value.toLowerCase();
  state.filters.teacher = container.querySelector('#teacherFilter').value;
// state.filters.mode and state.filters.type are handled by pills
  state.filters.type = container.querySelector('#typeFilter').value;
  
  applyFiltersAndSort();
  renderClassList();
}

function applyFiltersAndSort() {
  let tempClasses = [...state.classes];
  
  // --- 1. Filter ---
  tempClasses = tempClasses.filter(cls => {
    // Search filter
    if (state.filters.search) {
      const name = (cls.name || '').toLowerCase();
      const code = (cls.classCode || '').toLowerCase();
      const subject = (cls.subject || '').toLowerCase();
      if (!name.includes(state.filters.search) && 
          !code.includes(state.filters.search) && 
          !subject.includes(state.filters.search)) {
        return false;
      }
    }
    // Teacher filter
    if (state.filters.teacher !== 'all' && cls.teacherId !== state.filters.teacher) {
      return false;
    }
    // Type filter
    if (state.filters.type === 'group' && !cls.isGroup) return false;
    if (state.filters.type === 'individual' && cls.isGroup) return false;

    // ✨ NEW: Mode Filter (from pills)
    if (state.filters.mode === 'online' && !cls.isOnline) return false;
    if (state.filters.mode === 'offline' && cls.isOnline) return false;

    // ✨ NEW: Schedule Pattern Filter (from pills)
    const patternDays = {
        'mwf': ['Mon', 'Wed', 'Fri'],
        'tts': ['Tue', 'Thu', 'Sat']
    };
    if (state.filters.schedulePattern !== 'all') {
        const requiredDays = patternDays[state.filters.schedulePattern];
        
        // Check if all class days are included in the required pattern days
        const matchesPattern = (cls.days || []).every(day => requiredDays.includes(day));

        if (!matchesPattern) return false;
    }


    return true;
  });

  // 2. Sort (logic is unchanged, but now uses the global sort state)
  tempClasses.sort((a, b) => {
    const [field, direction] = container.querySelector('#sortClasses').value.split('-');
    const dir = direction === 'desc' ? -1 : 1;
    switch (field) {
      case 'name':
        return (a.displayName || a.name || '').localeCompare(b.displayName || b.name || '') * dir;
      case 'students':
        return ((a.students?.length || 0) - (b.students?.length || 0)) * dir;
      case 'teacher':
        return (a.teacherName || '').localeCompare(b.teacherName || '') * dir;
      default:
        return 0;
    }
  });

  state.filteredClasses = tempClasses;
}

function renderClassList() {
  const listEl = container.querySelector("#classListContainer");
  if (!listEl) return;

  if (state.filteredClasses.length === 0) {
    listEl.innerHTML = `<p class="text-gray-500 col-span-full text-center py-10">No classes found that match your filters.</p>`;
    return;
  }

  // Define the desired weekly sorting order for class days
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // --- NEW LOGIC: Group classes by schedule pattern ---
  const scheduleGroups = state.filteredClasses.reduce((groups, cls) => {
    
    // 1. Sort the days chronologically for consistent display
    const sortedDays = (cls.days || []).sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    
    // 2. Create a stable key from the sorted days and times for grouping
    const scheduleKey = JSON.stringify({ days: sortedDays, times: cls.dayTimes }); 
    
    // 3. Generate the correct, sorted display name
    const startTime = sortedDays[0] ? cls.dayTimes[sortedDays[0]] : 'N/A';
    const fullScheduleName = sortedDays.join(', ') + ' @ ' + startTime;

    if (!groups[scheduleKey]) {
      groups[scheduleKey] = {
        scheduleName: fullScheduleName,
        classes: [],
        days: sortedDays,
        dayTimes: cls.dayTimes
      };
    }
    groups[scheduleKey].classes.push(cls);
    return groups;
  }, {});
  
  // Convert map to array and sort by time
  const sortedGroups = Object.values(scheduleGroups).sort((a, b) => {
    // Sort by earliest start time
    const timeA = a.dayTimes[a.days[0]] || '99:99';
    const timeB = b.dayTimes[b.days[0]] || '99:99';
    return timeA.localeCompare(timeB);
  });

  // --- RENDER THE GROUPED LIST ---
  listEl.innerHTML = sortedGroups.map(group => `
    <div class="col-span-full mb-6">
        <h3 class="text-lg font-bold text-gray-700 bg-gray-100 p-3 rounded-t-lg border-b border-gray-200">
            🗓️ ${group.scheduleName}
        </h3>
        <div class="schedule-group-cards grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 bg-white rounded-b-lg shadow-md">
            ${group.classes.map(cls => renderClassCard(cls)).join("")}
        </div>
    </div>
  `).join("");

  // FIX: Attach a single delegation listener to the list container for card clicks
  listEl.addEventListener('click', (e) => {
    const card = e.target.closest("[data-class-id]");
    if (card) {
        openClassView(card.dataset.classId);
    }
  });
}

function renderClassCard(cls) {
  const studentCount = cls.students?.length || 0;
  const isGroup = cls.isGroup;
  const maxStudents = isGroup ? 10 : 1;

  let health = {};
  if (isGroup) {
    if (studentCount < 5) health = { text: 'Needs Students', color: 'yellow' };
    else if (studentCount < 10) health = { text: 'Available', color: 'green' };
    else if (studentCount === 10) health = { text: 'Full', color: 'blue' };
    else health = { text: 'Over Capacity', color: 'red' };
  } else {
    if (studentCount === 0) health = { text: 'Available', color: 'green' };
    else health = { text: 'Full', color: 'blue' };
  }

  // Define color classes
  const healthColorClasses = {
      yellow: 'bg-yellow-100 text-yellow-800',
      green: 'bg-green-100 text-green-800',
      blue: 'bg-blue-100 text-blue-800',
      red: 'bg-red-100 text-red-800'
  };
  
  const icon = cls.isOnline ? '💻' : '🛖';
  const typeIcon = cls.isGroup ? '👥' : '👤';

  return `
    <div class="bg-white rounded-lg shadow-md border hover:shadow-xl transition cursor-pointer"
         data-class-id="${cls.id}" title="Click to view details">
        
        <div class="p-3 border-b">
            <div class="flex justify-between items-start mb-1">
                <div class="flex flex-col">
                    <h3 class="text-md font-bold text-gray-800 truncate" title="${cls.displayName || cls.name}">
                        ${cls.displayName || cls.name}
                    </h3>
                    <p class="text-xs text-gray-500">${cls.classCode || 'NO-CODE'}</p>
                </div>
                <span class="px-2 py-0.5 rounded-full text-xs font-medium ${healthColorClasses[health.color]} shrink-0">
                    ${health.text}
                </span>
            </div>
        </div>
        
        <div class="p-3 flex flex-col space-y-1">
            <p class="text-sm text-gray-800 font-medium">
                🧑‍🏫 ${cls.teacherName || 'No Teacher'}
            </p>
            <p class="text-xs text-gray-600">
                ${cls.subject || 'No Subject'} • ${cls.gradeLevel || 'N/A'}
            </p>
        </div>

        <div class="p-3 border-t bg-gray-50 flex justify-between items-center rounded-b-lg">
            <span class="text-sm font-medium text-gray-700 space-x-2">
                <span>${icon} ${typeIcon}</span>
            </span>
            <span class="text-md font-bold ${health.color === 'red' ? 'text-red-600' : 'text-blue-600'} flex items-center gap-1" title="${studentCount} / ${maxStudents} Students">
                👥 ${studentCount} / ${maxStudents}
            </span>
        </div>
    </div>
  `;
}

function openClassView(classId) {
  const cls = state.classes.find(c => c.id === classId);
  if (!cls) return;

  const modal = new ClassViewModal(cls, state.teachers, async (action, data) => {
    if (action === 'edit') {
        // Open the editor modal, pre-filled with this class
        const editorModal = new ClassEditorModal(cls, state.teachers, async () => {
            ui.showToast('Class updated!', 'success');
            await render(); // Full refresh
        });
        editorModal.show();
    }
    if (action === 'delete') {
        if (confirm('Are you sure you want to delete this class?')) {
            try {
                ui.showGlobalLoader('Deleting class...');
                await api.deleteClass(classId);
                ui.showToast('Class deleted.', 'success');
                await render();
            } catch (err) {
                console.error(err);
                ui.showToast('Failed to delete class.', 'error');
            } finally {
                ui.hideGlobalLoader();
            }
        }
    }
  });
  modal.show();
}
