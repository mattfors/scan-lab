import scanTimelineMarkup from './scanTimeline.template.html';
import type { ScanEvent } from '../types/event';

export interface ScanTimeline {
  bars: { id: string; leftPercent: number; label: string }[];
  blockSizePercent: number;
  durationSeconds: number;
  scanCount: number;
}

export { scanTimelineMarkup };

export function buildScanTimeline(events: ScanEvent[]): ScanTimeline {
  const scanEvents = events
    .slice()
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  const scanCount = scanEvents.length;

  if (scanCount === 0) {
    return {
      bars: [],
      blockSizePercent: 100,
      durationSeconds: 0,
      scanCount
    };
  }

  const timestamps = scanEvents.map((event) => new Date(event.ts).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const durationMs = Math.max(0, maxTime - minTime);
  const durationSeconds = durationMs / 1000;
  const blockSizePercent =
    durationSeconds > 0 ? Math.min(100, (5 / durationSeconds) * 100) : 100;

  const bars = scanEvents.map((event) => {
    const offset = new Date(event.ts).getTime() - minTime;
    const leftPercent = durationMs > 0 ? (offset / durationMs) * 100 : 50;
    return {
      id: event._id,
      leftPercent,
      label: new Date(event.ts).toLocaleTimeString()
    };
  });

  return {
    bars,
    blockSizePercent,
    durationSeconds,
    scanCount
  };
}
