const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey1234567890';

// Middleware to verify if a valid JWT is provided in headers
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(403).json({ message: 'No authentication token provided.' });
  }

  // Support Bearer Token format
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Failed to authenticate token.' });
    }
    req.user = decoded;
    next();
  });
}

// Middleware to verify if user is an Admin
function isAdmin(req, res, next) {
  if (!req.user || !req.user.role) {
    return res.status(403).json({ message: 'Access denied. Role not found.' });
  }
  
  const role = req.user.role.toLowerCase();
  if (role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin role required.' });
  }
}

// Middleware to verify if user is a Shopkeeper
function isShopkeeper(req, res, next) {
  if (!req.user || !req.user.role) {
    return res.status(403).json({ message: 'Access denied. Role not found.' });
  }

  const role = req.user.role.toLowerCase();
  if (role === 'shopkeeper') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Shopkeeper role required.' });
  }
}

// Middleware to verify if user is either Admin or Shopkeeper
function isAdminOrShopkeeper(req, res, next) {
  if (!req.user || !req.user.role) {
    return res.status(403).json({ message: 'Access denied. Role not found.' });
  }

  const role = req.user.role.toLowerCase();
  if (role === 'admin' || role === 'shopkeeper') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin or Shopkeeper role required.' });
  }
}

module.exports = {
  verifyToken,
  isAdmin,
  isShopkeeper,
  isAdminOrShopkeeper
};
