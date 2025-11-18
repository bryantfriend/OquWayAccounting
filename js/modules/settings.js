// /accounting/js/modules/settings.js
import { db } from "../../firebase-init.js";
import * as api from '../api.js'; // Import API for categories
import * as ui from '../ui.js';   // Import UI for toasts

import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// --- Module State ---
let currentLocation = localStorage.getItem('activeLocationId') || 'default';
let categories = []; // To cache categories for editing

export async function renderSettings() {
  const container = document.getElementById("tab-settings");
  container.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-6 p-4">

      <section class="bg-white shadow-md rounded p-5">
        <h2 class="text-xl font-semibold mb-4">🏦 Optima Bank Fees</h2>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <label class="block">
            <span>QR Base Fee (%)</span>
            <input id="qrBase" type="number" step="0.01" class="border rounded w-full p-2 mt-1">
          </label>
          <label class="block">
            <span>Optima QR Fee (%)</span>
            <input id="qrOptima" type="number" step="0.01" class="border rounded w-full p-2 mt-1">
          </label>
          <label class="block">
            <span>POS Elkart (%)</span>
            <input id="posElkart" type="number" step="0.01" class="border rounded w-full p-2 mt-1">
          </label>
          <label class="block">
            <span>POS Visa (%)</span>
            <input id="posVisa" type="number" step="0.01" class="border rounded w-full p-2 mt-1">
          </label>
          <label class="block">
            <span>POS MasterCard (%)</span>
            <input id="posMastercard" type="number" step="0.01" class="border rounded w-full p-2 mt-1">
          </label>
          <label class="block">
            <span>POS UnionPay (%)</span>
            <input id="posUnionPay" type="number" step="0.01" class="border rounded w-full p-2 mt-1">
          </label>
        </div>
        <button id="saveFees" class="mt-4 btn-primary">💾 Save Fees</button>
        <span id="feeMsg" class="ml-3 text-gray-500"></span>
      </section>

      <section class="bg-white shadow-md rounded p-5">
        <h2 class="text-xl font-semibold mb-4">💰 Tax Configuration</h2>
        <label class="block text-sm mb-2">
          <span>Company Tax Rate (%)</span>
          <input id="taxRate" type="number" step="0.01" class="border rounded w-full p-2 mt-1">
        </label>
        <button id="saveTax" class="mt-2 btn-primary">💾 Save Tax</button>
        <span id="taxMsg" class="ml-3 text-gray-500"></span>
      </section>

      <section class="bg-white shadow-md rounded p-5">
        <h2 class="text-xl font-semibold mb-4">🧾 Teacher Fee Settings</h2>
        <label class="block text-sm mb-2">
          <span>50/50 Split – Center Share (%)</span>
          <input id="centerSplit" type="number" class="border rounded w-full p-2 mt-1" value="50">
        </label>
        <label class="block text-sm mb-2">
          <span>Default Social Fund Deduction (SOM)</span>
          <input id="socialFund" type="number" class="border rounded w-full p-2 mt-1" value="5000">
        </label>
        <button id="saveTeacherFees" class="mt-2 btn-primary">💾 Save Settings</button>
        <span id="teacherFeeMsg" class="ml-3 text-gray-500"></span>
      </section>
      
      <section class="bg-white shadow-md rounded p-5">
        <h2 class="text-xl font-semibold mb-4">🗂 Expense Categories</h2>
        <div id="categories-list" class="space-y-2">
          </div>
        <div class="mt-6 border-t pt-4">
          <h3 class="font-semibold mb-2">Add New Category</h3>
          <div class="flex flex-col sm:flex-row gap-2">
            <input id="newCategoryName" class="border p-2 rounded w-full sm:w-1/2" placeholder="Category name" />
            <input id="newCategoryColor" class="border p-2 rounded w-full sm:w-1/4" type="color" value="#4F46E5" />
            <button id="addCategoryBtn" class="btn-primary w-full sm:w-1/4">Add Category</button>
          </div>
        </div>
      </section>

    </div>
  `;

  await loadSettings();
  attachSaveHandlers();
}

/**
 * Loads all settings, including categories
 */
async function loadSettings() {
  ui.showGlobalLoader('Loading settings...');
  try {
    const feeRef = doc(db, "fees", "optima");
    const taxRef = doc(db, "config", "tax");
    const teacherFeeRef = doc(db, "config", "teacherFees");

    // Fetch all configs in parallel
    const [feeSnap, taxSnap, teacherSnap, categoriesData] = await Promise.all([
      getDoc(feeRef),
      getDoc(taxRef),
      getDoc(teacherFeeRef),
      api.getExpenseCategories(currentLocation) // Fetch categories
    ]);

    // Cache categories for editing
    categories = categoriesData;

    // --- Populate Bank & Tax ---
    const feeData = feeSnap.exists() ? feeSnap.data() : { qrBase: 0, qrOptima: 0, pos: {} };
    const taxData = taxSnap.exists() ? taxSnap.data() : { companyTaxRate: 0 };
    const teacherFees = teacherSnap.exists() ? teacherSnap.data() : { centerSplit: 0.5, socialFund: 5000 };

    document.getElementById("qrBase").value = (feeData.qrBase * 100).toFixed(2);
    document.getElementById("qrOptima").value = (feeData.qrOptima * 100).toFixed(2);
    document.getElementById("posElkart").value = (feeData.pos?.Elkart?.own || 0.01) * 100;
    document.getElementById("posVisa").value = (feeData.pos?.Visa?.own || 0.016) * 100;
    document.getElementById("posMastercard").value = (feeData.pos?.Mastercard?.own || 0.017) * 100;
    document.getElementById("posUnionPay").value = (feeData.pos?.UnionPay?.own || 0.018) * 100;
    document.getElementById("taxRate").value = (taxData.companyTaxRate * 100).toFixed(2);
    document.getElementById("centerSplit").value = (teacherFees.centerSplit * 100).toFixed(0);
    document.getElementById("socialFund").value = teacherFees.socialFund;

    // --- Populate Categories ---
    const catContainer = document.getElementById("categories-list");
    if (categories.length > 0) {
      catContainer.innerHTML = categories.map(c => `
        <div class="flex items-center justify-between border rounded p-3 hover:bg-gray-50 transition">
          <div class="flex items-center space-x-3">
            <span class="w-4 h-4 rounded-full" style="background:${c.color}"></span>
            <span>${c.name}</span>
          </div>
          <div class="space-x-2">
            <button class="edit-category-btn btn-secondary py-1 px-2 text-sm" data-id="${c.id}">Edit</button>
            <button class="delete-category-btn bg-red-100 text-red-700 px-3 py-1 rounded text-sm" data-id="${c.id}">Delete</button>
          </div>
        </div>
      `).join('');
    } else {
      catContainer.innerHTML = `<p class="text-gray-500">No expense categories yet.</p>`;
    }
    
  } catch (error) {
    console.error("Error loading settings:", error);
    document.getElementById("tab-settings").innerHTML = `<p class="text-red-500 p-6">Error loading settings.</p>`;
  } finally {
    ui.hideGlobalLoader();
  }
}

/**
 * Attaches all save handlers for the page
 */
function attachSaveHandlers() {
  const container = document.getElementById('tab-settings');

  // --- Bank Fees ---
  container.querySelector("#saveFees").onclick = async () => {
    const msgEl = document.getElementById("feeMsg");
    try {
      const qrBase = Number(document.getElementById("qrBase").value) / 100;
      const qrOptima = Number(document.getElementById("qrOptima").value) / 100;
      const pos = {
        Elkart: { own: Number(document.getElementById("posElkart").value) / 100 },
        Visa: { own: Number(document.getElementById("posVisa").value) / 100 },
        Mastercard: { own: Number(document.getElementById("posMastercard").value) / 100 },
        UnionPay: { own: Number(document.getElementById("posUnionPay").value) / 100 },
      };
      await setDoc(doc(db, "fees", "optima"), { qrBase, qrOptima, pos, updatedAt: new Date().toISOString() }, { merge: true });
      msgEl.textContent = "✅ Fees saved!";
    } catch (error) {
      console.error("Error saving fees:", error);
      msgEl.textContent = "❌ Save failed. Check console.";
    }
    setTimeout(() => (msgEl.textContent = ""), 3000);
  };

  // --- Tax Rate ---
  container.querySelector("#saveTax").onclick = async () => {
    const msgEl = document.getElementById("taxMsg");
    try {
      const companyTaxRate = Number(document.getElementById("taxRate").value) / 100;
      await setDoc(doc(db, "config", "tax"), { companyTaxRate, updatedAt: new Date().toISOString() }, { merge: true });
      msgEl.textContent = "✅ Tax rate saved!";
    } catch (error) {
      console.error("Error saving tax:", error);
      msgEl.textContent = "❌ Save failed. Check console.";
    }
    setTimeout(() => (msgEl.textContent = ""), 3000);
  };

  // --- Teacher Fees ---
  container.querySelector("#saveTeacherFees").onclick = async () => {
    const msgEl = document.getElementById("teacherFeeMsg");
    try {
      const centerSplit = Number(document.getElementById("centerSplit").value) / 100;
      const socialFund = Number(document.getElementById("socialFund").value);
      await setDoc(doc(db, "config", "teacherFees"), { centerSplit, socialFund, updatedAt: new Date().toISOString() }, { merge: true });
      msgEl.textContent = "✅ Teacher fees saved!";
    } catch (error) {
      console.error("Error saving teacher fees:", error);
      msgEl.textContent = "❌ Save failed. Check console.";
    }
    setTimeout(() => (msgEl.textContent = ""), 3000);
  };

  // --- Category Add Button ---
  container.querySelector("#addCategoryBtn").onclick = async () => {
    const nameInput = document.getElementById('newCategoryName');
    const colorInput = document.getElementById('newCategoryColor');
    const name = nameInput.value.trim();
    const color = colorInput.value;
    
    if (!name) {
      ui.showToast('Please enter a category name.', 'error');
      return;
    }
    
    try {
      await api.addExpenseCategory(currentLocation, { name, color });
      ui.showToast('Category added!', 'success');
      await renderSettings(); // Full refresh to show new list
    } catch (error) {
      console.error("Error adding category:", error);
      ui.showToast('Failed to add category.', 'error');
    }
  };

  // --- Category Edit/Delete Buttons (Event Delegation) ---
  container.querySelector("#categories-list").onclick = async (e) => {
    const editBtn = e.target.closest('.edit-category-btn');
    const deleteBtn = e.target.closest('.delete-category-btn');

    if (editBtn) {
      const id = editBtn.dataset.id;
      const cat = categories.find(c => c.id === id);
      if (!cat) return;

      const newName = prompt('Edit category name:', cat.name);
      if (newName === null || newName.trim() === '') return; // Canceled or empty
      
      const newColor = prompt('Edit color (hex):', cat.color);
      if (newColor === null) return; // Canceled
      
      try {
        await api.updateExpenseCategory(currentLocation, id, { name: newName.trim(), color: newColor });
        ui.showToast('Category updated!', 'success');
        await renderSettings();
      } catch (error) {
        console.error("Error updating category:", error);
        ui.showToast('Update failed.', 'error');
      }
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const cat = categories.find(c => c.id === id);
      if (!cat) return;

      if (confirm(`Are you sure you want to delete the category "${cat.name}"?`)) {
        try {
          await api.deleteExpenseCategory(currentLocation, id);
          ui.showToast('Category deleted.', 'success');
          await renderSettings();
        } catch (error) {
          console.error("Error deleting category:", error);
          ui.showToast('Delete failed.', 'error');
        }
      }
    }
  };
}