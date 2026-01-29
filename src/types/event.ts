export interface ScanEvent {
  _id: string;
  ts: string;
  data?: string;
  deltaTime?: number; // Time in seconds since previous event
}
