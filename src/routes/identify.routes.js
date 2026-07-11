const express = require('express');
const { identifyController } = require('../controllers/identify.controller');
const { validateIdentifyPayload } = require('../middleware/validateRequest');

const router = express.Router();

router.post('/identify', validateIdentifyPayload, identifyController);

module.exports = router;
