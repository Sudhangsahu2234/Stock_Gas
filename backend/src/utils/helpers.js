const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const normalizePhoneDigits = (value = "") => value.replace(/\D/g, "");

const parseAmountInr = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export { makeId, asyncHandler, normalizePhoneDigits, parseAmountInr };
