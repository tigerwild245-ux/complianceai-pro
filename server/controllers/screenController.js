const groqService = require('../services/groqService');
const llmService = require('../services/llmService');
const { logger } = require('../utils/logger');

/**
 * Main Screening Handler
 * POST /api/screen
 */
const screenSubject = async (req, res) => {
  // Generate a correlation ID for this specific request cycle
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
  const startTime = Date.now();

  try {
    const { name } = req.body;

    if (!name) {
      logger.warn('Screening attempted without name', { requestId });
      return res.status(400).json({ 
        success: false, 
        error: "Subject name is required" 
      });
    }

    logger.info(`Starting screening workflow`, { requestId });

    // 1. Database/Embedding Search
    const matches = await groqService.search(name);
    
    // 2. Parallel Execution for AI Tasks (Optimization)
    // We run analysis and bio generation in parallel to reduce latency
    const [analysis, bio] = await Promise.all([
      llmService.generateAnalysis(name, matches).catch(err => {
        logger.error('Analysis generation failed', err, { requestId });
        return "Analysis unavailable due to service error.";
      }),
      llmService.generateBio(name, matches).catch(err => {
        logger.error('Bio generation failed', err, { requestId });
        return null; // Return null so frontend knows not to render it
      })
    ]);

    // 3. Compliance Audit
    logger.audit("SCREENING_COMPLETED", name, "SUCCESS", { requestId });

    // 4. Construct Response
    const responsePayload = {
      success: true,
      data: {
        subject: name,
        riskLevel: matches.some(m => m.score >= 90) ? 'CRITICAL' : 'MODERATE',
        matches: matches,
        analysis: analysis,
        bio: bio // <--- FIX: Ensuring this field is passed to client
      },
      meta: {
        requestId,
        latencyMs: Date.now() - startTime
      }
    };

    return res.status(200).json(responsePayload);

  } catch (error) {
    logger.error("Critical error in screening controller", error, { requestId });
    
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      requestId
    });
  }
};

module.exports = { screenSubject };