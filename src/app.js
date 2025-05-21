const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const authController = require('./controllers/auth-controller');
const { authenticateJWT } = require('./middleware/auth-middleware');

// Logging and monitoring
const logger = require('./utils/logger');
const morganMiddleware = require('./middleware/morgan-middleware');

// Security middlewares
const rateLimiter = require('./middleware/rate-limit');
const ErrorHandler = require('./middleware/error-handler');

// Load environment variables
dotenv.config({ 
  path: process.env.NODE_ENV 
    ? `.env.${process.env.NODE_ENV}` 
    : '.env' 
});

// Import routes
const integrationController = require('./controllers/integration-controller');
const testIntegrationController = require('./controllers/test-integration-controller');
const mockEBSController = require('./controllers/mock-ebs-controller');
const externalIntegrationController = require('./controllers/external-integration-controller');

// Create Express app
const app = express();

// Advanced Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:']
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CORS Configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Performance Middleware
app.use(compression());

// Add cookie parsing middleware
app.use(cookieParser());

// Parsing Middleware
app.use(express.json({
  limit: '10kb',  // Limit payload size
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Logging Middleware
app.use(morganMiddleware);

// Apply authentication middleware to all routes
app.use(authenticateJWT);

// Rate Limiting
app.use('/api/', rateLimiter.apiLimiter);
app.use('/api/v1/integration/', rateLimiter.integrationLimiter);
app.use('/auth/', rateLimiter.authLimiter);

// Static file serving
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
}));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Mock EBS API routes - add this BEFORE your normal routes
if (process.env.USE_MOCK_EBS === 'true') {
  app.use('/ebs-api', mockEBSController);
  app.use('/mock-ebs', mockEBSController);
  logger.info('Mock EBS API routes enabled at /ebs-api and /mock-ebs');
}

// Routes
app.use('/test-integration', testIntegrationController);
app.use('/integration', integrationController);
app.use('/auth', authController);
app.use('/api/v1/integration', externalIntegrationController);

// Home route
app.get('/', (req, res) => {
  res.render('index', { 
    title: 'P6-EBS Integration Portal',
    environment: process.env.NODE_ENV,
    user: req.user 
  });
});

// 404 Handler
app.use(ErrorHandler.handle404);

// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const errorDetails = process.env.NODE_ENV === 'development' ? err : {};
  
  res.status(status);
  res.render('error', {
    message: err.message || 'An error occurred',
    error: errorDetails,
    user: req.user
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  app.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start the server
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
});

module.exports = server;