const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const identifyRoutes = require('./routes/identify.routes');
const healthRoutes = require('./routes/health.routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

// --- Security & parsing middleware ---------------------------------------
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' })); // small limit: this endpoint's payload is tiny

// Basic operational logging (skip noisy body dumps).
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// Rate limiting — "covert optimization" bonus: keeps repeated-request abuse
// (or an accidental retry storm) from hammering the DB.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});
app.use(limiter);

// --- Routes ----------------------------------------------------------------
app.use('/', healthRoutes);
app.use('/', identifyRoutes);

// --- 404 + centralized error handling --------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
