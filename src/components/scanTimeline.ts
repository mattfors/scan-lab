import scanTimelineMarkup from './scanTimeline.template.html';
import type { ScanEvent } from '../types/event';
import { Chart } from 'chart.js';

export interface ScanTimeline {
  scanCount: number;
  chartData: { timestamp: number; value: number; label: string }[];
}

export { scanTimelineMarkup };

let scanTimelineChart: Chart | null = null;

export function buildScanTimeline(events: ScanEvent[]): ScanTimeline {
  const now = Date.now();
  const ninetySecondsAgo = now - 90000; // 90 seconds in milliseconds

  const scanEvents = events
    .filter((event) => event.eventType === 'scan')
    .filter((event) => new Date(event.ts).getTime() >= ninetySecondsAgo) // Only last 90 seconds
    .slice()
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  const scanCount = scanEvents.length;

  const chartData = scanEvents.map((event) => ({
    timestamp: new Date(event.ts).getTime(),
    value: 1, // Y axis height of 1
    label: new Date(event.ts).toLocaleTimeString()
  }));

  return {
    scanCount,
    chartData
  };
}

export function updateScanTimelineChart(scanTimeline: ScanTimeline): void {
  const canvas = document.getElementById('scanTimelineChart') as HTMLCanvasElement;
  
  if (!canvas) {
    return;
  }

  const now = Date.now();
  const ninetySecondsAgo = now - 90000;

  // Prepare data for Chart.js
  const labels: string[] = [];
  const dataPoints: { x: number; y: number }[] = [];

  // Add all scan events as points
  scanTimeline.chartData.forEach((point) => {
    const secondsAgo = Math.floor((now - point.timestamp) / 1000);
    labels.push(`${secondsAgo}s ago`);
    dataPoints.push({ x: point.timestamp, y: point.value });
  });

  if (scanTimelineChart) {
    // Update existing chart
    scanTimelineChart.data.datasets[0].data = dataPoints;
    scanTimelineChart.options.scales!.x!.min = ninetySecondsAgo;
    scanTimelineChart.options.scales!.x!.max = now;
    scanTimelineChart.update();
  } else {
    // Create new chart
    scanTimelineChart = new Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Scans',
          data: dataPoints,
          backgroundColor: 'rgb(75, 192, 192)',
          borderColor: 'rgb(75, 192, 192)',
          pointRadius: 6,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'linear',
            min: ninetySecondsAgo,
            max: now,
            title: {
              display: true,
              text: 'Time (last 90 seconds)'
            },
            ticks: {
              callback: function(value) {
                const secondsAgo = Math.floor((now - (value as number)) / 1000);
                return `${secondsAgo}s ago`;
              }
            }
          },
          y: {
            min: 0,
            max: 1.5,
            title: {
              display: true,
              text: 'Scan Event'
            },
            ticks: {
              stepSize: 0.5
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const dataPoint = scanTimeline.chartData[context.dataIndex];
                return dataPoint ? dataPoint.label : '';
              }
            }
          }
        }
      }
    });
  }
}
