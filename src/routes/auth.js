const router = require('express').Router();
const { login, getMe, register, getAllUsers, getActiveUsers, logout } =
  require('../controllers/authController');
const { authenticate, isAdmin } = require('../middleware/auth');

router.post('/login',    login);
router.post('/logout',   authenticate, logout);
router.get('/me',        authenticate, getMe);
router.post('/register', authenticate, isAdmin, register);
router.get('/users',     authenticate, isAdmin, getAllUsers);
router.get('/active',    authenticate, isAdmin, getActiveUsers);

module.exports = router;