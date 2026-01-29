import Alpine from 'alpinejs';
import PouchDB from 'pouchdb-browser';

// Generate UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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
