import express from 'express';
import { login, getProfile } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', authenticate, getProfile);

export default router;
