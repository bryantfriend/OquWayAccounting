// js/modules/migration.js
import * as api from '../api.js';
import * as ui from '../ui.js';

let state = {
    unassignedStudents: [],
    unassignedTeachers: [],
    unassignedExpenses: [],
    unassignedBills: [],
    activeLocationId: null,
    locations: [],
};

const container = document.getElementById('tab-migration');

/**
 * Main entry point for the migration tab.
 * @param {string} userRole - The role passed from app.js.
 */
export async function init(userRole) { // <-- NOW ACCEPTS THE ROLE
    if (!container) return;
    
    // Admin Guard: Allow Super/Platform/School Admins only
    const isHighAdmin = userRole === 'superAdmin' || userRole === 'platformAdmin' || userRole === 'schoolAdmin' || userRole === 'admin';

    if (!isHighAdmin) {
        // This is the message you saw, but now it's correctly checking the role.
        container.innerHTML = '<p class="text-xl text-red-600 p-6">Access Denied: Migration tools are SuperAdmin/Platform Admin only.</p>';
        return;
    }
    
    // Set current context
    state.activeLocationId = api.getActiveLocationId();
    // Use the passed-in role for authorization check (if needed later)
    state.locations = await api.getAuthorizedLocations(userRole, state.activeLocationId);

    await render(); // Proceed to render the screen
}

async function render() {
    ui.showGlobalLoader('Loading unassigned data...');
    try {
        // --- FETCH ALL RELEVANT UNASSIGNED CANDIDATES ---
        const [students, teachers, classes, payments, expenses, bills] = await Promise.all([
            api.getUnassignedData('users', 'student'),
            api.getUnassignedData('users', 'teacher'),
            api.getUnassignedData('classes'),    // <-- NEW: Fetch Classes
            api.getUnassignedData('payments'),   // <-- NEW: Fetch Payments
            api.getUnassignedData('expenses'),
            api.getUnassignedData('recurring_bills'),
        ]);

        // --- FIX: Filter results CLIENT-SIDE for missing locationId ---
        const isUnassigned = (item) => !item.locationId;
        
        state.unassignedStudents = students.filter(isUnassigned);
        state.unassignedTeachers = teachers.filter(isUnassigned);
        state.unassignedClasses = classes.filter(isUnassigned);    // <-- NEW
        state.unassignedPayments = payments.filter(isUnassigned);  // <-- NEW
        state.unassignedExpenses = expenses.filter(isUnassigned);
        state.unassignedBills = bills.filter(isUnassigned);

        const totalUnassigned = state.unassignedStudents.length + state.unassignedTeachers.length + 
                                state.unassignedClasses.length + state.unassignedPayments.length + 
                                state.unassignedExpenses.length + state.unassignedBills.length;
        
        container.innerHTML = createDashboardHtml(totalUnassigned);
        attachEvents();

    } catch (error) {
        console.error('Error fetching unassigned data:', error);
        container.innerHTML = `<p class="text-red-500 p-6">Error loading data. Check console for database query errors.</p>`;
    } finally {
        ui.hideGlobalLoader();
    }
}

function createDashboardHtml(totalCount) {
    const totalHtml = totalCount > 0 
        ? `<span class="text-red-600 font-bold">${totalCount} items need attention.</span>` 
        : '<span class="text-green-600 font-bold">All core data is assigned.</span>';

    const locationOptions = state.locations.map(loc => 
        `<option value="${loc.id}">${loc.name}</option>`
    ).join('');

    return `
        <h2 class="text-2xl font-semibold mb-4">🌍 Data Migration & Audit</h2>
        <div class="p-4 mb-6 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 rounded-lg shadow-sm">
            Total Unassigned Items: ${totalHtml}
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-xl font-semibold border-b pb-2 mb-4">Action: Assign Location</h3>
            <div class="flex items-center gap-4 mb-6">
                <select id="location-select" class="border rounded p-2 text-sm w-48">${locationOptions}</select>
                <button id="assign-selected-btn" class="btn-primary" disabled>Assign Selected Items</button>
            </div>

            <div class="space-y-8">
                ${createCollectionHtml('Classes', 'classes', state.unassignedClasses)}    
                ${createCollectionHtml('Students', 'users', state.unassignedStudents, 'student')}
                ${createCollectionHtml('Teachers', 'users', state.unassignedTeachers, 'teacher')}
                ${createCollectionHtml('Payments', 'payments', state.unassignedPayments, 'payment')} 
                ${createCollectionHtml('Expenses', 'expenses', state.unassignedExpenses)}
                ${createCollectionHtml('Recurring Bills', 'recurring_bills', state.unassignedBills)}
            </div>
        </div>
    `;
}

function createCollectionHtml(title, collection, items, role = null) {
    const itemRows = items.map(item => `
        <tr class="hover:bg-gray-50">
            <td class="p-2 border-b"><input type="checkbox" class="migrate-checkbox" data-collection="${collection}" data-id="${item.id}"></td>
            <td class="p-2 border-b font-medium">${item.name || item.description || item.classCode || item.id}</td>
            <td class="p-2 border-b text-sm">${role ? `Role: ${role}` : '—'}</td>
        </tr>
    `).join('');

    return `
        <h4 class="text-lg font-medium text-gray-700">${title} (${items.length} Unassigned)</h4>
        <div class="max-h-60 overflow-y-auto border rounded-lg">
            <table class="min-w-full">
                <thead>
                    <tr class="bg-gray-100">
                        <th class="p-2 w-10"></th>
                        <th class="p-2 text-left">Item Name / Description</th>
                        <th class="p-2 text-left">Details</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemRows.length ? itemRows : `<tr><td colspan="3" class="p-4 text-gray-500 text-center">No unassigned ${title.toLowerCase()} found.</td></tr>`}
                </tbody>
            </table>
        </div>
    `;
}

function attachEvents() {
    const assignBtn = container.querySelector('#assign-selected-btn');
    const checkboxes = container.querySelectorAll('.migrate-checkbox');

    // Enable/Disable Assign button
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const checkedCount = container.querySelectorAll('.migrate-checkbox:checked').length;
            assignBtn.disabled = checkedCount === 0;
            assignBtn.textContent = checkedCount > 0 ? `Assign ${checkedCount} Items` : 'Assign Selected Items';
        });
    });

    // Handle Assignment Click
    assignBtn.addEventListener('click', async () => {
        const selectedLocationId = container.querySelector('#location-select').value;
        const checkedItems = Array.from(container.querySelectorAll('.migrate-checkbox:checked'));
        
        if (!checkedItems.length || !selectedLocationId) return;

        if (!confirm(`Are you sure you want to assign ${checkedItems.length} items to this location?`)) return;

        ui.showGlobalLoader('Assigning data...');
        const batches = new Map();
        
        // Group items by collection name
        checkedItems.forEach(item => {
            const collection = item.dataset.collection;
            if (!batches.has(collection)) batches.set(collection, []);
            batches.get(collection).push(item.dataset.id);
        });

        const promises = [];
        // Run batch updates for each collection
        batches.forEach((ids, collectionName) => {
            promises.push(api.assignLocationBatch(collectionName, ids, selectedLocationId));
        });

        try {
            await Promise.all(promises);
            ui.showToast(`Successfully assigned ${checkedItems.length} items.`, 'success');
            await render(); // Refresh the screen
        } catch (error) {
            console.error('Migration failed:', error);
            ui.showToast('Failed to assign data. See console.', 'error');
        } finally {
            ui.hideGlobalLoader();
        }
    });
}
