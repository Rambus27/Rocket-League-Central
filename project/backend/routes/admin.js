const express = require('express');
const { getStats, getReports, resolveReport, getAllUsers, setUserRole } = require('../controllers/adminController');
const { ensureAuth, ensureAdmin } = require('../middleware/auth');
const router = express.Router();

router.use(ensureAuth, ensureAdmin);

router.get('/stats', getStats);
router.get('/reports', getReports);
router.post('/reports/:id', resolveReport);
router.get('/users', getAllUsers);
router.post('/users/:id/role', setUserRole);

module.exports = router;
