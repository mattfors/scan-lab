import './styles/main.css';
import Alpine from 'alpinejs';
import PouchDB from 'pouchdb-browser';
import type { ScanEvent, AppConfig } from './types/event';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, Filler } from 'chart.js';
import { ModuleRegistry, GridOptions, createGrid, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import 'ag-grid-community/styles/ag-theme-balham.css';
import { updateRollingStatsCharts, defaultRollingStatsConfig } from './components/rollingStats';
import { performKMeansAndUpdateChart } from './components/kmeansClustering';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Register Chart.js components
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, Filler);

// Application configuration
const appConfig: AppConfig = {
  rollingWindow: 5, // Default window size for rolling statistics
  percentileRankWindow: 30 // Default window size for percentile rank calculation
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

// Helper function to calculate percentile rank
// Returns the percentage of values in the array that are less than the target value
function calculatePercentileRank(values: number[], targetValue: number): number {
  if (values.length === 0) return 0;
  const countLessThan = values.filter(val => val < targetValue).length;
  return (countLessThan / values.length) * 100;
}

// Helper function to calculate rolling statistics for events
function calculateRollingStats(events: ScanEvent[], config: AppConfig): void {
  // Process events in chronological order (oldest first)
  for (let i = 0; i < events.length; i++) {
    // Set scan index
    events[i].scanIndex = i;
    
    // Calculate scan speed (scans per second)
    if (i === 0 || !events[i].deltaTime || events[i].deltaTime === 0) {
      events[i].scanSpeed = 0;
      events[i].acceleration = 0;
    } else {
      events[i].scanSpeed = 1 / events[i].deltaTime!; // scans per second
      // Calculate acceleration (change in speed between consecutive scans, in scans/s)
      if (i === 1 || !events[i - 1].scanSpeed) {
        events[i].acceleration = 0;
      } else {
        events[i].acceleration = events[i].scanSpeed! - events[i - 1].scanSpeed!;
      }
    }
    
    // Skip first event (no deltaTime to calculate stats on)
    if (i === 0) {
      events[i].rollingMean = 0;
      events[i].rollingStd = 0;
      events[i].coefficientOfVariation = 0;
      events[i].logMean = -Infinity;
      events[i].logStd = -Infinity;
      events[i].zDelta = 0;
      events[i].speedVariability = 0;
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
      events[i].zDelta = 0;
      events[i].speedVariability = 0;
    } else {
      const mean = calculateMean(deltaTimes);
      const std = calculateStd(deltaTimes);
      
      events[i].rollingMean = mean;
      events[i].rollingStd = std;
      events[i].coefficientOfVariation = mean !== 0 ? std / mean : 0;
      events[i].logMean = mean > 0 ? Math.log(mean) : -Infinity;
      events[i].logStd = std > 0 ? Math.log(std) : -Infinity;
      
      // Calculate speed variability (coefficient of variation of speeds in the rolling window)
      const windowSpeeds = windowEvents
        .filter(e => e.scanSpeed !== undefined && e.scanSpeed > 0 && isFinite(e.scanSpeed))
        .map(e => e.scanSpeed!);
      
      if (windowSpeeds.length === 0) {
        events[i].speedVariability = 0;
      } else {
        const speedMean = calculateMean(windowSpeeds);
        const speedStd = calculateStd(windowSpeeds);
        events[i].speedVariability = speedMean !== 0 ? speedStd / speedMean : 0;
      }
      
      // Calculate z-delta using only past deltas (not including current event)
      // This measures how unusual the current delta is compared to recent history
      const pastWindowStart = Math.max(0, i - config.rollingWindow);
      const pastWindowEvents = events.slice(pastWindowStart, i);
      const pastDeltaTimes = pastWindowEvents
        .filter(e => e.deltaTime !== undefined && e.deltaTime > 0)
        .map(e => e.deltaTime!);
      
      const currentDelta = events[i].deltaTime ?? 0;
      if (pastDeltaTimes.length === 0) {
        events[i].zDelta = 0;
      } else {
        const pastMean = calculateMean(pastDeltaTimes);
        const pastStd = calculateStd(pastDeltaTimes);
        events[i].zDelta = pastStd > 0 ? (currentDelta - pastMean) / pastStd : 0;
      }
      
      // Calculate percentile rank of zDelta compared to previous zDeltas
      // Use a window of previous zDelta values (not including current)
      const percentileWindowStart = Math.max(0, i - config.percentileRankWindow);
      const percentileWindowEvents = events.slice(percentileWindowStart, i);
      const previousZDeltas = percentileWindowEvents
        .filter(e => e.zDelta !== undefined && isFinite(e.zDelta))
        .map(e => e.zDelta!);
      
      const currentZDelta = events[i].zDelta;
      if (currentZDelta === undefined || !isFinite(currentZDelta) || previousZDeltas.length === 0) {
        events[i].zDeltaPercentileRank = undefined;
      } else {
        events[i].zDeltaPercentileRank = calculatePercentileRank(previousZDeltas, currentZDelta);
      }
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
      
      // Update rolling statistics charts
      updateRollingStatsCharts(sortedEvents.slice().reverse()); // Pass in chronological order
      
      // Perform k-means clustering and update Gaussian curves chart
      performKMeansAndUpdateChart(sortedEvents.slice().reverse()); // Pass in chronological order
    } catch (error) {
      console.error('Error loading events:', error);
    }
  },
  
  init(): void {
    // Store reference to loadEvents for use in keyboard listener
    reloadEventsCallback = this.loadEvents.bind(this);
    this.loadEvents();
    
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
            headerName: 'I',
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
            headerName: 'Delta (s)',
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
            headerName: 'Mean',
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
            headerName: 'Std',
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
          },
          { 
            field: 'zDelta', 
            headerName: 'Z-Delta',
            flex: 1,
            valueFormatter: (params) => {
              if (params.value !== undefined && params.value !== null && isFinite(params.value)) {
                return params.value.toFixed(3);
              }
              return 'N/A';
            }
          },
          { 
            field: 'zDeltaPercentileRank', 
            headerName: 'Z-Delta %ile',
            flex: 1,
            valueFormatter: (params) => {
              if (params.value !== undefined && params.value !== null && isFinite(params.value)) {
                return params.value.toFixed(1);
              }
              return 'N/A';
            }
          }
        ],
        rowData: this.events,
        defaultColDef: {
          sortable: true,
          filter: false,
          resizable: true
        },
        domLayout: 'autoHeight',
        theme: 'legacy' // Use legacy theme to avoid warning
      };
      
      this.gridApi = createGrid(gridDiv, gridOptions);
    }
  }
}));

// Start Alpine
Alpine.start();
