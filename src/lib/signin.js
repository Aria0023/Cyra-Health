/* Sign-in (owner request 2026-11-12, docs/plans/account-wearables-evidence.md Task 1): she signs in to a Solia Health
   account with Apple, Google, Facebook or a one-time email code. The account lives on Solia Health's server and holds
   only how she signed in, her sign-in email (none for Facebook), her name if the service sent one and when it was made
   (backend/src/modules/accounts). Her health log never goes with it: it stays on this device as before.
   On this device the session lives in the record key `signin` ({ token, id, provider, email, name, createdAt }), which
   is device-only and never part of any backup (lib/record.js DEVICE_ONLY + NOT_IN_BACKUP).

   The REQUIRE switch: VITE_REQUIRE_SIGNIN (build time, default "true"). signinMode() decides what the sign-in step
   offers, from the build and what the server reported:
     "none"      the build has no server (VITE_API_BASE unset) or no signin flag: no account can be made; she continues
                 without one and the step says why
     "checking"  asking the server which sign-ins it has
     "offline"   the server couldn't be reached: Try again (no skip while sign-in is required)
     "unset"     the server reports no sign-in configured: continue without an account, said plainly
     "optional"  the build has VITE_REQUIRE_SIGNIN=false: the providers plus "Continue without an account"
     "required"  at least one sign-in works and the build requires it: the providers, no skip
   Pure: no React, no storage, no network (lib/signinClient.js makes the requests). */

/** The build's switch: anything but "false" (case-insensitive) requires sign-in. */
export const parseRequire = (raw) => String(raw ?? "").trim().toLowerCase() !== "false";
export const REQUIRE_SIGNIN = parseRequire(import.meta.env?.VITE_REQUIRE_SIGNIN);

export const PROVIDERS = Object.freeze([["apple", "Apple"], ["google", "Google"], ["facebook", "Facebook"]]); // Apple first (App Store)
export const PROVIDER_LABEL = Object.freeze({ apple: "Apple", google: "Google", facebook: "Facebook", email: "email" });

/** Whether this build can make accounts at all: the signin flag and a server. */
export const signinInBuild = (f, server) => !!(f && f.signin) && !!server;

/** config: null (not asked yet) | "offline" | { providers: { apple, google, facebook, email } }. */
export function signinMode({ build, server, require = REQUIRE_SIGNIN, config = null } = {}) {
  if (!build || !server) return "none";
  if (config == null) return "checking";
  if (config === "offline") return "offline";
  const p = config.providers || {};
  if (!["apple", "google", "facebook", "email"].some((k) => p[k] === true)) return "unset";
  return require ? "required" : "optional";
}
/** Whether "Continue without an account" is offered in a mode. */
export const canSkip = (mode) => mode === "none" || mode === "unset" || mode === "optional";

/** Whether a record that is already on this device has to sign in once before the app opens (existing users). */
export const gateNeeded = ({ mode, signedIn }) => mode === "required" && !signedIn;

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const TOKEN = /^[A-Za-z0-9_-]{8,560}\.[A-Za-z0-9_-]{43}$/;
/** The device's session ({ token, id, provider, email, name, createdAt }) or null. */
export function cleanSignin(v) {
  if (!v || typeof v !== "object" || !TOKEN.test(String(v.token || ""))) return null;
  const provider = ["apple", "google", "facebook", "email"].includes(v.provider) ? v.provider : null;
  const id = str(v.id, 40);
  if (!provider || !/^[A-Za-z0-9_-]{8,40}$/.test(id)) return null;
  return { token: v.token, id, provider, email: str(v.email, 320), name: str(v.name, 200), createdAt: str(v.createdAt, 40) };
}
/** The server's { token, account } as the device keeps it. */
export const sessionFrom = (r) => cleanSignin(r && r.account ? { token: r.token, ...r.account } : null);

/** "maya@example.com", "Ada (Facebook)" or "your Facebook account": who is signed in, in plain words. */
export function whoLine(s) {
  if (!s) return "";
  const via = PROVIDER_LABEL[s.provider] || "";
  if (s.email) return s.provider === "email" ? s.email : `${s.email} (${via})`;
  if (s.name) return `${s.name} (${via})`;
  return `your ${via} account`;
}

/** First name for the registration's name field, from the account's display name. */
export const firstNameOf = (s) => (s && typeof s.name === "string" ? s.name.trim().split(/\s+/)[0] || "" : "");

export const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
export const isEmailAddress = (v) => { const e = String(v || "").trim().toLowerCase(); return e.length <= 254 && EMAIL_RE.test(e); };
/** A typed code: digits only, at most 6. */
export const cleanCode = (v) => String(v || "").replace(/\D/g, "").slice(0, 6);

export const SIGNIN_COPY = Object.freeze({
  short: "Account",
  title: "Create your account",
  sub: "Sign in so Solia Health knows it's you. Your health log stays on this device.",
  gateTitle: "Sign in to keep going",
  gateSub: "Solia Health now asks everyone to sign in once. Your log stays on this device, and signing in doesn't send it anywhere.",
  continueWith: (label) => `Continue with ${label}`,
  email: "Continue with email",
  connecting: "Opening…",
  notHere: (label) => `${label} sign-in isn't set up on this server yet.`,
  // email
  emailLab: "Your email",
  sendCode: "Send me a code",
  sending: "Sending…",
  codeLab: "6-digit code",
  codeSent: (email) => `We sent a 6-digit code to ${email}. It works once, for 10 minutes.`,
  devCode: "This is a development server: the code is in the server's log, not in an email.",
  verify: "Sign in",
  verifying: "Signing in…",
  otherEmail: "Use a different email",
  resend: "Send a new code",
  errEmail: "Enter an email address, like name@example.com.",
  errCode: "Enter the 6 digits from the email.",
  errWrong: "That code isn't right. Check the email and try again.",
  errExpired: "That code has expired or was used. Send a new code.",
  errLocked: "Too many wrong codes. Send a new code.",
  errBusy: "Too many tries just now. Wait a minute and try again.",
  errSend: "The code couldn't be sent. Try again in a moment.",
  errNetwork: "Solia Health couldn't reach its server. Check your connection and try again.",
  errProvider: "Sign-in didn't finish. Try again, or choose another way.",
  // the skip and why
  skip: "Continue without an account",
  whyNone: "This version of Solia Health has no server, so there's no account to make. Your log stays on this device.",
  whyUnset: "Sign-in isn't set up on this server yet, so you can continue without an account. Your log stays on this device.",
  whyOptional: "Signing in is optional in this version. Your log stays on this device either way.",
  checking: "Checking which sign-ins are available…",
  offline: "Solia Health couldn't reach its server to sign you in. Check your connection and try again.",
  retry: "Try again",
  signedIn: (who) => `Signed in as ${who}.`,
  // what's shared
  sharedLab: "What signing in shares",
  shared: Object.freeze([
    "Solia Health's server keeps your account: how you signed in, your email, your name if the service shares it, and when you made the account. Never your health log.",
    "Apple, Google or Facebook learns that you signed in to Solia Health, and nothing about your health. Apple lets you hide your email; Solia Health then gets a private relay address.",
    "Facebook doesn't say whether an email is confirmed, so a Facebook account keeps your name and no email.",
    "With email, our email provider (Resend) delivers a 6-digit code to your address. The code works once, for 10 minutes.",
    "This device keeps your sign-in in a place that is never part of a backup. Sign out or delete your account any time in You → Account.",
  ]),
  // You → Account
  eyebrow: "Account",
  cardTitle: "Your account",
  cardWho: (who) => `Signed in as ${who}`,
  cardHolds: "Your account holds how you sign in, your email and your name if the service shared it. Your health log stays on this device.",
  signOut: "Sign out",
  signingOut: "Signing out…",
  signedOutToast: "Signed out. Your log stays on this device.",
  deleteAcct: "Delete account",
  deleteQ: "Delete your Solia Health account?",
  deleteBody: "This deletes your account from Solia Health's server: your sign-in email, name and how you signed in. Your health log on this device isn't touched; to erase it too, use Delete everything.",
  deleteBodyRequired: " To keep using Solia Health afterwards, you'll be asked to sign in again, which makes a new account.",
  deleteGo: "Delete my account",
  deleting: "Deleting…",
  deletedToast: "Your account is deleted. Your log is still on this device.",
  cancel: "Cancel",
  errSignOut: "Couldn't reach Solia Health's server, so you're still signed in. Try again when you're online.",
  errDelete: "Couldn't reach Solia Health's server, so the account wasn't deleted. Try again when you're online.",
  noneTitle: "No account",
  noneLine: "You haven't signed in on this device. Your log lives on this device.",
  signInNow: "Sign in",
});
