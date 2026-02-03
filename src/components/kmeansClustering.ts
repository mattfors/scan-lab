import type { ScanEvent } from '../types/event';
import { Chart } from 'chart.js';

/**
 * Represents a cluster from k-means clustering
 */
export interface Cluster {
  centroid: number;
  points: number[];
  mean: number;
  std: number;
}

/**
 * Result of k-means clustering with k=2
 */
export interface KMeansResult {
  clusters: [Cluster, Cluster];
  converged: boolean;
  iterations: number;
}

let gaussianChart: Chart | null = null;

/**
 * Simple k-means clustering implementation for 1D data with k=2
 * @param data - Array of numeric values to cluster
 * @param maxIterations - Maximum number of iterations (default: 100)
 * @returns KMeansResult with two clusters
 */
export function kMeansClustering(data: number[], maxIterations: number = 100): KMeansResult {
  if (data.length === 0) {
    return {
      clusters: [
        { centroid: 0, points: [], mean: 0, std: 0 },
        { centroid: 0, points: [], mean: 0, std: 0 }
      ],
      converged: false,
      iterations: 0
    };
  }

  // Initialize centroids: use min and max values as starting points
  const sortedData = [...data].sort((a, b) => a - b);
  let centroid1 = sortedData[Math.floor(sortedData.length * 0.25)];
  let centroid2 = sortedData[Math.floor(sortedData.length * 0.75)];

  let converged = false;
  let iterations = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations++;

    // Assign points to nearest centroid
    let [cluster1Points, cluster2Points] = assignPointsToClusters(data, centroid1, centroid2);

    // Handle edge case where one cluster is empty
    if (cluster1Points.length === 0 || cluster2Points.length === 0) {
      // If one cluster is empty, split the data at median
      const median = sortedData[Math.floor(sortedData.length / 2)];
      cluster1Points = [];
      cluster2Points = [];

      for (const point of data) {
        if (point < median) {
          cluster1Points.push(point);
        } else {
          cluster2Points.push(point);
        }
      }
    }

    // Calculate new centroids using calculateMean
    const newCentroid1 = cluster1Points.length > 0
      ? calculateMean(cluster1Points)
      : centroid1;
    const newCentroid2 = cluster2Points.length > 0
      ? calculateMean(cluster2Points)
      : centroid2;

    // Check for convergence
    const tolerance = 1e-6;
    if (Math.abs(newCentroid1 - centroid1) < tolerance &&
        Math.abs(newCentroid2 - centroid2) < tolerance) {
      converged = true;
      centroid1 = newCentroid1;
      centroid2 = newCentroid2;
      break;
    }

    centroid1 = newCentroid1;
    centroid2 = newCentroid2;
  }

  // Calculate final cluster statistics
  const [cluster1Points, cluster2Points] = assignPointsToClusters(data, centroid1, centroid2);

  const cluster1: Cluster = {
    centroid: centroid1,
    points: cluster1Points,
    mean: calculateMean(cluster1Points),
    std: calculateStd(cluster1Points)
  };

  const cluster2: Cluster = {
    centroid: centroid2,
    points: cluster2Points,
    mean: calculateMean(cluster2Points),
    std: calculateStd(cluster2Points)
  };

  return {
    clusters: [cluster1, cluster2],
    converged,
    iterations
  };
}

/**
 * Calculate mean of array
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate standard deviation of array
 */
function calculateStd(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = calculateMean(squaredDiffs);
  return Math.sqrt(variance);
}

/**
 * Assign points to nearest centroid
 * @param data - Array of data points
 * @param centroid1 - First centroid
 * @param centroid2 - Second centroid
 * @returns Tuple of [cluster1Points, cluster2Points]
 */
function assignPointsToClusters(
  data: number[],
  centroid1: number,
  centroid2: number
): [number[], number[]] {
  const cluster1Points: number[] = [];
  const cluster2Points: number[] = [];

  for (const point of data) {
    const dist1 = Math.abs(point - centroid1);
    const dist2 = Math.abs(point - centroid2);

    if (dist1 < dist2) {
      cluster1Points.push(point);
    } else {
      cluster2Points.push(point);
    }
  }

  return [cluster1Points, cluster2Points];
}

/**
 * Calculate Gaussian probability density function
 * @param x - Input value
 * @param mean - Mean of the distribution
 * @param std - Standard deviation of the distribution
 * @returns Probability density at x
 */
function gaussianPDF(x: number, mean: number, std: number): number {
  if (std === 0) return 0;
  const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(std, 2));
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
}

/**
 * Generate Gaussian curve data for a given cluster
 * @param cluster - Cluster with mean and std
 * @param minX - Minimum x value for curve
 * @param maxX - Maximum x value for curve
 * @param points - Number of points to generate
 * @returns Array of {x, y} points for the Gaussian curve
 */
function generateGaussianCurve(
  cluster: Cluster,
  minX: number,
  maxX: number,
  points: number = 200
): Array<{ x: number; y: number }> {
  const step = (maxX - minX) / (points - 1);
  const curve: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < points; i++) {
    const x = minX + i * step;
    const y = gaussianPDF(x, cluster.mean, cluster.std);
    curve.push({ x, y });
  }

  return curve;
}

/**
 * Updates or creates the Gaussian curves chart showing the two clusters
 * @param kmeansResult - Result from k-means clustering
 * @param allDeltaTimes - All delta time values for determining x-axis range
 */
export function updateGaussianCurvesChart(kmeansResult: KMeansResult, allDeltaTimes: number[]): void {
  const canvas = document.getElementById('gaussianCurvesChart') as HTMLCanvasElement;
  if (!canvas) {
    return;
  }

  // Determine x-axis range from data
  const validDeltas = allDeltaTimes.filter(d => d > 0);
  if (validDeltas.length === 0) {
    return;
  }

  const minX = Math.min(...validDeltas);
  const maxX = Math.max(...validDeltas);
  const range = maxX - minX;
  const paddedMinX = Math.max(0, minX - range * 0.1);
  const paddedMaxX = maxX + range * 0.1;

  // Generate Gaussian curves for both clusters
  const cluster1Curve = generateGaussianCurve(kmeansResult.clusters[0], paddedMinX, paddedMaxX);
  const cluster2Curve = generateGaussianCurve(kmeansResult.clusters[1], paddedMinX, paddedMaxX);

  if (gaussianChart) {
    // Update existing chart
    gaussianChart.data.datasets[0].data = cluster1Curve;
    gaussianChart.data.datasets[1].data = cluster2Curve;
    // Update labels with current cluster statistics
    gaussianChart.data.datasets[0].label = `Cluster 1 (μ=${kmeansResult.clusters[0].mean.toFixed(3)}s, σ=${kmeansResult.clusters[0].std.toFixed(3)}s, n=${kmeansResult.clusters[0].points.length})`;
    gaussianChart.data.datasets[1].label = `Cluster 2 (μ=${kmeansResult.clusters[1].mean.toFixed(3)}s, σ=${kmeansResult.clusters[1].std.toFixed(3)}s, n=${kmeansResult.clusters[1].points.length})`;
    gaussianChart.update();
  } else {
    // Create new chart
    gaussianChart = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: `Cluster 1 (μ=${kmeansResult.clusters[0].mean.toFixed(3)}s, σ=${kmeansResult.clusters[0].std.toFixed(3)}s, n=${kmeansResult.clusters[0].points.length})`,
            data: cluster1Curve,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            fill: true
          },
          {
            label: `Cluster 2 (μ=${kmeansResult.clusters[1].mean.toFixed(3)}s, σ=${kmeansResult.clusters[1].std.toFixed(3)}s, n=${kmeansResult.clusters[1].points.length})`,
            data: cluster2Curve,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        scales: {
          x: {
            type: 'linear',
            title: {
              display: true,
              text: 'Delta Time (seconds)'
            },
            min: paddedMinX,
            max: paddedMaxX
          },
          y: {
            title: {
              display: true,
              text: 'Probability Density'
            },
            beginAtZero: true
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'K-Means Clustering (k=2) - Gaussian Distributions',
            font: {
              size: 16
            }
          },
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.dataset.label || '';
                const x = (context.parsed.x as number).toFixed(3);
                const y = (context.parsed.y as number).toFixed(6);
                return `${label}: x=${x}s, density=${y}`;
              }
            }
          }
        }
      }
    });
  }
}

/**
 * Perform k-means clustering on scan event delta times and update the Gaussian curves chart
 * @param events - Array of scan events in chronological order
 */
export function performKMeansAndUpdateChart(events: ScanEvent[]): void {
  // Extract delta times, excluding first event and any invalid values
  const deltaTimes = events
    .filter(e => e.deltaTime !== undefined && e.deltaTime > 0)
    .map(e => e.deltaTime!);

  if (deltaTimes.length < 2) {
    console.log('Not enough data points for k-means clustering (need at least 2)');
    return;
  }

  // Perform k-means clustering
  const kmeansResult = kMeansClustering(deltaTimes);

  console.log('K-means clustering results:', {
    converged: kmeansResult.converged,
    iterations: kmeansResult.iterations,
    cluster1: {
      mean: kmeansResult.clusters[0].mean,
      std: kmeansResult.clusters[0].std,
      count: kmeansResult.clusters[0].points.length
    },
    cluster2: {
      mean: kmeansResult.clusters[1].mean,
      std: kmeansResult.clusters[1].std,
      count: kmeansResult.clusters[1].points.length
    }
  });

  // Update the Gaussian curves chart
  updateGaussianCurvesChart(kmeansResult, deltaTimes);
}
