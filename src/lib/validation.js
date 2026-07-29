import { AppError } from "./http.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requiredString(value, field, { min = 1, max = 1000 } = {}) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized.length < min || normalized.length > max) {
    throw new AppError(
      422,
      "validation_error",
      `${field} deve ter entre ${min} e ${max} caracteres.`,
      { field }
    );
  }
  return normalized;
}

export function optionalString(value, field, { max = 1000 } = {}) {
  if (value === null || value === undefined || value === "") return null;
  return requiredString(String(value), field, { min: 1, max });
}

export function emailAddress(value) {
  const email = requiredString(value, "E-mail", { min: 5, max: 190 })
    .toLowerCase()
    .trim();
  if (!EMAIL_PATTERN.test(email)) {
    throw new AppError(422, "validation_error", "Informe um e-mail válido.", {
      field: "email"
    });
  }
  return email;
}

export function enumValue(value, field, allowed) {
  if (!allowed.includes(value)) {
    throw new AppError(
      422,
      "validation_error",
      `${field} possui um valor inválido.`,
      { field, allowed }
    );
  }
  return value;
}

export function booleanValue(value, fallback = false) {
  if (value === undefined) return fallback;
  return value === true || value === 1 || value === "true";
}

export function arrayValue(value, field, { min = 0, max = 100 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new AppError(
      422,
      "validation_error",
      `${field} deve conter entre ${min} e ${max} itens.`,
      { field }
    );
  }
  return value;
}
