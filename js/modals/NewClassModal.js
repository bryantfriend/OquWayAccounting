// js/modals/NewClassModal.js
import { BaseModal } from './BaseModal.js';
import { generateDisplayName, generateClassCode } from '../modules/classUtils.js';

export class NewClassModal extends BaseModal {
  constructor(student, teacher, days, time, isOnline, onSave) {
    super('Create New Class', { size: 'max-w-lg', onSave });
    this.student = student;
    this.teacher = teacher;
    this.days = days;
    this.time = time;
    this.isOnline = isOnline;
    this.isGroup = false; // Default to Individual, but changeable
  }

  renderContent() {
    const studentName = this.student.name || 'New Student';
    const teacherName = this.teacher.name || 'N/A';
    const scheduleString = this.days.join('/');

    return `
      <div class="space-y-5">
        
        <div class="p-4 bg-blue-50 rounded-lg border border-blue-100 flex justify-between items-start">
           <div class="text-sm text-gray-700 space-y-1">
             <p><strong>Teacher:</strong> ${teacherName}</p>
             <p><strong>Slot:</strong> ${scheduleString} @ ${this.time}</p>
             <p><strong>Mode:</strong> ${this.isOnline ? 'Online 💻' : 'Offline 🛖'}</p>
           </div>
           <div class="text-right">
              <span class="text-xs font-bold text-blue-600 uppercase tracking-wide">Primary Student</span>
              <p class="font-semibold">${studentName}</p>
           </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2">Class Type</label>
          <div class="grid grid-cols-2 gap-4">
            <button type="button" class="type-btn active border-2 border-blue-500 bg-blue-50 p-3 rounded-lg flex flex-col items-center justify-center gap-1 transition" data-value="individual">
               <span class="text-2xl">👤</span>
               <span class="font-bold text-blue-700">Individual</span>
            </button>
            <button type="button" class="type-btn border-2 border-gray-200 p-3 rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-gray-50 transition" data-value="group">
               <span class="text-2xl">👥</span>
               <span class="font-bold text-gray-600">Group</span>
            </button>
          </div>
        </div>

        <div class="space-y-3">
           <div>
            <label class="block text-sm font-medium">Subject</label>
            <input id="clsSubject" type="text" class="mt-1 block w-full border rounded px-3 py-2" value="General English">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium">Language</label>
              <input id="clsLanguage" type="text" class="mt-1 block w-full border rounded px-3 py-2" value="English">
            </div>
            <div>
              <label class="block text-sm font-medium">Grade Level</label>
              <input id="clsGrade" type="text" class="mt-1 block w-full border rounded px-3 py-2" value="${this.student.grade || ''}">
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderFooter() {
    return '<button id="save-class-btn" class="btn-primary w-full py-2 text-lg">Create Class</button>';
  }

  attachEventListeners() {
    // Type Toggle Logic
    const btns = this.modalEl.querySelectorAll('.type-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => {
            b.classList.remove('active', 'border-blue-500', 'bg-blue-50');
            b.classList.add('border-gray-200');
            b.querySelector('span.font-bold').classList.replace('text-blue-700', 'text-gray-600');
        });
        btn.classList.add('active', 'border-blue-500', 'bg-blue-50');
        btn.classList.remove('border-gray-200');
        btn.querySelector('span.font-bold').classList.replace('text-gray-600', 'text-blue-700');
        
        this.isGroup = btn.dataset.value === 'group';
      });
    });

    this.modalEl.querySelector('#save-class-btn').addEventListener('click', () => {
      this._handleSaveClass();
    });
  }

  _handleSaveClass() {
    const subject = this.modalEl.querySelector('#clsSubject').value;
    const language = this.modalEl.querySelector('#clsLanguage').value;
    const gradeLevel = this.modalEl.querySelector('#clsGrade').value;

    if (!subject || !language || !gradeLevel) {
      this.showToast('Please fill in all fields.', 'error');
      return;
    }

    const endTime = `${(parseInt(this.time.split(':')[0]) + 1).toString().padStart(2, '0')}:00`;
    const timeRange = `${this.time}-${endTime}`;
    
    const dayTimes = {};
    for (const day of this.days) dayTimes[day] = timeRange;
    const selectedDays = new Set(this.days);
    
    const studentName = this.student.name.split(' ')[0];
    
    // Smart Naming
    let name = `Individual: ${this.student.name}`;
    let displayName = `👤 ${studentName} @ ${this.days[0].slice(0,1)}${this.time.split(':')[0]}`;
    
    if (this.isGroup) {
        name = `${gradeLevel} Group`;
        displayName = generateDisplayName(dayTimes, selectedDays, this.isOnline, true); // Using Utils
    }

    const newClassData = {
      subject, language, gradeLevel,
      teacherId: this.teacher.id,
      teacherName: this.teacher.name,
      isOnline: this.isOnline,
      isGroup: this.isGroup, // ✅ Dynamic
      days: this.days,
      dayTimes: dayTimes,
      students: [], 
      
      displayName: displayName,
      name: name,
      classCode: generateClassCode(dayTimes, selectedDays, this.isOnline, this.isGroup, gradeLevel),
    };

    if (this.onSave) this.onSave(newClassData);
    this.close();
  }
}