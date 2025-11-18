// js/modules/payroll.js
import * as api from '../api.js';
import * as ui from '../ui.js';
import { renderPayrollModal } from '../modals.js';
import { exportToCSV, printTable, formatCurrency, debounce } from '../utils.js';

let state = {
  teachers: [],
  students: [],
  classes: [],
  monthlyPayments: [], // Payments made THIS month (for simple 50/50)
  lessons: [],         // Lessons taught THIS month
  loggedPaymentPackages: [], // Payment packages (from any month) tied to THIS month's lessons
  config: {},
};

const container = document.getElementById('tab-payroll');

export async function init() {
  await render();
}

async function render() {
  if (!container) return;
  ui.showGlobalLoader('Loading payroll...');
  try {
    // --- NEW: Fetch all data needed for payroll calculation ---
    const { start, end } = api.getDateRange('monthly', new Date().getFullYear(), new Date().getMonth());
    
    const [teachers, students, classes, config, lessons, monthlyPayments] = await Promise.all([
      api.getUsersByRole('teacher', true), // Get all teachers (active and archived)
      api.getUsersByRole('student', true), // Get ALL students
      api.getClasses(),
      api.getConfig('teacherFees'),
      api.getLessonsByDate(start, end),   // <-- NEW: Get this month's lessons
      api.getPaymentsByDate(start, end)   // <-- NEW: Get this month's payments (for simple 50/50)
    ]);

    // Filter for active teachers *after* fetching all
    state.teachers = teachers.filter(t => t.active !== false); 
    state.students = students;
    state.classes = classes;
    state.config = config || { centerSplit: 0.5, socialFund: 5000 };
    state.lessons = lessons; // <-- NEW: Save lessons
    state.monthlyPayments = monthlyPayments; // <-- NEW: Save monthly payments
    
    // --- NEW: Fetch payment packages for lesson-logged students ---
    const loggedPaymentIds = [...new Set(lessons.map(l => l.paymentId).filter(Boolean))];
    const loggedPaymentPackages = await api.getPaymentsByIds(loggedPaymentIds);
    state.loggedPaymentPackages = loggedPaymentPackages;
    // --- END NEW ---

    const topBarHtml = `
      <div class="mb-6 flex justify-end gap-2">
        <button id="exportPayrollBtn" class="btn-secondary">📊 Export Payroll</button>
        <button id="printPayrollBtn" class="btn-secondary">🖨️ Print Summary</button>
      </div>
    `;
    const tableHtml = createPayrollTable(state.teachers);
    
    container.innerHTML = topBarHtml + tableHtml;
    attachEventListeners();
    
  } catch (error) {
    console.error("Error rendering payroll tab:", error);
    container.innerHTML = `<p class="text-red-500 p-6">Error loading payroll.</p>`;
  } finally {
    ui.hideGlobalLoader();
  }
}

/**
 * --- ✨ NEW HYBRID LOGIC (Copied from teachers.js) ---
 * Pre-calculates all necessary stats for a teacher using hybrid logic.
 */
function _computeTeacherStats(teacher) {
  if (!teacher) return { payrollDue: 0, calculationHtml: '', classCount: 0, totalStudents: 0, totalRevenueGenerated: 0 };

  const stats = {};
  const socialFund = state.config.socialFund || 5000;
  const splitRate = state.config.centerSplit || 0.5;

  // --- 1. HOURLY PAYROLL (Simple) ---
  if (teacher.salaryType === 'hourly') {
    stats.totalRevenueGenerated = (teacher.hourlyRate || 0) * (teacher.totalHours || 0);
    stats.teacherShare = stats.totalRevenueGenerated;
    stats.payrollDue = stats.teacherShare - socialFund;
    
    // Class/Student counts (still useful for list view)
    stats.assignedClasses = state.classes.filter(c => c.teacherId === teacher.id);
    stats.classCount = stats.assignedClasses.length;
    stats.totalStudents = stats.assignedClasses.reduce((sum, c) => sum + (c.students?.length || 0), 0);
    
    return stats;
  }

  // --- 2. 50/50 SPLIT PAYROLL (Hybrid Logic) ---
  let totalTeacherShare = 0;
  let totalRevenueGenerated = 0;
  let lessonBasedRevenue = 0;
  let simpleSplitRevenue = 0;

  // Get all students *taught* by this teacher this month (from lessons)
  const lessonsByThisTeacher = state.lessons.filter(l => l.teacherId === teacher.id);
  
  // Get all students *assigned* to this teacher (from classes)
  const assignedClasses = state.classes.filter(c => c.teacherId === teacher.id);
  const assignedStudentIds = new Set();
  assignedClasses.forEach(c => {
    (c.students || []).forEach(id => assignedStudentIds.add(id));
  });

  // --- 2a. Calculate Lesson-Based (Proportional) Share ---
  // Find payment packages that have been "touched" by *any* lesson log this month
  const touchedPaymentIds = new Set(state.lessons.map(l => l.paymentId));
  
  lessonsByThisTeacher.forEach(lesson => {
    // Find the payment package this lesson is tied to
    const paymentPackage = state.loggedPaymentPackages.find(p => p.id === lesson.paymentId);
    
    if (paymentPackage && paymentPackage.lessonCount > 0) {
      // This is a valid, logged lesson with a package
      const perLessonValue = (paymentPackage.amountGross || 0) / paymentPackage.lessonCount;
      const teacherShareForLesson = perLessonValue * (1 - splitRate);
      totalTeacherShare += teacherShareForLesson;
      
      // Add to revenue stats
      lessonBasedRevenue += perLessonValue;
    }
  });

  // --- 2b. Calculate Simple 50/50 Share ---
  // Find students who are assigned to this teacher but have NOT had any lessons logged
  const simpleSplitStudentIds = new Set(assignedStudentIds);
  state.loggedPaymentPackages.forEach(pkg => {
    if (touchedPaymentIds.has(pkg.id)) {
      simpleSplitStudentIds.delete(pkg.studentId);
    }
  });
  state.lessons.forEach(l => {
    simpleSplitStudentIds.delete(l.studentId);
  });

  // Now, calculate the simple 50/50 split for the remaining students' monthly payments
  const simpleSplitPayments = state.monthlyPayments.filter(p => simpleSplitStudentIds.has(p.studentId));
  
  simpleSplitPayments.forEach(p => {
    const revenue = p.amountGross || 0;
    const teacherShareForPayment = revenue * (1 - splitRate);
    totalTeacherShare += teacherShareForPayment;
    
    // Add to revenue stats
    simpleSplitRevenue += revenue;
  });

  // --- 2c. Finalize Stats & Build HTML ---
  stats.assignedClasses = assignedClasses;
  stats.classCount = stats.assignedClasses.length;
  stats.totalStudents = assignedStudentIds.size;
  
  stats.totalRevenueGenerated = lessonBasedRevenue + simpleSplitRevenue;
  stats.teacherShare = totalTeacherShare;
  stats.payrollDue = stats.teacherShare - socialFund;

  return stats;
}


/**
 * --- UPDATED: Uses the new _calculatePayrollStats function ---
 */
function createPayrollTable(teachers) {
  const rows = teachers.map(t => {
    // --- FIX: Use the correct, full calculation ---
    const stats = _computeTeacherStats(t);
    const payrollDue = stats.payrollDue;
    // --- END FIX ---

    const isPaid = payrollDue <= 0;
    const statusText = isPaid ? 'Paid' : 'Due';
    const statusClass = isPaid ? 'paid' : 'unpaid';
    
    return `
      <tr class="hover:bg-gray-50">
        <td class="p-4 border-b font-medium">${t.name}</td>
        <td class="p-4 border-b">${t.salaryType === 'hourly' ? 'Hourly' : '50/50 Split'}</td>
        <td class="p-4 border-b">${t.salaryType === 'hourly' ? t.totalHours || 0 : 'N/A'}</td>
        <td class="p-4 border-b">${t.salaryType === 'hourly' ? formatCurrency(t.hourlyRate) : 'N/A'}</td>
        <td class="p-4 border-b font-semibold">${formatCurrency(payrollDue)}</td>
        <td class="p-4 border-b text-center">
          ${ui.createStatusPill(statusText, statusClass)}
        </td>
        <td class="p-4 border-b text-right space-x-2">
          <button class="edit-payroll-btn" data-id="${t.id}" title="Edit Rate/Hours">✏️</button>
          ${!isPaid 
            ? `<button class="mark-paid-btn btn-primary" data-id="${t.id}">Mark Paid</button>` 
            : ''}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div id="payroll-table-container" class="bg-white rounded-lg shadow-md overflow-hidden">
      <table id="payroll-table" class="min-w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="p-4 text-left">Teacher</th>
            <th class="p-4 text-left">Salary Type</th>
            <th class="p-4 text-left">Hours (Hourly)</th>
            <th class="p-4 text-left">Rate (Hourly)</th>
            <th class="p-4 text-left">Payroll Due</th>
            <th class="p-4 text-center">Status</th>
            <th class="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function attachEventListeners() {
  container.querySelector('#exportPayrollBtn')?.addEventListener('click', handleExport);
  container.querySelector('#printPayrollBtn')?.addEventListener('click', handlePrint);

  container.querySelector('table tbody')?.addEventListener('click', e => {
    const editBtn = e.target.closest('.edit-payroll-btn');
    if (editBtn) handleEditPayroll(editBtn.dataset.id);

    const paidBtn = e.target.closest('.mark-paid-btn');
    if (paidBtn) handleMarkPaid(paidBtn.dataset.id);
  });
}

function handleEditPayroll(teacherId) {
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (!teacher) return;
  
  // Note: This modal only edits hourly rate/hours
  renderPayrollModal(teacher, async (data, id) => { 
    ui.showGlobalLoader('Updating payroll...');
    try {
      await api.saveUser(data, id); 
      ui.showToast('Payroll info updated!', 'success');
      await render();
    } catch (error) {
      console.error(error);
      ui.showToast('Failed to update payroll.', 'error');
    } finally {
      ui.hideGlobalLoader();
    }
  });
}

async function handleMarkPaid(teacherId) {
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (confirm(`Mark payroll as paid for ${teacher.name}? This will reset their hours to 0.`)) {
    ui.showGlobalLoader('Processing payment...');
    try {
      await api.markPayrollPaid(teacherId); 
      ui.showToast('Payroll marked as paid.', 'success');
      await render();
    } catch (error) {
      console.error(error);
      ui.showToast('Failed to mark as paid.', 'error');
    } finally {
      ui.hideGlobalLoader();
    }
  }
}

/**
 * --- UPDATED: Exports the new, correct data ---
 */
function handleExport() {
  const dataToExport = state.teachers.map(t => {
    const stats = _computeTeacherStats(t);
    return {
      Teacher: t.name,
      Phone: t.phone || 'N/A',
      SalaryType: t.salaryType === 'hourly' ? 'Hourly' : '50/50 Split',
      Hours: t.salaryType === 'hourly' ? t.totalHours || 0 : 'N/A',
      Rate: t.salaryType === 'hourly' ? formatCurrency(t.hourlyRate || 0) : 'N/A',
      TotalRevenueGenerated: formatCurrency(stats.totalRevenueGenerated),
      TeacherShare: formatCurrency(stats.teacherShare),
      PayrollDue: formatCurrency(stats.payrollDue),
    };
  });
  exportToCSV(dataToExport, 'payroll_summary.csv');
}

function handlePrint() {
  const table = document.getElementById('payroll-table').outerHTML;
  const header = `<h1>Payroll Summary</h1><h2>${new Date().toLocaleDateString()}</h2>`;
  printTable('Payroll Summary', header, table);
}