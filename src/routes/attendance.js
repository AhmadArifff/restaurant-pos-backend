const router = require('express').Router();
const c = require('../controllers/attendanceController');
const { authenticate, isAdmin } = require('../middleware/auth');

router.get('/weekly',      authenticate, isAdmin, c.getWeeklyAttendance);
router.get('/performance', authenticate, isAdmin, c.getStaffPerformance);

module.exports = router;