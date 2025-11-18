// js/app.js
import { auth } from '../firebase-init.js';
import { signOut, onAuthStateChanged, getIdTokenResult } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { setApiLocation } from './api.js';

// Import all module initializers
import { init as initOverview } from './modules/overview.js';
import { init as initStudents } from './modules/students.js';
import { init as initPayments } from './modules/payments.js';
import { init as initExpenses } from './modules/expenses.js';
import { init as initTeachers } from './modules/teachers.js';
import { init as initClasses } from './modules/classes.js';
import { renderSettings } from './modules/settings.js';

/**
 * Main application class.
 * Orchestrates the dashboard, handling global state, auth, and tab routing.
 */
class AccountingApp {
  constructor() {
    this.tabButtons = document.querySelectorAll('.tab-btn');
    this.contentAreas = document.querySelectorAll('.tab-content');
    this.logoutButton = document.getElementById('logoutBtn');
    this.currentTab = 'overview'; // Default tab
    this.loadedTabs = new Set();
  }

  /**
   * Kicks off the application.
   * Sets up the authentication guard.
   */
  init() {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = './login.html'; // Not logged in
        return;
      }

      try {
        const tokenResult = await getIdTokenResult(user);
        const role = tokenResult.claims.role || 'none';
        
        // 🔐 PRIMARY SECURITY GUARD 🔐
        if (role !== 'admin' && role !== 'accountant' && role !== 'superAdmin') {
          console.warn(`Access Denied: User role '${role}' is not authorized.`);
          this.showAccessDenied();
          return;
        }

        const locationId = tokenResult.claims.locationId || 'default';
        setApiLocation(locationId);

        this.setupEventListeners();
        this.loadTabContent(this.currentTab, true);
        // 1. Init the floating button listener
        document.getElementById('floating-bug-btn')?.addEventListener('click', () => {
            this.checkAndShowWelcome(true); // true = Force show
        });

        // 2. Auto-show welcome (only if not seen)
        this.checkAndShowWelcome(false);

      } catch (error) {
        console.error('Error fetching user role:', error);
        this.showAccessDenied("Error checking permissions.");
        await signOut(auth);
      }
    });
  }

  /**
   * --- UPDATED: Shows the Beta Welcome Screen ---
   * @param {boolean} force - If true, show modal even if already seen.
   */
  checkAndShowWelcome(force = false) {
    // Check if they have seen this specific version
    const hasSeen = localStorage.getItem('oquway_beta_welcome_v1');
    
    // If NOT forced (auto-load) AND they have seen it, do nothing.
    if (!force && hasSeen) return;

    // Prevent duplicate modals
    if (document.getElementById('welcome-modal')) return;

    const welcomeModal = document.createElement('div');
    welcomeModal.id = 'welcome-modal'; // Add ID to prevent duplicates
    welcomeModal.className = "fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm transition-opacity duration-300";
    
    // Slightly different text if they clicked the bug button vs auto-welcome
    const titleText = force ? "Support & Bug Report" : "Welcome to OquWay Beta";
    const btnText = force ? "Close" : "I Understand – Let's Start!";

    welcomeModal.innerHTML = `
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform scale-100 transition-transform duration-300">
        <div class="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white text-center">
          <div class="text-5xl mb-2">${force ? '🛠️' : '🚀'}</div>
          <h2 class="text-2xl font-bold">${titleText}</h2>
          <p class="text-blue-100 text-sm mt-1">System Version 1.0 (Open Beta)</p>
        </div>

        <div class="p-6 space-y-4">
          <p class="text-gray-600 leading-relaxed">
            ${force 
              ? "Need help? Found a bug? Use the direct line below to contact the developer." 
              : "You are one of the first users to access the new accounting system! Because this is an <strong>Open Beta</strong>, you might encounter some rough edges."}
          </p>

          <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md">
            <h3 class="font-bold text-red-700 flex items-center gap-2">
              <span>🚨 Urgent Issues</span>
            </h3>
            <p class="text-sm text-red-600 mt-1">
              If something is broken (e.g., cannot save payment, page crashes), please contact me immediately:
            </p>
            <a href="https://wa.me/996550346970" target="_blank" 
               class="mt-3 flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition">
               <span>💬 WhatsApp Bryant</span>
               <span class="font-normal text-xs">(+996 550 346 970)</span>
            </a>
          </div>

          <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-md">
            <h3 class="font-bold text-blue-700">📝 Feedback</h3>
            <p class="text-sm text-blue-600 mt-1">
              Notice a typo? Have an idea for a feature? Please let me know! Your feedback helps build a better system.
            </p>
          </div>
        </div>

        <div class="bg-gray-50 px-6 py-4 text-center">
          <button id="close-welcome-btn" class="w-full btn-primary py-3 text-lg shadow-lg">
            ${btnText}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(welcomeModal);

    // Handle Close
    welcomeModal.querySelector('#close-welcome-btn').addEventListener('click', () => {
      // Only mark as seen if it was the auto-welcome
      if (!force) {
          localStorage.setItem('oquway_beta_welcome_v1', 'true');
      }
      
      welcomeModal.classList.add('opacity-0');
      setTimeout(() => welcomeModal.remove(), 300);
    });
  }

  /**
   * Binds all global event listeners.
   */
  setupEventListeners() {
    this.tabButtons.forEach(tab => {
      tab.addEventListener('click', () => this.handleTabClick(tab));
    });

    this.logoutButton?.addEventListener('click', () => this.logout());
  }

  /**
   * Handles the logic when a user clicks on a tab.
   */
  handleTabClick(clickedTab) {
    const tabName = clickedTab.dataset.tab;
    if (this.currentTab === tabName) return;
    
    this.currentTab = tabName;

    // Update UI
    this.tabButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tabName);
    });
    this.contentAreas.forEach(content => {
      content.classList.toggle('hidden', content.id !== `tab-${tabName}`);
    });

    this.loadTabContent(tabName);
  }

  /**
   * Acts as a router, calling the correct module to populate the tab's content.
   */
  loadTabContent(tabName) {
    if (this.loadedTabs.has(tabName) && tabName !== 'overview') {
       return;
    }
    
    // 2. UPDATE THE SWITCH STATEMENT
    switch (tabName) {
      case 'overview':    initOverview(); break;
      case 'payments':    initPayments(); break;
      case 'expenses':    initExpenses(); break;
      case 'students':    initStudents(); break;
      case 'teachers':    initTeachers(); break; 
      case 'classes':     initClasses(); break;
      case 'settings':    renderSettings(); break;

      default:
        console.warn(`No module found for tab: ${tabName}`);
    }
    this.loadedTabs.add(tabName);
  }

  /**
   * Displays an "Access Denied" message and hides the main UI.
   */
  showAccessDenied(message = "Accounting system is for administrative staff only.") {
    const main = document.querySelector('main');
    if (main) {
      main.innerHTML = `
        <div class="max-w-xl mx-auto mt-20 text-center bg-white p-10 rounded-lg shadow-xl">
          <h1 class="text-3xl font-bold text-red-600">🚫 Access Denied</h1>
          <p class="text-lg text-gray-700 mt-4">${message}</p>
          <button id="logoutBtnDenied" class="mt-6 text-sm font-medium text-blue-600 hover:text-blue-800 transition">Logout</button>
        </div>
      `;
      // Hide tab navigation
      document.querySelector('.bg-white.border-b')?.classList.add('hidden');
      document.getElementById('logoutBtnDenied')?.addEventListener('click', () => this.logout());
    }
  }

  /**
   * Signs the user out.
   */
  async logout() {
    try {
      await signOut(auth);
      console.log('User signed out.');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }
}

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  const app = new AccountingApp();
  app.init();
});

window.addEventListener('error', (e) => {
  console.error('❌ Global JS Error:', e.message, e.filename);
});