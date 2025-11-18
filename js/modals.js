// js/modals.js
import * as api from './api.js';
import { auth } from '../firebase-init.js';
import { formatCurrency, debounce, createSpinner } from './utils.js';
import { Timestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { showToast, showGlobalLoader, hideGlobalLoader } from './ui.js';

// --- NEW CLASS IMPORT ---
import { StudentModal } from './modals/StudentModal.js';
import { SalaryModal } from './modals/SalaryModal.js';

/**
 * Creates and displays a modal for editing a record.
 */
export function renderEditModal(type, data, onSave) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  // --- FIX: Handle date safely (string vs object) ---
  let dateValue = '';
  if (data.date) {
      if (typeof data.date === 'string') dateValue = data.date;
      else if (data.date.toDate) dateValue = data.date.toDate().toISOString().split('T')[0];
      else if (data.date instanceof Date) dateValue = data.date.toISOString().split('T')[0];
  }

  const title = type === 'payment' ? '💵 Edit Payment' : '💰 Edit Expense';

  let formHtml = '';
  if (type === 'payment') {
      formHtml = `
        <div class="space-y-4">
          <div>
            <label for="editStudentSearchInput" class="block text-sm font-medium text-gray-700">👤 Student Name</label>
            <input type="text" id="editStudentSearchInput"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              placeholder="Start typing..." autocomplete="off" 
              value="${data.payerName || data.studentName || ''}" />
            <div id="editStudentSearchResults" class="absolute z-50 w-full bg-white border border-gray-300 rounded-md mt-1 hidden shadow-lg max-h-60 overflow-y-auto"></div>
            <p id="editStudentSelectionFeedback" class="text-sm text-gray-600 mt-1 h-5"></p>
          </div>
          <input type="hidden" id="editSelectedStudentId" value="${data.studentId || ''}" />
          <div>
            <label class="block text-sm font-medium text-gray-700">💰 Amount</label>
            <input id="editAmount" type="number" class="mt-1 block w-full border rounded-md px-3 py-2" value="${data.amountGross || 0}">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">📅 Date</label>
            <input id="editDate" type="date" class="mt-1 block w-full border rounded-md px-3 py-2" value="${dateValue}">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">🏦 Method</label>
            <select id="editMethod" class="mt-1 block w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500">
              <option value="cash" ${data.method === 'cash' ? 'selected' : ''}>Cash</option>
              <option value="qr" ${data.method === 'qr' ? 'selected' : ''}>QR</option>
              <option value="card" ${data.method === 'card' ? 'selected' : ''}>Card</option>
            </select>
          </div>
        </div>
      `;
  } else {
    formHtml = `
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">📝 Description</label>
          <input id="editDescription" type="text" class="mt-1 block w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500" value="${data.description}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">💸 Amount</label>
          <input id="editAmount" type="number" class="mt-1 block w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500" value="${data.amount}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">📅 Date</label>
          <input id="editDate" type="date" class="mt-1 block w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500" value="${dateValue}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">📂 Category</label>
          <select id="editCategory" class="mt-1 block w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500">
            <option value="rent" ${data.category === 'rent' ? 'selected' : ''}>Rent</option>
            <option value="payroll" ${data.category === 'payroll' ? 'selected' : ''}>Payroll</option>
            <option value="utilities" ${data.category === 'utilities' ? 'selected' : ''}>Utilities</option>
            <option value="supplies" ${data.category === 'supplies' ? 'selected' : ''}>Supplies</option>
            <option value="marketing" ${data.category === 'marketing' ? 'selected' : ''}>Marketing</option>
            <option value="other" ${data.category === 'other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
      </div>
    `;
  }

  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-2xl w-full max-w-md transform scale-100 transition-all">
        <div class="p-5 border-b flex justify-between items-center">
          <h3 class="text-lg font-semibold">${title}</h3>
          <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div class="p-6">${formHtml}</div>
        <div class="bg-gray-50 px-6 py-3 flex justify-end space-x-3 border-t">
          <button id="cancel-edit-btn" class="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-md text-sm">
            ❌ Cancel
          </button>
          <button id="save-edit-btn" class="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm flex items-center gap-1">
            ✅ Save Changes
          </button>
        </div>
      </div>
    </div>
  `;

  const close = () => (modalContainer.innerHTML = '');
  document.getElementById('close-modal-btn').addEventListener('click', close);
  document.getElementById('cancel-edit-btn').addEventListener('click', close);
  modalContainer.querySelector('.fixed').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) close();
  });
  
  document.getElementById('save-edit-btn').addEventListener('click', () => {
    const updatedData = {};
    
    // --- DATE FIX ---
    const dateInput = document.getElementById('editDate').value;
    const newTimestamp = Timestamp.fromDate(new Date(dateInput));

    if (type === 'payment') {
      updatedData.payerName = document.getElementById('editStudentSearchInput').value;
      updatedData.studentId = document.getElementById('editSelectedStudentId').value;
      updatedData.amountGross = Number(document.getElementById('editAmount').value);
      updatedData.date = newTimestamp;
      updatedData.timestamp = newTimestamp;
      updatedData.method = document.getElementById('editMethod').value;
    } else {
      updatedData.description = document.getElementById('editDescription').value;
      updatedData.amount = document.getElementById('editAmount').value;
      updatedData.date = newTimestamp;
      updatedData.category = document.getElementById('editCategory').value;
    }
    onSave(data.id, updatedData);
    close();
  });
}

/**
 * --- ✨ UPGRADED FUNCTION ---
 * Renders the "smart" modal for adding a payment.
 */
export function renderPaymentModal(student, classes, onSave) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const today = new Date().toISOString().split('T')[0];
  
  const defaultExpires = new Date();
  defaultExpires.setDate(defaultExpires.getDate() + 30);
  const expiresString = defaultExpires.toISOString().split('T')[0];

  // --- SAFEGUARD FOR NULL STUDENT ---
  // We set default variables so the template string doesn't crash
  const sName = student ? student.name : '';
  const sId = student ? student.id : '';
  const sPhone = student ? student.phone : '';
  const sTuition = student ? student.tuitionTotal : '';
  const sModel = student ? student.paymentModel : 'monthly';
  const isMonthly = sModel === 'monthly';
  const feedbackText = student ? `Selected: ${sName} (${sPhone || 'No phone'})` : '';
  
  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-2xl w-full max-w-lg">
        <div class="p-5 border-b flex justify-between items-center">
          <h3 class="text-lg font-semibold">💸 Add New Payment</h3>
          <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        
        <div class="p-6 space-y-4">
          <div>
            <label for="modalStudentSearch" class="block text-sm font-medium">1. Find Student</label>
            <input type="text" id="modalStudentSearch" class="mt-1 block w-full border rounded px-3 py-2" placeholder="Start typing name or phone..." value="${sName}">
            <div id="modalSearchResults" class="mt-2 border rounded max-h-48 overflow-y-auto hidden"></div>
            <input type="hidden" id="modalStudentId" value="${sId}">
            <p id="modalStudentFeedback" class="text-sm text-green-600 h-5 mt-1">${feedbackText}</p>
          </div>
          
          <div class="text-center">
            <span class="text-gray-500 text-xs">--- OR ---</span><br>
            <button id="modal-add-student-btn" class="text-blue-600 hover:text-blue-800 text-sm font-medium mt-1">
              + Add New Student
            </button>
          </div>

          <div class="border-t pt-4 space-y-4">
            <h3 class="block text-sm font-medium">2. Payment Details</h3>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Payment Type</label>
                <select id="modalPaymentType" class="mt-1 block w-full border rounded px-3 py-2">
                  <option value="lesson" ${!isMonthly ? 'selected' : ''}>Per Lesson / Balance</option>
                  <option value="monthly" ${isMonthly ? 'selected' : ''}>Monthly (Package)</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Amount Paid (KGS)</label>
                <input id="modalPaymentAmount" type="number" class="mt-1 block w-full border rounded px-3 py-2" placeholder="5000">
              </div>
            </div>

            <div id="monthly-details" class="${isMonthly ? '' : 'hidden'} space-y-4 border-t pt-4">
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700">Total Tuition</label>
                  <input id="modalTuitionTotal" type="number" class="mt-1 block w-full border rounded px-2 py-1 text-sm" value="${sTuition || ''}">
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700"># Lessons</label>
                  <input id="modalLessonCount" type="number" class="mt-1 block w-full border rounded px-2 py-1 text-sm" value="12">
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700">Expires On</label>
                  <input id="modalExpiresOn" type="date" class="mt-1 block w-full border rounded px-2 py-1 text-sm" value="${expiresString}">
                </div>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Payment Date</label>
                <input id="modalPaymentDate" type="date" class="mt-1 block w-full border rounded px-3 py-2" value="${today}">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Method</label>
                <select id="modalPaymentMethod" class="mt-1 block w-full border rounded px-3 py-2">
                  <option value="cash">Cash</option>
                  <option value="qr" selected>QR</option>
                  <option value="card">Card</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-gray-50 px-6 py-3 flex justify-end space-x-3 border-t">
          <button id="cancel-payment-btn" class="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300">Cancel</button>
          <button id="save-payment-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">💾 Record Payment</button>
        </div>
      </div>
    </div>
  `;

  // --- Listeners ---
  const close = () => modalContainer.innerHTML = '';
  modalContainer.querySelector('#close-modal-btn').addEventListener('click', close);
  modalContainer.querySelector('#cancel-payment-btn').addEventListener('click', close);

  // Add Student Listener
  modalContainer.querySelector('#modal-add-student-btn').addEventListener('click', () => {
    _handleAddNewStudent(classes); 
  });

  // Toggle Monthly
  const typeSelect = modalContainer.querySelector('#modalPaymentType');
  const detailsDiv = modalContainer.querySelector('#monthly-details');
  typeSelect.addEventListener('change', () => {
      if(typeSelect.value === 'monthly') detailsDiv.classList.remove('hidden');
      else detailsDiv.classList.add('hidden');
  });

  // Search Logic
  const searchInp = modalContainer.querySelector('#modalStudentSearch');
  const resultsDiv = modalContainer.querySelector('#modalSearchResults');
  const idInp = modalContainer.querySelector('#modalStudentId');
  const fbEl = modalContainer.querySelector('#modalStudentFeedback');
  const tuitionInp = modalContainer.querySelector('#modalTuitionTotal');

  searchInp.addEventListener('input', debounce(async () => {
      const term = searchInp.value;
      idInp.value = ''; // clear ID on type
      if(term.length < 2) { resultsDiv.classList.add('hidden'); return; }
      
      const res = await api.searchStudents(term);
      if(res.length > 0) {
          resultsDiv.innerHTML = res.map(s => `
            <div class="p-2 hover:bg-gray-100 cursor-pointer border-b" 
                 data-id="${s.id}" 
                 data-name="${s.name}"
                 data-tuition="${s.tuitionTotal || ''}">
               ${s.name} <span class="text-gray-500 text-xs">(${s.phone||''})</span>
            </div>
          `).join('');
          resultsDiv.classList.remove('hidden');
      } else {
          resultsDiv.innerHTML = '<div class="p-2 text-gray-500">No results</div>';
          resultsDiv.classList.remove('hidden');
      }
  }, 300));

  resultsDiv.addEventListener('click', (e) => {
      const row = e.target.closest('[data-id]');
      if(!row) return;
      idInp.value = row.dataset.id;
      searchInp.value = row.dataset.name;
      tuitionInp.value = row.dataset.tuition;
      fbEl.textContent = `Selected: ${row.dataset.name}`;
      resultsDiv.classList.add('hidden');
  });

  // Save
  modalContainer.querySelector('#save-payment-btn').addEventListener('click', () => {
      const pType = typeSelect.value;
      const amt = Number(modalContainer.querySelector('#modalPaymentAmount').value);
      
      if(!idInp.value) { showToast('Select a student', 'error'); return; }
      if(!amt || amt <= 0) { showToast('Enter valid amount', 'error'); return; }

      const data = {
          studentId: idInp.value,
          studentName: searchInp.value,
          amount: amt,
          date: modalContainer.querySelector('#modalPaymentDate').value,
          method: modalContainer.querySelector('#modalPaymentMethod').value,
          recordedBy: auth.currentUser?.uid,
          paymentType: pType,
          tuitionTotal: pType === 'monthly' ? Number(tuitionInp.value) : null,
          expiresOn: pType === 'monthly' ? modalContainer.querySelector('#modalExpiresOn').value : null,
          lessonCount: pType === 'monthly' ? Number(modalContainer.querySelector('#modalLessonCount').value) : null,
      };
      
      onSave(data);
      close();
  });
}

/**
 * --- ✨ UPDATED: Handles the "Add New Student" flow using the new Class ---
 */
function _handleAddNewStudent(classes) {
  // 1. Close the payment modal
  document.getElementById('modal-container').innerHTML = '';
  
  // 2. Open the Student Modal
  const modal = new StudentModal(null, classes, [], [], async (saveData) => {
    showGlobalLoader('Saving new student...');
    try {
        // Unwrap the saveData object (because StudentModal now returns { studentData, pendingClass })
        // If it's a simple save, it might just be studentData, but StudentModal wraps it now.
        // Let's check if it has 'studentData' property, otherwise use it as is
        const studentData = saveData.studentData || saveData; 

      // 3. Save the new student
      const newStudentId = await api.saveUser(studentData, null);
      
      if (studentData.classId) {
        await api.updateClassStudents(studentData.classId, newStudentId, 'add');
      }

      const newStudent = await api.getUserById(newStudentId);
      showToast('Student saved!', 'success');
      
      // 4. Re-open the payment modal, pre-filled with the new student
      renderPaymentModal(newStudent, classes, async (paymentData) => {
          showGlobalLoader('Recording payment...');
          try {
            await api.addPayment(paymentData);
            showToast('Payment recorded!', 'success');
            // Trigger a refresh in the UI somehow? 
            // Since this is a generic function, we assume the caller refreshes or we rely on toasts.
          } catch (error) {
            console.error(error);
            showToast(error.message || 'Payment failed.', 'error');
          } finally {
            hideGlobalLoader();
          }
      });

    } catch (error) {
      console.error(error);
      showToast('Failed to save student.', 'error');
    } finally {
      hideGlobalLoader();
    }
  });
  modal.show();
}

/**
 * Renders a modal for editing a Teacher's payroll info.
 */
export function renderPayrollModal(teacher, onSave) {
    const modalContainer = document.getElementById('modal-container');
    
    const html = `
      <div class="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-2xl w-full max-w-md">
          <div class="p-5 border-b flex justify-between items-center">
            <h3 class="text-lg font-semibold">Edit Payroll: ${teacher.name}</h3>
            <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium">Hourly Rate (KGS)</label>
              <input id="hourlyRate" type="number" class="mt-1 block w-full" value="${teacher.hourlyRate || 0}">
            </div>
            <div>
              <label class="block text-sm font-medium">Total Hours (This Period)</label>
              <input id="totalHours" type="number" class="mt-1 block w-full" value="${teacher.totalHours || 0}">
            </div>
            <div>
              <label class="block text-sm font-medium">Payroll Due (Auto-calc on save)</label>
              <input class="mt-1 block w-full bg-gray-100" value="${teacher.payrollDue || 0}" readonly>
            </div>
          </div>
          <div class="bg-gray-50 px-6 py-3 flex justify-end space-x-3 border-t">
            <button id="cancel-edit-btn" class="btn-secondary">Cancel</button>
            <button id="save-payroll-btn" class="btn-primary">Save Changes</button>
          </div>
        </div>
      </div>
    `;
    modalContainer.innerHTML = html;
  
    const close = () => modalContainer.innerHTML = '';
    modalContainer.querySelector('#close-modal-btn').addEventListener('click', close);
    modalContainer.querySelector('#cancel-edit-btn').addEventListener('click', close);
    
    modalContainer.querySelector('#save-payroll-btn').addEventListener('click', () => {
      const data = {
        hourlyRate: Number(modalContainer.querySelector('#hourlyRate').value),
        totalHours: Number(modalContainer.querySelector('#totalHours').value),
      };
      onSave(data, teacher.id);
      close();
    });
  }

/**
 * Renders the modal for adding or editing an Expense (regular or recurring).
 */
export function renderExpenseModal(expense, categories, onSave) {
  const modalContainer = document.getElementById('modal-container');
  const isRecurring = expense?.isRecurring || false;
  const title = expense ? 'Edit Expense' : 'Add New Expense';
  const today = new Date().toISOString().split('T')[0];
  
  const startDateValue = expense?.startDate 
    ? expense.startDate.toDate().toISOString().split('T')[0] 
    : today;

  const categoryOptions = categories.map(c => 
    `<option value="${c.name}" ${expense?.category === c.name ? 'selected' : ''} data-color="${c.color}">
      ${c.name}
    </option>`
  ).join('');

  const html = `
    <div class="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-2xl w-full max-w-lg">
        <div class="p-5 border-b flex justify-between items-center">
          <h3 class="text-lg font-semibold">${title}</h3>
          <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium">Description</label>
            <input id="expDesc" type="text" class="mt-1 block w-full" value="${expense?.description || ''}">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium">Amount (KGS)</label>
              <input id="expAmount" type="number" class="mt-1 block w-full" value="${expense?.amount || ''}">
            </div>
            <div>
              <label class="block text-sm font-medium">Category</label>
              <select id="expCategory" class="mt-1 block w-full">
                ${categoryOptions.length ? categoryOptions : '<option disabled>No categories found</option>'}
              </select>
            </div>
          </div>
          
          <div class="border-t pt-4">
            <label class="flex items-center space-x-2">
              <input type="checkbox" id="expIsRecurring" class="form-checkbox" ${isRecurring ? 'checked' : ''}>
              <span class="font-medium">This is a recurring expense</span>
            </label>
            
            <div id="recurring-options" class="space-y-3 mt-3 ${isRecurring ? '' : 'hidden'} bg-gray-50 p-3 rounded-md border">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700">Interval</label>
                  <select id="expInterval" class="mt-1 block w-full bg-white">
                    <option value="monthly" ${expense?.interval === 'monthly' ? 'selected' : ''}>Monthly</option>
                    <option value="weekly" ${expense?.interval === 'weekly' ? 'selected' : ''}>Weekly</option>
                    <option value="yearly" ${expense?.interval === 'yearly' ? 'selected' : ''}>Yearly</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700">Due Day</label>
                  <input id="expDueDay" type="number" class="mt-1 block w-full bg-white" placeholder="Day (e.g. 1)" value="${expense?.dueDay || '1'}">
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700">Start Date</label>
                <input id="expStartDate" type="date" class="mt-1 block w-full bg-white" value="${startDateValue}">
                <p class="text-xs text-gray-500 mt-1">Expenses will calculate from this date forward.</p>
              </div>
            </div>
            
            <div id="one-time-date" class="mt-2 ${isRecurring ? 'hidden' : ''}">
              <label class="block text-sm font-medium">Date of Expense</label>
              <input id="expDate" type="date" class="mt-1 block w-full" value="${expense?.date ? expense.date.toISOString().split('T')[0] : today}">
            </div>

          </div>
        </div>

        <div class="bg-gray-50 px-6 py-3 flex justify-end space-x-3 border-t">
          <button id="cancel-edit-btn" class="btn-secondary">Cancel</button>
          <button id="save-expense-btn" class="btn-primary">💾 Save Expense</button>
        </div>
      </div>
    </div>
  `;
  modalContainer.innerHTML = html;
  
  const close = () => modalContainer.innerHTML = '';
  const recurringCheckbox = modalContainer.querySelector('#expIsRecurring');
  const recurringOptions = modalContainer.querySelector('#recurring-options');
  const oneTimeDate = modalContainer.querySelector('#one-time-date');

  recurringCheckbox.addEventListener('change', () => {
    recurringOptions.classList.toggle('hidden', !recurringCheckbox.checked);
    oneTimeDate.classList.toggle('hidden', recurringCheckbox.checked);
  });

  modalContainer.querySelector('#close-modal-btn').addEventListener('click', close);
  modalContainer.querySelector('#cancel-edit-btn').addEventListener('click', close);

  modalContainer.querySelector('#save-expense-btn').addEventListener('click', () => {
    const isRecurring = recurringCheckbox.checked;
    const categorySelect = modalContainer.querySelector('#expCategory');
    const selectedOption = categorySelect.options[categorySelect.selectedIndex];

    const data = {
      description: modalContainer.querySelector('#expDesc').value,
      amount: Number(modalContainer.querySelector('#expAmount').value),
      category: categorySelect.value || 'Uncategorized',
      categoryColor: selectedOption?.dataset.color || '#9CA3AF',
      isRecurring: isRecurring,
      interval: isRecurring ? modalContainer.querySelector('#expInterval').value : null,
      dueDay: isRecurring ? Number(modalContainer.querySelector('#expDueDay').value) : null,
      startDate: isRecurring ? modalContainer.querySelector('#expStartDate').value : null,
      date: isRecurring ? null : modalContainer.querySelector('#expDate').value
    };

    if (!data.description || data.amount <= 0) {
      showToast('Please enter a description and valid amount.', 'error');
      return;
    }
    
    onSave(data, expense?.id || null);
    close();
  });
}

/**
 * Renders the modal for adding or editing a Staff Salary.
 */
export function renderSalaryModal(salary, onSave) {
    const modal = new SalaryModal(salary, onSave);
    modal.show();
}

/**
 * Renders the "Log Lessons" Calendar Modal
 */
export function renderLessonLogModal(student, teachers, classes, payments, initialLessons) {
  const modalContainer = document.getElementById('modal-container');
  
  const studentClass = classes.find(c => c.id === student.classId);
  const scheduleDays = studentClass?.days || []; 

  let state = {
    selectedTeacherId: teachers[0]?.id || null,
    selectedPaymentId: null, 
    lessons: initialLessons,
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
  };

  const firstActivePackage = payments.find(p => (p.lessonsLogged || 0) < p.lessonCount);
  if (firstActivePackage) {
    state.selectedPaymentId = firstActivePackage.id;
  }

  function renderModalHtml() {
    const teacherButtons = teachers.map(t => `
      <button 
        class="teacher-btn" 
        data-id="${t.id}" 
        title="${t.name}"
        draggable="true">
        ${t.name.split(' ')[0]}
      </button>
    `).join('');
    
    const paymentOptions = payments.map(p => {
      const lessonsLogged = p.lessonsLogged || 0;
      const lessonCount = p.lessonCount;
      const paymentDate = p.timestamp.toDate().toLocaleDateString();

      if (lessonCount) {
        const remaining = lessonCount - lessonsLogged;
        const isFull = remaining <= 0;
        return `
          <option value="${p.id}" ${isFull ? 'disabled' : ''}>
            ${paymentDate} (${formatCurrency(p.amountGross)}) - ${remaining} / ${lessonCount} lessons left
          </option>`;
      } else {
        return `
          <option value="${p.id}" data-legacy="true">
            ${paymentDate} (${formatCurrency(p.amountGross)}) - (Needs Setup)
          </option>`;
      }
    }).join('');

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4" id="lesson-modal-overlay">
        <div class="bg-white rounded-lg shadow-2xl w-full max-w-4xl transform transition-all" style="transform: scale(1);">
          <div class="p-5 border-b flex justify-between items-center">
            <h3 class="text-lg font-semibold">📋 Log Lessons for ${student.name}</h3>
            <div class="flex items-center gap-2">
              <button id="help-btn" class="card-header-btn" style="transform: none; opacity: 0.8; width: 1.75rem; height: 1.75rem; font-size: 1rem;">?</button>
              <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-4">
            <div class="md:col-span-1 p-4 border-r bg-gray-50 space-y-4">
              
              <div id="step-1-payment" class="step-container">
                <label class="step-label">1. Select Payment Package</label>
                <select id="payment-select" class="w-full text-sm">
                  <option value="">-- Select Package --</option>
                  ${paymentOptions.length ? paymentOptions : '<option disabled>No packages found</option>'}
                </select>
                <div id="legacy-setup" class="hidden mt-2 space-y-2">
                  <p class="text-xs text-yellow-700">This is an old payment. How many lessons was this for?</p>
                  <input id="legacy-lesson-count" type="number" class="w-full text-sm p-1" value="12">
                  <button id="migrate-payment-btn" class="btn-primary w-full text-sm py-1 flex items-center justify-center gap-2">
                    <span class="btn-text">Save & Activate</span>
                    <span class="btn-spinner hidden">${createSpinner()}</span> 
                  </button>
                </div>
                <div id="lesson-counter" class="text-sm font-medium text-gray-700 mt-2 h-10"></div>
              </div>
              
              <div id="step-2-teacher" class="step-container">
                <label class="step-label">2. Select Teacher to Log</label>
                <div class="teacher-list">
                  ${teacherButtons}
                </div>
                 <p class="text-xs text-gray-500 mt-2">Click to select, or drag-and-drop onto the calendar.</p>
              </div>
            </div>
            
            <div id="step-3-calendar" class="md:col-span-3 p-4 step-container">
              <p class="text-center text-sm text-gray-500 mb-2">3. Click a day to log a lesson for the selected teacher.</p>
              <div id="lesson-calendar" class="calendar-grid">
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
function renderCalendar() {
    const calendarEl = modalContainer.querySelector('#lesson-calendar');
    if (!calendarEl) return;
    
    const { currentMonth, currentYear, lessons } = state;
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startOffset = (firstDay === 0) ? 6 : firstDay - 1;
    
    let calendarHtml = '<div class="calendar-header">Mon</div><div class="calendar-header">Tue</div><div class="calendar-header">Wed</div><div class="calendar-header">Thu</div><div class="calendar-header">Fri</div><div class="calendar-header">Sat</div><div class="calendar-header">Sun</div>';

    for (let i = 0; i < startOffset; i++) {
      calendarHtml += `<div class="calendar-day empty"></div>`;
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      
      const lessonsOnThisDay = lessons.filter(l => {
        if (!l.date) return false;
        // --- FIX: Handle both Timestamp and Date objects ---
        const lessonDate = l.date.toDate ? l.date.toDate() : new Date(l.date);
        // --------------------------------------------------
        return lessonDate.getDate() === day && 
               lessonDate.getMonth() === currentMonth && 
               lessonDate.getFullYear() === currentYear;
      });
      
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
      const isScheduledDay = scheduleDays.includes(dayOfWeek);
      const scheduledClass = isScheduledDay ? 'bg-blue-50' : '';
      
      const lessonChips = lessonsOnThisDay.map(l => {
        const teacher = teachers.find(t => t.id === l.teacherId);
        return `
          <div class="lesson-chip" data-lesson-id="${l.id}" data-payment-id="${l.paymentId}" title="Click to remove ${teacher?.name}">
            ${teacher?.name.split(' ')[0] || '...'}
          </div>`;
      }).join('');
      
      calendarHtml += `
        <div class="calendar-day ${scheduledClass}" data-date="${date.toISOString()}">
          <div class="day-number">${day}</div>
          <div class="lesson-chips">${lessonChips}</div>
        </div>
      `;
    }
    calendarEl.innerHTML = calendarHtml;
    updateHighlights();
  }

  function updateHighlights() {
    const step1 = modalContainer.querySelector('#step-1-payment');
    const step2 = modalContainer.querySelector('#step-2-teacher');
    const step3 = modalContainer.querySelector('#step-3-calendar');
    const paymentSelect = modalContainer.querySelector('#payment-select');
    const legacySetup = modalContainer.querySelector('#legacy-setup');
    const counterEl = modalContainer.querySelector('#lesson-counter');
    
    [step1, step2, step3].forEach(el => el?.classList.remove('active-step', 'disabled-step'));
    legacySetup?.classList.add('hidden');
    
    const payment = payments.find(p => p.id === state.selectedPaymentId);

    if (!payment) {
      step1?.classList.add('active-step');
      step2?.classList.add('disabled-step');
      step3?.classList.add('disabled-step');
      if (counterEl) counterEl.textContent = 'Please select a package.';
      return;
    }

    if (!payment.lessonCount) {
      step1?.classList.add('active-step');
      step2?.classList.add('disabled-step');
      step3?.classList.add('disabled-step');
      if (counterEl) counterEl.textContent = 'This package needs to be set up.';
      legacySetup?.classList.remove('hidden');
    } else {
      step2?.classList.add('active-step');
      step3?.classList.add('active-step');
      const lessonsLogged = payment.lessonsLogged || 0;
      const totalLessons = payment.lessonCount;
      const remaining = totalLessons - lessonsLogged;
      if (counterEl) counterEl.textContent = `Using package: ${remaining} lessons remaining.`;
      modalContainer.querySelectorAll('.teacher-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.id === state.selectedTeacherId);
      });
    }
  }
  
  async function attemptToLogLesson(dayEl, lessonDate, teacherIdToLog) {
    if (dayEl.classList.contains('day-loading')) return; 
    dayEl.classList.add('day-loading');
    const dayNumberEl = dayEl.querySelector('.day-number');
    const originalDayText = dayNumberEl.textContent;
    dayNumberEl.innerHTML = `<div class="day-spinner">${createSpinner()}</div>`;

    const { selectedPaymentId } = state;
    
    try {
      if (!teacherIdToLog) {
        throw new Error('Please select a teacher first.');
      }
      
      const payment = payments.find(p => p.id === selectedPaymentId);
      if (!payment) {
        throw new Error('Please select a payment package first.');
      }
      if (!payment.lessonCount) {
        throw new Error('Please set up this legacy package first.');
      }
      
      const lessonsLogged = payment.lessonsLogged || 0;
      if (lessonsLogged >= payment.lessonCount) {
        throw new Error('This payment package is full.');
      }

      const { lessonId, payment: updatedPaymentData } = await api.logLesson(
        payment.id,
        student.id,
        teacherIdToLog, 
        student.classId || null,
        lessonDate
      );
      
      state.lessons.push({ 
        id: lessonId, 
        teacherId: teacherIdToLog, 
        paymentId: payment.id, 
        date: Timestamp.fromDate(lessonDate) 
      });
      
      const pIndex = payments.findIndex(p => p.id === payment.id);
      if (pIndex > -1) {
        payments[pIndex] = { ...payments[pIndex], ...updatedPaymentData };
      }
      state.selectedPaymentId = payment.id;
      
      showToast('Lesson logged!', 'success');
      
    } catch (error) {
      console.error("Error logging lesson:", error);
      showToast(error.message || 'Failed to log lesson.', 'error');
    } finally {
      renderCalendar();
    }
  }

  async function handleChipClick(chipEl) {
    if (chipEl.classList.contains('chip-loading')) return;
    chipEl.classList.add('chip-loading');
    const originalText = chipEl.textContent;
    chipEl.innerHTML = createSpinner();
    
    const lessonId = chipEl.dataset.lessonId;
    const paymentId = chipEl.dataset.paymentId;
    
    if (confirm('Are you sure you want to remove this lesson?')) {
      try {
        const updatedPaymentData = await api.deleteLesson(lessonId, paymentId);
        
        state.lessons = state.lessons.filter(l => l.id !== lessonId);
        
        if (updatedPaymentData) {
          const pIndex = payments.findIndex(p => p.id === paymentId);
          if (pIndex > -1) {
            payments[pIndex] = { ...payments[pIndex], ...updatedPaymentData };
          }
          state.selectedPaymentId = paymentId;
        }

        showToast('Lesson removed.', 'success');
      } catch (error) {
        console.error("Error deleting lesson:", error);
        showToast(error.message || 'Failed to remove lesson.', 'error');
        chipEl.classList.remove('chip-loading');
        chipEl.innerHTML = originalText;
      } finally {
        renderCalendar();
      }
    } else {
      chipEl.classList.remove('chip-loading');
      chipEl.innerHTML = originalText;
    }
  }
  
  async function handleMigratePayment() {
    const countInput = modalContainer.querySelector('#legacy-lesson-count');
    const lessonCount = Number(countInput.value);
    
    if (lessonCount <= 0) {
      showToast('Please enter a valid number of lessons (e.g., 12).', 'error');
      return;
    }
    
    const payment = payments.find(p => p.id === state.selectedPaymentId);
    if (!payment) return;
    
    const perLessonValue = (payment.amountGross || 0) / lessonCount;
    
    const data = {
      lessonCount: lessonCount,
      lessonsLogged: 0,
      perLessonValue: perLessonValue
    };
    
    const migrateBtn = modalContainer.querySelector('#migrate-payment-btn');
    const btnText = migrateBtn.querySelector('.btn-text');
    const btnSpinner = migrateBtn.querySelector('.btn-spinner');
    migrateBtn.disabled = true;
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');

    try {
      await api.updatePayment(payment.id, data);
      
      payment.lessonCount = lessonCount;
      payment.lessonsLogged = 0;
      payment.perLessonValue = perLessonValue;
      
      const paymentSelect = modalContainer.querySelector('#payment-select');
      const option = paymentSelect.querySelector(`option[value="${payment.id}"]`);
      option.removeAttribute('data-legacy');
      option.textContent = `${payment.timestamp.toDate().toLocaleDateString()} (${formatCurrency(payment.amountGross)}) - ${lessonCount} / ${lessonCount} lessons left`;
      
      updateHighlights();
      showToast('Package activated!', 'success');
      
    } catch (error) {
      console.error("Error migrating payment:", error);
      showToast(error.message || 'Failed to activate.', 'error');
    } finally {
      migrateBtn.disabled = false;
      btnText.classList.remove('hidden');
      btnSpinner.classList.add('hidden');
    }
  }

  function showHelpModal() {
    const helpModal = document.createElement('div');
    helpModal.className = 'modal-overlay';
    helpModal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100;';
    helpModal.innerHTML = `
      <div class="modal-content !max-w-lg bg-white rounded-lg shadow-2xl" style="transform: scale(1);">
        <div class="p-5 border-b flex justify-between items-center">
          <h3 class="text-lg font-semibold">❓ How to Log Lessons</h3>
          <button id="close-help-btn" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        <div class="p-6 space-y-3">
          <p>This system allows you to assign a teacher's payroll to a specific student payment, one lesson at a time.</p>
          <ol class="list-decimal list-inside space-y-2">
            <li>
              <strong>Select a Payment Package:</strong> Choose one of the student's active "Monthly (Package)" payments. If it's an old payment, you'll be asked to set it up by entering the number of lessons it was for (e.g., 12).
            </li>
            <li>
              <strong>Select a Teacher:</strong> Click on the teacher who gave the lesson. Their name will be highlighted.
            </li>
            <li>
              <strong>Click a Calendar Day:</strong> Click on a day in the calendar to log one lesson for that teacher. You can click multiple days.
            </li>
            <li>
              <strong>Drag-and-Drop:</strong> You can also drag a teacher's name directly onto a calendar day to log a lesson.
            </li>
          </ol>
          <p>A "chip" with the teacher's name will appear on that day. To remove a lesson, just click the chip.</p>
        </div>
      </div>
    `;
    document.body.appendChild(helpModal);
    helpModal.querySelector('#close-help-btn').addEventListener('click', () => helpModal.remove());
  }

  // --- Initial Render and Listeners ---
  renderModalHtml();
  if (firstActivePackage) {
    modalContainer.querySelector('#payment-select').value = firstActivePackage.id;
  }
  renderCalendar();
  
  const close = () => {
    modalContainer.innerHTML = '';
  };
  modalContainer.querySelector('#close-modal-btn').addEventListener('click', close);
  modalContainer.querySelector('#lesson-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'lesson-modal-overlay') close();
  });
  
  modalContainer.querySelector('#payment-select').addEventListener('change', (e) => {
    state.selectedPaymentId = e.target.value;
    updateHighlights();
  });

  modalContainer.querySelector('#migrate-payment-btn').addEventListener('click', handleMigratePayment);
  
  const teacherList = modalContainer.querySelector('.teacher-list');
  teacherList.addEventListener('click', (e) => {
    const btn = e.target.closest('.teacher-btn');
    if (btn) {
      state.selectedTeacherId = btn.dataset.id;
      updateHighlights();
    }
  });

  teacherList.addEventListener('dragstart', (e) => {
    const btn = e.target.closest('.teacher-btn');
    if (btn) {
      e.dataTransfer.setData('text/plain', btn.dataset.id); 
      e.dataTransfer.effectAllowed = 'copy';
      state.selectedTeacherId = btn.dataset.id;
      updateHighlights();
    }
  });


  const calendarEl = modalContainer.querySelector('#lesson-calendar');
  
  calendarEl.addEventListener('click', (e) => {
    const chipEl = e.target.closest('.lesson-chip');
    if (chipEl) {
      handleChipClick(chipEl); 
    } else {
      const dayEl = e.target.closest('.calendar-day');
      if (dayEl && dayEl.dataset.date) {
        attemptToLogLesson(dayEl, new Date(dayEl.dataset.date), state.selectedTeacherId); 
      }
    }
  });

  calendarEl.addEventListener('dragover', (e) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'copy';
    const dayEl = e.target.closest('.calendar-day');
    if (dayEl && dayEl.dataset.date) {
      dayEl.classList.add('drag-over'); 
    }
  });

  calendarEl.addEventListener('dragleave', (e) => {
    const dayEl = e.target.closest('.calendar-day');
    if (dayEl) {
      dayEl.classList.remove('drag-over');
    }
  });

  calendarEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const dayEl = e.target.closest('.calendar-day');
    if (dayEl && dayEl.dataset.date) {
      dayEl.classList.remove('drag-over');
      const teacherId = e.dataTransfer.getData('text/plain');
      if (teacherId) {
        attemptToLogLesson(dayEl, new Date(dayEl.dataset.date), teacherId); 
      }
    }
  });

  modalContainer.querySelector('#help-btn').addEventListener('click', showHelpModal);
}