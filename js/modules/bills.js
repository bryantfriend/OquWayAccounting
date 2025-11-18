// js/modules/bills.js
import * as api from '../api.js';
import * as ui from '../ui.js';
import { createHeaderBar, attachHeaderEvents } from '../components/headerBar.js';

const state = {
  bills: [],
  timeRange: 'monthly',
};

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// --- Main Render Function ---
export async function init(isInitialLoad) {
  if (isInitialLoad) render();
  else await render();
}

async function render() {
  showLoader();
  try {
    state.bills = await api.getRecurringBills();

    const headerHtml = createHeaderBar({
      currentMonth,
      currentYear,
      timeRange: state.timeRange,
      showReload: true,
    });

    const statCardsHtml = generateStatCards(state.bills);
    const formHtml = renderForm();
    const tableHtml = renderTable(state.bills);

    const layout = `
      ${headerHtml}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        ${statCardsHtml}
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2">${tableHtml}</div>
        <div>${formHtml}</div>
      </div>
    `;

    ui.renderPageLayout('bills-content', layout, '');

    attachHeaderEvents('#bills-content', { currentMonth, currentYear }, {
      onMonthChange: (m, y) => { currentMonth = m; currentYear = y; render(); },
      onRangeChange: (r) => { state.timeRange = r; render(); },
      onReload: async () => { await render(); ui.showToast('✅ Refreshed!'); },
    });

    attachEventListeners();
  } catch (err) {
    console.error('Error loading recurring bills:', err);
    document.getElementById('bills-content').innerHTML =
      `<p class="text-red-500">Failed to load recurring bills.</p>`;
  } finally {
    hideLoader();
  }
}

// --- 🧮 Stat Cards ---
function generateStatCards(bills) {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const totalDue = bills.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);

  const paidBills = bills.filter(
    (b) => b.lastPaidYear === currentYear && b.lastPaidMonth === currentMonth
  );

  const upcomingBills = bills.filter(
    (b) =>
      (!b.lastPaidYear ||
        b.lastPaidMonth !== currentMonth ||
        b.lastPaidYear !== currentYear) &&
      b.dueDay > currentDay
  );

  const overdueBills = bills.filter(
    (b) =>
      (!b.lastPaidYear ||
        b.lastPaidMonth !== currentMonth ||
        b.lastPaidYear !== currentYear) &&
      b.dueDay < currentDay
  );

  const cards = [
    { title: '💰 Total Due This Month', value: formatCurrency(totalDue, 'KGS'), bg: 'bg-blue-100', text: 'text-blue-800' },
    { title: '✅ Bills Paid', value: paidBills.length, bg: 'bg-green-100', text: 'text-green-800' },
    { title: '🧾 Upcoming Bills', value: upcomingBills.length, bg: 'bg-yellow-100', text: 'text-yellow-800' },
    { title: '⚠️ Overdue Bills', value: overdueBills.length, bg: 'bg-red-100', text: 'text-red-800' },
  ];

  return cards.map((c) => `
    <div class="p-6 rounded-lg shadow-md ${c.bg}">
      <h3 class="text-sm font-medium ${c.text}">${c.title}</h3>
      <p class="mt-1 text-3xl font-semibold ${c.text}">${c.value}</p>
    </div>
  `).join('');
}

// --- Table View ---
function renderTable(bills) {
  if (!bills.length)
    return `<div class="bg-white p-6 rounded-lg shadow text-gray-500 text-center">No recurring bills found.</div>`;

  const rows = bills.map(b => {
    const isPaid = b.lastPaidYear === currentYear && b.lastPaidMonth === currentMonth;

    return `
      <tr class="hover:bg-gray-50 transition-all">
        <td class="p-3 border-b font-medium">${b.name}</td>
        <td class="p-3 border-b">${formatCurrency(b.amount, b.currency)}</td>
        <td class="p-3 border-b">${b.currency}</td>
        <td class="p-3 border-b">${b.dueDay}</td>
        <td class="p-3 border-b">${b.method}</td>
        <td class="p-3 border-b text-right space-x-2">
          ${
            isPaid
              ? `<button class="unmark-paid-btn bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-md text-sm font-medium transition" data-id="${b.id}">❌ Mark Unpaid</button>`
              : `<button class="mark-paid-btn bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition" data-id="${b.id}">💰 Mark Paid</button>`
          }
          ${ui.createActionButton('edit', b.id)}
          ${ui.createActionButton('delete', b.id)}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <h3 class="p-4 border-b text-lg font-semibold">Recurring Bills</h3>
      <table class="min-w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="p-3 text-left text-xs uppercase text-gray-500">Name</th>
            <th class="p-3 text-left text-xs uppercase text-gray-500">Amount</th>
            <th class="p-3 text-left text-xs uppercase text-gray-500">Currency</th>
            <th class="p-3 text-left text-xs uppercase text-gray-500">Due</th>
            <th class="p-3 text-left text-xs uppercase text-gray-500">Method</th>
            <th class="p-3 text-right text-xs uppercase text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// --- Form ---
function renderForm() {
  return `
    <div class="bg-white p-6 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-4">Add / Edit Bill</h3>
      <div class="space-y-3">
        <input id="billName" class="w-full border p-2 rounded" placeholder="Name" />
        <input id="billAmount" class="w-full border p-2 rounded" placeholder="Amount" type="number" />
        <input id="billCurrency" class="w-full border p-2 rounded" placeholder="Currency (KGS/USD)" />
        <input id="billDueDay" class="w-full border p-2 rounded" type="number" min="1" max="31" placeholder="Due Day" />
        <input id="billMethod" class="w-full border p-2 rounded" placeholder="Payment Method" />
        <input id="billPayee" class="w-full border p-2 rounded" placeholder="Payee" />
        <input id="billContact" class="w-full border p-2 rounded" placeholder="Contact Info" />
        <textarea id="billNotes" class="w-full border p-2 rounded" placeholder="Notes"></textarea>
        <button id="saveBillBtn" class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition">💾 Save Bill</button>
      </div>
    </div>
  `;
}

// --- Event Handling ---
function attachEventListeners() {
  document.getElementById('saveBillBtn')?.addEventListener('click', handleSaveBill);
  document.querySelector('#bills-content table')?.addEventListener('click', handleTableClick);
}

async function handleSaveBill() {
  const bill = {
    name: document.getElementById('billName').value.trim(),
    amount: document.getElementById('billAmount').value,
    currency: document.getElementById('billCurrency').value.trim().toUpperCase() || 'KGS',
    dueDay: document.getElementById('billDueDay').value,
    method: document.getElementById('billMethod').value,
    payee: document.getElementById('billPayee').value,
    contact: document.getElementById('billContact').value,
    notes: document.getElementById('billNotes').value,
  };

  if (!bill.name || !bill.amount || !bill.dueDay) {
    alert('Please fill in Name, Amount, and Due Day.');
    return;
  }

  try {
    showLoader();
    await api.addRecurringBill(bill);
    alert('✅ Bill saved successfully!');
    await render();
  } catch (err) {
    console.error('Error saving bill:', err);
    alert('❌ Failed to save bill.');
  } finally {
    hideLoader();
  }
}

async function handleTableClick(e) {
  const markBtn = e.target.closest('.mark-paid-btn');
  const unmarkBtn = e.target.closest('.unmark-paid-btn');
  const editBtn = e.target.closest('.action-btn-edit');
  const deleteBtn = e.target.closest('.action-btn-delete');

  // 💰 Mark Paid
  if (markBtn) {
    const id = markBtn.dataset.id;
    try {
      await api.markBillPaid(id, state.timeRange);
      ui.showToast('✅ Bill marked as paid');
      await render();
    } catch (err) {
      alert('Failed to mark paid.');
      console.error(err);
    }
  }

  // ❌ Mark Unpaid
  if (unmarkBtn) {
    const id = unmarkBtn.dataset.id;
    try {
      await api.markBillUnpaid(id);
      ui.showToast('🔁 Bill marked as unpaid');
      await render();
    } catch (err) {
      alert('Failed to mark unpaid.');
      console.error(err);
    }
  }

  // ✏️ Edit Bill
  if (editBtn) {
    const id = editBtn.dataset.id;
    const bill = state.bills.find(b => b.id === id);
    if (bill) populateForm(bill);
  }

  // 🗑️ Delete Bill
  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    const bill = state.bills.find(b => b.id === id);
    if (!bill) return;

    const confirmed = confirm(`🗑️ Delete bill "${bill.name}" (${formatCurrency(bill.amount, bill.currency)})?`);
    if (confirmed) {
      const row = deleteBtn.closest('tr');
      row.classList.add('fade-out');
      setTimeout(async () => {
        showLoader();
        try {
          await api.deleteBill(id);
          alert('✅ Bill deleted successfully!');
          await render();
        } catch (err) {
          console.error('Failed to delete bill:', err);
          alert('❌ Failed to delete bill.');
        } finally {
          hideLoader();
        }
      }, 300);
    }
  }
}

function populateForm(bill) {
  document.getElementById('billName').value = bill.name;
  document.getElementById('billAmount').value = bill.amount;
  document.getElementById('billCurrency').value = bill.currency;
  document.getElementById('billDueDay').value = bill.dueDay;
  document.getElementById('billMethod').value = bill.method;
  document.getElementById('billPayee').value = bill.payee;
  document.getElementById('billContact').value = bill.contact;
  document.getElementById('billNotes').value = bill.notes;
}

// --- Utilities ---
function formatCurrency(amount, currency = 'KGS') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);
}

function showLoader() {
  document.getElementById('loading-text').textContent = 'Loading bills...';
  document.getElementById('global-loading-overlay').classList.remove('hidden');
}

function hideLoader() {
  document.getElementById('global-loading-overlay').classList.add('hidden');
}
