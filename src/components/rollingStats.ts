import type { ScanEvent } from '../types/event';
import { Chart } from 'chart.js';

/**
 * Configuration interface for rolling statistics charts.
 * Allows customization of chart titles, axis labels, and min/max values.
 */
export interface RollingStatsConfig {
  rollingMean: {
    title: string;
    yAxisLabel: string;
    min?: number;
    max?: number;
  };
  rollingStdLog: {
    title: string;
    yAxisLabel: string;
    min?: number;
    max?: number;
  };
  deltaVsIndex: {
    title: string;
    yAxisLabel: string;
    min?: number;
    max?: number;
  };
}

/**
 * Default configuration for rolling statistics charts.
 * - Rolling Std Log: y-axis from -6 to 1
 * - Delta vs Index: y-axis from 0 to 5
 */
export const defaultRollingStatsConfig: RollingStatsConfig = {
  rollingMean: {
    title: 'Rolling Mean vs Index',
    yAxisLabel: 'Rolling Mean (s)',
    min: 0
  },
  rollingStdLog: {
    title: 'Rolling Std Log vs Index',
    yAxisLabel: 'Log(Rolling Std)',
    min: -6,
    max: 1
  },
  deltaVsIndex: {
    title: 'Delta vs Index',
    yAxisLabel: 'Delta Time (s)',
    min: 0,
    max: 5
  }
};

let rollingMeanChart: Chart | null = null;
let rollingStdLogChart: Chart | null = null;
let deltaVsIndexChart: Chart | null = null;

/**
 * Updates the Rolling Mean chart with new data.
 * Creates a new chart if one doesn't exist, otherwise updates the existing chart with new data.
 * @param events - Array of scan events in chronological order
 * @param config - Chart configuration including axis limits and labels
 */
export function updateRollingMeanChart(events: ScanEvent[], config: RollingStatsConfig): void {
  const canvas = document.getElementById('rollingMeanChart') as HTMLCanvasElement;
  if (!canvas) {
    return;
  }

  const indices = events.map(e => e.scanIndex ?? 0);
  const means = events.map(e => e.rollingMean ?? 0);

  if (rollingMeanChart) {
    rollingMeanChart.data.labels = indices;
    rollingMeanChart.data.datasets[0].data = means;
    rollingMeanChart.update();
  } else {
    rollingMeanChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: indices,
        datasets: [{
          label: 'Rolling Mean',
          data: means,
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
          tension: 0.1,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.5,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Scan Index'
            }
          },
          y: {
            min: config.rollingMean.min,
            max: config.rollingMean.max,
            title: {
              display: true,
              text: config.rollingMean.yAxisLabel
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: config.rollingMean.title
          },
          legend: {
            display: false
          }
        }
      }
    });
  }
}

/**
 * Updates the Rolling Std Log chart with new data.
 * Creates a new chart if one doesn't exist, otherwise updates the existing chart with new data.
 * Displays log of rolling standard deviation values, filtering out non-finite values.
 * @param events - Array of scan events in chronological order
 * @param config - Chart configuration including axis limits and labels
 */
export function updateRollingStdLogChart(events: ScanEvent[], config: RollingStatsConfig): void {
  const canvas = document.getElementById('rollingStdLogChart') as HTMLCanvasElement;
  if (!canvas) {
    return;
  }

  const indices = events.map(e => e.scanIndex ?? 0);
  const logStds = events.map(e => {
    const val = e.logStd ?? -Infinity;
    return isFinite(val) ? val : null;
  });

  if (rollingStdLogChart) {
    rollingStdLogChart.data.labels = indices;
    rollingStdLogChart.data.datasets[0].data = logStds;
    rollingStdLogChart.update();
  } else {
    rollingStdLogChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: indices,
        datasets: [{
          label: 'Log(Rolling Std)',
          data: logStds,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          tension: 0.1,
          pointRadius: 2,
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.5,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Scan Index'
            }
          },
          y: {
            min: config.rollingStdLog.min,
            max: config.rollingStdLog.max,
            title: {
              display: true,
              text: config.rollingStdLog.yAxisLabel
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: config.rollingStdLog.title
          },
          legend: {
            display: false
          }
        }
      }
    });
  }
}

/**
 * Updates the Delta vs Index chart with new data.
 * Creates a new chart if one doesn't exist, otherwise updates the existing chart with new data.
 * Displays delta time between consecutive scans.
 * @param events - Array of scan events in chronological order
 * @param config - Chart configuration including axis limits and labels
 */
export function updateDeltaVsIndexChart(events: ScanEvent[], config: RollingStatsConfig): void {
  const canvas = document.getElementById('deltaVsIndexChart') as HTMLCanvasElement;
  if (!canvas) {
    return;
  }

  const indices = events.map(e => e.scanIndex ?? 0);
  const deltas = events.map(e => e.deltaTime ?? 0);

  if (deltaVsIndexChart) {
    deltaVsIndexChart.data.labels = indices;
    deltaVsIndexChart.data.datasets[0].data = deltas;
    deltaVsIndexChart.update();
  } else {
    deltaVsIndexChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: indices,
        datasets: [{
          label: 'Delta Time',
          data: deltas,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          tension: 0.1,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.5,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Scan Index'
            }
          },
          y: {
            min: config.deltaVsIndex.min,
            max: config.deltaVsIndex.max,
            title: {
              display: true,
              text: config.deltaVsIndex.yAxisLabel
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: config.deltaVsIndex.title
          },
          legend: {
            display: false
          }
        }
      }
    });
  }
}

/**
 * Updates all rolling statistics charts (Rolling Mean, Rolling Std Log, and Delta vs Index).
 * Convenience function that calls all three chart update functions with the same data and config.
 * @param events - Array of scan events in chronological order
 * @param config - Chart configuration, defaults to defaultRollingStatsConfig
 */
export function updateRollingStatsCharts(events: ScanEvent[], config: RollingStatsConfig = defaultRollingStatsConfig): void {
  updateRollingMeanChart(events, config);
  updateRollingStdLogChart(events, config);
  updateDeltaVsIndexChart(events, config);
}
