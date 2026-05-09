const router = require('express').Router();
const c = require('../controllers/categoryController');
const { authenticate, isAdmin } = require('../middleware/auth');

router.get('/',      authenticate, c.getAll);
router.post('/',     authenticate, isAdmin, c.create);
router.delete('/:id', authenticate, isAdmin, c.remove);

module.exports = router;