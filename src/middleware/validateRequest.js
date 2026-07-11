const { z } = require('zod');
const { ValidationError } = require('../utils/errors');

/**
 * At least one of email / phoneNumber must be present, and if present,
 * must be a non-empty string/number. phoneNumber is accepted as a string
 * or number (Doc might send either) and normalized to a string.
 */
const identifySchema = z
  .object({
    email: z.string().trim().email().nullish(),
    phoneNumber: z
      .union([z.string(), z.number()])
      .transform((val) => String(val).trim())
      .nullish(),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.phoneNumber), {
    message: 'At least one of "email" or "phoneNumber" is required',
  });

function validateIdentifyPayload(req, res, next) {
  const result = identifySchema.safeParse(req.body);

  if (!result.success) {
    const message = result.error.errors.map((e) => e.message).join('; ');
    return next(new ValidationError(message));
  }

  // Normalize: undefined -> null, keep validated/coerced values on req.body
  req.body = {
    email: result.data.email ?? null,
    phoneNumber: result.data.phoneNumber ?? null,
  };

  next();
}

module.exports = { validateIdentifyPayload };
