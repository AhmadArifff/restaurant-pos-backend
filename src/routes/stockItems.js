const router = require('express').Router();
const c      = require('../controllers/stockItemController');
const { authenticate, isAdmin } = require('../middleware/auth');

router.get('/units',     authenticate, c.getUnits);
router.get('/',          authenticate, c.getAll);
router.post('/',         authenticate, isAdmin, c.create);
router.put('/:id',       authenticate, isAdmin, c.update);
router.delete('/:id',    authenticate, isAdmin, c.remove);
router.post('/in',       authenticate, isAdmin, c.stockIn);
router.get('/history',   authenticate, c.getHistory);

module.exports = router;