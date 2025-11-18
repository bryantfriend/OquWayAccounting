// js/modules/categories.js
import * as api from '../api.js';
import * as ui from '../ui.js';
import { createHeaderBar, attachHeaderEvents } from '../components/headerBar.js';

let currentLocation = localStorage.getItem('activeLocationId') || 'default';
let categories = [];

export async function init() {
  render();
}

async function render() {
  const container = document.getElementById('categories-content');
    if (!container) {
      console.error('❌ #categories-content not found in DOM');
      return;
    }
  ui.showGlobalLoader('Loading categories...');
  try {
    categories = await api.getExpenseCategories(currentLocation);

    const headerHtml = createHeaderBar({
      currentMonth: new Date().getMonth(),
      currentYear: new Date().getFullYear(),
      timeRange: 'monthly',
      showReload: true,
    });

    const listHtml = `
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Expense Categories</h2>
        <div id="categories-list" class="space-y-2">
          ${categories.length
            ? categories.map(c => `
              <div class="flex items-center justify-between border rounded p-3 hover:bg-gray-50 transition">
                <div class="flex items-center space-x-3">
                  <span class="w-4 h-4 rounded-full" style="background:${c.color}"></span>
                  <span>${c.name}</span>
                </div>
                <div class="space-x-2">
                  <button class="edit-category-btn bg-blue-100 text-blue-700 px-3 py-1 rounded" data-id="${c.id}">Edit</button>
                  <button class="delete-category-btn bg-red-100 text-red-700 px-3 py-1 rounded" data-id="${c.id}">Delete</button>
                </div>
              </div>
            `).join('')
            : `<p class="text-gray-500">No categories yet.</p>`}
        </div>
        <div class="mt-6">
          <h3 class="font-semibold mb-2">Add New Category</h3>
          <input id="newCategoryName" class="border p-2 rounded w-full mb-2" placeholder="Category name" />
          <input id="newCategoryColor" class="border p-2 rounded w-full mb-2" type="color" value="#4F46E5" />
          <button id="addCategoryBtn" class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition">Add Category</button>
        </div>
      </div>
    `;

    container.innerHTML = headerHtml + listHtml;

    // Attach button listeners
    document.getElementById('addCategoryBtn').addEventListener('click', handleAddCategory);
    document.querySelectorAll('.edit-category-btn').forEach(btn =>
      btn.addEventListener('click', handleEditCategory)
    );
    document.querySelectorAll('.delete-category-btn').forEach(btn =>
      btn.addEventListener('click', handleDeleteCategory)
    );

  } catch (err) {
    console.error('Error loading categories:', err);
    document.getElementById('categories-content').innerHTML = `<p class="text-red-500">Failed to load categories.</p>`;
  } finally {
    ui.hideGlobalLoader();
  }
}

async function handleAddCategory() {
  const name = document.getElementById('newCategoryName').value.trim();
  const color = document.getElementById('newCategoryColor').value;
  if (!name) return alert('Please enter a name.');
  await api.addExpenseCategory(currentLocation, { name, color });
  await render();
}

async function handleEditCategory(e) {
  const id = e.target.dataset.id;
  const cat = categories.find(c => c.id === id);
  if (!cat) return;

  const newName = prompt('Edit category name:', cat.name);
  if (newName === null) return; // canceled
  const newColor = prompt('Edit color (hex):', cat.color);
  await api.updateExpenseCategory(currentLocation, id, { name: newName, color: newColor });
  await render();
}

async function handleDeleteCategory(e) {
  const id = e.target.dataset.id;
  const cat = categories.find(c => c.id === id);
  if (!cat) return;
  const confirmDelete = confirm(`Delete category "${cat.name}"?`);
  if (!confirmDelete) return;
  await api.deleteExpenseCategory(currentLocation, id);
  await render();
}
