const router = require('express').Router();
const c = require('../controllers/mainStockController');
const { authenticate, isAdmin } = require('../middleware/auth');

router.get('/summary',  authenticate, c.getSummary);
router.get('/daily',    authenticate, c.getDaily);
router.post('/out',           authenticate, c.addManualOut);

router.get('/monthly',  authenticate, isAdmin, c.getMonthly);
router.post('/purchase',authenticate, isAdmin, c.addPurchase);
router.put('/purchase/:id',  authenticate, isAdmin, c.updatePurchase);
router.delete('/purchase/:id',authenticate, isAdmin, c.deletePurchase);

module.exports = router;