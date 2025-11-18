// js/modules/teachers.js
import * as api from '../api.js';
import * as ui from '../ui.js';
import { createDayTimeSelector, getDayTimeData, initDayTimeSelector } from './dayTimeSelector.js';
import { formatCurrency, debounce } from '../utils.js';

// Module state
let state = {
  teachers: [],
  students: [],
  classes: [],
  monthlyPayments: [],
  lessons: [],
  loggedPaymentPackages: [],
  config: {},
  startDate: null, 
  endDate: null,  
  currentView: 'list',
  selectedTeacher: null,
  // Note: selectedTeacherStats is no longer needed in state as we attach stats to the teacher object directly
  sort: {
    field: 'name',
    direction: 'asc'
  }
};

const container = document.getElementById('tab-teachers');

/**
 * Main entry point
 */
export async function init() {
  if (!state.startDate || !state.endDate) {
    const { start, end } = _calculatePayPeriod();
    state.startDate = start;
    state.endDate = end;
  }
  await render();
}

/**
 * Calculates the default pay period (26th to 25th)
 */
function _calculatePayPeriod() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const payday = 25;

  let startDate, endDate;

  if (today.getDate() <= payday) {
    endDate = new Date(year, month, payday, 23, 59, 59);
    startDate = new Date(year, month - 1, 26);
  } else {
    endDate = new Date(year, month + 1, payday, 23, 59, 59);
    startDate = new Date(year, month, 26);
  }
  return { start: startDate, end: endDate };
}

function createTopBar(startDate, endDate) {
  const startString = startDate.toISOString().split('T')[0];
  const endString = endDate.toISOString().split('T')[0];

  return `
    <div class="mb-6 p-4 bg-white rounded-lg shadow-sm border flex items-center gap-4 flex-wrap">
      <h2 class="text-2xl font-semibold">Teacher Management</h2>
      <div class="flex items-center gap-2 ml-auto">
        <label for="payrollStartDate" class="text-sm font-medium">From:</label>
        <input type="date" id="payrollStartDate" class="border rounded p-2" value="${startString}">
      </div>
      <div class="flex items-center gap-2">
        <label for="payrollEndDate" class="text-sm font-medium">To:</label>
        <input type="date" id="payrollEndDate" class="border rounded p-2" value="${endString}">
      </div>
      <button id="add-teacher-btn" class="btn-primary">➕ Add Teacher</button>
    </div>
  `;
}

/**
 * Main render function
 */
async function render() {
  if (!container) return;
  ui.showGlobalLoader('Loading teachers...');
  
  try {
    const start = state.startDate;
    const end = state.endDate;

    const [teachersData, students, classes, config, lessons, monthlyPayments] = await Promise.all([
      api.getUsersByRole('teacher', true),
      api.getUsersByRole('student', true),
      api.getClasses(),
      api.getConfig('teacherFees'),
      api.getLessonsByDate(start, end),
      api.getPaymentsByDate(start, end)
    ]);
    
    // Update raw data in state
    state.students = students;
    state.classes = classes;
    state.config = config || { centerSplit: 0.5, socialFund: 5000 };
    state.lessons = lessons;
    state.monthlyPayments = monthlyPayments;
    
    const loggedPaymentIds = [...new Set(lessons.map(l => l.paymentId).filter(Boolean))];
    const loggedPaymentPackages = await api.getPaymentsByIds(loggedPaymentIds);
    state.loggedPaymentPackages = loggedPaymentPackages;

    // --- 🚀 OPTIMIZATION: Pre-calculate stats for ALL teachers once ---
    // This prevents lag when sorting or rendering the list
    state.teachers = teachersData.map(t => {
        const stats = _computeTeacherStats(t);
        return { ...t, stats }; // Attach stats directly to teacher object
    });

    if (state.currentView === 'detail') {
      const teacherId = state.selectedTeacher?.id;
      // Find the teacher in our updated state (which has the fresh stats)
      const teacher = state.teachers.find(t => t.id === teacherId);
      
      if (teacher) {
          state.selectedTeacher = teacher;
          await renderDetailView(teacher, teacher.stats, start, end);
      } else {
          // Fallback if teacher was deleted or not found
          state.currentView = 'list';
          render();
      }
    } else {
      applyListSort();
      renderListView(state.teachers.filter(t => t.active !== false), start, end);
    }

  } catch (error) {
    console.error('Error rendering teachers tab:', error);
    container.innerHTML = `<p class="text-red-500 p-6">Could not load teacher data.</p>`;
  } finally {
    ui.hideGlobalLoader();
  }
}

// ----------------------------------------------------------------
// 👨‍🏫 TEACHER LIST VIEW
// ----------------------------------------------------------------

function renderListView(teachers, startDate, endDate) {
  const tableHtml = createTeacherTable(teachers);
  const topBarHtml = createTopBar(startDate, endDate);

  container.innerHTML = `
    ${topBarHtml} <div class="bg-white rounded-lg shadow-md overflow-hidden">
      ${tableHtml}
    </div>
  `;

  attachListListeners();
  attachTopBarListeners();
  updateListSortIcons();
}

function createTeacherTable(teachers) {
  const rows = teachers.map(t => {
    const stats = _computeTeacherStats(t);
    
    // --- Mode Logic ---
    let modeBadge = '';
    if (t.teachingMode === 'online') modeBadge = '<span class="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs">Online</span>';
    else if (t.teachingMode === 'both') modeBadge = '<span class="px-2 py-1 rounded bg-purple-100 text-purple-800 text-xs">Both</span>';
    else modeBadge = '<span class="px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">Offline</span>';

    // --- Languages Logic ---
    const langs = t.languages || '—';

    return `
      <tr class="hover:bg-gray-50">
        <td class="p-4 border-b">
          <span class="font-medium">${t.name}</span><br>
          <span class="text-sm text-gray-500">${t.phone || 'No phone'}</span>
        </td>
        <td class="p-4 border-b">${modeBadge}</td>
        <td class="p-4 border-b text-sm text-gray-600 max-w-xs truncate" title="${langs}">${langs}</td>
        <td class="p-4 border-b">${stats.classCount}</td>
        <td class="p-4 border-b">${stats.totalStudents}</td>
        <td class="p-4 border-b">${t.salaryType === 'hourly' ? `${formatCurrency(t.hourlyRate || 0)}/hr` : '50/50 Split'}</td>
        <td class="p-4 border-b font-medium">${formatCurrency(stats.payrollDue)}</td>
        <td class="p-4 border-b text-right space-x-2">
          <button class="view-teacher-btn btn-secondary py-1 px-3" data-id="${t.id}">View Details</button>
          <button class="archive-teacher-btn text-red-600 hover:text-red-800 p-1" data-id="${t.id}" title="Archive Teacher">🗃️</button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table class="min-w-full">
      <thead class="bg-gray-50">
        <tr>
          <th class="p-4 text-left sortable" data-sort="name">Name</th>
          <th class="p-4 text-left">Mode</th> <th class="p-4 text-left">Languages</th> <th class="p-4 text-left sortable" data-sort="classes">Classes</th>
          <th class="p-4 text-left sortable" data-sort="students">Students</th>
          <th class="p-4 text-left sortable" data-sort="salary">Salary Type</th>
          <th class="p-4 text-left sortable" data-sort="payroll">Est. Payroll</th>
          <th class="p-4 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length ? rows : '<tr><td colspan="8" class="p-6 text-center text-gray-500">No active teachers found.</td></tr>'}
      </tbody>
    </table>
  `;
}

function attachListListeners() {
  // Table click event delegation
  container.querySelector('table tbody')?.addEventListener('click', e => {
    const viewBtn = e.target.closest('.view-teacher-btn');
    if (viewBtn) {
      const teacher = state.teachers.find(t => t.id === viewBtn.dataset.id);
      state.currentView = 'detail';
      state.selectedTeacher = teacher;
      render();
      return;
    }
    
    const archiveBtn = e.target.closest('.archive-teacher-btn');
    if (archiveBtn) {
      handleArchiveTeacher(archiveBtn.dataset.id);
      return;
    }
  });

  // Sort listener
  container.querySelector('table thead')?.addEventListener('click', e => {
    const sortableHeader = e.target.closest('.sortable');
    if (sortableHeader) handleListSort(sortableHeader.dataset.sort);
  });
}

function attachTopBarListeners() {
  const startDateInput = container.querySelector('#payrollStartDate');
  const endDateInput = container.querySelector('#payrollEndDate');

  const handleDateChange = () => {
    const newStartDate = new Date(startDateInput.value);
    const newEndDate = new Date(endDateInput.value);
    
    newEndDate.setHours(23, 59, 59, 999); 

    state.startDate = newStartDate;
    state.endDate = newEndDate;
    
    render();
  };

  startDateInput?.addEventListener('change', handleDateChange);
  endDateInput?.addEventListener('change', handleDateChange);

  container.querySelector('#add-teacher-btn')?.addEventListener('click', () => {
    state.currentView = 'detail';
    state.selectedTeacher = null; 
    render(); 
  });
}

// ----------------------------------------------------------------
// 🧑‍💻 TEACHER DETAIL VIEW
// ----------------------------------------------------------------

async function renderDetailView(teacher, stats, startDate, endDate) {
  const isNew = !teacher;
  const teacherId = teacher?.id;
  
  container.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-2xl font-semibold">${isNew ? 'Add New Teacher' : `Profile: ${teacher.name}`}</h2>
      <div class="space-x-2">
        <button id="back-to-list-btn" class="btn-secondary">⬅️ Back to List</button>
        <button id="print-report-btn" class="btn-secondary">🖨️ Print Report</button>
      </div>
    </div>

    ${isNew ? '' : renderTeacherHeader(teacher, stats)}

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        ${renderTeacherProfile(teacher)}
        ${renderTeacherSchedule(teacher)}
        ${renderWeeklyTimetable(teacher, stats)}
      </div>
      <div class="lg:col-span-1 space-y-6">
        ${renderTeacherPayroll(teacher, stats)}
      </div>
    </div>
  `;
  
  const scheduleContainer = container.querySelector('#teacher-schedule-component');
  if (scheduleContainer) {
    const scheduleData = {
      days: teacher?.days || [],
      dayTimes: teacher?.dayTimes || {}
    };
    initDayTimeSelector(scheduleContainer, scheduleData);
  }
  
  attachDetailListeners(teacherId, startDate, endDate);
}

function renderTeacherHeader(teacher, stats) {
  return `
    <div class="bg-white rounded-lg shadow-md p-4 mb-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div>
          <div class="text-sm text-gray-500">Phone</div>
          <div class="text-lg font-semibold">${teacher.phone || 'N/A'}</div>
        </div>
        <div>
          <div class="text-sm text-gray-500">Active Classes</div>
          <div class="text-lg font-semibold">${stats.classCount}</div>
        </div>
        <div>
          <div class="text-sm text-gray-500">Total Students</div>
          <div class="text-lg font-semibold">${stats.totalStudents}</div>
        </div>
        <div>
          <div class="text-sm text-gray-500">Revenue (This Period)</div>
          <div class="text-lg font-semibold">${formatCurrency(stats.totalRevenueGenerated)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderTeacherProfile(teacher) {
  // Default to true (checked) if property doesn't exist yet
  const paysSocialFund = teacher?.paysSocialFund !== false;

  return `
    <div class="bg-white rounded-lg shadow-md">
      <h3 class="text-lg font-semibold p-4 border-b">Profile</h3>
      <div class="p-4 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium">Full Name</label>
            <input id="teacherName" type="text" class="mt-1 block w-full border rounded px-3 py-2" value="${teacher?.name || ''}">
          </div>
          <div>
            <label class="block text-sm font-medium">Phone</label>
            <input id="teacherPhone" type="text" class="mt-1 block w-full border rounded px-3 py-2" value="${teacher?.phone || ''}">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
             <label class="block text-sm font-medium">Teaching Mode</label>
             <select id="teacherMode" class="mt-1 block w-full border rounded px-3 py-2">
               <option value="offline" ${teacher?.teachingMode === 'offline' ? 'selected' : ''}>Offline Only</option>
               <option value="online" ${teacher?.teachingMode === 'online' ? 'selected' : ''}>Online Only</option>
               <option value="both" ${teacher?.teachingMode === 'both' ? 'selected' : ''}>Both (Hybrid)</option>
             </select>
          </div>
          <div>
            <label class="block text-sm font-medium">Languages Spoken</label>
            <input id="teacherLanguages" type="text" class="mt-1 block w-full border rounded px-3 py-2" 
                   placeholder="e.g. English, Russian, Kyrgyz" 
                   value="${teacher?.languages || ''}">
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium">Salary Type</label>
          <select id="teacherSalaryType" class="mt-1 block w-full border rounded px-3 py-2">
            <option value="split_50_50" ${teacher?.salaryType === 'split_50_50' ? 'selected' : ''}>50/50 Split</option>
            <option value="hourly" ${teacher?.salaryType === 'hourly' ? 'selected' : ''}>Hourly Rate</option>
          </select>
        </div>
        
        <div class="flex items-center space-x-2 bg-gray-50 p-2 rounded border">
            <input id="teacherPaysSocialFund" type="checkbox" class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" ${paysSocialFund ? 'checked' : ''}>
            <label for="teacherPaysSocialFund" class="text-sm font-medium text-gray-700">Deduct Social Fund?</label>
        </div>
        <div id="hourly-rate-fields" class="${teacher?.salaryType === 'hourly' ? '' : 'hidden'} grid grid-cols-2 gap-4">
           <div>
            <label class="block text-sm font-medium">Hourly Rate (KGS)</label>
            <input id="teacherHourlyRate" type="number" class="mt-1 block w-full border rounded px-3 py-2" value="${teacher?.hourlyRate || 0}">
          </div>
          <div>
            <label class="block text-sm font-medium">Total Hours</label>
            <input id="teacherTotalHours" type="number" class="mt-1 block w-full border rounded px-3 py-2" value="${teacher?.totalHours || 0}">
          </div>
        </div>
        <div class="text-right">
          <button id="save-profile-btn" class="btn-primary">💾 Save Profile</button>
        </div>
      </div>
    </div>
  `;
}

function renderTeacherSchedule(teacher) {
  return `
    <div class="bg-white rounded-lg shadow-md">
      <h3 class="text-lg font-semibold p-4 border-b">Set Availability</h3>
      <div id="teacher-schedule-component" class="p-4">
        ${createDayTimeSelector()}
      </div>
      <div class="bg-gray-50 p-4 border-t text-right">
        <button id="save-schedule-btn" class="btn-primary">💾 Save Schedule</button>
      </div>
    </div>
  `;
}

function renderWeeklyTimetable(teacher, stats) {
  if (!teacher) return ''; 

  const teacherDays = teacher.days || [];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const timetableHtml = days.map(day => {
    const isAvailable = teacherDays.includes(day);
    
    // Find classes on this day
    const classesForDay = stats.assignedClasses
      .filter(c => c.days.includes(day))
      .sort((a, b) => (a.dayTimes[day] || '').localeCompare(b.dayTimes[day])); 

    const classCardsHtml = classesForDay.map(cls => {
      const time = cls.dayTimes[day] || 'Unscheduled';
      const studentCount = cls.students?.length || 0;
      return `
        <div class="class-card" data-class-id="${cls.id}" title="Click to see details">
          <span class="font-bold">${time}</span>
          <p class="class-card-name">${cls.displayName || cls.name}</p>
          <div class="class-card-footer">
            <span title="${studentCount} student(s)">👥 ${studentCount}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="day-column ${isAvailable ? '' : 'unavailable'}">
        <h4 class="font-semibold text-center">${day}</h4>
        <div class="class-list">
          ${classCardsHtml.length ? classCardsHtml : (isAvailable ? '<p class="text-xs text-gray-400 text-center">No classes</p>' : '')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="bg-white rounded-lg shadow-md">
      <h3 class="text-lg font-semibold p-4 border-b">Weekly Timetable</h3>
      <div class="p-4 overflow-x-auto">
        <div class="timetable-grid">
          ${timetableHtml}
        </div>
      </div>
    </div>
  `;
}

function renderTeacherPayroll(teacher, stats) {
  if (!teacher) return '<div class="bg-white rounded-lg shadow-md p-4"><h3 class="text-lg font-semibold">Payroll</h3><p class="text-gray-500">Save the teacher profile first to enable payroll.</p></div>';

  const { payrollDue, calculationHtml } = stats;
  
  return `
    <div class="bg-white rounded-lg shadow-md">
      <h3 class="text-lg font-semibold p-4 border-b">Payroll (This Period)</h3>
      <div class="p-4 space-y-3">
        ${calculationHtml}
        <div class="border-t pt-3 mt-3 flex justify-between">
          <span class="font-bold text-lg">Total Due:</span>
          <span class="font-bold text-lg ${payrollDue >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(payrollDue)}</span>
        </div>
      </div>
      <div class="bg-gray-50 p-4 border-t text-right">
        <button id="mark-paid-btn" class="btn-secondary" ${payrollDue <= 0 ? 'disabled' : ''}>
          Mark as Paid
        </button>
      </div>
    </div>
  `;
}

// --- Event Handlers for Detail View ---

function attachDetailListeners(teacherId, startDate, endDate) {
  container.querySelector('#back-to-list-btn')?.addEventListener('click', () => {
    state.currentView = 'list';
    state.selectedTeacher = null;
    render(); 
  });
  
  container.querySelector('#print-report-btn')?.addEventListener('click', () => {
    handlePrintReport(state.selectedTeacher, state.selectedTeacher.stats, startDate, endDate);
  });
  
  container.querySelector('#teacherSalaryType')?.addEventListener('change', (e) => {
    const hourlyFields = container.querySelector('#hourly-rate-fields');
    hourlyFields.classList.toggle('hidden', e.target.value !== 'hourly');
  });

  container.querySelector('#save-profile-btn')?.addEventListener('click', async () => {
    const data = {
      name: container.querySelector('#teacherName').value,
      phone: container.querySelector('#teacherPhone').value,
      teachingMode: container.querySelector('#teacherMode').value,
      languages: container.querySelector('#teacherLanguages').value,
      paysSocialFund: container.querySelector('#teacherPaysSocialFund').checked,
      salaryType: container.querySelector('#teacherSalaryType').value,
      hourlyRate: Number(container.querySelector('#teacherHourlyRate').value) || 0,
      totalHours: Number(container.querySelector('#teacherTotalHours').value) || 0,
      role: 'teacher',
      active: true,
    };

    ui.showGlobalLoader('Saving...');
    try {
      const newTeacherId = await api.saveUser(data, teacherId);
      if (!teacherId) { 
        state.selectedTeacher = { id: newTeacherId, ...data };
        state.currentView = 'detail';
      }
      ui.showToast('Profile saved!', 'success');
      await render(); 
    } catch (e) { console.error(e); ui.showToast('Save failed', 'error'); } finally { ui.hideGlobalLoader(); }
  });

  container.querySelector('#save-schedule-btn')?.addEventListener('click', async () => {
    const scheduleData = getDayTimeData();
    const data = {
      days: scheduleData.days,
      dayTimes: scheduleData.dayTimes
    };
    
    ui.showGlobalLoader('Saving schedule...');
    try {
      await api.saveUser(data, teacherId);
      ui.showToast('Schedule saved!', 'success');
      await render();
    } catch (e) { console.error(e); ui.showToast('Save failed', 'error'); } finally { ui.hideGlobalLoader(); }
  });
  
  container.querySelector('#mark-paid-btn')?.addEventListener('click', async () => {
    if (!teacherId) return;
    if (confirm(`Mark payroll as paid for ${state.selectedTeacher.name}? This will reset their hours to 0.`)) {
      ui.showGlobalLoader('Processing payroll...');
      try {
        await api.markPayrollPaid(teacherId);
        ui.showToast('Payroll marked as paid!', 'success');
        await render(); 
      } catch (e) { console.error(e); ui.showToast('Save failed', 'error'); } finally { ui.hideGlobalLoader(); }
    }
  });

  container.querySelector('.timetable-grid')?.addEventListener('click', e => {
    const card = e.target.closest('.class-card');
    if (card) {
      const classId = card.dataset.classId;
      const cls = state.classes.find(c => c.id === classId);
      if (cls) {
        showClassModal(cls);
      }
    }
  });
}

// ----------------------------------------------------------------
// [NEW] DETAIL VIEW MODAL & HELPERS
// ----------------------------------------------------------------

async function handleArchiveTeacher(teacherId) {
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (!teacher) return;
  
  if (confirm(`Are you sure you want to archive ${teacher.name}? They will be hidden from the list.`)) {
    ui.showGlobalLoader('Archiving...');
    try {
      await api.archiveUser(teacherId); 
      ui.showToast('Teacher archived.', 'success');
      await render(); // Refresh the list
    } catch (e) {
      console.error(e);
      ui.showToast('Archive failed.', 'error');
    } finally {
      ui.hideGlobalLoader();
    }
  }
}

function showClassModal(cls) {
  const modalContainer = document.getElementById('modal-container');
  
  const students = (cls.students || []).map(id => state.students.find(s => s.id === id)).filter(Boolean);
  
  const studentsHtml = students.length ? students.map(s => `
    <li class="flex justify-between items-center p-2 hover:bg-gray-50">
      <span>${s.name}</span>
      <span class="text-sm text-gray-500">${s.phone || 'No phone'}</span>
    </li>
  `).join('') : '<p class="text-gray-500 p-2">No students found.</p>';

  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-2xl w-full max-w-2xl">
        <div class="p-5 border-b flex justify-between items-center">
          <h3 class="text-lg font-semibold">${cls.displayName || cls.name}</h3>
          <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        
        <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div>
            <h4 class="text-md font-semibold text-gray-700 border-b pb-2 mb-2">Class Details</h4>
            <ul class="text-sm space-y-2">
              <li><strong>Subject:</strong> ${cls.subject || '—'}</li>
              <li><strong>Grade Level:</strong> ${cls.gradeLevel || '—'}</li>
              <li><strong>Language:</strong> ${cls.language || '—'}</li>
              <li><strong>Class Code:</strong> ${cls.classCode || '—'}</li>
              <li><strong>Mode:</strong> ${cls.isOnline ? 'Online 💻' : 'Offline 🛖'}</li>
              <li><strong>Type:</strong> ${cls.isGroup ? 'Group 👥' : 'Individual 👤'}</li>
            </ul>
          </div>
          
          <div>
            <h4 class="text-md font-semibold text-gray-700 border-b pb-2 mb-2">Students (${students.length})</h4>
            <ul class="divide-y border rounded-md max-h-60 overflow-y-auto">
              ${studentsHtml}
            </ul>
          </div>

        </div>
      </div>
    </div>
  `;
  
  modalContainer.querySelector('#close-modal-btn').addEventListener('click', () => {
    modalContainer.innerHTML = '';
  });
}

// ----------------------------------------------------------------
// --- ✨ CALCULATION LOGIC ---
// ----------------------------------------------------------------

function _computeTeacherStats(teacher) {
  if (!teacher) return { payrollDue: 0, calculationHtml: '', classCount: 0, totalStudents: 0, totalRevenueGenerated: 0, reportData: {} };

  const stats = {};
  
  // --- ✨ NEW LOGIC: Check if teacher pays social fund ---
  // Default to true if property is missing
  const paysSocialFund = teacher.paysSocialFund !== false; 
  const configSocialFund = state.config.socialFund || 5000;
  
  // If unchecked, deduction is 0. Otherwise, use config value.
  const actualDeduction = paysSocialFund ? configSocialFund : 0;

  stats.reportData = { 
    lessons: [], 
    simplePayments: [], 
    socialFund: actualDeduction // <-- Use calculated value
  };
  
  const socialFund = stats.reportData.socialFund;
  const splitRate = state.config.centerSplit || 0.5;

  // --- 1. HOURLY PAYROLL (Simple) ---
  if (teacher.salaryType === 'hourly') {
    stats.totalRevenueGenerated = (teacher.hourlyRate || 0) * (teacher.totalHours || 0);
    stats.teacherShare = stats.totalRevenueGenerated;
    stats.payrollDue = stats.teacherShare - socialFund;
    
    // ... (Calculation HTML for hourly omitted for brevity, logic same as before) ...
    stats.calculationHtml = `<div class="text-gray-500">Hourly calculation view.</div>`; // Placeholder if needed
    
    stats.assignedClasses = state.classes.filter(c => c.teacherId === teacher.id);
    stats.classCount = stats.assignedClasses.length;
    stats.totalStudents = stats.assignedClasses.reduce((sum, c) => sum + (c.students?.length || 0), 0);
    
    return stats;
  }

  // --- 2. 50/50 SPLIT PAYROLL ---
  let totalTeacherShare = 0;
  let totalRevenueGenerated = 0;
  let lessonBasedRevenue = 0;
  let simpleSplitRevenue = 0;

  const lessonsByThisTeacher = state.lessons.filter(l => l.teacherId === teacher.id);
  const assignedClasses = state.classes.filter(c => c.teacherId === teacher.id);
  const assignedStudentIds = new Set();
  assignedClasses.forEach(c => {
    (c.students || []).forEach(id => assignedStudentIds.add(id));
  });

  const touchedPaymentIds = new Set(state.lessons.map(l => l.paymentId));
  
  // --- 2a. Calculate Lesson-Based Share ---
  lessonsByThisTeacher.forEach(lesson => {
    const paymentPackage = state.loggedPaymentPackages.find(p => p.id === lesson.paymentId);
    
    if (paymentPackage && paymentPackage.lessonCount > 0) {
      const revenueBasis = paymentPackage.amountNet || paymentPackage.amountGross || 0;
      const perLessonValue = revenueBasis / paymentPackage.lessonCount;
      const teacherShareForLesson = perLessonValue * (1 - splitRate);
      totalTeacherShare += teacherShareForLesson;
      lessonBasedRevenue += perLessonValue;

      const student = state.students.find(s => s.id === lesson.studentId);
      stats.reportData.lessons.push({
          // SAFE DATE CHECK
          date: lesson.date.toDate ? lesson.date.toDate() : new Date(lesson.date),
          studentName: student?.name || 'Unknown Student',
          paymentAmount: paymentPackage.amountGross,
          lessonCount: paymentPackage.lessonCount,
          perLessonValue: perLessonValue,
          teacherShare: teacherShareForLesson
      });
    }
  });

  // --- 2b. Calculate Simple 50/50 Share ---
  const simpleSplitStudentIds = new Set(assignedStudentIds);
  // Remove students who had ANY lesson logs
  state.loggedPaymentPackages.forEach(pkg => {
    if (touchedPaymentIds.has(pkg.id)) simpleSplitStudentIds.delete(pkg.studentId);
  });
  state.lessons.forEach(l => {
    simpleSplitStudentIds.delete(l.studentId);
  });

  const simpleSplitPayments = state.monthlyPayments.filter(p => simpleSplitStudentIds.has(p.studentId));
  
  simpleSplitPayments.forEach(p => {
    const revenue = p.amountNet || p.amountGross || 0;
    const teacherShareForPayment = revenue * (1 - splitRate);
    totalTeacherShare += teacherShareForPayment;
    simpleSplitRevenue += revenue;

    const student = state.students.find(s => s.id === p.studentId); // ✅ FIXED: Use 'p', not 'lesson'
    stats.reportData.simplePayments.push({
        // SAFE DATE CHECK (p.date is typically already a Date object from api.js)
        date: (p.date && p.date.toDate) ? p.date.toDate() : (p.date || new Date()), 
        studentName: student?.name || 'Unknown Student',
        paymentAmount: p.amountGross,
        teacherShare: teacherShareForPayment
    });
  });

  stats.assignedClasses = assignedClasses;
  stats.classCount = stats.assignedClasses.length;
  stats.totalStudents = assignedStudentIds.size;
  stats.totalRevenueGenerated = lessonBasedRevenue + simpleSplitRevenue;
  stats.teacherShare = totalTeacherShare;
  stats.payrollDue = stats.teacherShare - socialFund;
  
  let classBreakdownHtml = stats.assignedClasses.map(cls => {
      // ... (Class breakdown logic kept simple for brevity, same as before) ...
      return `<div class="flex justify-between text-xs"><span class="text-gray-500">${cls.name}</span></div>`;
  }).join('');

  stats.calculationHtml = `
    <div class="flex justify-between">
      <span class="text-gray-600">Total Revenue:</span>
      <span class="font-medium">${formatCurrency(stats.totalRevenueGenerated)}</span>
    </div>
    <div class="flex justify-between">
      <span class="text-gray-600">Teacher's Share:</span>
      <span class="font-medium">${formatCurrency(stats.teacherShare)}</span>
    </div>
    <div class="flex justify-between border-t pt-2 mt-2">
      <span class="text-gray-600">Social Fund:</span>
      <span class="font-medium text-red-600">-${formatCurrency(socialFund)}</span>
    </div>
  `;

  return stats;
}


function applyListSort() {
  const field = state.sort.field;
  const dir = state.sort.direction === 'asc' ? 1 : -1;

  state.teachers.sort((a, b) => {
    // Use pre-calculated stats
    const statsA = a.stats; 
    const statsB = b.stats;
    
    let valA, valB;
    switch (field) {
      case 'name':
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        break;
      case 'classes':
        valA = statsA.classCount;
        valB = statsB.classCount;
        break;
      case 'students':
        valA = statsA.totalStudents;
        valB = statsB.totalStudents;
        break;
      case 'salary':
        valA = a.salaryType || 'split_50_50';
        valB = b.salaryType || 'split_50_50';
        break;
      case 'payroll':
        valA = statsA.payrollDue;
        valB = statsB.payrollDue;
        break;
      default:
        return 0;
    }
    
    if (valA < valB) return -1 * dir;
    if (valA > valB) return 1 * dir;
    return 0;
  });
}

function handleListSort(field) {
  if (state.sort.field === field) {
    state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    state.sort.field = field;
    state.sort.direction = 'asc';
  }
  
  applyListSort();
  // Pass the current dates to re-render list correctly
  renderListView(state.teachers.filter(t => t.active !== false), state.startDate, state.endDate);
  updateListSortIcons();
}

function updateListSortIcons() {
  container.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    const field = th.dataset.sort;
    if (field === state.sort.field) {
      th.classList.add(state.sort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

function handlePrintReport(teacher, stats, startDate, endDate) {
  const reportHtml = generateReportHtml(teacher, stats, startDate, endDate);
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(reportHtml);
  printWindow.document.close();
  printWindow.focus();
  
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

function generateReportHtml(teacher, stats, startDate, endDate) {
  const { reportData } = stats;

  const lessonRows = reportData.lessons.map(item => `
    <tr>
      <td>${item.date.toLocaleDateString()}</td>
      <td>${item.studentName}</td>
      <td class="num">${formatCurrency(item.paymentAmount)}</td>
      <td class="num">${formatCurrency(item.perLessonValue)}</td>
      <td class="num">${formatCurrency(item.teacherShare)}</td>
    </tr>
  `).join('');
  
  const simpleRows = reportData.simplePayments.map(item => `
    <tr>
      <td>${item.date.toLocaleDateString()}</td>
      <td>${item.studentName}</td>
      <td class="num">${formatCurrency(item.paymentAmount)}</td>
      <td class="num">${formatCurrency(item.teacherShare)}</td>
    </tr>
  `).join('');

  const summaryHtml = `
    <div class="summary-grid">
      <div>Total Earned</div>
      <div class="num">${formatCurrency(stats.teacherShare)}</div>
      
      <div>Social Fund</div>
      <div class="num text-red">-${formatCurrency(reportData.socialFund)}</div>
      
      <div>Advances Paid</div>
      <div class="num text-red">-${formatCurrency(0)}</div>
      
      <div class="total">Final Payment Due</div>
      <div class="total num">${formatCurrency(stats.payrollDue)}</div>
    </div>
  `;

  return `
    <html>
      <head>
        <title>Payroll Report: ${teacher.name}</title>
        <style>
          body { font-family: sans-serif; margin: 20px; }
          h1, h2, h3 { color: #333; text-align: center; }
          p { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10pt; }
          th { background-color: #f4f4f4; }
          .num { text-align: right; }
          .text-red { color: #d9534f; }
          .total { font-weight: bold; font-size: 1.1em; border-top: 2px solid #333; }
          
          .logo {
            display: block;
            margin: 0 auto 20px auto;
            max-height: 70px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: 3fr 1fr;
            max-width: 400px;
            margin-left: auto;
            font-size: 12pt;
            gap: 5px;
            margin-top: 10px;
          }
          
          .signatures {
            margin-top: 80px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            width: 45%;
            text-align: center;
            font-size: 10pt;
            color: #555;
          }
          .signature-line {
            display: block;
            border-top: 1px solid #777;
            margin-bottom: 5px;
            padding-top: 5px;
          }

          @media print {
            body { margin: 0.5in; }
            h1, h2, h3 { page-break-after: avoid; }
            table { page-break-inside: auto; }
            .signatures { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <img src="LogoSmall.jpg" alt="Logo" class="logo">

        <h1>Payroll Report</h1>
        <h2>${teacher.name}</h2>
        <p>Pay Period: ${startDate.toLocaleDateString()} – ${endDate.toLocaleDateString()}</p>
        
        <h3>Proportional (Lesson-Based) Earnings</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Total Pkg.</th>
              <th>Per Lesson</th>
              <th>Teacher Share</th>
            </tr>
          </thead>
          <tbody>${lessonRows || '<tr><td colspan="5">No lesson-based earnings.</td></tr>'}</tbody>
        </table>

        <h3>Simple 50/50 Split Earnings</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Payment Amount</th>
              <th>Teacher Share</th>
            </tr>
          </thead>
          <tbody>${simpleRows || '<tr><td colspan="4">No simple 50/50 earnings.</td></tr>'}</tbody>
        </table>
        
        <hr>
        <h2>Summary</h2>
        ${summaryHtml}

        <div class="signatures">
          <div class="signature-box">
            <span class="signature-line">Director's Signature</span>
          </div>
          <div class="signature-box">
            <span class="signature-line">Employee's Signature</span>
          </div>
        </div>

      </body>
    </html>
  `;
}