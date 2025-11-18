// js/modules/studentImporter.js
import * as api from '../api.js';
import * as ui from '../ui.js';
import { Timestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

/**
 * Renders the Import Modal.
 * @param {Array<object>} classes - The list of all classes.
 * @param {function} onSuccess - The callback function to run on successful import (e.g., render())
 */
export function showImportModal(classes, onSuccess) {
  const modalContainer = document.getElementById('modal-container');
  
  const classInputs = classes.map(c => `
    <div class="grid grid-cols-2 gap-4 items-center">
      <label class="text-sm font-medium text-gray-700 text-right">${c.displayName || c.name} (from database)</label>
      <input type="text" data-id="${c.id}" class="class-map-input border p-2 rounded" placeholder="Spreadsheet Name (e.g., 7 MWF)">
    </div>
  `).join('');

  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-2xl w-full max-w-2xl">
        <div class="p-5 border-b flex justify-between items-center">
          <h3 class="text-lg font-semibold">🚀 Bulk Student Import</h3>
          <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        
        <div class="p-6 max-h-[70vh] overflow-y-auto space-y-4">
          <div>
            <label class="block text-base font-medium">1. Map Class Names</label>
            <p class="text-sm text-gray-500 mb-4">Enter the *exact* name from your spreadsheet that matches each class. (e.g., "7 MWF", "Adult Eng"). This is case-insensitive.</p>
            <div class="space-y-2 p-4 bg-gray-50 rounded">${classInputs}</div>
          </div>
          <div>
            <label class="block text-base font-medium">2. Paste Spreadsheet Data</label>
            <p class="text-sm text-gray-500 mb-2">Copy all your student data from Excel (including the header row) and paste it here.</p>
            <textarea id="importData" class="w-full h-48 border rounded p-2 font-mono text-sm" placeholder="Name | Phone Number / Email | English Level | ..."></textarea>
          </div>
        </div>

        <div class="bg-gray-50 px-6 py-3 flex justify-end space-x-3 border-t">
          <button id="cancel-import-btn" class="btn-secondary">Cancel</button>
          <button id="run-import-btn" class="btn-primary">Run Import</button>
        </div>
      </div>
    </div>
  `;
  
  const close = () => modalContainer.innerHTML = '';
  modalContainer.querySelector('#close-modal-btn').addEventListener('click', close);
  modalContainer.querySelector('#cancel-import-btn').addEventListener('click', close);
  modalContainer.querySelector('#run-import-btn').addEventListener('click', () => {
    // Pass the onSuccess callback to the processing function
    processImportData(onSuccess);
  });
}

/**
 * Processes the data from the import modal.
 */
async function processImportData(onSuccess) {
  // 1. Build the Class Map
  const classMap = new Map();
  document.querySelectorAll('.class-map-input').forEach(input => {
    const name = input.value.trim().toLowerCase();
    const id = input.dataset.id;
    if (name) {
      classMap.set(name, id);
    }
  });

  if (classMap.size === 0) {
    ui.showToast("Please map at least one class name.", 'error');
    return;
  }

  // 2. Get and Parse Data
  const rawData = document.getElementById('importData').value.trim();
  const lines = rawData.split('\n');
  
  if (lines.length <= 1) {
    ui.showToast("No data found to import.", 'error');
    return;
  }
  
  const header = lines[0].split('|').map(h => h.trim().toLowerCase());
  const dataLines = lines.slice(1);
  const studentsToImport = [];
  
  for (const line of dataLines) {
    const row = line.split('|').map(s => s.trim());
    const student = mapRowToStudent(row, classMap);
    if (student) {
      studentsToImport.push(student);
    }
  }
  
  if (studentsToImport.length === 0) {
    ui.showToast("No valid student rows found.", 'error');
    return;
  }

  if (confirm(`Found ${studentsToImport.length} valid students. Import now?`)) {
    ui.showGlobalLoader('Importing students...');
    try {
      await api.batchSaveStudentsAndAssign(studentsToImport);
      ui.showToast(`Successfully imported ${studentsToImport.length} students!`, 'success');
      document.getElementById('modal-container').innerHTML = '';
      onSuccess(); // Call the refresh function
    } catch (e) {
      console.error(e);
      ui.showToast('Import failed. See console for details.', 'error');
    } finally {
      ui.hideGlobalLoader();
    }
  }
}

/**
 * Maps a single CSV row to a student object.
 */
function mapRowToStudent(row, classMap) {
  if (row.length < 13 || !row[0]) return null; 

  try {
    const name = row[0];
    const phone = row[1] || null;
    const level = row[2] || null;
    const datePaidStr = row[3];
    const isPaid = row[4].toLowerCase() === 'yes';
    const payFreq = row[9].toLowerCase();
    const amountStr = row[10];
    const className = row[11].toLowerCase();
    const notes = row[12] || null;
    
    const classId = classMap.get(className);
    const amount = parseInt(amountStr.replace(/[^0-9]/g, '')) || 0;
    
    let paymentModel = 'session';
    if (payFreq.includes('month')) paymentModel = 'monthly';
    
    let tuitionTotal = 0;
    let tuitionPaid = 0;
    let tuitionOwed = 0;
    let lastPaymentDate = null;
    let paymentExpiresOn = null;

    if (paymentModel === 'monthly') {
      tuitionTotal = amount;
    }

    if (isPaid && datePaidStr) {
      tuitionPaid = amount;
      
      const [day, month, year] = datePaidStr.split('.');
      if (day && month && year) {
        lastPaymentDate = new Date(`20${year}-${month}-${day}`);
        if (paymentModel === 'monthly') {
          paymentExpiresOn = new Date(lastPaymentDate);
          paymentExpiresOn.setDate(paymentExpiresOn.getDate() + 30);
        }
      }
    }
    
    if (paymentModel === 'monthly' && !isPaid) {
      tuitionOwed = tuitionTotal;
    }
    
    if (notes?.includes('pay 4500 left')) {
      tuitionOwed = 4500;
      tuitionTotal = 5000;
      tuitionPaid = 500;
    }

    return {
      name,
      phone,
      englishLevel: level,
      classId: classId || null,
      paymentModel,
      tuitionTotal,
      tuitionPaid,
      tuitionOwed,
      lastPaymentDate: lastPaymentDate ? Timestamp.fromDate(lastPaymentDate) : null,
      paymentExpiresOn: paymentExpiresOn ? Timestamp.fromDate(paymentExpiresOn) : null,
      notes,
    };
  } catch (error) {
    console.error("Error parsing row:", row, error);
    return null;
  }
}