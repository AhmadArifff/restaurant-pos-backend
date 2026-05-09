const router = require('express').Router();
const c = require('../controllers/stockRequestController');
const { authenticate, isAdmin } = require('../middleware/auth');

router.post('/',            authenticate, c.submitRequest);
router.delete('/:id',       authenticate, c.deleteRequest);
router.get('/',             authenticate, isAdmin, c.getAllRequests);
router.get('/my',           authenticate, c.getMyRequests);
router.put('/:id/approve',  authenticate, isAdmin, c.approveRequest);
router.put('/:id/resubmit', authenticate, c.resubmitRequest);

module.exports = router;