const contactService = require('../services/contact.service');
const logger = require('../utils/logger');

/**
 * POST /identify
 * Body: { email?: string, phoneNumber?: string|number }
 * Always responds 200 on success, per spec, with the consolidated payload.
 */
async function identifyController(req, res, next) {
  try {
    const { email, phoneNumber } = req.body;

    const result = await contactService.identify({ email, phoneNumber });

    logger.info('Identify request resolved', {
      primaryContactId: result.contact.primaryContactId,
    });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { identifyController };
