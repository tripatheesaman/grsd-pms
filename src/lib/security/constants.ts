export const SESSION_COOKIE = "grsd_session";
// Session must be refreshed at least every 4 hours.
export const SESSION_TTL_MS = 1000 * 60 * 60 * 4;
// Absolute maximum persistent login window.
export const SESSION_MAX_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7;
