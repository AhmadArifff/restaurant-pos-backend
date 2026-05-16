const { processAIQuery } = require('../services/geminiService');

/**
 * POST /api/ai-chat/query
 * Admin sends natural language query, AI processes and returns insight with database data
 */
exports.query = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ message: 'Query message tidak boleh kosong' });
    }

    if (message.length > 500) {
      return res.status(400).json({ message: 'Query terlalu panjang (max 500 karakter)' });
    }

    // Log untuk monitoring
    console.log(`[AI CHAT] User ${req.user.id} (${req.user.email}): ${message}`);

    // Process dengan Gemini AI
    const result = await processAIQuery(message);

    if (!result.success) {
      return res.status(400).json({
        message: 'Gagal memproses query',
        error: result.error,
        response: result.response
      });
    }

    return res.status(200).json({
      success: true,
      response: result.response,
      debug: process.env.NODE_ENV === 'development' ? result.debug : undefined
    });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * GET /api/ai-chat/health
 * Check if Gemini API is accessible
 */
exports.health = async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        status: 'error',
        message: 'GEMINI_API_KEY tidak dikonfigurasi'
      });
    }

    return res.status(200).json({
      status: 'ok',
      message: 'AI Chat service ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
