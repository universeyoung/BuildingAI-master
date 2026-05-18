import { STORAGE_KEYS } from "@buildingai/constants/web";

/** Default Max-Age so cookies survive refreshes; cleared explicitly on logout. */
const PLUGIN_AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * @returns "; Secure" when the page is served over HTTPS
 */
function secureCookieFlag(): string {
    return typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
}

/**
 * Sets or clears a first-party cookie with Path=/ and SameSite=Lax.
 *
 * @param name - Cookie name
 * @param value - Cookie value; use empty string with maxAgeSeconds 0 to delete
 * @param maxAgeSeconds - Max-Age in seconds
 */
function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
    if (typeof document === "undefined") return;
    const body = maxAgeSeconds === 0 ? `${name}=` : `${name}=${encodeURIComponent(value)}`;
    document.cookie = `${body}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secureCookieFlag()}`;
}

/**
 * Mirrors web auth into cookies for the browser extension.
 * `__user_token__` is the same access token stored in persisted auth state.
 * `__login_time_stamp__` is the client time (ms since epoch) when the token was set.
 *
 * @param token - Access token from login / OAuth / install (same as `auth.token`)
 */
export function setPluginAuthCookies(token: string): void {
    if (!token) return;
    writeCookie(STORAGE_KEYS.USER_TOKEN, token, PLUGIN_AUTH_COOKIE_MAX_AGE_SECONDS);
    writeCookie(
        STORAGE_KEYS.LOGIN_TIME_STAMP,
        Date.now().toString(),
        PLUGIN_AUTH_COOKIE_MAX_AGE_SECONDS,
    );
}

/**
 * Removes extension auth cookies (logout or explicit token clear).
 */
export function clearPluginAuthCookies(): void {
    writeCookie(STORAGE_KEYS.USER_TOKEN, "", 0);
    writeCookie(STORAGE_KEYS.LOGIN_TIME_STAMP, "", 0);
}
