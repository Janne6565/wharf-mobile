// No-op on Node/web, where `btoa`/`atob` already exist as globals (the crypto
// `base64.ts` relies on them). The `.native.ts` sibling installs a pure-JS
// implementation for Hermes, which ships neither. Imported for side effect at
// the app root.
export {};
