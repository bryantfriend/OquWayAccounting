// js/modules/archived.js
import * as api from '../api.js';
import * as ui from '../ui.js';

let state = {
  students: []
};

const container = document.getElementById('tab-archived');

export async function init() {
  await render();
}

async function render() {
  if (!container) return;
  ui.showGlobalLoader('Loading archived students...');
  try {
    state.students = await api.getUsersByRole('student', true);
    const archivedStudents = state.students.filter(s => s.active === false);
    
    const tableHtml = createArchivedTable(archivedStudents);
    container.innerHTML = tableHtml;
    attachEventListeners();
    
  } catch (error) {
    console.error("Error rendering archived tab:", error);
    container.innerHTML = `<p class="text-red-500 p-6">Error loading archived students.</p>`;
  } finally {
    ui.hideGlobalLoader();
  }
}

function createArchivedTable(students) {
  const rows = students.map(s => `
    <tr class="hover:bg-gray-50">
      <td class="p-4 border-b font-medium">${s.name}</td>
      <td class="p-4 border-b">${s.phone || 'N/A'}</td>
      <td class="p-4 border-b">${s.archivedAt ? s.archivedAt.toDate().toLocaleDateString() : 'Unknown'}</td>
      <td class="p-4 border-b text-right">
        <button class="restore-student-btn btn-secondary" data-id="${s.id}">🔁 Restore</button>
      </td>
    </tr>
  `).join('');

  return `
    <div class="bg-white rounded-lg shadow-md overflow-hidden">
      <h3 class="text-lg font-semibold p-4 border-b">Archived Students</h3>
      <table class="min-w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="p-4 text-left">Student Name</th>
            <th class="p-4 text-left">Phone</th>
            <th class="p-4 text-left">Archived Date</th>
            <th class="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>${rows.length ? rows : '<tr><td colspan="4" class="p-6 text-center text-gray-500">No archived students found.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function attachEventListeners() {
  container.querySelector('table tbody')?.addEventListener('click', e => {
    const restoreBtn = e.target.closest('.restore-student-btn');
    if (restoreBtn) handleRestore(restoreBtn.dataset.id);
  });
}

async function handleRestore(studentId) {
  const student = state.students.find(s => s.id === studentId);
  if (confirm(`Are you sure you want to restore ${student.name} to the active list?`)) {
    ui.showGlobalLoader('Restoring...');
    try {
      await api.restoreUser(studentId);
      ui.showToast('Student restored!', 'success');
      await render(); // Refresh this tab
    } catch (error) {
      console.error(error);
      ui.showToast('Failed to restore.', 'error');
    } finally {
      ui.hideGlobalLoader();
    }
  }
}
