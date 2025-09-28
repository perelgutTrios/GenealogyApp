// Shim deprecated util._extend to Object.assign to silence dependency warnings
try {
  const util = require('util');
  if (util && typeof util._extend === 'function') {
    util._extend = Object.assign;
  }
} catch {}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const gedcomRoutes = require('./routes/gedcom');
const aiResearchRoutes = require('./routes/aiResearch');

const app = express();

// Configure Express trust proxy setting
// Default: trust local/unique-local networks (good for dev + CRA proxy)
// Override via ENV TRUST_PROXY. Accepted values:
//  - "true" | "false" (booleans)
//  - integer (number of proxy hops)
//  - string (e.g., "loopback" or CIDR/IP)
//  - comma-separated list of strings (e.g., "loopback,linklocal,uniquelocal")
function resolveTrustProxy(envVal) {
  if (envVal === undefined || envVal === null || envVal === '') {
    return ['loopback', 'linklocal', 'uniquelocal'];
  }
  const raw = String(envVal).trim();
  const lower = raw.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (/^\d+$/.test(lower)) return parseInt(lower, 10);
  if (raw.includes(',')) {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  return raw; // single token (e.g., 'loopback' or '127.0.0.1')
}

const trustProxySetting = resolveTrustProxy(process.env.TRUST_PROXY);
app.set('trust proxy', trustProxySetting);
console.log(`Express trust proxy set to:`, trustProxySetting);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/gedcom', gedcomRoutes);
app.use('/api/ai-research', aiResearchRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    message: 'Steve\'s Genealogy API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/genealogy-db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});