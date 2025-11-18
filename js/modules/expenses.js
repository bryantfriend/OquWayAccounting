// js/modules/expenses.js
import * as api from '../api.js';
import * as ui from '../ui.js';
import { renderBarChart } from '../charts.js';
import { createHeaderBar, attachHeaderEvents } from '../components/headerBar.js';
import { renderExpenseModal, renderSalaryModal } from '../modals.js';
import { formatCurrency } from '../utils.js';

let state = {
  timeRange: 'monthly',
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  expenses: [],
  recurring: [],
  salaries: [],
  categories: [],
  chartInstance: null,
};

const container = document.getElementById('tab-expenses');

export async function init() {
  await render();
}

/**
 * Main render function for the expenses tab
 */
async function render() {
  if (!container) return;
  ui.showGlobalLoader('Loading expenses...');
  try {
    const { start, end } = api.getDateRange(state.timeRange, state.currentYear, state.currentMonth);
    
    const [expenses, recurring, categories, salaries] = await Promise.all([
      api.getExpensesByDate(start, end),
      api.getRecurringBills(),
      api.getExpenseCategories(),
      api.getSalaries()
    ]);
    
    state.expenses = expenses;
    state.recurring = recurring;
    state.categories = categories;
    state.salaries = salaries;
    
    const headerHtml = createHeaderBar({
      currentMonth: state.currentMonth,
      currentYear: state.currentYear,
      timeRange: state.timeRange,
      showReload: true,
    });

    const topBarHtml = createTopBar();
    const statCardsHtml = createStatCards(expenses, recurring, salaries);
    const layoutHtml = createLayout(expenses, recurring, salaries);

    container.innerHTML = headerHtml + topBarHtml + statCardsHtml + layoutHtml;
    
    attachHeaderEvents('#tab-expenses', state, {
      onMonthChange: (m, y) => { state.currentMonth = m; state.currentYear = y; render(); },
      onRangeChange: (r) => { state.timeRange = r; render(); },
      onReload: async () => { await render(); ui.showToast('✅ Refreshed!'); },
    });
    
    attachLocalEventListeners();
    
    renderExpensesChart(expenses, recurring, salaries);
    
  } catch (error) {
    console.error("Error rendering expenses tab:", error);
    container.innerHTML = `<p class="text-red-500 p-6">Error loading expenses data. ${error.message}</p>`;
  } finally {
    ui.hideGlobalLoader();
  }
}

/**
 * Creates the top bar
 */
function createTopBar() {
  return `
    <div class="mb-6 flex justify-between items-center gap-4">
      <h2 class="text-2xl font-semibold">Expenses Dashboard</h2>
    </div>
  `;
}

/**
 * --- ✨ UPDATED: Creates the top row of stat cards ---
 * Now with modal triggers.
 */
function createStatCards(expenses, recurring, salaries) {
  const monthlySalary = salaries.reduce((sum, s) => sum + s.salary, 0);
  const monthlyRecurring = recurring.reduce((sum, b) => sum + b.amount, 0);
  const monthlyFixed = monthlySalary + monthlyRecurring;
  const oneTimePeriod = expenses.reduce((sum, e) => sum + e.amount, 0);
  
  const totalPeriod = (state.timeRange === 'yearly')
    ? (monthlyFixed * 12) + oneTimePeriod
    : monthlyFixed + oneTimePeriod;

  return `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      ${ui.createStatCard('Monthly Fixed Costs', monthlyFixed, '🧾', 'Salaries + Bills', 'fixed')}
      ${ui.createStatCard('One-Time Expenses (Period)', oneTimePeriod, '💸', null, 'onetime')}
      ${ui.createStatCard('Total Expenses (Period)', totalPeriod, '📉', 'Fixed + One-Time', 'total')}
    </div>
  `;
}

/**
 * Creates the 3-column layout
 */
function createLayout(expenses, recurring, salaries) {
  return `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <div class="bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
        <div class="flex justify-between items-center p-4 border-b">
          <h3 class="text-lg font-semibold">Staff Payroll</h3>
          <button id="add-salary-btn" class="card-header-btn" title="Add New Salary">+</button>
        </div>
        <div id="salaries-table-container" class="flex-grow">
          ${createSalariesTable(salaries)}
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
        <div class="flex justify-between items-center p-4 border-b">
          <h3 class="text-lg font-semibold">Recurring Bills</h3>
          <button id="add-bill-btn" class="card-header-btn" title="Add Recurring Bill">+</button>
        </div>
        <div id="recurring-table-container" class="flex-grow">
          ${createRecurringBillsTable(recurring)}
        </div>
      </div>
      
      <div class="space-y-6">
        <div class="bg-white rounded-lg shadow-md overflow-hidden">
          <h3 class="text-lg font-semibold p-4 border-b">Expense Breakdown (Monthly)</h3>
          <div class="h-72 p-4">
            <canvas id="expensesChart"></canvas>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
          <div class="flex justify-between items-center p-4 border-b">
            <h3 class="text-lg font-semibold">One-Time Expenses (Period)</h3>
            <button id="add-expense-btn" class="card-header-btn" title="Add One-Time Expense">+</button>
          </div>
          <div id="expenses-table-container" class="flex-grow">
            ${createOneTimeExpensesTable(expenses)}
          </div>
        </div>
      </div>
    </div>
  `;
}

// --- Table-specific render functions ---

function createSalariesTable(salaries) {
  if (salaries.length === 0) {
    return `
      <div class="empty-state">
        <span class="text-4xl">👩‍💼</span>
        <p class="text-gray-500 mt-2">No staff salaries added yet.</p>
        <button id="add-salary-btn-empty" class="btn-secondary mt-4">Add First Salary</button>
      </div>`;
  }
  
  const rows = salaries.map(s => `
    <tr class="hover:bg-gray-50">
      <td class="p-4 border-b">
        <span class="font-medium">${s.name}</span><br>
        <span class="text-sm text-gray-500">${s.position}</span>
      </td>
      <td class="p-4 border-b text-red-600 font-medium">${formatCurrency(s.salary)}</td>
      <td class="p-4 border-b text-right">
        <button class="table-action-btn edit-salary-btn" data-id="${s.id}" title="Edit">✏️</button>
        <button class="table-action-btn delete-salary-btn" data-id="${s.id}" title="Delete">🗑️</button>
      </td>
    </tr>
  `).join('');
  
  return `
    <table class="min-w-full">
      <thead class="bg-gray-50">
        <tr>
          <th class="p-4 text-left text-sm font-semibold text-gray-600">Staff</th>
          <th class="p-4 text-left text-sm font-semibold text-gray-600">Amount</th>
          <th class="p-4 text-right text-sm font-semibold text-gray-600">Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function createRecurringBillsTable(recurring) {
  if (recurring.length === 0) {
    return `
      <div class="empty-state">
        <span class="text-4xl">🔁</span>
        <p class="text-gray-500 mt-2">No recurring bills added yet.</p>
        <button id="add-bill-btn-empty" class="btn-secondary mt-4">Add First Bill</button>
      </div>`;
  }

  const rows = recurring.map(b => `
    <tr class="hover:bg-gray-50">
      <td class="p-4 border-b">
        <span class="font-medium">${b.name}</span><br>
        <span class="text-sm text-gray-500">Due day: ${b.dueDay}</span>
      </td>
      <td class="p-4 border-b text-red-600 font-medium">${formatCurrency(b.amount)}</td>
      <td class="p-4 border-b text-right">
        <button class="table-action-btn edit-bill-btn" data-id="${b.id}" title="Edit">✏️</button>
        <button class="table-action-btn delete-bill-btn" data-id="${b.id}" title="Delete">🗑️</button>
      </td>
    </tr>
  `).join('');
  
  return `
    <table class="min-w-full">
      <thead class="bg-gray-50">
        <tr>
          <th class="p-4 text-left text-sm font-semibold text-gray-600">Bill</th>
          <th class="p-4 text-left text-sm font-semibold text-gray-600">Amount</th>
          <th class="p-4 text-right text-sm font-semibold text-gray-600">Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function createOneTimeExpensesTable(expenses) {
  if (expenses.length === 0) {
    return `
      <div class="empty-state">
        <span class="text-4xl">💸</span>
        <p class="text-gray-500 mt-2">No one-time expenses for this period.</p>
        <button id="add-expense-btn-empty" class="btn-secondary mt-4">Add First Expense</button>
      </div>`;
  }
  
  const rows = expenses.map(e => `
    <tr class="hover:bg-gray-50">
      <td class="p-4 border-b">
        <span class="font-medium">${e.description}</span><br>
        <span class="text-sm text-gray-500">${e.date.toLocaleDateString()}</span>
      </td>
      <td class="p-4 border-b">
        <span class="status-pill" style="background-color:${e.categoryColor}30; color:${e.categoryColor};">
          ${e.category}
        </span>
      </td>
      <td class="p-4 border-b text-red-600 font-medium">${formatCurrency(e.amount)}</td>
      <td class="p-4 border-b text-right">
        <button class="table-action-btn edit-expense-btn" data-id="${e.id}" title="Edit">✏️</button>
        <button class="table-action-btn delete-expense-btn" data-id="${e.id}" title="Delete">🗑️</button>
      </td>
    </tr>
  `).join('');
  
  return `
    <table class="min-w-full">
      <thead class="bg-gray-50">
        <tr>
          <th class="p-4 text-left text-sm font-semibold text-gray-600" colspan="2">Description</th>
          <th class="p-4 text-left text-sm font-semibold text-gray-600">Category</th>
          <th class="p-4 text-left text-sm font-semibold text-gray-600">Amount</th>
          <th class="p-4 text-right text-sm font-semibold text-gray-600">Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}


/**
 * Renders the combined expense pie chart
 */
function renderExpensesChart(expenses, recurring, salaries) {
  // ... (This function is unchanged)
  const canvas = document.getElementById('expensesChart');
  if (!canvas) return;
  const categoryTotals = {};
  const salaryTotal = salaries.reduce((sum, s) => sum + s.salary, 0);
  if (salaryTotal > 0) {
    categoryTotals['Staff Salaries'] = salaryTotal;
  }
  recurring.forEach(b => {
    const category = b.category || b.name || 'Recurring';
    categoryTotals[category] = (categoryTotals[category] || 0) + b.amount;
  });
  expenses.forEach(e => {
    const category = e.category || 'Uncategorized';
    categoryTotals[category] = (categoryTotals[category] || 0) + e.amount;
  });
  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);
  if (labels.length === 0) {
     canvas.parentElement.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">No expense data for this period.</div>';
     return;
  }
  const colors = labels.map((_, i) => `hsl(${(i * 360 / labels.length) % 360}, 70%, 60%)`);
  if (state.chartInstance) state.chartInstance.destroy();
  state.chartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: 'bottom', labels: { padding: 10, boxWidth: 12 } } 
      }
    }
  });
}

/**
 * --- ✨ UPDATED: Attaches all local event listeners ---
 */
function attachLocalEventListeners() {
  // "Add" buttons in headers
  container.querySelector('#add-expense-btn')?.addEventListener('click', handleAddExpense);
  container.querySelector('#add-bill-btn')?.addEventListener('click', handleAddBill);
  container.querySelector('#add-salary-btn')?.addEventListener('click', handleAddSalary);

  // "Add" buttons in empty states
  container.querySelector('#add-expense-btn-empty')?.addEventListener('click', handleAddExpense);
  container.querySelector('#add-bill-btn-empty')?.addEventListener('click', handleAddBill);
  container.querySelector('#add-salary-btn-empty')?.addEventListener('click', handleAddSalary);

  // Table action listeners (using event delegation)
  container.addEventListener('click', e => {
    // Edit buttons
    const editExpense = e.target.closest('.edit-expense-btn');
    if (editExpense) handleEditItem(editExpense.dataset.id, 'expense');

    const editBill = e.target.closest('.edit-bill-btn');
    if (editBill) handleEditItem(editBill.dataset.id, 'bill');
    
    const editSalary = e.target.closest('.edit-salary-btn');
    if (editSalary) handleEditItem(editSalary.dataset.id, 'salary');

    // Delete buttons
    const deleteExpense = e.target.closest('.delete-expense-btn');
    if (deleteExpense) handleDeleteItem(deleteExpense.dataset.id, 'expense');

    const deleteBill = e.target.closest('.delete-bill-btn');
    if (deleteBill) handleDeleteItem(deleteBill.dataset.id, 'bill');
    
    const deleteSalary = e.target.closest('.delete-salary-btn');
    if (deleteSalary) handleDeleteItem(deleteSalary.dataset.id, 'salary');

    // ✨ NEW: Stat Card click listener
    const statCard = e.target.closest('.stat-card[data-modal-type]');
    if (statCard) {
      showExpenseDetailModal(statCard.dataset.modalType);
    }
  });
}

// --- Event Handlers ---

function handleAddExpense() {
  // ... (This function is unchanged)
  renderExpenseModal(null, state.categories, async (data, id) => {
    ui.showGlobalLoader('Saving expense...');
    try {
      if (data.isRecurring) {
        await api.addRecurringBill(data);
      } else {
        await api.recordExpense(data);
      }
      ui.showToast('Expense saved!', 'success');
      await render();
    } catch (e) {
      console.error(e);
      ui.showToast('Failed to save expense.', 'error');
    } finally {
      ui.hideGlobalLoader();
    }
  });
}

function handleAddBill() {
  // ... (This function is unchanged)
  renderExpenseModal({ isRecurring: true }, state.categories, async (data, id) => {
    ui.showGlobalLoader('Saving bill...');
    try {
      await api.addRecurringBill(data);
      ui.showToast('Recurring bill saved!', 'success');
      await render();
    } catch (e) {
      console.error(e);
      ui.showToast('Failed to save bill.', 'error');
    } finally {
      ui.hideGlobalLoader();
    }
  });
}

function handleAddSalary() {
  // ... (This function is unchanged)
  renderSalaryModal(null, async (data, id) => {
    ui.showGlobalLoader('Saving salary...');
    try {
      await api.saveSalary(data, id);
      ui.showToast('Salary saved!', 'success');
      await render();
    } catch (e) {
      console.error(e);
      ui.showToast('Failed to save salary.', 'error');
    } finally {
      ui.hideGlobalLoader();
    }
  });
}

function handleEditItem(id, type) {
  // ... (This function is unchanged)
  if (type === 'salary') {
    const salary = state.salaries.find(s => s.id === id);
    if (!salary) return;
    renderSalaryModal(salary, async (data, id) => {
      ui.showGlobalLoader('Updating salary...');
      try {
        await api.saveSalary(data, id);
        ui.showToast('Salary updated!', 'success');
        await render();
      } catch (e) { console.error(e); ui.showToast('Update failed.', 'error'); } 
      finally { ui.hideGlobalLoader(); }
    });
  } else {
    let item = (type === 'expense') 
      ? state.expenses.find(e => e.id === id)
      : state.recurring.find(b => b.id === id);
    if (!item) return;
    const modalData = { ...item, 
      description: item.description || item.name,
      isRecurring: type === 'recurring'
    };
    renderExpenseModal(modalData, state.categories, async (data, id) => {
      ui.showGlobalLoader('Updating expense...');
      try {
        if (data.isRecurring) {
          if (type === 'expense') { 
            await api.addRecurringBill(data);
            await api.deleteExpense(id);
          } else {
            await api.updateRecurringBill(id, data);
          }
        } else {
          if (type === 'recurring') {
            await api.recordExpense(data);
            await api.deleteBill(id);
          } else {
            await api.updateExpense(id, data);
          }
        }
        ui.showToast('Expense updated!', 'success');
        await render();
      } catch (e) { console.error(e); ui.showToast('Update failed.', 'error'); }
      finally { ui.hideGlobalLoader(); }
    });
  }
}

async function handleDeleteItem(id, type) {
  // ... (This function is unchanged)
  ui.showGlobalLoader('Deleting...');
  try {
    if (type === 'salary') {
      const item = state.salaries.find(s => s.id === id);
      if (confirm(`Delete salary for "${item.name}"?`)) {
        await api.deleteSalary(id);
      }
    } else if (type === 'bill') {
      const item = state.recurring.find(s => s.id === id);
      if (confirm(`Delete recurring bill "${item.name}"?`)) {
        await api.deleteBill(id);
      }
    } else {
      const item = state.expenses.find(s => s.id === id);
      if (confirm(`Delete expense "${item.description}"?`)) {
        await api.deleteExpense(id);
      }
    }
    ui.showToast('Item deleted.', 'success');
    await render();
  } catch(e) {
    console.error(e);
    ui.showToast('Failed to delete item.', 'error');
  } finally {
    ui.hideGlobalLoader();
  }
}

// --- ✨ NEW MODAL FUNCTIONS ---

/**
 * Renders an itemized list for the detail modal.
 */
function _renderModalList(title, items, nameField, amountField) {
  if (items.length === 0) return '';
  
  const total = items.reduce((sum, item) => sum + (item[amountField] || 0), 0);
  
  const rows = items.map(item => `
    <li class="flex justify-between items-center py-2 px-3">
      <span class="text-sm text-gray-700">${item[nameField]}</span>
      <span class="text-sm font-medium text-red-600">${formatCurrency(item[amountField])}</span>
    </li>
  `).join('');
  
  return `
    <div>
      <h4 class="text-md font-semibold text-gray-700 border-b pb-2 mb-2">${title}</h4>
      <ul class="divide-y border rounded-md max-h-48 overflow-y-auto">
        ${rows}
      </ul>
      <div class="flex justify-between font-bold text-gray-800 p-2 mt-1 border-t">
        <span>Total</span>
        <span>${formatCurrency(total)}</span>
      </div>
    </div>
  `;
}

/**
 * Creates and shows the detail modal based on the card type clicked.
 */
function showExpenseDetailModal(type) {
  const modalContainer = document.getElementById('modal-container');
  let title = 'Expense Details';
  let contentHtml = '';
  
  const salaryList = _renderModalList('Staff Payroll', state.salaries, 'name', 'salary');
  const billList = _renderModalList('Recurring Bills', state.recurring, 'name', 'amount');
  const oneTimeList = _renderModalList('One-Time Expenses (Period)', state.expenses, 'description', 'amount');

  if (type === 'fixed') {
    title = 'Monthly Fixed Costs';
    contentHtml = `
      <div class="space-y-4">
        ${salaryList || '<p class="text-gray-500">No salary data.</p>'}
        ${billList || '<p class="text-gray-500">No recurring bill data.</p>'}
      </div>
    `;
  } else if (type === 'onetime') {
    title = 'One-Time Expenses (Period)';
    contentHtml = oneTimeList || '<p class="text-gray-500">No one-time expenses recorded for this period.</p>';
  } else {
    title = 'Total Expenses (Period)';
    contentHtml = `
      <div class="space-y-6">
        ${salaryList || ''}
        ${billList || ''}
        ${oneTimeList || ''}
      </div>
    `;
  }
  
  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-2xl w-full max-w-lg">
        <div class="p-5 border-b flex justify-between items-center">
          <h3 class="text-lg font-semibold">${title}</h3>
          <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        <div class="p-6 max-h-[70vh] overflow-y-auto">
          ${contentHtml}
        </div>
      </div>
    </div>
  `;
  
  modalContainer.querySelector('#close-modal-btn').addEventListener('click', () => {
    modalContainer.innerHTML = '';
  });
}