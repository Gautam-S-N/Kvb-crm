const express = require('express');
const router = express.Router();
const st = require('../controllers/salesTarget.controller');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');

router.use(authMiddleware);
router.get('/',          st.getTargets);
router.post('/',         authorize('ADMIN', 'EMPLOYEE'), st.createTarget);
router.put('/:id',       authorize('ADMIN', 'EMPLOYEE'), st.updateTarget);
router.delete('/:id',    authorize('ADMIN', 'EMPLOYEE'), st.deleteTarget);
router.post('/refresh',  authorize('ADMIN', 'EMPLOYEE'), st.refreshAttainment);

module.exports = router;
