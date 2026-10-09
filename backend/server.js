require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/authRoutes');
const habitRoutes = require('./routes/habitRoutes');
const todoRoutes = require('./routes/todoRoutes');
const waterRoutes = require('./routes/waterRoutes');
const sleepRoutes = require('./routes/sleepRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();

// --- Database ---
connectDB();

// --- Core middleware ---
const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser tools (curl/Postman with no Origin header) and
      // any origin explicitly whitelisted via CLIENT_ORIGIN.
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Static frontend (serves the plain HTML/CSS/JS client) ---
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'HabitSync API is running', timestamp: new Date().toISOString() });
});

// --- API routes ---
app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/water', waterRoutes);
app.use('/api/sleep', sleepRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);

// --- Fallback: serve index.html for any non-API route (simple client-side routing) ---
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// --- Error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[HabitSync] Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

module.exports = app;
