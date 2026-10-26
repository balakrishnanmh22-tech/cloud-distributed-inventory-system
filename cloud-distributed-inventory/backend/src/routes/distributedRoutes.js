import express from 'express';
import {
  getFragmentation,
  getVerticalFragmentation,
  getReplication,
  getDatabaseHealth,
  getPerformance,
  runCapExperiment,
  runConcurrencyTest,
  runBenchmark,
} from '../controllers/distributedController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/fragmentation', getFragmentation);
router.get('/vertical-fragmentation', getVerticalFragmentation);
router.get('/replication', getReplication);
router.get('/database-health', getDatabaseHealth);
router.get('/performance', getPerformance);

// Interactive Distributed Experiments
router.post('/run-cap-experiment', authenticate, runCapExperiment);
router.post('/run-concurrency-test', authenticate, runConcurrencyTest);
router.post('/run-benchmark', authenticate, runBenchmark);

export default router;
