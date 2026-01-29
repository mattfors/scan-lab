import './styles/main.css';
import './styles/scan-timeline.css';
import Alpine from 'alpinejs';
import PouchDB from 'pouchdb-browser';
import { buildScanTimeline, updateScanTimelineChart, scanTimelineMarkup } from './components/scanTimeline';
import type { ScanEvent } from './types/event';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, ScatterController } from 'chart.js';
import { ModuleRegistry, GridOptions, createGrid, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Register Chart.js components
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, ScatterController);

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

// Initialize Chart.js Hello World Line Chart
function initHelloWorldChart(): void {
  const canvas = document.getElementById('helloWorldChart') as HTMLCanvasElement;
  if (canvas) {
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        datasets: [{
          label: 'Hello World Data',
          data: [12, 19, 3, 5, 2, 3, 9],
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Hello World Line Chart'
          }
        }
      }
    });
  }
}

// Start Alpine
Alpine.start();

// Initialize chart after Alpine starts
initHelloWorldChart();
