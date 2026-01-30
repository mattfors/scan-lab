import './styles/main.css';
import './styles/scan-timeline.css';
import Alpine from 'alpinejs';
import PouchDB from 'pouchdb-browser';
import { buildScanTimeline, updateScanTimelineChart, scanTimelineMarkup } from './components/scanTimeline';
import type { ScanEvent, AppConfig } from './types/event';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, ScatterController, BarController, BarElement } from 'chart.js';
import { ModuleRegistry, GridOptions, createGrid, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Register Chart.js components
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, ScatterController, BarController, BarElement);

// Application configuration
const appConfig: AppConfig = {
  rollingWindow: 5 // Default window size for rolling statistics
};

// Helper function to calculate mean
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

// Helper function to calculate standard deviation
function calculateStd(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = calculateMean(squaredDiffs);
  return Math.sqrt(variance);
}

// Helper function to calculate rolling statistics for events
function calculateRollingStats(events: ScanEvent[], config: AppConfig): void {
  // Process events in chronological order (oldest first)
  for (let i = 0; i < events.length; i++) {
    // Set scan index
    events[i].scanIndex = i;
    
    // Skip first event (no deltaTime to calculate stats on)
    if (i === 0) {
      events[i].rollingMean = 0;
      events[i].rollingStd = 0;
      events[i].coefficientOfVariation = 0;
      events[i].logMean = -Infinity;
      events[i].logStd = -Infinity;
      continue;
    }
    
    // Get the window of delta times (up to window size, or as many as available)
    const windowStart = Math.max(0, i - config.rollingWindow + 1);
    const windowEvents = events.slice(windowStart, i + 1);
    
    // Extract delta times (skip events without deltaTime or with deltaTime = 0)
    const deltaTimes = windowEvents
      .filter(e => e.deltaTime !== undefined && e.deltaTime > 0)
      .map(e => e.deltaTime!);
    
    if (deltaTimes.length === 0) {
      events[i].rollingMean = 0;
      events[i].rollingStd = 0;
      events[i].coefficientOfVariation = 0;
      events[i].logMean = -Infinity;
      events[i].logStd = -Infinity;
    } else {
      const mean = calculateMean(deltaTimes);
      const std = calculateStd(deltaTimes);
      
      events[i].rollingMean = mean;
      events[i].rollingStd = std;
      events[i].coefficientOfVariation = mean !== 0 ? std / mean : 0;
      events[i].logMean = mean > 0 ? Math.log(mean) : -Infinity;
      events[i].logStd = std > 0 ? Math.log(std) : -Infinity;
    }
  }
}

// Generate UUID v4 using crypto API for better randomness
function generateUUID(): string {
  return crypto.randomUUID();
}

// Initialize PouchDB
let db = new PouchDB('scan-lab');

interface AppData {
  events: ScanEvent[];
  fakeScan: () => Promise<void>;
  clearData: () => Promise<void>;
  loadEvents: () => Promise<void>;
  scanTimeline: ReturnType<typeof buildScanTimeline>;
  init?: () => void;
  gridApi?: any;
}

// Keyboard input buffer for scan events
let scanBuffer = '';
let reloadEventsCallback: (() => Promise<void>) | null = null;
let deltaTimeHistogramChart: Chart | null = null;
let rollingMeanChart: Chart | null = null;
let rollingStdLogChart: Chart | null = null;
let deltaVsIndexChart: Chart | null = null;

// Add document-level keyboard listener
document.addEventListener('keydown', async (event: KeyboardEvent) => {
  // Check if Enter key was pressed
  if (event.key === 'Enter') {
    // If buffer has content, create a scan event
    if (scanBuffer.trim().length > 0) {
      const scanEvent: ScanEvent = {
        _id: generateUUID(),
        ts: new Date().toISOString(),
        data: scanBuffer
      };
      
      try {
        await db.put(scanEvent);
        // Trigger Alpine to reload events
        if (reloadEventsCallback) {
          await reloadEventsCallback();
        }
      } catch (error) {
        console.error('Error inserting scan event:', error);
      }
      
      // Clear buffer after logging
      scanBuffer = '';
    }
  } else if (event.key.length === 1) {
    // Only add printable characters to buffer
    scanBuffer += event.key;
  } else if (event.key === 'Backspace') {
    // Handle backspace
    scanBuffer = scanBuffer.slice(0, -1);
  }
});

Alpine.data('app', (): AppData => ({
  events: [],

  get scanTimeline() {
    return buildScanTimeline(this.events);
  },
  
  async fakeScan(): Promise<void> {
    const event: ScanEvent = {
      _id: generateUUID(),
      ts: new Date().toISOString(),
      data: 'fakescan'
    };
    
    try {
      await db.put(event);
      await this.loadEvents();
    } catch (error) {
      console.error('Error inserting event:', error);
    }
  },

  async clearData(): Promise<void> {
    const confirmed = window.confirm('Are you sure you want to clear all local data? This action cannot be undone.');
    
    if (confirmed) {
      try {
        await db.destroy();
        // Recreate the database after destroying it
        db = new PouchDB('scan-lab');
        await this.loadEvents();
      } catch (error) {
        console.error('Error clearing data:', error);
      }
    }
  },
  
  async loadEvents(): Promise<void> {
    try {
      const result = await db.allDocs({ include_docs: true, descending: true });
      // Sort events by timestamp in ascending order (oldest first) to calculate delta times
      const sortedEvents = result.rows
        .map((row: any) => row.doc as ScanEvent)
        .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
      
      // Calculate delta times
      for (let i = 0; i < sortedEvents.length; i++) {
        if (i === 0) {
          sortedEvents[i].deltaTime = 0; // First event has no previous event
        } else {
          const prevTime = new Date(sortedEvents[i - 1].ts).getTime();
          const currTime = new Date(sortedEvents[i].ts).getTime();
          sortedEvents[i].deltaTime = (currTime - prevTime) / 1000; // Convert to seconds
        }
      }
      
      // Calculate rolling statistics
      calculateRollingStats(sortedEvents, appConfig);
      
      // Reverse to show most recent first
      this.events = sortedEvents.reverse();
      
      // Update AG Grid if it exists
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.events);
      }
      
      // Update scan timeline chart
      updateScanTimelineChart(this.scanTimeline);
      
      // Update delta time histogram
      updateDeltaTimeHistogram(this.events);
      
      // Update new rolling statistics charts
      updateRollingStatsCharts(sortedEvents.slice().reverse()); // Pass in chronological order
    } catch (error) {
      console.error('Error loading events:', error);
    }
  },
  
  init(): void {
    // Store reference to loadEvents for use in keyboard listener
    reloadEventsCallback = this.loadEvents.bind(this);
    this.loadEvents();
    const timelineRoot = document.getElementById('scan-timeline-root');
    if (timelineRoot) {
      timelineRoot.innerHTML = scanTimelineMarkup;
      (Alpine as any).initTree(timelineRoot);
    }
    
    // Initialize AG Grid
    const gridDiv = document.querySelector('#eventsGrid') as HTMLElement;
    if (gridDiv) {
      // Destroy existing grid if it exists (for HMR)
      if (this.gridApi) {
        this.gridApi.destroy();
      }
      
      // Clear the grid container
      gridDiv.innerHTML = '';
      
      const gridOptions: GridOptions = {
        columnDefs: [
          { 
            field: 'scanIndex', 
            headerName: 'Index',
            flex: 0.5,
            valueFormatter: (params) => {
              if (params.value !== undefined && params.value !== null) {
                return params.value.toString();
              }
              return '';
            }
          },
          { 
            field: 'ts', 
            headerName: 'Time',
            flex: 2,
            valueFormatter: (params) => {
              if (params.value) {
                return new Date(params.value).toLocaleString();
              }
              return '';
            }
          },
          { 
            field: 'data', 
            headerName: 'Data',
            flex: 2
          },
          { 
            field: 'deltaTime', 
            headerName: 'Delta Time (s)',
            flex: 1,
            valueFormatter: (params) => {
              if (params.value !== undefined && params.value !== null) {
                return params.value.toFixed(3);
              }
              return '0.000';
            }
          },
          { 
            field: 'rollingMean', 
            headerName: 'Rolling Mean',
            flex: 1,
            valueFormatter: (params) => {
              if (params.value !== undefined && params.value !== null && isFinite(params.value)) {
                return params.value.toFixed(3);
              }
              return 'N/A';
            }
          },
          { 
            field: 'rollingStd', 
            headerName: 'Rolling Std',
            flex: 1,
            valueFormatter: (params) => {
              if (params.value !== undefined && params.value !== null && isFinite(params.value)) {
                return params.value.toFixed(3);
              }
              return 'N/A';
            }
          },
          { 
            field: 'coefficientOfVariation', 
            headerName: 'CV',
            flex: 1,
            valueFormatter: (params) => {
              if (params.value !== undefined && params.value !== null && isFinite(params.value)) {
                return params.value.toFixed(3);
              }
              return 'N/A';
            }
          },
          { 
            field: 'logMean', 
            headerName: 'Log(Mean)',
            flex: 1,
            valueFormatter: (params) => {
              if (params.value !== undefined && params.value !== null && isFinite(params.value)) {
                return params.value.toFixed(3);
              }
              return 'N/A';
            }
          },
          { 
            field: 'logStd', 
            headerName: 'Log(Std)',
            flex: 1,
            valueFormatter: (params) => {
              if (params.value !== undefined && params.value !== null && isFinite(params.value)) {
                return params.value.toFixed(3);
              }
              return 'N/A';
            }
          }
        ],
        rowData: this.events,
        defaultColDef: {
          sortable: true,
          filter: true,
          resizable: true
        },
        domLayout: 'autoHeight',
        theme: 'legacy' // Use legacy theme to avoid warning
      };
      
      this.gridApi = createGrid(gridDiv, gridOptions);
    }
  }
}));

// Create logarithmic buckets for delta times
// Buckets will be: 0-0.1s, 0.1-0.5s, 0.5-1s, 1-2s, 2-5s, 5-10s, 10-30s, 30-60s, 60s+
function createDeltaTimeBuckets(events: ScanEvent[]): { labels: string[]; counts: number[] } {
  const buckets = [
    { min: 0, max: 0.1, label: '0-0.1s' },
    { min: 0.1, max: 0.5, label: '0.1-0.5s' },
    { min: 0.5, max: 1, label: '0.5-1s' },
    { min: 1, max: 2, label: '1-2s' },
    { min: 2, max: 5, label: '2-5s' },
    { min: 5, max: 10, label: '5-10s' },
    { min: 10, max: 30, label: '10-30s' },
    { min: 30, max: 60, label: '30-60s' },
    { min: 60, max: Infinity, label: '60s+' }
  ];

  const counts = new Array(buckets.length).fill(0);

  // Count events in each bucket (skip first event which has deltaTime = 0)
  events.forEach((event) => {
    if (event.deltaTime !== undefined && event.deltaTime > 0) {
      const bucketIndex = buckets.findIndex(
        (bucket) => event.deltaTime! >= bucket.min && event.deltaTime! < bucket.max
      );
      if (bucketIndex >= 0) {
        counts[bucketIndex]++;
      }
    }
  });

  return {
    labels: buckets.map((b) => b.label),
    counts
  };
}

// Initialize and update Delta Time Histogram
function updateDeltaTimeHistogram(events: ScanEvent[]): void {
  const canvas = document.getElementById('deltaTimeHistogram') as HTMLCanvasElement;
  if (!canvas) {
    return;
  }

  const { labels, counts } = createDeltaTimeBuckets(events);

  if (deltaTimeHistogramChart) {
    // Update existing chart
    deltaTimeHistogramChart.data.labels = labels;
    deltaTimeHistogramChart.data.datasets[0].data = counts;
    deltaTimeHistogramChart.update();
  } else {
    // Create new chart
    deltaTimeHistogramChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Count',
          data: counts,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgb(75, 192, 192)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 3.5,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            },
            title: {
              display: true,
              text: 'Count'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Delta Time Range'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Distribution of Delta Times Between Scans'
          },
          legend: {
            display: false
          }
        }
      }
    });
  }
}

// Update Rolling Mean Chart
function updateRollingMeanChart(events: ScanEvent[]): void {
  const canvas = document.getElementById('rollingMeanChart') as HTMLCanvasElement;
  if (!canvas) {
    return;
  }

  const indices = events.map(e => e.scanIndex ?? 0);
  const means = events.map(e => e.rollingMean ?? 0);

  if (rollingMeanChart) {
    rollingMeanChart.data.labels = indices;
    rollingMeanChart.data.datasets[0].data = means;
    rollingMeanChart.update();
  } else {
    rollingMeanChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: indices,
        datasets: [{
          label: 'Rolling Mean',
          data: means,
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
          tension: 0.1,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 3.5,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Scan Index'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Rolling Mean (s)'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Rolling Mean vs Index'
          },
          legend: {
            display: false
          }
        }
      }
    });
  }
}

// Update Rolling Std Log Chart
function updateRollingStdLogChart(events: ScanEvent[]): void {
  const canvas = document.getElementById('rollingStdLogChart') as HTMLCanvasElement;
  if (!canvas) {
    return;
  }

  const indices = events.map(e => e.scanIndex ?? 0);
  const logStds = events.map(e => {
    const val = e.logStd ?? -Infinity;
    return isFinite(val) ? val : null;
  });

  if (rollingStdLogChart) {
    rollingStdLogChart.data.labels = indices;
    rollingStdLogChart.data.datasets[0].data = logStds;
    rollingStdLogChart.update();
  } else {
    rollingStdLogChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: indices,
        datasets: [{
          label: 'Log(Rolling Std)',
          data: logStds,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          tension: 0.1,
          pointRadius: 2,
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 3.5,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Scan Index'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Log(Rolling Std)'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Rolling Std Log vs Index'
          },
          legend: {
            display: false
          }
        }
      }
    });
  }
}

// Update Delta vs Index Chart
function updateDeltaVsIndexChart(events: ScanEvent[]): void {
  const canvas = document.getElementById('deltaVsIndexChart') as HTMLCanvasElement;
  if (!canvas) {
    return;
  }

  const indices = events.map(e => e.scanIndex ?? 0);
  const deltas = events.map(e => e.deltaTime ?? 0);

  if (deltaVsIndexChart) {
    deltaVsIndexChart.data.labels = indices;
    deltaVsIndexChart.data.datasets[0].data = deltas;
    deltaVsIndexChart.update();
  } else {
    deltaVsIndexChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: indices,
        datasets: [{
          label: 'Delta Time',
          data: deltas,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          tension: 0.1,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 3.5,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Scan Index'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Delta Time (s)'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Delta vs Index'
          },
          legend: {
            display: false
          }
        }
      }
    });
  }
}

// Update all rolling statistics charts
function updateRollingStatsCharts(events: ScanEvent[]): void {
  updateRollingMeanChart(events);
  updateRollingStdLogChart(events);
  updateDeltaVsIndexChart(events);
}

// Start Alpine
Alpine.start();

// Initialize charts after Alpine starts
updateDeltaTimeHistogram([]);
updateRollingMeanChart([]);
updateRollingStdLogChart([]);
updateDeltaVsIndexChart([]);
