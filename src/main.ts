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
}

interface AppData {
  events: Event[];
  pushButton: () => Promise<void>;
  loadEvents: () => Promise<void>;
  init?: () => void;
}

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
