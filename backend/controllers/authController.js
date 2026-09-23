const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

const SALT_ROUNDS = 10;

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  waterGoalMl: user.waterGoalMl,
  monthlyBudget: user.monthlyBudget,
  createdAt: user.createdAt,
});

// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  const { name, email, password } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({ name, email, passwordHash });

  const token = signToken(user._id.toString());

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: { user: sanitizeUser(user), token },
  });
});

// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  const token = signToken(user._id.toString());

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    data: { user: sanitizeUser(user), token },
  });
});

// @route   POST /api/auth/logout
// @access  Private
// JWTs are stateless, so "logout" is handled client-side by discarding
// the token. This endpoint exists for a consistent API surface and to
// allow future server-side token blacklisting if needed.
const logout = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { user: sanitizeUser(req.user) } });
});

// @route   PUT /api/auth/me
// @access  Private
const updateMe = asyncHandler(async (req, res) => {
  const { name, waterGoalMl, monthlyBudget } = req.body;

  if (name !== undefined) req.user.name = name;
  if (waterGoalMl !== undefined) req.user.waterGoalMl = waterGoalMl;
  if (monthlyBudget !== undefined) req.user.monthlyBudget = monthlyBudget;

  await req.user.save();

  res.status(200).json({ success: true, message: 'Profile updated', data: { user: sanitizeUser(req.user) } });
});

module.exports = { register, login, logout, getMe, updateMe, sanitizeUser };
