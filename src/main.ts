import './styles/main.css';
import './styles/scan-timeline.css';
import Alpine from 'alpinejs';
import PouchDB from 'pouchdb-browser';
import { buildScanTimeline, updateScanTimelineChart, scanTimelineMarkup } from './components/scanTimeline';
import type { ScanEvent } from './types/event';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, ScatterController, BarController, BarElement } from 'chart.js';
import { ModuleRegistry, GridOptions, createGrid, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Register Chart.js components
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, ScatterController, BarController, BarElement);

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
        aspectRatio: 2.5,
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

// Start Alpine
Alpine.start();

// Initialize histogram after Alpine starts
updateDeltaTimeHistogram([]);
