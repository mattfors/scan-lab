import './styles/main.css';
import Alpine from 'alpinejs';
import PouchDB from 'pouchdb-browser';

// Generate UUID v4 using crypto API for better randomness
function generateUUID(): string {
  return crypto.randomUUID();
}

// Initialize PouchDB
const db = new PouchDB('scan-lab');

// Alpine.js app data
interface Event {
  _id: string;
  eventType: string;
  ts: string;
  data?: string;
}

interface AppData {
  events: Event[];
  pushButton: () => Promise<void>;
  loadEvents: () => Promise<void>;
  init?: () => void;
}

// Keyboard input buffer for scan events
let scanBuffer = '';

// Add document-level keyboard listener
document.addEventListener('keydown', async (event: KeyboardEvent) => {
  // Check if Enter key was pressed
  if (event.key === 'Enter') {
    // If buffer has content, create a scan event
    if (scanBuffer.trim().length > 0) {
      const scanEvent: Event = {
        _id: generateUUID(),
        eventType: 'scan',
        ts: new Date().toISOString(),
        data: scanBuffer
      };
      
      try {
        await db.put(scanEvent);
        // Trigger Alpine to reload events (if Alpine is initialized)
        const appElement = document.querySelector('[x-data="app"]');
        if (appElement && (appElement as any).__x) {
          await (appElement as any).__x.$data.loadEvents();
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
  
  async pushButton(): Promise<void> {
    const event: Event = {
      _id: generateUUID(),
      eventType: 'button_push',
      ts: new Date().toISOString()
    };
    
    try {
      await db.put(event);
      await this.loadEvents();
    } catch (error) {
      console.error('Error inserting event:', error);
    }
  },
  
  async loadEvents(): Promise<void> {
    try {
      const result = await db.allDocs({ include_docs: true, descending: true });
      this.events = result.rows.map((row: any) => row.doc as Event);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  },
  
  init(): void {
    this.loadEvents();
  }
}));

// Start Alpine
Alpine.start();
