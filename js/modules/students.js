// js/modules/students.js
import * as api from '../api.js';
import * as ui from '../ui.js';
import { StudentModal } from '../modals/StudentModal.js';
import { renderPaymentModal, renderLessonLogModal } from '../modals.js';
import { exportToCSV, printTable, formatCurrency, debounce } from '../utils.js';
import { Timestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { showImportModal } from './studentImporter.js';

let state = {
  students: [], // The master list
  classes: [],  // The master list
  teachers: [], // The master list
  filteredStudents: [], // The list to display
  filters: {
    status: 'active',
    class: 'all',
    teacher: 'all', 
    search: '',
  },
  sort: {
    field: 'name',
    direction: 'asc',
  }
};

const container = document.getElementById('tab-students');

export async function init() {
  await render();
}

/**
 * Main render function. Fetches all data and builds the page.
*/
async function render() {
  if (!container) return;
  ui.showGlobalLoader('Loading students...');
  try {
    const [students, classes, teachers] = await Promise.all([
      api.getUsersByRole('student', true), 
      api.getClasses(),
      api.getUsersByRole('teacher') 
    ]);

    const updatedStudents = await resetOverdueMonthlyStudents(students);
    state.students = updatedStudents; 
    state.classes = classes;
    state.teachers = teachers.sort((a,b) => a.name.localeCompare(b.name)); 

    applyFiltersAndSort();
    
    const topBarHtml = createTopBar(state.classes, state.teachers); 
    const tableHtml = createStudentsTable(state.filteredStudents, state.classes, state.teachers);

    container.innerHTML = `
      ${topBarHtml}
      <div id="students-table-container" class="bg-white rounded-lg shadow-md overflow-hidden">
        ${tableHtml}
      </div>
    `;
    
    attachPageEventListeners();
    attachTableEventListeners();
    updateSortIcons();
    
  } catch (error) {
    console.error("Error rendering students tab:", error);
    container.innerHTML = `<p class="text-red-500 p-6">Error loading students.</p>`;
  } finally {
    ui.hideGlobalLoader();
  }
}

/**
 * Creates the top bar with new class and teacher filters
 */
function createTopBar(classes, teachers) { 
  const sortedClasses = [...classes].sort((a, b) => {
    const nameA = (a.displayName || a.name).toLowerCase();
    const nameB = (b.displayName || b.name).toLowerCase();
    if (nameA < nameB) return 1;
    if (nameA > nameB) return -1;
    return 0;
  });

  const classOptions = sortedClasses.map(c => 
    `<option value="${c.id}">${c.displayName || c.name}</option>`
  ).join('');

  const teacherOptions = teachers.map(t =>
    `<option value="${t.id}">${t.name}</option>`
  ).join('');

  return `
    <div class="mb-6 grid grid-cols-1 md:grid-cols-3 items-center gap-4">
      
      <div class="relative w-full">
        <input id="studentSearchInput" type="text" class="w-full p-2 pl-10 border rounded" placeholder="Search by name or phone..." value="${state.filters.search}">
        <span class="absolute left-3 top-2.5 text-gray-400">🔍</span>
      </div>
      
      <div class="flex flex-col sm:flex-row flex-wrap gap-2 w-full md:justify-center">
        <select id="classFilterSelect" class="border rounded p-2 w-full sm:w-auto" value="${state.filters.class}">
          <option value="all">All Classes</option>
          ${classOptions}
        </select>

        <select id="teacherFilterSelect" class="border rounded p-2 w-full sm:w-auto" value="${state.filters.teacher}">
          <option value="all">All Teachers</option>
          ${teacherOptions}
        </select>

        <select id="statusFilterSelect" class="border rounded p-2 w-full sm:w-auto" value="${state.filters.status}">
          <option value="active">Active Students</option>
          <option value="due">Payment Due</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial (Session)</option>
          <option value="archived">Archived Students</option>
        </select>
      </div>
      
      <div class="flex gap-2 w-full justify-start md:justify-end">
        <button id="addStudentBtn" class="btn-primary">➕ Add Student</button>
        <button id="importStudentsBtn" class="btn-secondary">📥 Import</button>
        <button id="printStudentsBtn" class="btn-secondary">🖨️ Print</button>
      </div>

    </div>
  `;
}

/**
 * Creates the student table with sortable headers
 */
function createStudentsTable(students, classes, teachers) { 
  const rows = students.map(s => {
    const { status, pill } = getPaymentStatus(s);
    if (!s.active && status === 'archived') {
      if (state.filters.status !== 'archived') return '';
    } else if (s.active === false) {
      return '';
    }

    const studentClass = classes.find(c => c.id === s.classId);
    let className = 'N/A';
    let schedule = 'N/A';
    let teacherName = 'N/A'; 
    if (studentClass) {
      className = studentClass.displayName || studentClass.name;
      const teacher = teachers.find(t => t.id === studentClass.teacherId);
      if (teacher) {
        teacherName = teacher.name;
      }
      
      const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      schedule = (studentClass.days || [])
        .sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
        .map(day => `${day}: ${studentClass.dayTimes[day] || '?'}`)
        .join('<br>');
      if (!schedule) schedule = 'No schedule set';
    }

    const lastPayment = s.lastPaymentDate ? s.lastPaymentDate.toDate().toLocaleDateString() : 'N/A';

    return `
      <tr class="hover:bg-gray-50">
        <td class="p-4 border-b">
          <span class="font-medium">${s.name}</span><br>
          <span class="text-sm text-gray-500">${s.phone || 'No phone'}</span>
        </td>
        <td class="p-4 border-b">${className}</td>
        <td class="p-4 border-b">${teacherName}</td>
        <td class="p-4 border-b text-xs leading-5">${schedule}</td>
        <td class="p-4 border-b text-sm">${lastPayment}</td>
        <td class="p-4 border-b font-medium">${formatCurrency(s.tuitionOwed)}</td>
        <td class="p-4 border-b">${pill}</td>
        <td class="p-4 border-b text-right space-x-2">
          ${s.active !== false ? `
            <button class="add-payment-btn table-action-btn" data-id="${s.id}" title="Add Payment">💵</button>
            <button class="log-lesson-btn table-action-btn" data-id="${s.id}" title="Log Lessons">📋</button>
            <button class="edit-student-btn table-action-btn" data-id="${s.id}" title="Edit Student">✏️</button>
            <button class="archive-student-btn table-action-btn" data-id="${s.id}" title="Archive Student">🗃️</button>
          ` : `
            <button class="restore-student-btn table-action-btn" data-id="${s.id}" title="Restore Student">🔁</button>
          `}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table id="students-table" class="min-w-full">
      <thead class="bg-gray-50">
        <tr>
          <th class="p-4 text-left sortable" data-sort="name">Student</th>
          <th class="p-4 text-left sortable" data-sort="class">Class</th>
          <th class="p-4 text-left sortable" data-sort="teacher">Teacher</th>
          <th class="p-4 text-left">Schedule</th>
          <th class="p-4 text-left sortable" data-sort="lastPaymentDate">Last Payment</th>
          <th class="p-4 text-left sortable" data-sort="tuitionOwed">Owed</th>
          <th class="p-4 text-left sortable" data-sort="paymentStatus">Payment Status</th>
          <th class="p-4 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>${rows.length ? rows : '<tr><td colspan="8" class="p-6 text-center text-gray-500">No students found.</td></tr>'}</tbody>
    </table>
  `;
}

/**
 * Applies all filters and sorting from state, then updates the table.
 */
function applyFiltersAndSort() {
  const { status, class: classId, search, teacher: teacherId } = state.filters;
  let tempStudents = state.students;

  // 1. Filter by Status
  tempStudents = tempStudents.filter(s => {
    if (status === 'active') return s.active !== false;
    if (status === 'archived') return s.active === false;
    if (s.active === false) return false;
    const { status: paymentStatus } = getPaymentStatus(s);
    if (status === 'due') return paymentStatus === 'due' || paymentStatus === 'unpaid';
    if (status === 'paid') return paymentStatus === 'paid';
    if (status === 'partial') return paymentStatus === 'partial';
    return true;
  });

  // 2. Filter by Class
  if (classId !== 'all') {
    tempStudents = tempStudents.filter(s => s.classId === classId);
  }
  
  // 3. Filter by Teacher
  if (teacherId !== 'all') {
    tempStudents = tempStudents.filter(s => {
      if (!s.classId) return false; 
      const studentClass = state.classes.find(c => c.id === s.classId);
      return studentClass?.teacherId === teacherId;
    });
  }

  // 4. Filter by Search
  if (search.length > 1) {
    const searchTerm = search.toLowerCase();
    tempStudents = tempStudents.filter(s => 
      s.name.toLowerCase().includes(searchTerm) ||
      s.phone?.includes(searchTerm)
    );
  }

  // 5. Sort
  tempStudents.sort((a, b) => {
    let valA, valB;
    const dir = state.sort.direction === 'asc' ? 1 : -1;
    switch (state.sort.field) {
      case 'name':
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        break;
      case 'class':
        valA = state.classes.find(c => c.id === a.classId)?.name || 'zzz';
        valB = state.classes.find(c => c.id === b.classId)?.name || 'zzz';
        break;
      case 'teacher':
        const classA = state.classes.find(c => c.id === a.classId);
        const classB = state.classes.find(c => c.id === b.classId);
        const teacherA = state.teachers.find(t => t.id === classA?.teacherId);
        const teacherB = state.teachers.find(t => t.id === classB?.teacherId);
        valA = teacherA?.name.toLowerCase() || 'zzz';
        valB = teacherB?.name.toLowerCase() || 'zzz';
        break;
      case 'lastPaymentDate':
        valA = a.lastPaymentDate?.toDate() || new Date(0);
        valB = b.lastPaymentDate?.toDate() || new Date(0);
        break;
      case 'tuitionOwed':
        valA = a.tuitionOwed || 0;
        valB = b.tuitionOwed || 0;
        break;
      case 'paymentStatus':
        valA = getPaymentStatus(a).status;
        valB = getPaymentStatus(b).status;
        break;
      default:
        return 0;
    }
    if (valA < valB) return -1 * dir;
    if (valA > valB) return 1 * dir;
    return 0;
  });

  state.filteredStudents = tempStudents;
}

/**
 * Updates the sort arrows in the table header
 */
function updateSortIcons() {
  container.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    const field = th.dataset.sort;
    if (field === state.sort.field) {
      th.classList.add(state.sort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

/**
 * Gets the payment status pill for a student
 */
function getPaymentStatus(student) {
  if (student.active === false) {
    return { status: 'archived', pill: ui.createStatusPill('Archived', 'archived') };
  }
  const model = student.paymentModel || 'session';
  if (model === 'monthly') {
    if (!student.lastPaymentDate) {
      return { status: 'due', pill: ui.createStatusPill('First Payment Due', 'unpaid') };
    }
    const lastPay = student.lastPaymentDate.toDate();
    const nextDueDate = new Date(lastPay.getFullYear(), lastPay.getMonth(), lastPay.getDate() + 30);
    const today = new Date();
    
    if (today > nextDueDate) {
      return { status: 'due', pill: ui.createStatusPill(`Due (since ${nextDueDate.toLocaleDateString()})`, 'unpaid') };
    } else {
      return { status: 'paid', pill: ui.createStatusPill(`Paid (until ${nextDueDate.toLocaleDateString()})`, 'paid') };
    }
  }
  const balance = (student.tuitionTotal || 0) - (student.tuitionPaid || 0);
  if (balance <= 0) {
    const credit = -balance;
    if (student.tuitionPaid > 0) {
      return { status: 'paid', pill: ui.createStatusPill(`Credit: ${formatCurrency(credit)}`, 'paid') };
    } else {
      return { status: 'none', pill: '<span>-</span>' };
    }
  }
  if (balance > 0 && student.tuitionPaid > 0) {
    return { status: 'partial', pill: ui.createStatusPill('Partial', 'partial') };
  }
  if (balance > 0 && (student.tuitionPaid === 0 || !student.tuitionPaid)) {
    return { status: 'unpaid', pill: ui.createStatusPill('Unpaid', 'unpaid') };
  }
  return { status: 'none', pill: '<span>-</span>' };
}

/**
 * Attaches listeners for page-level actions
 */
function attachPageEventListeners() {
  container.querySelector('#addStudentBtn')?.addEventListener('click', handleAddStudent);
  container.querySelector('#printStudentsBtn')?.addEventListener('click', handlePrint);
  
  container.querySelector('#importStudentsBtn')?.addEventListener('click', () => {
    showImportModal(state.classes, render);
  });
  // Filter Listeners
  container.querySelector('#statusFilterSelect')?.addEventListener('change', handleFilterChange);
  container.querySelector('#classFilterSelect')?.addEventListener('change', handleFilterChange);
  container.querySelector('#teacherFilterSelect')?.addEventListener('change', handleFilterChange);
  container.querySelector('#studentSearchInput')?.addEventListener('input', debounce(handleFilterChange, 300));
}

/**
 * Attaches listeners for table-specific actions
 */
function attachTableEventListeners() {
  const tbody = container.querySelector('table tbody');
  tbody?.addEventListener('click', e => {
    const editBtn = e.target.closest('.edit-student-btn');
    if (editBtn) handleEditStudent(editBtn.dataset.id);

    const paymentBtn = e.target.closest('.add-payment-btn');
    if (paymentBtn) handleAddPayment(paymentBtn.dataset.id);

    const logLessonBtn = e.target.closest('.log-lesson-btn');
    if (logLessonBtn) handleLogLessons(logLessonBtn.dataset.id);

    const archiveBtn = e.target.closest('.archive-student-btn');
    if (archiveBtn) handleArchiveStudent(archiveBtn.dataset.id);
    
    const restoreBtn = e.target.closest('.restore-student-btn');
    if (restoreBtn) handleRestoreStudent(restoreBtn.dataset.id);
  });
  
  const thead = container.querySelector('table thead');
  thead?.addEventListener('click', e => {
    const sortableHeader = e.target.closest('.sortable');
    if (sortableHeader) handleSort(sortableHeader.dataset.sort);
  });
}

// --- Event Handlers ---

/**
 * --- UPDATED: Uses the new StudentModal class ---
 */
function handleAddStudent() {
  const modal = new StudentModal(
    null, // No student (creating new)
    state.classes,
    state.students,
    state.teachers,
    async (saveData) => { // This is the onSave callback
      ui.showGlobalLoader('Saving student...');
      try {
        const { studentData, pendingClass } = saveData;

        // 1. Save the new student
        const newUserId = await api.saveUser(studentData, null);
        
        // 2. Check if we also have a pending class to create
        if (pendingClass) {
            // 2a. Add the new student's ID to the pending class
            pendingClass.students = [newUserId];
            
            // 2b. Save the new class
            const newClassId = await api.saveClass(pendingClass);
            
            // 2c. Update the student with the new class ID
            await api.saveUser({ classId: newClassId }, newUserId);

        } else if (studentData.classId) {
          // This handles the original flow (if they just selected an existing class)
          await api.updateClassStudents(studentData.classId, newUserId, 'add');
        }

        ui.showToast('Student added successfully!', 'success');
        await render(); 
      } catch (error) {
        console.error(error);
        ui.showToast('Failed to add student.', 'error');
      } finally {
        ui.hideGlobalLoader();
      }
  }
  );
  modal.show();
}

/**
 * --- UPDATED: Now handles creating NEW classes during an edit ---
 */
function handleEditStudent(studentId) {
    const student = state.students.find(s => s.id === studentId);
    if (!student) {
        console.error("Edit FAILED: Student not found for ID:", studentId);
        return;
    }
    
    const oldClassId = student.classId || null;

    const modal = new StudentModal(
      student, 
      state.classes,
      state.students,
      state.teachers,
      async (saveData, studentId) => {
        ui.showGlobalLoader('Updating student...');
        try {
          const { studentData, pendingClass } = saveData; 
          
          // 1. Check if we need to create a NEW class first
          if (pendingClass) {
              pendingClass.students = [studentId];
              const newClassId = await api.saveClass(pendingClass);
              studentData.classId = newClassId; // Assign new ID to the student data
          }

          // 2. Save the student updates (including the new classId from step 1 or selection)
          await api.saveUser(studentData, studentId); // THIS ENSURES classID IS SAVED

          const newClassId = studentData.classId || null;
          
          // 3. Manage Class Lists (Add/Remove student from class arrays)
          if (oldClassId && oldClassId !== newClassId) {
            await api.updateClassStudents(oldClassId, studentId, 'remove');
          }
          
          if (newClassId && newClassId !== oldClassId) {
            await api.updateClassStudents(newClassId, studentId, 'add');
          }
          
          ui.showToast('Student updated!', 'success');
          await render();

        } catch (error) {
          console.error("SAVE FAILED!", error);
          ui.showToast('Failed to update student. See console.', 'error');
        } finally {
          ui.hideGlobalLoader();
        }
      }
    );
    modal.show();
}

function handleAddPayment(studentId) {
  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  renderPaymentModal(student, state.classes, async (paymentData) => {
    ui.showGlobalLoader('Recording payment...');
    try {
      await api.addPayment(paymentData);
      ui.showToast('Payment recorded!', 'success');
      await render();
    } catch (error) {
      console.error(error);
      ui.showToast(error.message || 'Payment failed.', 'error');
    } finally {
      ui.hideGlobalLoader();
    }
  });
}

async function handleLogLessons(studentId) {
  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  ui.showGlobalLoader('Loading lesson log...');
  try {
    const [payments, lessons] = await Promise.all([
      api.getActivePaymentsForStudent(studentId),
      api.getLessonsForStudent(studentId, new Date().getFullYear(), new Date().getMonth())
    ]);
    
    ui.hideGlobalLoader();
    
    renderLessonLogModal(student, state.teachers, state.classes, payments, lessons);

  } catch (error) {
    ui.hideGlobalLoader();
    console.error("Error loading lesson data:", error);
    ui.showToast(error.message || 'Failed to load lesson data.', 'error');
  }
}

async function handleArchiveStudent(studentId) {
  const student = state.students.find(s => s.id === studentId);
  if (confirm(`Are you sure you want to archive ${student.name}?`)) {
    ui.showGlobalLoader('Archiving...');
    try {
      await api.archiveUser(studentId);
      
      if (student.classId) {
        await api.updateClassStudents(student.classId, studentId, 'remove');
      }

      ui.showToast('Student archived.', 'success');
      await render();
    } catch (error) {
      console.error(error);
      ui.showToast('Failed to archive.', 'error');
    } finally {
      ui.hideGlobalLoader();
    }
  }
}

async function handleRestoreStudent(studentId) {
  const student = state.students.find(s => s.id === studentId);
  if (confirm(`Are you sure you want to restore ${student.name}?`)) {
    ui.showGlobalLoader('Restoring...');
    try {
      await api.restoreUser(studentId);
      
      if (student.classId) {
        await api.updateClassStudents(student.classId, studentId, 'add');
      }

      ui.showToast('Student restored.', 'success');
      await render();
    } catch (error) { 
      console.error(error);
      ui.showToast('Failed to restore.', 'error');
    } finally { 
      ui.hideGlobalLoader();
    }
  }
}

function handleFilterChange() {
  state.filters.status = container.querySelector('#statusFilterSelect').value;
  state.filters.class = container.querySelector('#classFilterSelect').value;
  state.filters.teacher = container.querySelector('#teacherFilterSelect').value;
  state.filters.search = container.querySelector('#studentSearchInput').value;
  
  applyFiltersAndSort();
  refreshTable();
}

function handleSort(field) {
  if (state.sort.field === field) {
    state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    state.sort.field = field;
    state.sort.direction = 'asc';
  }
  
  applyFiltersAndSort();
  refreshTable();
}

function handlePrint() {
  const table = document.getElementById('students-table').outerHTML;
  const header = `<h1>OquWay Student Summary</h1><h2>${new Date().toLocaleDateString()}</h2>`;
  printTable('Student Summary', header, table);
}

/**
 * Refreshes just the table with current filtered/sorted data
 */
function refreshTable() {
  const tableHtml = createStudentsTable(state.filteredStudents, state.classes, state.teachers);
  document.getElementById('students-table-container').innerHTML = tableHtml;
  updateSortIcons();
  attachTableEventListeners(); 
}

/**
 * Checks for students on a monthly plan whose payment is overdue.
 */
async function resetOverdueMonthlyStudents(students) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); 
  const studentsToUpdate = [];

  for (const student of students) {
    if (student.active && student.paymentModel === 'monthly' && student.lastPaymentDate) {
      
      const lastPay = student.lastPaymentDate.toDate();
      const nextDueDate = new Date(lastPay);
      nextDueDate.setDate(nextDueDate.getDate() + 30);
      nextDueDate.setHours(0, 0, 0, 0); 

      if (today > nextDueDate) {
        const newOwed = student.tuitionTotal || 0;
        
        if (student.tuitionOwed !== newOwed || student.tuitionPaid !== 0) {
          studentsToUpdate.push({
            id: student.id,
            updates: {
              tuitionOwed: newOwed,
              tuitionPaid: 0,
            }
          });
          
          student.tuitionOwed = newOwed;
          student.tuitionPaid = 0;
        }
      }
    }
  }

  if (studentsToUpdate.length > 0) {
    console.log(`Resetting tuition for ${studentsToUpdate.length} overdue student(s).`);
    await api.batchUpdateUsers(studentsToUpdate); 
  }
  
  return students;
}
