export interface ScanEvent {
  _id: string;
  ts: string;
  data?: string;
  deltaTime?: number; // Time in seconds since previous event
  scanIndex?: number; // Index in the scan sequence
  rollingMean?: number; // Rolling mean of delta times
  rollingStd?: number; // Rolling standard deviation of delta times
  coefficientOfVariation?: number; // CV = std / mean
  logMean?: number; // Natural log of rolling mean
  logStd?: number; // Natural log of rolling std
  zDelta?: number; // Z-score of delta time: (delta - mean) / std
  zDeltaPercentileRank?: number; // Percentile rank of zDelta compared to previous zDeltas
  scanSpeed?: number; // Speed in scans per second (1 / deltaTime)
  acceleration?: number; // Change in speed between consecutive events (scans/s)
  speedVariability?: number; // Coefficient of variation of speed over rolling window
}

export interface AppConfig {
  rollingWindow: number; // Window size for rolling statistics (default: 5)
  percentileRankWindow: number; // Window size for percentile rank calculation (default: 30)
}
