const express = require('express');
const router = express.Router();
const dr = require('../controllers/dailyReport.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

router.use(authMiddleware);
router.get('/today',  dr.getTodayStats);
router.get('/',       dr.getDailyReports);
router.post('/',      dr.createDailyReport);
router.get('/:id',    dr.getDailyReportById);

module.exports = router;
