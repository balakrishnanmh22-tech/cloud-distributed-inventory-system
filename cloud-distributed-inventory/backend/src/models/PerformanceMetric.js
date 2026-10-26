import mongoose from 'mongoose';

const performanceMetricSchema = new mongoose.Schema({
  testId: {
    type: String,
    required: true,
    unique: true,
  },
  testName: {
    type: String,
    required: true,
  },
  backendReplicas: {
    type: Number,
    required: true,
    default: 1,
  },
  totalRequests: {
    type: Number,
    required: true,
  },
  successfulRequests: {
    type: Number,
    required: true,
  },
  failedRequests: {
    type: Number,
    default: 0,
  },
  concurrency: {
    type: Number,
    default: 10,
  },
  rps: {
    type: Number,
    required: true,
  },
  avgLatencyMs: {
    type: Number,
    required: true,
  },
  p95LatencyMs: {
    type: Number,
    required: true,
  },
  p99LatencyMs: {
    type: Number,
    default: 0,
  },
  errorRate: {
    type: Number,
    default: 0,
  },
  durationSeconds: {
    type: Number,
    required: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
});

export const PerformanceMetric = mongoose.model('PerformanceMetric', performanceMetricSchema);
