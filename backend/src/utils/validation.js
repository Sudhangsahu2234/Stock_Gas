import { parseAmountInr } from "./helpers.js";

const SENSITIVE_KEYS = new Set([
  "password", "secret", "token", "razorpaysignature",
  "razorpay_signature", "authorization", "otp", "otpcode"
]);

const sanitiseBody = (body) => {
  if (!body || typeof body !== "object") return body;
  const sanitised = { ...body };
  for (const key of Object.keys(sanitised)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitised[key] = "[REDACTED]";
    }
  }
  return sanitised;
};

const stripHtml = (str) => {
  if (typeof str !== "string") return str;
  return str.replace(/<[^>]*>/g, "").trim();
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  return EMAIL_REGEX.test(email.trim());
};

const validatePhone = (phone) => {
  if (!phone || typeof phone !== "string") return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
};

const validateOrderPayload = ({
  customerName, phone, cylinderSizeKg, quantity,
  paymentMethod, address, amountInr
}) => {
  const sizeKg = Number(cylinderSizeKg);
  const qty = Number(quantity);
  const parsedAmountInr = parseAmountInr(amountInr);

  if (!customerName || !phone || !cylinderSizeKg || !quantity || !paymentMethod || !address) {
    return { error: "Missing required order fields." };
  }
  if (!validatePhone(phone)) {
    return { error: "Invalid phone number format." };
  }
  if (!Number.isFinite(sizeKg) || sizeKg <= 0) {
    return { error: "Cylinder size must be a valid number." };
  }
  if (!Number.isInteger(qty) || qty <= 0) {
    return { error: "Quantity must be a whole number greater than zero." };
  }
  if (parsedAmountInr !== null && (!Number.isFinite(parsedAmountInr) || parsedAmountInr <= 0)) {
    return { error: "Amount must be a valid number greater than zero." };
  }

  return {
    payload: {
      customerName: stripHtml(customerName).trim(),
      phone: stripHtml(phone).trim(),
      cylinderSizeKg: sizeKg,
      quantity: qty,
      paymentMethod: stripHtml(paymentMethod),
      address: stripHtml(address).trim(),
      amountInr: parsedAmountInr
    }
  };
};

export {
  SENSITIVE_KEYS, sanitiseBody, stripHtml,
  validateEmail, validatePhone, validateOrderPayload
};
