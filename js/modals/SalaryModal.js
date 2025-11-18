// js/modals/SalaryModal.js
import { BaseModal } from './BaseModal.js';

export class SalaryModal extends BaseModal {
    /**
     * @param {object} salary - The existing salary object, or null for a new one
     * @param {function} onSave - Callback function(data, salaryId)
     */
    constructor(salary, onSave) {
        const title = salary ? 'Edit Staff Salary' : 'Add New Staff Salary';
        super(title, { size: 'max-w-md', onSave });

        this.salary = salary;
        this.salaryId = salary?.id || null;
    }

    /**
     * Renders the modal's main content.
     */
    renderContent() {
        // This is the HTML from the old function's 
        // <div class="p-6 space-y-4">...</div>
        return `
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium">Staff Name</label>
                    <input id="salaryName" type="text" class="mt-1 block w-full" value="${this.salary?.name || ''}">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium">Position</label>
                        <input id="salaryPosition" type="text" class="mt-1 block w-full" value="${this.salary?.position || ''}">
                    </div>
                    <div>
                        <label class="block text-sm font-medium">Monthly Salary (KGS)</label>
                        <input id="salaryAmount" type="number" class="mt-1 block w-full" value="${this.salary?.salary || ''}">
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Renders the "Save" button in the footer.
     */
    renderFooter() {
        return '<button id="save-salary-btn" class="btn-primary">💾 Save Salary</button>';
    }

    /**
     * Attaches the event listener for the save button.
     */
    attachEventListeners() {
        // This logic is copied from the old 'save-salary-btn' click handler
        this.modalEl.querySelector('#save-salary-btn').addEventListener('click', () => {
            const data = {
                name: this.modalEl.querySelector('#salaryName').value,
                position: this.modalEl.querySelector('#salaryPosition').value,
                salary: Number(this.modalEl.querySelector('#salaryAmount').value) || 0,
            };

            if (!data.name || data.salary <= 0) {
                this.showToast('Please enter a name and valid salary.', 'error');
                return;
            }

            if (this.onSave) {
                this.onSave(data, this.salaryId);
            }
            this.close();
        });
    }
}