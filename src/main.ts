import './styles/main.css';
import './styles/scan-timeline.css';
import Alpine from 'alpinejs';
import PouchDB from 'pouchdb-browser';
import { buildScanTimeline, scanTimelineMarkup } from './components/scanTimeline';
import type { ScanEvent } from './types/event';

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
        eventType: 'scan',
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
      eventType: 'scan',
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
      // Sort events by timestamp in descending order (most recent first)
      this.events = result.rows
        .map((row: any) => row.doc as ScanEvent)
        .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
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
  }
}));

// Start Alpine
Alpine.start();
