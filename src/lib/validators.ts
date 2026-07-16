// Shared field-validation constants (REACT.md: validation rules live here, not
// inline in components or hooks). Zod schemas in the logic hooks reference these.

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A wharf pairing code is 8 alphanumeric characters, displayed as XXXX-XXXX.
export const PAIRING_CODE_LEN = 8;
