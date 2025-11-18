/**
 * Destroys a previous Chart.js instance if it exists.
 * This is crucial for preventing memory leaks and rendering glitches when updating charts.
 * @param {Chart} chartInstance - The Chart.js instance to destroy.
 */
export function destroyChart(chartInstance) {
  if (chartInstance) {
    chartInstance.destroy();
  }
}

/**
 * Renders or updates a bar chart on a given canvas element.
 * @param {HTMLCanvasElement} canvas - The canvas element to render the chart on.
 * @param {string} title - The title to display for the chart.
 * @param {Array<string>} labels - The labels for the X-axis.
 * @param {Array<number>|Array<object>} data - The data to plot. Can be a single array for one dataset or an array of dataset objects for multiple.
 * @param {Chart} [existingChartInstance=null] - The existing chart instance, if any, to destroy before rendering.
 * @param {boolean} [isMultiDataset=false] - Flag indicating if the data is structured for multiple datasets.
 * @returns {Chart} The new Chart.js instance.
 */
export function renderBarChart(
  canvas,
  title,
  labels,
  data,
  existingChart,
  stacked = false,
  colors = ['#3B82F6'] // default blue fallback
) {
  // 🧹 Destroy previous chart instance
  if (existingChart) {
    try {
      existingChart.destroy();
    } catch (err) {
      console.warn('Chart destroy failed:', err);
    }
  }

  const ctx = canvas.getContext('2d');

  // 🧮 Determine if multiple datasets are being passed
  const isMultiDataset = Array.isArray(data[0]) || Array.isArray(data.datasets);

  // 🎨 Prepare datasets dynamically
  let datasets;
  if (isMultiDataset && data.datasets) {
    // When `data` is already a chart.js-style dataset array
    datasets = data.datasets;
  } else if (isMultiDataset) {
    // When data is an array of arrays (e.g. multiple series)
    datasets = data.map((dataset, idx) => ({
      label: labels[idx] || `Dataset ${idx + 1}`,
      data: dataset,
      backgroundColor: colors[idx % colors.length],
      borderColor: '#1E293B',
      borderWidth: 1,
      borderRadius: 4,
    }));
  } else {
    // Standard single dataset (used for Expenses, Payments, etc.)
    datasets = [
      {
        label: title,
        data,
        backgroundColor: Array.isArray(colors) ? colors : [colors],
        borderColor: '#1E293B',
        borderWidth: 1,
        borderRadius: 4,
      },
    ];
  }

  // ⚙️ Chart Configuration
  const chartConfig = {
    type: 'bar',
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: isMultiDataset,
          position: 'top',
          labels: {
            font: {
              size: 12,
            },
          },
        },
        title: {
          display: !!title,
          text: title,
          font: {
            size: 18,
            weight: '600',
          },
          padding: { top: 10, bottom: 20 },
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          callbacks: {
            label: function (context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) {
                label += new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'KGS',
                  minimumFractionDigits: 0,
                }).format(context.parsed.y);
              }
              return label;
            },
          },
        },
      },
      scales: stacked
        ? {
            x: { stacked: true },
            y: {
              stacked: true,
              beginAtZero: true,
              grid: { color: '#e5e7eb' },
              ticks: {
                callback: (value) =>
                  value >= 1000 ? `${value / 1000}k` : value,
              },
            },
          }
        : {
            y: {
              beginAtZero: true,
              grid: { color: '#e5e7eb' },
              ticks: {
                callback: (value) =>
                  value >= 1000 ? `${value / 1000}k` : value,
              },
            },
            x: { grid: { display: false } },
          },
    },
  };

  // 🧁 Return the new Chart instance
  return new Chart(ctx, chartConfig);
}
