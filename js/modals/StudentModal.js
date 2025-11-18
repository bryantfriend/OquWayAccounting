// js/modals/StudentModal.js
import { BaseModal } from './BaseModal.js';
import { ClassFinderModal } from './ClassFinderModal.js';
import { TeacherFinderModal } from './TeacherFinderModal.js';

export class StudentModal extends BaseModal {
  constructor(student, classes, students, teachers, onSave) {
    const title = student ? 'Edit Student Details' : 'Add New Student';
    super(title, { size: 'max-w-2xl', onSave }); 
    
    this.student = student; // This is the student object (or null)
    this.classes = classes;
    this.students = students;
    this.teachers = teachers;
    this.pendingClassData = null;

    // Cache element references
    this.nameEl = null;
    this.phoneEl = null;
    this.totalEl = null;
    this.paidEl = null;
    this.owedEl = null;
    this.creditEl = null;
    this.modelEl = null;
    this.classIdEl = null;
    this.classNameEl = null;
  }

  renderContent() {
    // --- THIS IS THE FIX ---
    // The code now correctly uses this.student to populate values
    const selectedClass = this.student?.classId ? this.classes.find(c => c.id === this.student.classId) : null;
    const selectedClassName = selectedClass ? (selectedClass.displayName || selectedClass.name) : '— Unassigned —';

    const initialTotal = this.student?.tuitionTotal || 0;
    const initialPaid = this.student?.tuitionPaid || 0;
    const initialBalance = initialTotal - initialPaid;
    const initialOwed = Math.max(0, initialBalance);
    const initialCredit = Math.max(0, -initialBalance);

    return `
      <div class="space-y-4">
        <h4 class="text-md font-semibold text-gray-700 border-b pb-2">Personal Info</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium">Full Name</label>
            <input id="studentName" type="text" class="mt-1 block w-full" value="${this.student?.name || ''}">
          </div>
          <div>
            <label class="block text-sm font-medium">Phone Number</label>
            <input id="studentPhone" type="text" class="mt-1 block w-full" value="${this.student?.phone || ''}">
          </div>
        </div>
        
        <h4 class="text-md font-semibold text-gray-700 border-b pb-2 mt-4">Tuition</h4>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium">Total Tuition (Price)</label>
            <input id="tuitionTotal" type="number" class="mt-1 block w-full" value="${initialTotal}">
          </div>
          <div>
            <label class="block text-sm font-medium">Amount Paid</label>
            <input id="tuitionPaid" type="number" class="mt-1 block w-full bg-gray-100" value="${initialPaid}" readonly title="Use the 'Add Payment' (💵) button to change this">
          </div>
          <div>
            <label class="block text-sm font-medium">Owed (Auto)</label>
            <input id="tuitionOwed" type="number" class="mt-1 block w-full bg-gray-100 text-red-600" 
              value="${initialOwed}" readonly>
          </div>
          <div>
            <label class="block text-sm font-medium">Credit (Auto)</label>
            <input id="tuitionCredit" type="number" class="mt-1 block w-full bg-gray-100 text-green-600" 
              value="${initialCredit}" readonly>
          </div>
        </div>
        <p class="text-xs text-gray-500 -mt-2">To add a payment, close this modal and use the "Add Payment" (💵) button on the student list.</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium">Payment Model</label>
            <select id="paymentModel" class="mt-1 block w-full">
              <option value="session" ${this.student?.paymentModel === 'session' ? 'selected' : ''}>Per Session (Balance)</option>
              <option value="monthly" ${this.student?.paymentModel === 'monthly' ? 'selected' : ''}>Monthly (Time-based)</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium">Last Payment Date (Read-only)</label>
            <input id="lastPaymentDate" type="date" class="mt-1 block w-full bg-gray-100" 
              value="${this.student?.lastPaymentDate ? this.student.lastPaymentDate.toDate().toISOString().split('T')[0] : ''}" readonly title="This is updated automatically when you add a payment.">
          </div>
        </div>

            <h4 class="text-md font-semibold text-gray-700 border-b pb-2 mt-4">Scheduling</h4>
            <div>
              <label class="block text-sm font-medium">Assigned Class</label>
              <input type="hidden" id="studentClass" value="${this.student?.classId || ''}">
              <input type="text" id="studentClassName" class="mt-1 block w-full bg-gray-100 border rounded px-3 py-2 mb-2" value="${selectedClassName}" readonly>

              <button id="find-class-btn" class="btn-secondary w-full flex justify-center items-center gap-2 py-2">
                <span>🔎 Find Class / Teacher</span>
              </button>
            </div>
          </div>
      </div>
    `;
  }

  renderFooter() {
    return '<button id="save-student-btn" class="btn-primary">Save Changes</button>';
  }

  attachEventListeners() {
    // Cache elements
    this.nameEl = this.modalEl.querySelector('#studentName');
    this.phoneEl = this.modalEl.querySelector('#studentPhone');
    this.totalEl = this.modalEl.querySelector('#tuitionTotal');
    this.paidEl = this.modalEl.querySelector('#tuitionPaid');
    this.owedEl = this.modalEl.querySelector('#tuitionOwed');
    this.creditEl = this.modalEl.querySelector('#tuitionCredit');
    this.modelEl = this.modalEl.querySelector('#paymentModel');
    this.classIdEl = this.modalEl.querySelector('#studentClass');
    this.classNameEl = this.modalEl.querySelector('#studentClassName');

    // Balance calculator
    this.totalEl.addEventListener('input', () => this._calcBalance());

    this.modalEl.querySelector('#find-class-btn').addEventListener('click', () => {
      // Pass a temporary student object if new
      const studentName = this.nameEl.value || 'Prospective Student';
      const studentData = {
        id: this.student?.id, 
        name: studentName,
        grade: this.student?.grade
      };

      // Import the TeacherFinderModal dynamically or use the import at top
      // Assuming imported as: import { TeacherFinderModal } from './TeacherFinderModal.js';
      const finder = new TeacherFinderModal(
        studentData,
        this.teachers,
        this.classes,
        (result) => {
           // Result can be a saved class object OR a "saveData" object (for joining)
           // We handle both formats here to be safe
           if (result.pendingClass || result.studentData) {
               // It's a "Join" action or a complex save
               if (result.pendingClass) this.pendingClassData = result.pendingClass;
               if (result.studentData?.classId) this.classIdEl.value = result.studentData.classId;
               // We can try to find the class name from the ID in the classes list
               const cls = this.classes.find(c => c.id === result.studentData?.classId);
               this.classNameEl.value = cls ? (cls.displayName || cls.name) : "Pending Creation...";
               if (result.pendingClass) this.classIdEl.value = 'pending-creation';
           } else {
               // It's a simple class object (Created New)
               this.classIdEl.value = result.id || 'pending-creation';
               this.classNameEl.value = result.displayName || result.name;
               if (!result.id) this.pendingClassData = result;
               else this.classes.push(result);
           }
        }
      );
      finder.show();
    });


    // "Save" button
    this.modalEl.querySelector('#save-student-btn').addEventListener('click', () => {
      this._handleSave();
    });
  }

  _calcBalance() {
    const total = Number(this.totalEl.value) || 0;
    const paid = Number(this.paidEl.value) || 0;
    const balance = total - paid;
    this.owedEl.value = Math.max(0, balance);
    this.creditEl.value = Math.max(0, -balance);
  }

_handleSave() {
    const studentData = {
      name: this.nameEl.value,
      phone: this.phoneEl.value,
      tuitionTotal: Number(this.totalEl.value),
      paymentModel: this.modelEl.value, 
      role: 'student',
      active: this.student?.active ?? true,
      classId: this.classIdEl.value === 'pending-creation' ? null : this.classIdEl.value || null,
    };
    
    // Package up *everything* for the main save handler in students.js
    const saveData = {
      studentData: studentData,
      pendingClass: this.pendingClassData // Pass the pending class
    };

    if (this.onSave) {
      this.onSave(saveData, this.student?.id || null);
    }
    this.close();
  }
}