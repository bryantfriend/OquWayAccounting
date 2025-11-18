// js/modules/classViewModal.js
import { BaseModal } from '../modals/BaseModal.js';
import * as api from '../api.js';

export class ClassViewModal extends BaseModal {
  constructor(cls, teachers, onAction) {
    super(cls.name, { size: 'max-w-2xl' });
    this.cls = cls;
    this.teachers = teachers;
    this.onAction = onAction; // Callback for 'edit' or 'delete'
    this.students = []; // Will be loaded
  }

  renderContent() {
    const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const scheduleHtml = this.cls.days && this.cls.days.length > 0
      ? this.cls.days
        .sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
        .map(day => {
          const time = this.cls.dayTimes[day] || "No time set";
          return `<li><strong>${day}:</strong> ${time}</li>`;
        })
        .join("")
      : "<li class='text-gray-500'>No schedule set</li>";

    return `
      <div class="space-y-3">
        ${this.cls.photoUrl ? `<img src="${this.cls.photoUrl}" alt="Class Photo" class="w-24 h-24 object-cover rounded border mb-4" />` : ""}
        <p><strong>Subject:</strong> ${this.cls.subject || "—"}</p>
        <p><strong>Grade Level:</strong> ${this.cls.gradeLevel || "—"}</p>
        <p><strong>Class Code:</strong> ${this.cls.classCode || "—"}</p>
        <p><strong>Mode:</strong> ${this.cls.isOnline ? "Online" : "Offline"}</p>
        <p><strong>Type:</strong> ${this.cls.isGroup ? "Group" : "Individual"}</p>
        <p><strong>Teacher:</strong> ${this.cls.teacherName || "—"}</p>
        
        <div>
          <strong>Schedule:</strong>
          <ul class="list-disc list-inside">${scheduleHtml}</ul>
        </div>

        <div>
          <strong>Students (${this.cls.students?.length || 0}):</strong>
          <ul id="class-student-list" class="list-disc list-inside h-32 overflow-y-auto border rounded p-2">
            <li class='text-gray-500'>Loading students...</li>
          </ul>
        </div>
      </div>
    `;
  }

  renderFooter() {
    return `
        <button id="delete-class-btn" class="btn-danger-secondary">🗑️ Delete</button>
        <button id="edit-class-btn" class="btn-primary">✏️ Edit</button>
    `;
  }

  attachEventListeners() {
    this.modalEl.querySelector('#edit-class-btn').addEventListener('click', () => {
      this.onAction('edit', this.cls);
      this.close();
    });

    this.modalEl.querySelector('#delete-class-btn').addEventListener('click', () => {
      this.onAction('delete', this.cls.id);
      this.close();
    });

    // Asynchronously load students
    this._loadStudents();
  }

  async _loadStudents() {
    const listEl = this.modalEl.querySelector('#class-student-list');
    if (!listEl) return;

    const studentIds = this.cls.students || [];
    if (studentIds.length === 0) {
      listEl.innerHTML = "<li class='text-gray-500'>No students assigned</li>";
      return;
    }

    try {
      // This is not efficient for many students, but fine for a class
      const studentPromises = studentIds.map(id => api.getUserById(id));
      const students = await Promise.all(studentPromises);
      
      this.students = students.filter(Boolean); // Filter out any nulls

      if (this.students.length === 0) {
        listEl.innerHTML = "<li class='text-gray-500'>No students found.</li>";
        return;
      }
      
      listEl.innerHTML = this.students.map(s => 
        `<li>${s.name} (${s.phone || 'No phone'})</li>`
      ).join('');

    } catch (error) {
      console.error("Error loading students for class view:", error);
      listEl.innerHTML = "<li class='text-red-500'>Error loading students.</li>";
    }
  }
}