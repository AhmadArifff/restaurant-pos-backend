const router = require('express').Router();
const c = require('../controllers/stockController');
const { authenticate, isAdmin } = require('../middleware/auth');

router.get('/',         authenticate, c.getAll);
router.get('/history',  authenticate, c.getHistory);
router.post('/in',      authenticate, isAdmin, c.stockIn);

module.exports = router;