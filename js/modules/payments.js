// js/modules/payments.js
import * as api from '../api.js';
import * as ui from '../ui.js';
import { auth } from '../../firebase-init.js';
import { renderBarChart } from '../charts.js';
import { createHeaderBar, attachHeaderEvents } from '../components/headerBar.js';
import { exportToCSV, printTable, formatCurrency, debounce } from '../utils.js'; // Import helpers
import { renderPaymentModal, renderEditModal } from '../modals.js';

let state = {
  payments: [], // Master list
  filteredPayments: [], // Sorted list to display
  classes: [],
  timeRange: 'monthly',
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  chartInstance: null,
  sort: {
    field: 'date',
    direction: 'desc'
  }
};

const container = document.getElementById('tab-payments');

export async function init() {
  state.classes = await api.getClasses();
  await render();
}

/**
 * Main render function for the payments tab
 */
async function render() {
  if (!container) return;
  ui.showGlobalLoader('Loading payments...');
  try {
    const month = state.timeRange === 'yearly' ? null : state.currentMonth;
    const { start, end } = api.getDateRange(state.timeRange, state.currentYear, month);
    
    state.payments = await api.getPaymentsByDate(start, end);
    
    applySort(); 
    
    const headerHtml = createHeaderBar({
      currentMonth: state.currentMonth,
      currentYear: state.currentYear,
      timeRange: state.timeRange,
      showReload: true,
    });
    
    const topBarHtml = `
      <div class="mb-6 flex justify-between items-center gap-4">
        <h2 class="text-2xl font-semibold">Payment Log</h2>
        <div class="flex gap-2">
          <button id="add-payment-btn" class="btn-primary">💸 Add Payment</button>
          <button id="exportCsvBtn" class="btn-secondary">📊 Export CSV</button>
          <button id="printPaymentsBtn" class="btn-secondary">🖨️ Print</button>
        </div>
      </div>
    `;
    
    const chartHtml = `
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 class="text-lg font-semibold mb-4">Incoming Payments (${state.timeRange})</h3>
        <div class="h-72">
          <canvas id="paymentsChart"></canvas>
        </div>
      </div>
    `;

    const tableHtml = createPaymentsTable(state.filteredPayments);
    
    container.innerHTML = headerHtml + topBarHtml + chartHtml + tableHtml;
    
    attachHeaderEvents('#tab-payments', state, {
      onMonthChange: (m, y) => { state.currentMonth = m; state.currentYear = y; render(); },
      onRangeChange: (r) => { state.timeRange = r; render(); },
      onReload: async () => { await render(); ui.showToast('✅ Refreshed!'); },
    });
    
    attachPageEventListeners(); // ✨ RENAMED
    attachTableEventListeners(); // ✨ NEW
    renderPaymentsChart(state.payments);
    updateSortIcons();
    
  } catch (error) {
    console.error("Error rendering payments tab:", error);
    container.innerHTML = `<p class="text-red-500 p-6">Error loading payments.</p>`;
  } finally {
    ui.hideGlobalLoader();
  }
}

/**
 * Creates the HTML for the main payments table
 */
function createPaymentsTable(payments) {
  // ... (This function is unchanged)
  const rows = payments.map(p => `
    <tr class="hover:bg-gray-50">
      <td class="p-4 border-b">${p.date.toLocaleDateString()}</td>
      <td class="p-4 border-b font-medium">${p.payerName || 'N/A'}</td>
      <td class="p-4 border-b">
        <span class="font-medium">${formatCurrency(p.amountGross)}</span>
        <br>
        <span class="text-sm text-green-600">(Net: ${formatCurrency(p.amountNet)})</span>
      </td> 
      <td class="p-4 border-b capitalize">${p.method}</td>
      <td class="p-4 border-b text-gray-500">${p.recordedBy || 'N/A'}</td>
      <td class="p-4 border-b text-right space-x-2">
        ${ui.createActionButton('edit', p.id)}
        ${ui.createActionButton('delete', p.id)}
      </td>
    </tr>
  `).join('');

  return `
    <div id="payments-table-container" class="bg-white rounded-lg shadow-md overflow-hidden">
      <table id="payments-table" class="min-w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="p-4 text-left sortable" data-sort="date">Date</th>
            <th class="p-4 text-left sortable" data-sort="name">Student</th>
            <th class="p-4 text-left">Amount (Gross/Net)</th>
            <th class="p-4 text-left">Method</th>
            <th class="p-4 text-left">Recorded By</th>
            <th class="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>${rows.length ? rows : '<tr><td colspan="6" class="p-6 text-center text-gray-500">No payments found for this period.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

/**
 * Renders the bar chart for payments
 */
function renderPaymentsChart(payments) {
  // ... (This function is unchanged)
  const canvas = document.getElementById('paymentsChart');
  if (!canvas) return;
  let labels = [];
  let data = [];
  if (state.timeRange === 'yearly') {
    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    data = Array(12).fill(0);
    payments.forEach(p => data[p.date.getMonth()] += (p.amountNet || 0));
  } else if (state.timeRange === 'monthly') {
    const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
    labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    data = Array(daysInMonth).fill(0);
    payments.forEach(p => data[p.date.getDate() - 1] += (p.amountNet || 0));
  } else { // weekly
    labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    data = Array(7).fill(0);
    payments.forEach(p => data[p.date.getDay()] += (p.amountNet || 0));
  }
  state.chartInstance = renderBarChart(
    canvas, 'Incoming Payments', labels, data, state.chartInstance,
    false, ['rgba(34, 197, 94, 0.8)']
  );
}

/**
 * --- ✨ RENAMED: Attaches listeners for PAGE-LEVEL buttons ---
 */
function attachPageEventListeners() {
  container.querySelector('#exportCsvBtn')?.addEventListener('click', handleExport);
  container.querySelector('#printPaymentsBtn')?.addEventListener('click', handlePrint);
  
  container.querySelector('#add-payment-btn')?.addEventListener('click', () => {
    renderPaymentModal(null, state.classes, async (paymentData) => {
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
  });
}

/**
 * --- ✨ NEW: Attaches listeners for TABLE-SPECIFIC actions ---
 */
function attachTableEventListeners() {
  // Event delegation for table actions
  container.querySelector('#payments-table-container tbody')?.addEventListener('click', e => {
    const editBtn = e.target.closest('.action-btn-edit');
    if (editBtn) {
      handleEditPayment(editBtn.dataset.id);
      return;
    }
    const deleteBtn = e.target.closest('.action-btn-delete');
    if (deleteBtn) {
      handleDeletePayment(deleteBtn.dataset.id);
      return;
    }
  });

  // Sort Listener
  const thead = container.querySelector('table thead');
  thead?.addEventListener('click', e => {
    const sortableHeader = e.target.closest('.sortable');
    if (sortableHeader) handleSort(sortableHeader.dataset.sort);
  });
}


/**
 * Handles editing a payment.
 */
function handleEditPayment(paymentId) {
  // ... (This function is unchanged)
  const payment = state.payments.find(p => p.id === paymentId);
  if (!payment) return;
  const onSave = async (id, updatedData) => {
    ui.showGlobalLoader('Updating payment...');
    try {
      await api.updatePayment(id, updatedData);  
      ui.showToast('Payment updated!');
      await render();
    } catch (e) {
      console.error('Error updating payment:', e);
      ui.showToast('Failed to update payment.', 'error');
    } finally {
      ui.hideGlobalLoader();
    }
  };
  renderEditModal('payment', payment, onSave);
  const modalContainer = document.getElementById('modal-container');
  const searchInput = modalContainer.querySelector('#editStudentSearchInput');
  const searchResults = modalContainer.querySelector('#editStudentSearchResults');
  const feedbackEl = modalContainer.querySelector('#editStudentSelectionFeedback');
  const hiddenIdInput = modalContainer.querySelector('#editSelectedStudentId');
  searchInput.addEventListener('input', debounce(async () => {
    const searchTerm = searchInput.value;
    hiddenIdInput.value = '';
    if (searchTerm.length < 2) {
      searchResults.classList.add('hidden');
      return;
    }
    const students = await api.searchStudents(searchTerm);
    if (students.length > 0) {
      searchResults.innerHTML = students.map(s => `
        <div class="p-2 hover:bg-gray-100 cursor-pointer" data-id="${s.id}" data-name="${s.name}">
          ${s.name} <span class="text-xs text-gray-500">(${s.phone || 'No phone'})</span>
        </div>
      `).join('');
      searchResults.classList.remove('hidden');
    } else {
      searchResults.innerHTML = `<div class="p-2 text-gray-500">No students found.</div>`;
    }
  }, 300));
  searchResults.addEventListener('click', (e) => {
    const target = e.target.closest('[data-id]');
    if (target) {
      hiddenIdInput.value = target.dataset.id;
      searchInput.value = target.dataset.name;
      feedbackEl.textContent = `Selected: ${target.dataset.name}`;
      searchResults.classList.add('hidden');
    }
  });
}

/**
 * Handles deleting a payment.
 */
async function handleDeletePayment(paymentId) {
  // ... (This function is unchanged)
  const payment = state.payments.find(p => p.id === paymentId);
  if (!payment) return;
  if (confirm(`Are you sure you want to delete this payment?\n${payment.payerName} - ${formatCurrency(payment.amountGross)}\n\n(WARNING: This will NOT automatically update the student's tuition balance.)`)) {
    ui.showGlobalLoader('Deleting payment...');
    try {
      await api.deletePayment(paymentId);
      ui.showToast('Payment deleted.', 'success');
      await render();
    } catch (error) {
      console.error('Error deleting payment:', error);
      ui.showToast('Failed to delete payment.', 'error');
    } finally {
      ui.hideGlobalLoader();
    }
  }
}

// --- Utility Functions ---

function handleExport() {
  // ... (This function is unchanged)
  const dataToExport = state.payments.map(p => ({
    Date: p.date.toLocaleDateString(),
    Student: p.payerName,
    Amount: p.amountGross,
    Net_Amount: p.amountNet,
    Method: p.method,
    RecordedBy: p.recordedBy,
  }));
  exportToCSV(dataToExport, 'payments_export.csv');
}

function handlePrint() {
  // ... (This function is unchanged)
  const table = document.getElementById('payments-table').outerHTML;
  const header = `<h1>Payment Log (${new Date(state.currentYear, state.currentMonth).toLocaleString('en', { month: 'long', year: 'numeric' })})</h1>`;
  printTable('Payment Log', header, table);
}

// ------------------------------------
// --- ✨ SORTING FUNCTIONS ---
// ------------------------------------

function applySort() {
  // ... (This function is unchanged)
  const field = state.sort.field;
  const dir = state.sort.direction === 'asc' ? 1 : -1;
  const sorted = [...state.payments].sort((a, b) => {
    let valA, valB;
    switch (field) {
      case 'name':
        valA = a.payerName?.toLowerCase() || '';
        valB = b.payerName?.toLowerCase() || '';
        break;
      case 'date':
      default:
        valA = a.date || new Date(0);
        valB = b.date || new Date(0);
        break;
    }
    if (valA < valB) return -1 * dir;
    if (valA > valB) return 1 * dir;
    return 0;
  });
  state.filteredPayments = sorted;
}

function handleSort(field) {
  // ... (This function is unchanged)
  if (state.sort.field === field) {
    state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    state.sort.field = field;
    state.sort.direction = field === 'date' ? 'desc' : 'asc';
  }
  applySort();
  refreshTable();
}

function updateSortIcons() {
  // ... (This function is unchanged)
  container.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    const field = th.dataset.sort;
    if (field === state.sort.field) {
      th.classList.add(state.sort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

/**
 * --- ✨ UPDATED: Refreshes table and re-attaches listeners ---
 */
function refreshTable() {
  const tableHtml = createPaymentsTable(state.filteredPayments);
  document.getElementById('payments-table-container').innerHTML = tableHtml;
  updateSortIcons();
  attachTableEventListeners(); // <-- ✨ RE-ATTACHES aTABLE LISTENERS
}