// backend/middleware/demoGuard.js
// Blocks all write operations for demo accounts.
// Must be placed after verifyToken in route middleware chains.
function demoGuard(req, res, next) {
  if (req.user?.is_demo) {
    return res.status(403).json({
      error: 'demo_restricted',
      message: 'Write actions are not available in demo mode.',
    });
  }
  next();
}

module.exports = { demoGuard };
