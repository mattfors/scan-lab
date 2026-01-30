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
}

export interface AppConfig {
  rollingWindow: number; // Window size for rolling statistics (default: 5)
}
