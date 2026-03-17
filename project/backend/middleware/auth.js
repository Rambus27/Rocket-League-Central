function ensureAuth(req, res, next) {
  if (req.user) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

function ensureAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Admin access required' });
}

module.exports = { ensureAuth, ensureAdmin };

