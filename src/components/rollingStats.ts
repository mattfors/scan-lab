import type { ScanEvent } from '../types/event';
import { Chart } from 'chart.js';

/**
 * Configuration interface for rolling statistics charts.
 * Allows customization of chart titles, axis labels, and min/max values.
 */
export interface RollingStatsConfig {
  scanSpeed: {
    title: string;
    yAxisLabel: string;
    min?: number;
    max?: number;
  };
  acceleration: {
    title: string;
    yAxisLabel: string;
    min?: number;
    max?: number;
  };
  speedVariability: {
    title: string;
    yAxisLabel: string;
    min?: number;
    max?: number;
  };
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
  zDelta: {
    title: string;
    yAxisLabel: string;
    min?: number;
    max?: number;
  };
}

/**
 * Default configuration for rolling statistics charts.
 * - Scan Speed: y-axis from 0 (auto-scaled)
 * - Acceleration: y-axis centered around 0
 * - Speed Variability: y-axis from 0 to 1 (coefficient of variation)
 * - Rolling Std Log: y-axis from -6 to 1
 * - Delta vs Index: y-axis from 0 to 5
 * - Z-Delta: y-axis from -3 to 3
 */
export const defaultRollingStatsConfig: RollingStatsConfig = {
  scanSpeed: {
    title: 'Scan Speed vs Index',
    yAxisLabel: 'Speed (scans/s)',
    min: 0,
    max: 10
  },
  acceleration: {
    title: 'Acceleration vs Index',
    yAxisLabel: 'Δ Speed (scans/s)'
  },
  speedVariability: {
    title: 'Speed Variability vs Index',
    yAxisLabel: 'Coefficient of Variation',
    min: 0,
    max: 1
  },
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
  },
  zDelta: {
    title: 'Z-Delta vs Index',
    yAxisLabel: 'Z-Delta',
    min: -3,
    max: 3
  }
};

let scanSpeedChart: Chart | null = null;
let accelerationChart: Chart | null = null;
let speedVariabilityChart: Chart | null = null;
let rollingMeanChart: Chart | null = null;
let rollingStdLogChart: Chart | null = null;
let deltaVsIndexChart: Chart | null = null;
let zDeltaChart: Chart | null = null;

/**
 * Default color for null or invalid data points.
 */
const DEFAULT_COLOR = 'rgb(128, 128, 128)';

/**
 * Maps a log std value to a color in a gradient from green to red.
 * Values from -1 to -6 map to green -> yellow -> orange -> red.
 * @param value - The log std value
 * @returns RGB color string
 */
function getColorForLogStd(value: number | null): string {
  if (value === null || !isFinite(value)) {
    return DEFAULT_COLOR; // Gray for null/invalid values
  }
  
  // Clamp value to range [-6, -1]
  const clampedValue = Math.max(-6, Math.min(-1, value));
  
  // Normalize to [0, 1] where 0 = -6 (red) and 1 = -1 (green)
  const normalized = (clampedValue + 6) / 5;
  
  let r: number, g: number, b: number;
  
  if (normalized < 0.33) {
    // Red to Orange (0 to 0.33)
    const t = normalized / 0.33;
    r = 255;
    g = Math.round(165 * t); // 0 to 165 (orange)
    b = 0;
  } else if (normalized < 0.67) {
    // Orange to Yellow (0.33 to 0.67)
    const t = (normalized - 0.33) / 0.34;
    r = 255;
    g = Math.round(165 + (255 - 165) * t); // 165 to 255
    b = 0;
  } else {
    // Yellow to Green (0.67 to 1)
    const t = (normalized - 0.67) / 0.33;
    r = Math.round(255 * (1 - t)); // 255 to 0
    g = 255;
    b = 0;
  }
  
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Maps a rolling mean value to a color in a gradient from red to green.
 * Values from low to high map to red -> orange -> yellow -> green.
 * Low values are red, high values are green (inverted from previous version).
 * @param value - The rolling mean value
 * @returns RGB color string
 */
function getColorForRollingMean(value: number | null): string {
  if (value === null || !isFinite(value)) {
    return DEFAULT_COLOR; // Gray for null/invalid values
  }
  
  // Color mapping: red (0.6) -> orange (1.0) -> yellow (1.5) -> green (2.0+)
  // Low values are red, high values are green
  let r: number, g: number, b: number;
  
  if (value < 0.6) {
    // Below threshold, use red
    r = 255;
    g = 0;
    b = 0;
  } else if (value < 1.0) {
    // Red to Orange (0.6 to 1.0)
    const t = (value - 0.6) / 0.4;
    r = 255;
    g = Math.round(165 * t); // 0 to 165 (orange)
    b = 0;
  } else if (value < 1.5) {
    // Orange to Yellow (1.0 to 1.5)
    const t = (value - 1.0) / 0.5;
    r = 255;
    g = Math.round(165 + 90 * t); // 165 to 255 (yellow)
    b = 0;
  } else {
    // Yellow to Green (1.5 to 2.0+)
    const t = Math.min((value - 1.5) / 0.5, 1.0);
    r = Math.round(255 * (1 - t)); // 255 to 0
    g = 255;
    b = 0;
  }
  
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Maps a scan speed value to a color in a gradient from green to red.
 * Values from 0 to 7 map to green -> yellow -> orange -> red.
 * Low values (0) are green, high values (7+) are red.
 * @param value - The scan speed value
 * @returns RGB color string
 */
function getColorForScanSpeed(value: number | null): string {
  if (value === null || !isFinite(value)) {
    return DEFAULT_COLOR; // Gray for null/invalid values
  }
  
  // Clamp value to range [0, 7]
  const clampedValue = Math.max(0, Math.min(7, value));
  
  // Normalize to [0, 1] where 0 = green and 1 = red
  const normalized = clampedValue / 7;
  
  let r: number, g: number, b: number;
  
  if (normalized < 0.33) {
    // Green to Yellow (0 to 0.33)
    const t = normalized / 0.33;
    r = Math.round(255 * t); // 0 to 255
    g = 255;
    b = 0;
  } else if (normalized < 0.67) {
    // Yellow to Orange (0.33 to 0.67)
    const t = (normalized - 0.33) / 0.34;
    r = 255;
    g = Math.round(255 - 90 * t); // 255 to 165 (orange)
    b = 0;
  } else {
    // Orange to Red (0.67 to 1)
    const t = (normalized - 0.67) / 0.33;
    r = 255;
    g = Math.round(165 * (1 - t)); // 165 to 0
    b = 0;
  }
  
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Updates the Scan Speed chart with new data.
 * Creates a new chart if one doesn't exist, otherwise updates the existing chart with new data.
 * Displays scan speed in scans per minute.
 * @param events - Array of scan events in chronological order
 * @param config - Chart configuration including axis limits and labels
 */
export function updateScanSpeedChart(events: ScanEvent[], config: RollingStatsConfig): void {
  const canvas = document.getElementById('scanSpeedChart') as HTMLCanvasElement;
  if (!canvas) {
    return;
  }

  const indices = events.map(e => e.scanIndex ?? 0);
  const speeds = events.map(e => {
    const val = e.scanSpeed ?? 0;
    return isFinite(val) && val > 0 ? val : null;
  });

  // Generate colors for each point based on its value
  const pointColors = speeds.map(val => getColorForScanSpeed(val));

  if (scanSpeedChart) {
    scanSpeedChart.data.labels = indices;
    scanSpeedChart.data.datasets[0].data = speeds;
    // @ts-expect-error - Chart.js types don't fully support dynamic colors per point
    scanSpeedChart.data.datasets[0].pointBackgroundColor = pointColors;
    // @ts-expect-error - Chart.js types don't fully support dynamic colors per point
    scanSpeedChart.data.datasets[0].pointBorderColor = pointColors;
    // @ts-expect-error - Chart.js types don't fully support segment styling
    scanSpeedChart.data.datasets[0].segment = {
      borderColor: (ctx: any) => {
        const p0 = ctx.p0;
        // Use the color of the starting point of the segment
        return p0.parsed && p0.parsed.y !== null ? getColorForScanSpeed(p0.parsed.y) : DEFAULT_COLOR;
      }
    };
    scanSpeedChart.update();
  } else {
    scanSpeedChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: indices,
        datasets: [{
          label: 'Scan Speed',
          data: speeds,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          backgroundColor: 'rgba(128, 128, 128, 0.05)',
          tension: 0.1,
          pointRadius: 3,
          spanGaps: true,
          segment: {
            borderColor: (ctx: any) => {
              const p0 = ctx.p0;
              // Use the color of the starting point of the segment
              return p0.parsed && p0.parsed.y !== null ? getColorForScanSpeed(p0.parsed.y) : DEFAULT_COLOR;
            }
          }
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
            min: config.scanSpeed.min,
            max: config.scanSpeed.max,
            title: {
              display: true,
              text: config.scanSpeed.yAxisLabel
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: config.scanSpeed.title
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
 * Updates the Acceleration chart with new data.
 * Creates a new chart if one doesn't exist, otherwise updates the existing chart with new data.
 * Displays acceleration (change in scan speed).
 * @param events - Array of scan events in chronological order
 * @param config - Chart configuration including axis limits and labels
 */
export function updateAccelerationChart(events: ScanEvent[], config: RollingStatsConfig): void {
  const canvas = document.getElementById('accelerationChart') as HTMLCanvasElement;
  if (!canvas) {
    return;
  }

  const indices = events.map(e => e.scanIndex ?? 0);
  const accelerations = events.map(e => {
    const val = e.acceleration ?? 0;
    return isFinite(val) ? val : null;
  });

  if (accelerationChart) {
    accelerationChart.data.labels = indices;
    accelerationChart.data.datasets[0].data = accelerations;
    accelerationChart.update();
  } else {
    accelerationChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: indices,
        datasets: [{
          label: 'Acceleration',
          data: accelerations,
          borderColor: 'rgb(201, 203, 207)',
          backgroundColor: 'rgba(201, 203, 207, 0.1)',
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
            min: config.acceleration.min,
            max: config.acceleration.max,
            title: {
              display: true,
              text: config.acceleration.yAxisLabel
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: config.acceleration.title
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
 * Updates the Speed Variability chart with new data.
 * Creates a new chart if one doesn't exist, otherwise updates the existing chart with new data.
 * Displays coefficient of variation of speed over rolling window.
 * @param events - Array of scan events in chronological order
 * @param config - Chart configuration including axis limits and labels
 */
export function updateSpeedVariabilityChart(events: ScanEvent[], config: RollingStatsConfig): void {
  const canvas = document.getElementById('speedVariabilityChart') as HTMLCanvasElement;
  if (!canvas) {
    return;
  }

  const indices = events.map(e => e.scanIndex ?? 0);
  const variabilities = events.map(e => {
    const val = e.speedVariability ?? 0;
    return isFinite(val) ? val : null;
  });

  if (speedVariabilityChart) {
    speedVariabilityChart.data.labels = indices;
    speedVariabilityChart.data.datasets[0].data = variabilities;
    speedVariabilityChart.update();
  } else {
    speedVariabilityChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: indices,
        datasets: [{
          label: 'Speed Variability',
          data: variabilities,
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
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
            min: config.speedVariability.min,
            max: config.speedVariability.max,
            title: {
              display: true,
              text: config.speedVariability.yAxisLabel
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: config.speedVariability.title
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

  // Generate colors for each point based on its value
  const pointColors = means.map(val => getColorForRollingMean(val));

  if (rollingMeanChart) {
    rollingMeanChart.data.labels = indices;
    rollingMeanChart.data.datasets[0].data = means;
    // @ts-expect-error - Chart.js types don't fully support dynamic colors per point
    rollingMeanChart.data.datasets[0].pointBackgroundColor = pointColors;
    // @ts-expect-error - Chart.js types don't fully support dynamic colors per point
    rollingMeanChart.data.datasets[0].pointBorderColor = pointColors;
    // @ts-expect-error - Chart.js types don't fully support segment styling
    rollingMeanChart.data.datasets[0].segment = {
      borderColor: (ctx: any) => {
        const p0 = ctx.p0;
        // Use the color of the starting point of the segment
        return p0.parsed && p0.parsed.y !== null ? getColorForRollingMean(p0.parsed.y) : DEFAULT_COLOR;
      }
    };
    rollingMeanChart.update();
  } else {
    rollingMeanChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: indices,
        datasets: [{
          label: 'Rolling Mean',
          data: means,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          backgroundColor: 'rgba(128, 128, 128, 0.05)',
          tension: 0.1,
          pointRadius: 3,
          spanGaps: true,
          segment: {
            borderColor: (ctx: any) => {
              const p0 = ctx.p0;
              // Use the color of the starting point of the segment
              return p0.parsed && p0.parsed.y !== null ? getColorForRollingMean(p0.parsed.y) : DEFAULT_COLOR;
            }
          }
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

  // Generate colors for each point based on its value
  const pointColors = logStds.map(val => getColorForLogStd(val));

  if (rollingStdLogChart) {
    rollingStdLogChart.data.labels = indices;
    rollingStdLogChart.data.datasets[0].data = logStds;
    // @ts-expect-error - Chart.js types don't fully support dynamic colors per point
    rollingStdLogChart.data.datasets[0].pointBackgroundColor = pointColors;
    // @ts-expect-error - Chart.js types don't fully support dynamic colors per point
    rollingStdLogChart.data.datasets[0].pointBorderColor = pointColors;
    // @ts-expect-error - Chart.js types don't fully support segment styling
    rollingStdLogChart.data.datasets[0].segment = {
      borderColor: (ctx: any) => {
        const p0 = ctx.p0;
        // Use the color of the starting point of the segment
        return p0.parsed && p0.parsed.y !== null ? getColorForLogStd(p0.parsed.y) : DEFAULT_COLOR;
      }
    };
    rollingStdLogChart.update();
  } else {
    rollingStdLogChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: indices,
        datasets: [{
          label: 'Log(Rolling Std)',
          data: logStds,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          tension: 0.1,
          pointRadius: 3,
          spanGaps: true,
          segment: {
            borderColor: (ctx: any) => {
              const p0 = ctx.p0;
              // Use the color of the starting point of the segment
              return p0.parsed && p0.parsed.y !== null ? getColorForLogStd(p0.parsed.y) : DEFAULT_COLOR;
            }
          }
        }]
      } as any,
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
 * Updates the Z-Delta chart with new data.
 * Creates a new chart if one doesn't exist, otherwise updates the existing chart with new data.
 * Displays z-score of delta time: (delta - mean) / std.
 * @param events - Array of scan events in chronological order
 * @param config - Chart configuration including axis limits and labels
 */
export function updateZDeltaChart(events: ScanEvent[], config: RollingStatsConfig): void {
  const canvas = document.getElementById('zDeltaChart') as HTMLCanvasElement;
  if (!canvas) {
    return;
  }

  const indices = events.map(e => e.scanIndex ?? 0);
  const zDeltas = events.map(e => {
    const val = e.zDelta ?? 0;
    return isFinite(val) ? val : null;
  });

  if (zDeltaChart) {
    zDeltaChart.data.labels = indices;
    zDeltaChart.data.datasets[0].data = zDeltas;
    zDeltaChart.update();
  } else {
    zDeltaChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: indices,
        datasets: [{
          label: 'Z-Delta',
          data: zDeltas,
          borderColor: 'rgb(153, 102, 255)',
          backgroundColor: 'rgba(153, 102, 255, 0.1)',
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
            min: config.zDelta.min,
            max: config.zDelta.max,
            title: {
              display: true,
              text: config.zDelta.yAxisLabel
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: config.zDelta.title
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
 * Updates all rolling statistics charts.
 * Convenience function that calls all chart update functions with the same data and config.
 * @param events - Array of scan events in chronological order
 * @param config - Chart configuration, defaults to defaultRollingStatsConfig
 */
export function updateRollingStatsCharts(events: ScanEvent[], config: RollingStatsConfig = defaultRollingStatsConfig): void {
  updateScanSpeedChart(events, config);
  updateAccelerationChart(events, config);
  updateSpeedVariabilityChart(events, config);
  updateRollingMeanChart(events, config);
  updateRollingStdLogChart(events, config);
  updateDeltaVsIndexChart(events, config);
  updateZDeltaChart(events, config);
}
