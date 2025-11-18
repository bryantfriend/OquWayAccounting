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
    mode: 'all',
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
          <label for="modeFilter" class="block text-sm font-medium text-gray-700">Mode</label>
          <select id="modeFilter" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2">
            <option value="all">All Modes</option>
            <option value="online">Online 💻</option>
            <option value="offline">Offline 🛖</option>
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
      </div>
    </div>
    
    <div class="mb-4 flex justify-between items-center">
      <div class="flex items-center gap-2">
          <label for="sortClasses" class="text-sm font-medium text-gray-700">Sort by:</label>
          <select id="sortClasses" class="border-gray-300 rounded-md shadow-sm text-sm p-2">
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="students-desc">Students (Most)</option>
            <option value="students-asc">Students (Fewest)</option>
            <option value="teacher-asc">Teacher (A-Z)</option>
          </select>
      </div>
      <button id="addClassBtn" class="btn-primary">
        + Add Class
      </button>
    </div>

    <div id="classListContainer" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    </div>
  `;
}

function bindEvents() {
  const filters = ['#classSearch', '#teacherFilter', '#modeFilter', '#typeFilter'];
  filters.forEach(sel => {
    container.querySelector(sel)?.addEventListener('input', debounce(handleFilterChange, 300));
  });

  container.querySelector('#sortClasses')?.addEventListener('input', (e) => {
    state.sort = e.target.value;
    applyFiltersAndSort();
    renderClassList();
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
  state.filters.mode = container.querySelector('#modeFilter').value;
  state.filters.type = container.querySelector('#typeFilter').value;
  
  applyFiltersAndSort();
  renderClassList();
}

function applyFiltersAndSort() {
  let tempClasses = [...state.classes];
  
  // 1. Filter (logic from your ClassesDashboard.js)
  tempClasses = tempClasses.filter(cls => {
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
    if (state.filters.teacher !== 'all' && cls.teacherId !== state.filters.teacher) {
      return false;
    }
    if (state.filters.mode === 'online' && !cls.isOnline) return false;
    if (state.filters.mode === 'offline' && cls.isOnline) return false;
    if (state.filters.type === 'group' && !cls.isGroup) return false;
    if (state.filters.type === 'individual' && cls.isGroup) return false;
    return true;
  });

  // 2. Sort (logic from your ClassesDashboard.js)
  tempClasses.sort((a, b) => {
    switch (state.sort) {
      case 'name-asc':
        return (a.displayName || a.name || '').localeCompare(b.displayName || b.name || '');
      case 'name-desc':
        return (b.displayName || b.name || '').localeCompare(a.displayName || a.name || '');
      case 'students-desc':
        return (b.students?.length || 0) - (a.students?.length || 0);
      case 'students-asc':
        return (a.students?.length || 0) - (b.students?.length || 0);
      case 'teacher-asc':
        return (a.teacherName || '').localeCompare(b.teacherName || '');
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

  listEl.innerHTML = state.filteredClasses.map(cls => renderClassCard(cls)).join("");

  // Attach click events
  listEl.querySelectorAll("[data-class-id]").forEach(card => {
    card.addEventListener("click", () => openClassView(card.dataset.classId));
  });
}

function renderClassCard(cls) {
  // This is the logic from your ClassesDashboard.js's renderClassCard
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

  return `
    <div class="bg-white rounded-lg shadow border flex flex-col justify-between h-full hover:shadow-lg transition cursor-pointer"
         data-class-id="${cls.id}" title="Click to view details">
      
      <div class="p-4">
        <div class="flex justify-between items-center mb-2">
          <span class="text-xs font-semibold text-gray-500">${cls.classCode || 'NO-CODE'}</span>
          <span class="px-2 py-0.5 rounded-full text-xs font-medium ${healthColorClasses[health.color]}">
            ${health.text}
          </span>
        </div>
        <h3 class="text-lg font-bold text-gray-800 truncate" title="${cls.name}">
          ${cls.displayName || cls.name}
        </h3>
        <p class="text-sm text-gray-600">${cls.subject || 'No Subject'} - ${cls.gradeLevel || 'N/A'}</p>
      </div>
      
      <div class="mt-4 p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50 rounded-b-lg">
        <span class="text-sm font-medium text-gray-700 truncate" title="Teacher: ${cls.teacherName || '...'}">
          🧑‍🏫 ${cls.teacherName || 'No Teacher'}
        </span>
        <span class="text-lg font-bold ${health.color === 'red' ? 'text-red-600' : 'text-blue-600'} flex items-center gap-1" title="${studentCount} / ${maxStudents} Students">
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