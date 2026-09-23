const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protects a route by requiring a valid JWT in the Authorization header
 * (format: "Bearer <token>"). On success, attaches req.userId and
 * req.user (without the password hash) to the request.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const message = err.name === 'TokenExpiredError' ? 'Session expired, please log in again' : 'Not authorized, invalid token';
      return res.status(401).json({ success: false, message });
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authorized, user no longer exists' });
    }

    req.userId = user._id.toString();
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { protect };
