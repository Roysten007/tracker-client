import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";

const EMAIL_KEY = "sprint-client:auth-email";

// UX-level gate only — the real boundary is the Firestore security rule, which
// rejects any uid/email that isn't the owner regardless of what the client sends.
export function isAllowedEmail(email: string): boolean {
  const allowed = import.meta.env.VITE_ALLOWED_EMAIL;
  if (!allowed) return true; // not configured: don't lock out the owner by mistake
  return email.trim().toLowerCase() === allowed.trim().toLowerCase();
}

// undefined = still checking session, null = signed out, User = signed in
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;
    return onAuthStateChanged(getFirebaseAuth(), setUser);
  }, []);

  return user;
}

export async function sendLoginLink(email: string) {
  if (!isAllowedEmail(email)) throw new Error("email-not-allowed");
  const auth = getFirebaseAuth();
  await sendSignInLinkToEmail(auth, email, {
    url: window.location.origin + "/",
    handleCodeInApp: true,
  });
  window.localStorage.setItem(EMAIL_KEY, email);
}

export function isLoginLink(): boolean {
  if (typeof window === "undefined") return false;
  return isSignInWithEmailLink(getFirebaseAuth(), window.location.href);
}

export async function completeLoginFromLink(fallbackEmail?: string) {
  const auth = getFirebaseAuth();
  const email = window.localStorage.getItem(EMAIL_KEY) ?? fallbackEmail;
  if (!email) throw new Error("missing-email");
  await signInWithEmailLink(auth, email, window.location.href);
  window.localStorage.removeItem(EMAIL_KEY);
  // Strip the sign-in token from the URL so a refresh doesn't try to replay it.
  window.history.replaceState(null, "", window.location.pathname);
}

export function signOutUser() {
  return signOut(getFirebaseAuth());
}
