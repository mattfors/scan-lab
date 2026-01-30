import type { ScanEvent } from '../types/event';
import { Chart } from 'chart.js';

// Configuration for rolling statistics charts
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

// Default configuration
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

// Update Rolling Mean Chart
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

// Update Rolling Std Log Chart
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

// Update Delta vs Index Chart
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

// Update all rolling statistics charts
export function updateRollingStatsCharts(events: ScanEvent[], config: RollingStatsConfig = defaultRollingStatsConfig): void {
  updateRollingMeanChart(events, config);
  updateRollingStdLogChart(events, config);
  updateDeltaVsIndexChart(events, config);
}
