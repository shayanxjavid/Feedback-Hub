/**
 * Feedback Hub - Node.js Express API with MongoDB
 * 
 * RESTful API for storing and retrieving user feedback.
 * Integrates with Python sentiment analysis microservice.
 * Uses MongoDB for persistent data storage.
 */

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const SENTIMENT_SERVICE_URL = process.env.SENTIMENT_SERVICE_URL || 'http://localhost:8000';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/feedback-hub';

// Middleware
app.use(cors());
app.use(express.json());

// =============================================================================
// MongoDB Schema & Model
// =============================================================================

const feedbackSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  sentiment: {
    label: {
      type: String,
      enum: ['positive', 'neutral', 'negative', 'unknown'],
      default: 'unknown'
    },
    score: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    }
  }
}, {
  timestamps: true,  // Adds createdAt and updatedAt
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Add text index for search functionality
feedbackSchema.index({ message: 'text', user: 'text' });

const Feedback = mongoose.model('Feedback', feedbackSchema);

// =============================================================================
// Database Connection
// =============================================================================

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calls the Python sentiment analysis microservice
 * @param {string} text - The text to analyze
 * @returns {Promise<{label: string, score: number}>}
 */
async function analyzeSentiment(text) {
  try {
    const response = await fetch(`${SENTIMENT_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error(`Sentiment service returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Sentiment analysis failed:', error.message);
    return {
      label: 'unknown',
      score: 0.5,
      error: 'Sentiment service unavailable'
    };
  }
}

/**
 * Validates feedback input
 * @param {object} body - Request body
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateFeedback(body) {
  const errors = [];
  
  if (!body.text || typeof body.text !== 'string' || body.text.trim() === '') {
    errors.push('Field "text" is required and must be a non-empty string');
  }
  
  if (!body.user || typeof body.user !== 'string' || body.user.trim() === '') {
    errors.push('Field "user" is required and must be a non-empty string');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// =============================================================================
// API Routes
// =============================================================================

/**
 * Health check endpoint
 * GET /health
 */
app.get('/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.json({
    status: 'healthy',
    service: 'feedback-api',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

/**
 * Get all feedback entries
 * GET /api/feedback
 * 
 * Query params:
 *   - limit: number of items to return (default: 50)
 *   - offset: pagination offset (default: 0)
 *   - sentiment: filter by sentiment label (positive, neutral, negative)
 *   - user: filter by user name
 *   - search: text search in message
 *   - sort: field to sort by (default: -createdAt)
 */
app.get('/api/feedback', async (req, res) => {
  try {
    const { 
      sentiment, 
      user,
      search,
      limit = 50, 
      offset = 0,
      sort = '-createdAt'
    } = req.query;

    // Build query
    const query = {};
    
    if (sentiment) {
      query['sentiment.label'] = sentiment;
    }
    
    if (user) {
      query.user = new RegExp(user, 'i');  // Case-insensitive search
    }
    
    if (search) {
      query.$text = { $search: search };
    }

    // Execute query with pagination
    const [results, total] = await Promise.all([
      Feedback.find(query)
        .sort(sort)
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .lean(),
      Feedback.countDocuments(query)
    ]);

    // Transform results
    const data = results.map(doc => ({
      id: doc._id,
      user: doc.user,
      message: doc.message,
      sentiment: doc.sentiment,
      createdAt: doc.createdAt
    }));

    res.json({
      data,
      meta: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + data.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch feedback'
    });
  }
});

/**
 * Get single feedback entry by ID
 * GET /api/feedback/:id
 */
app.get('/api/feedback/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid feedback ID format'
      });
    }

    const feedback = await Feedback.findById(id);

    if (!feedback) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Feedback with id ${id} not found`
      });
    }

    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch feedback'
    });
  }
});

/**
 * Create new feedback entry
 * POST /api/feedback
 * 
 * Request body:
 *   - text: string (required) - The feedback message
 *   - user: string (required) - The user's name
 */
app.post('/api/feedback', async (req, res) => {
  // Validate input
  const validation = validateFeedback(req.body);
  
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Validation Error',
      messages: validation.errors
    });
  }

  const { text, user } = req.body;

  try {
    // Call Python sentiment analysis service
    console.log(`📤 Sending text to sentiment service: "${text.substring(0, 50)}..."`);
    const sentimentResult = await analyzeSentiment(text);
    console.log(`📥 Received sentiment: ${sentimentResult.label} (${sentimentResult.score})`);

    // Create and save feedback document
    const feedback = new Feedback({
      user: user.trim(),
      message: text.trim(),
      sentiment: {
        label: sentimentResult.label,
        score: sentimentResult.score
      }
    });

    await feedback.save();

    // Return created feedback
    res.status(201).json(feedback);
  } catch (error) {
    console.error('Error creating feedback:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create feedback'
    });
  }
});

/**
 * Update feedback entry
 * PUT /api/feedback/:id
 */
app.put('/api/feedback/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, user } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid feedback ID format'
      });
    }

    const updateData = {};
    
    if (text) {
      updateData.message = text.trim();
      // Re-analyze sentiment if message changed
      const sentimentResult = await analyzeSentiment(text);
      updateData.sentiment = {
        label: sentimentResult.label,
        score: sentimentResult.score
      };
    }
    
    if (user) {
      updateData.user = user.trim();
    }

    const feedback = await Feedback.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!feedback) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Feedback with id ${id} not found`
      });
    }

    res.json(feedback);
  } catch (error) {
    console.error('Error updating feedback:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update feedback'
    });
  }
});

/**
 * Delete feedback entry
 * DELETE /api/feedback/:id
 */
app.delete('/api/feedback/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid feedback ID format'
      });
    }

    const feedback = await Feedback.findByIdAndDelete(id);

    if (!feedback) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Feedback with id ${id} not found`
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete feedback'
    });
  }
});

/**
 * Get sentiment statistics
 * GET /api/stats
 */
app.get('/api/stats', async (req, res) => {
  try {
    const [total, sentimentStats, avgScore] = await Promise.all([
      Feedback.countDocuments(),
      Feedback.aggregate([
        {
          $group: {
            _id: '$sentiment.label',
            count: { $sum: 1 }
          }
        }
      ]),
      Feedback.aggregate([
        {
          $group: {
            _id: null,
            averageScore: { $avg: '$sentiment.score' }
          }
        }
      ])
    ]);

    // Build stats object
    const byLabel = {
      positive: 0,
      neutral: 0,
      negative: 0,
      unknown: 0
    };

    sentimentStats.forEach(stat => {
      if (byLabel.hasOwnProperty(stat._id)) {
        byLabel[stat._id] = stat.count;
      }
    });

    res.json({
      total,
      byLabel,
      averageScore: avgScore[0]?.averageScore 
        ? Math.round(avgScore[0].averageScore * 100) / 100 
        : 0
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get statistics'
    });
  }
});

/**
 * Get feedback by user
 * GET /api/users/:username/feedback
 */
app.get('/api/users/:username/feedback', async (req, res) => {
  try {
    const { username } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const query = { user: new RegExp(`^${username}$`, 'i') };

    const [results, total] = await Promise.all([
      Feedback.find(query)
        .sort('-createdAt')
        .skip(parseInt(offset))
        .limit(parseInt(limit)),
      Feedback.countDocuments(query)
    ]);

    res.json({
      data: results,
      meta: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching user feedback:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user feedback'
    });
  }
});

// =============================================================================
// Error Handling
// =============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

// =============================================================================
// Start Server
// =============================================================================

async function startServer() {
  // Connect to MongoDB first
  await connectDB();
  
  // Start Express server
  app.listen(PORT, () => {
    console.log('═'.repeat(50));
    console.log('🚀 Feedback Hub API Server (MongoDB Edition)');
    console.log('═'.repeat(50));
    console.log(`📍 Server running at: http://localhost:${PORT}`);
    console.log(`🔗 Sentiment service: ${SENTIMENT_SERVICE_URL}`);
    console.log(`🗄️  MongoDB: ${MONGODB_URI}`);
    console.log('═'.repeat(50));
    console.log('Available endpoints:');
    console.log('  GET    /health               - Health check');
    console.log('  GET    /api/feedback         - List all feedback');
    console.log('  GET    /api/feedback/:id     - Get feedback by ID');
    console.log('  POST   /api/feedback         - Create new feedback');
    console.log('  PUT    /api/feedback/:id     - Update feedback');
    console.log('  DELETE /api/feedback/:id     - Delete feedback');
    console.log('  GET    /api/stats            - Get statistics');
    console.log('  GET    /api/users/:user/feedback - Get user feedback');
    console.log('═'.repeat(50));
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await mongoose.connection.close();
  process.exit(0);
});

startServer();

module.exports = app;
