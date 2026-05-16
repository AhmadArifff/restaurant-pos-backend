const express = require('express');
const router = express.Router();
const geminiAIController = require('../controllers/geminiAIController');
const { authenticate, isAdmin } = require('../middleware/auth');

/**
 * Admin-only AI Chat Routes
 */

// Health check (public)
router.get('/health', geminiAIController.health);

// Send query to AI (admin only)
router.post('/query', authenticate, isAdmin, geminiAIController.query);

module.exports = router;
