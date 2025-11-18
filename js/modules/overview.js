// js/modules/overview.js
import * as api from '../api.js';
import * as ui from '../ui.js';
import { renderBarChart } from '../charts.js';
import { createHeaderBar, attachHeaderEvents } from '../components/headerBar.js';
import { formatCurrency } from '../utils.js';

let state = {
  stats: {},
  revenueChart: null,
  expensePieChart: null,
  timeRange: 'monthly',
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
};

export async function init() {
  await render();
}

/**
 * Main render function for the Overview tab
 */
async function render() {
  const container = document.getElementById('overview-content');
  if (!container) return;
  ui.showGlobalLoader('Loading overview...');

  try {
    const month = state.timeRange === 'yearly' ? null : state.currentMonth;
    const { start, end } = api.getDateRange(state.timeRange, state.currentYear, month);
    const now = new Date();
    
    const [
      stats, 
      paymentsInRange, 
      oneTimeExpenses, // This is the variable we pass
      recurringBills, 
      allStudents, 
      allTeachers, 
      recentPayments
    ] = await Promise.all([
      api.getSummaryStats(),
      api.getPaymentsByDate(start, end),
      api.getExpensesByDate(start, end),
      api.getRecurringBills(),
      api.getUsersByRole('student'),
      api.getUsersByRole('teacher'),
      api.getPaymentsByDate(new Date(new Date().setDate(now.getDate() - 7)), new Date())
    ]);

    // ... (rest of the stats calculation is correct)
    const expensesInPeriod = calculateTotalExpenses(oneTimeExpenses, recurringBills, state.timeRange);
    const revenueInPeriod = paymentsInRange.reduce((sum, p) => sum + (p.amountNet || 0), 0);
    const netInPeriod = revenueInPeriod - expensesInPeriod;
    const { activeStudents, outstandingTuition, totalPayrollDue } = stats;

    const headerHtml = createHeaderBar({
      currentMonth: state.currentMonth,
      currentYear: state.currentYear,
      timeRange: state.timeRange,
      showReload: true,
    });

    const summaryCardsHtml = `
      <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        ${ui.createStatCard('Revenue (Period)', revenueInPeriod, '💰')}
        ${ui.createStatCard('Expenses (Period)', expensesInPeriod, '💸')}
        ${ui.createStatCard('Net (Period)', netInPeriod, '📈', netInPeriod >= 0 ? 'Profit' : 'Loss')}
        ${ui.createStatCard('Teacher Payouts', totalPayrollDue, '🧾')}
        ${ui.createStatCard('Active Students', activeStudents, '🎓')}
        ${ui.createStatCard('Pending Payments', outstandingTuition, '⚠️')}
      </div>
    `;
    const warningsHtml = renderWarnings(allStudents, allTeachers);
    const chartsHtml = `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div class="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <h3 class="text-lg font-semibold mb-4">Revenue vs. Expenses (${state.timeRange})</h3>
          <div class="h-72">
            <canvas id="overviewBarChart"></canvas>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow-md p-6">
          <h3 class="text-lg font-semibold mb-4">Expense Breakdown (${state.timeRange})</h3>
          <div class="h-72">
            <canvas id="overviewPieChart"></canvas>
          </div>
        </div>
      </div>
    `;
    const activityFeedHtml = renderActivityFeed(recentPayments);

    container.innerHTML = headerHtml + summaryCardsHtml + warningsHtml + chartsHtml + activityFeedHtml;
    
    attachHeaderEvents('#overview-content', state, {
      onMonthChange: (m, y) => { state.currentMonth = m; state.currentYear = y; render(); },
      onRangeChange: (r) => { state.timeRange = r; render(); },
      onReload: async () => { await render(); ui.showToast('✅ Refreshed!'); },
    });
    
    attachWarningListeners();
    
    // We pass 'oneTimeExpenses' here
    renderRevenueExpenseChart(paymentsInRange, oneTimeExpenses, recurringBills);
    renderExpensePieChart(oneTimeExpenses, recurringBills);

  } catch (error) {
    console.error("Error rendering overview:", error);
    container.innerHTML = `<p class="p-6 text-red-500">Error loading dashboard. ${error.message}</p>`;
  } finally {
    ui.hideGlobalLoader();
  }
}

// --- Chart Rendering ---

/**
 * [FIXED] Renders the "Revenue vs. Expenses" bar chart.
 */
function renderRevenueExpenseChart(payments, oneTimeExpenses, recurringBills) { // <-- ✨ FIX #1: Variable name corrected
  const canvas = document.getElementById('overviewBarChart');
  if (!canvas) return;

  let labels = [];
  let revenueData = [];
  let expenseData = [];
  let recurringData = [];

  if (state.timeRange === 'yearly') {
    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    revenueData = Array(12).fill(0);
    expenseData = Array(12).fill(0);
    recurringData = Array(12).fill(0);

    payments.forEach(p => revenueData[p.date.getMonth()] += (p.amountNet || 0)); // Added || 0
    oneTimeExpenses.forEach(e => expenseData[e.date.getMonth()] += e.amount); // <-- ✨ FIX #2: Use correct variable
    
    recurringBills.forEach(bill => {
      const billStart = bill.startDate ? bill.startDate.toDate() : new Date(0); 
      for (let i = 0; i < 12; i++) {
        const endOfMonth = new Date(state.currentYear, i + 1, 0);
        if (billStart <= endOfMonth) {
           recurringData[i] += bill.amount;
        }
      }
    });

  } else if (state.timeRange === 'monthly') {
    const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
    labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    revenueData = Array(daysInMonth).fill(0);
    expenseData = Array(daysInMonth).fill(0);
    recurringData = Array(daysInMonth).fill(0);

    payments.forEach(p => revenueData[p.date.getDate() - 1] += (p.amountNet || 0));
    oneTimeExpenses.forEach(e => expenseData[e.date.getDate() - 1] += e.amount); // <-- ✨ FIX #3: Use correct variable
    
    const endOfCurrentMonth = new Date(state.currentYear, state.currentMonth + 1, 0);
    
    recurringBills.forEach(b => {
      const billStart = b.startDate ? b.startDate.toDate() : new Date(0);
      
      if (billStart <= endOfCurrentMonth) {
        if (b.dueDay > 0 && b.dueDay <= daysInMonth) {
          recurringData[b.dueDay - 1] += b.amount;
        }
      }
    });

  } else { // weekly
    labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    revenueData = Array(7).fill(0);
    expenseData = Array(7).fill(0);
    recurringData = Array(7).fill(0);
    
    payments.forEach(p => revenueData[p.date.getDay()] += (p.amountNet || 0));
    oneTimeExpenses.forEach(e => expenseData[e.date.getDay()] += e.amount); // <-- ✨ FIX #4: Use correct variable
    
    const { start } = api.getDateRange(state.timeRange, state.currentYear, state.currentMonth);
    
    recurringBills.forEach(b => {
      const billStart = b.startDate ? b.startDate.toDate() : new Date(0);
      const dayOfWeek = new Date(state.currentYear, state.currentMonth, b.dueDay).getDay();
      const dueDate = new Date(state.currentYear, state.currentMonth, b.dueDay);
      
      if (dueDate >= start && dueDate < new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)) {
        if (billStart <= dueDate) {
          recurringData[dayOfWeek] += b.amount;
        }
      }
    });
  }

  const chartData = {
    datasets: [
      { label: 'Revenue', data: revenueData, backgroundColor: 'rgba(59, 130, 246, 0.8)' },
      { label: 'Expenses', data: expenseData, backgroundColor: 'rgba(239, 68, 68, 0.8)' },
      { label: 'Recurring', data: recurringData, backgroundColor: 'rgba(245, 158, 11, 0.8)' }
    ]
  };

  state.revenueChart = renderBarChart(
    canvas, 'Revenue vs. Expenses', labels, chartData, state.revenueChart, false
  );
}

function renderExpensePieChart(expenses, recurringBills) {
  // ... (This function is unchanged)
  const canvas = document.getElementById('overviewPieChart');
  if (!canvas) return;
  const categoryTotals = {};
  expenses.forEach(e => {
    const category = e.category || 'Uncategorized';
    categoryTotals[category] = (categoryTotals[category] || 0) + e.amount;
  });
  recurringBills.forEach(b => {
    const category = b.category || b.name || 'Recurring';
    categoryTotals[category] = (categoryTotals[category] || 0) + b.amount;
  });
  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);
  if (labels.length === 0) {
     canvas.parentElement.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">No expense data for this period.</div>';
     return;
  }
  const colors = labels.map((_, i) => `hsl(${(i * 360 / labels.length) % 360}, 70%, 60%)`);
  if (state.expensePieChart) {
    state.expensePieChart.destroy();
  }
  state.expensePieChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 10, boxWidth: 12 }
        }
      }
    }
  });
}

function renderWarnings(students, teachers) {
  // ... (This function is unchanged)
  const unpaidStudents = students.filter(s => s.tuitionOwed > 0);
  const unassignedTeachers = teachers.filter(t => t.active && (!t.days || t.days.length === 0));
  let warnings = [];
  if (unpaidStudents.length > 0) {
    warnings.push(`
      <div class="warning-item cursor-pointer" data-action="go-to-students-unpaid" title="Click to view students">
        <span>⚠️ ${unpaidStudents.length} student(s) have outstanding payments.</span>
      </div>
    `);
  }
  if (unassignedTeachers.length > 0) {
    warnings.push(`
      <div class="warning-item cursor-pointer" data-action="go-to-teachers" title="Click to view teachers">
        <span>👨‍🏫 ${unassignedTeachers.length} active teacher(s) have no availability set.</span>
      </div>
    `);
  }
  if (warnings.length === 0) return '';
  return `
    <div class="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg p-4 mb-6">
      <h3 class="font-semibold mb-2">Action Items</h3>
      <div class="space-y-1">
        ${warnings.join('')}
      </div>
    </div>
  `;
}

function renderActivityFeed(recentPayments) {
  // ... (This function is unchanged)
  const activities = recentPayments.map(p => ({
    type: 'payment',
    date: p.date,
    text: `<b>${p.payerName}</b> paid ${formatCurrency(p.amountNet)} (net).`
  }));
  const items = activities
    .sort((a, b) => b.date - a.date)
    .slice(0, 5)
    .map(act => {
      const icon = act.type === 'payment' ? '💵' : '📄';
      return `
        <li class="activity-item">
          <div class="activity-icon">${icon}</div>
          <div class="activity-content">
            <p class="text-gray-800">${act.text}</p>
            <span class="text-gray-500 text-sm">${act.date.toLocaleDateString()}</span>
          </div>
        </li>
      `;
    }).join('');
  return `
    <div class="bg-white rounded-lg shadow-md">
      <h3 class="text-lg font-semibold p-4 border-b">Recent Activity (Last 7 Days)</h3>
      <ul class="p-4">
        ${items.length ? items : '<p class="text-gray-500">No recent activity.</p>'}
      </ul>
    </div>
  `;
}

function attachWarningListeners() {
  // ... (This function is unchanged)
  const container = document.getElementById('overview-content');
  if (!container) return;
  container.addEventListener('click', e => {
    const target = e.target.closest('.warning-item');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'go-to-students-unpaid') {
      document.querySelector('.tab-btn[data-tab="students"]').click();
    }
    if (action === 'go-to-teachers') {
      document.querySelector('.tab-btn[data-tab="teachers"]').click();
    }
  });
}

function calculateTotalExpenses(oneTimeExpenses, recurringBills, timeRange) {
  // ... (This function is unchanged)
  const oneTimeTotal = oneTimeExpenses.reduce((sum, e) => sum + e.amount, 0);
  if (timeRange === 'yearly') {
    let recurringTotal = 0;
    recurringBills.forEach(bill => {
      const billStart = bill.startDate ? bill.startDate.toDate() : new Date(0);
      for (let i = 0; i < 12; i++) {
        const endOfMonth = new Date(state.currentYear, i + 1, 0);
        if (billStart <= endOfMonth) {
           recurringTotal += bill.amount;
        }
      }
    });
    return oneTimeTotal + recurringTotal;
  }
  const { end } = api.getDateRange(state.timeRange, state.currentYear, state.currentMonth);
  const recurringTotal = recurringBills.reduce((sum, b) => {
    const billStart = b.startDate ? b.startDate.toDate() : new Date(0);
    if (billStart <= end) {
      return sum + b.amount;
    }
    return sum;
  }, 0);
  return oneTimeTotal + recurringTotal;
}