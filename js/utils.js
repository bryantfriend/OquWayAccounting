// js/utils.js

/**
 * Exports an array of objects to a CSV file.
 * @param {Array<object>} data - The data to export.
 * @param {string} filename - The desired filename (e.g., 'payroll.csv').
 */
export function exportToCSV(data, filename) {
  if (!data || data.length === 0) {
    console.warn("No data to export.");
    return;
  }

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')]; // Header row

  // Data rows
  for (const row of data) {
    const values = headers.map(header => {
      let cell = row[header];
      cell = (cell === null || cell === undefined) ? '' : cell;
      cell = String(cell);
      // Escape commas and quotes
      if (cell.includes(',') || cell.includes('"')) {
        cell = `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  a.click();
}

/**
 * Opens a print dialog for a specific element.
 * @param {string} title - The document title for the print job.
 * @param {string} headerHtml - HTML string for the header (e.g., logo, date).
 * @param {string} tableHtml - The HTML string of the table to print.
 */
export function printTable(title, headerHtml, tableHtml) {
  const printWindow = window.open('', '', 'height=800,width=1000');
  printWindow.document.write('<html><head><title>' + title + '</title>');
  // Basic print styling
  printWindow.document.write(`
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.5; }
      h1, h2 { text-align: center; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
      th { background-color: #f4f4f4; }
      tr:nth-child(even) { background-color: #f9f9f9; }
      @page { size: A4; margin: 20mm; }
      @media print {
        body { margin: 0; }
        .no-print { display: none; }
      }
    </style>
  `);
  printWindow.document.write('</head><body>');
  printWindow.document.write(headerHtml);
  printWindow.document.write(tableHtml);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.focus();
  
  // Wait for content to load before printing
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

/**
 * Formats a number as KGS currency.
 * @param {number} amount - The amount to format.
 * @returns {string} The formatted currency string.
 */
export function formatCurrency(amount) {
  const value = amount || 0;
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'KGS', 
    minimumFractionDigits: 0 
  }).format(value);
}

/**
 * --- ✨ MOVED FROM students.js ---
 * Delays executing a function until the user has stopped typing.
 * @param {function} func - The function to call.
 * @param {number} delay - The delay in milliseconds.
 */
export function debounce(func, delay = 300) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Creates the HTML for a simple loading spinner.
 * @returns {string} HTML string for the spinner.
 */
export function createSpinner() {
  // Returns Tailwind classes for a small, white spinner
  return `<div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>`;
}