"use client";

import {
  AuthenticateWithRedirectCallback,
  SignIn,
  SignUp,
  useSignIn,
  useSignUp,
  useUser,
} from "@clerk/nextjs";
import { Apple, Globe2, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TelegramSignInButton } from "@/components/auth/TelegramSignInButton";

const DEVELOPMENT_CLERK =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") === true;
const GOOGLE_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true" ||
  (process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED !== "false" && DEVELOPMENT_CLERK);
const APPLE_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_AUTH_APPLE_ENABLED === "true" ||
  (process.env.NEXT_PUBLIC_AUTH_APPLE_ENABLED !== "false" && DEVELOPMENT_CLERK);

function safeReturnTo(value: string | null) {
  if (
    !value ||
    value.length > 512 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    (value === "/api/auth" || value.startsWith("/api/auth/")) ||
    value.includes("\\") ||
    /[\u0000-\u001f]/.test(value)
  ) {
    return "/";
  }
  return value;
}

export function SignInExperience({ mode = "sign-in" }: { mode?: "sign-in" | "sign-up" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { signIn, fetchStatus: signInFetchStatus } = useSignIn();
  const { signUp, fetchStatus: signUpFetchStatus } = useSignUp();
  const [mobile, setMobile] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const returnTo = useMemo(
    () => safeReturnTo(searchParams.get("redirect_url")),
    [searchParams],
  );
  const isCallback = pathname.includes("/sso-callback");
  const fetchStatus = mode === "sign-up" ? signUpFetchStatus : signInFetchStatus;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn && !isCallback) router.replace(returnTo);
  }, [isCallback, isLoaded, isSignedIn, returnTo, router]);

  if (isCallback) {
    return (
      <div className="flex min-h-[60svh] items-center justify-center text-nerd-muted">
        <AuthenticateWithRedirectCallback
          signInFallbackRedirectUrl={returnTo}
          signUpFallbackRedirectUrl={returnTo}
        />
        <RefreshCw className="spin" aria-hidden="true" size={20} />
        <span className="ml-3">Finishing secure sign-in…</span>
      </div>
    );
  }

  if (mobile === null || !isLoaded || isSignedIn) {
    return (
      <div className="flex min-h-[60svh] items-center justify-center gap-3 text-nerd-muted">
        <RefreshCw className="spin" aria-hidden="true" size={20} />
        Preparing secure sign-in…
      </div>
    );
  }

  const startSso = async (strategy: "oauth_google" | "oauth_apple") => {
    if (fetchStatus === "fetching") return;
    setError(null);
    const callback = new URL(`/${mode}/sso-callback`, window.location.origin);
    callback.searchParams.set("redirect_url", returnTo);
    try {
      const { error: clerkError } = await (mode === "sign-up" ? signUp : signIn).sso({
        strategy,
        redirectUrl: returnTo,
        redirectCallbackUrl: `${callback.pathname}${callback.search}`,
      });
      if (clerkError) {
        setError(clerkError.longMessage || clerkError.message || "Sign-in could not be started.");
      }
    } catch {
      setError("Sign-in could not be started. Check your connection and try again.");
    }
  };

  if (!mobile) {
    return (
      <div className="mx-auto grid min-h-[70svh] w-full max-w-5xl items-center gap-8 px-4 py-12 lg:grid-cols-[1fr_auto]">
        <div className="max-w-lg">
          <span className="eyebrow">One identity, every device</span>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-nerd-paper sm:text-5xl">
            {mode === "sign-up" ? "Join Money Nerds" : "Sign in to Money Nerds"}
          </h1>
          <p className="mt-5 text-lg text-nerd-muted">
            Use an enabled social account, Telegram, or a supported Web3 wallet. Your private login maps to one durable public profile.
          </p>
          <div className="mt-7 max-w-sm">
            <TelegramSignInButton returnTo={returnTo} />
          </div>
        </div>
        {mode === "sign-up" ? (
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            fallbackRedirectUrl={returnTo}
            signInFallbackRedirectUrl={returnTo}
            oauthFlow="redirect"
          />
        ) : (
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            fallbackRedirectUrl={returnTo}
            signUpFallbackRedirectUrl={returnTo}
            oauthFlow="redirect"
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[72svh] w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="rounded-[1.75rem] border border-white/10 bg-nerd-panel/95 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-nerd-lime/15 text-nerd-lime">
          <ShieldCheck aria-hidden="true" size={25} />
        </div>
        <span className="eyebrow">Mobile-friendly sign-in</span>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-nerd-paper">
          {mode === "sign-up" ? "Join Money Nerds." : "Welcome, Nerd."}
        </h1>
        <p className="mt-3 text-nerd-muted">
          Stay in this browser so camera and microphone permissions keep working after login.
        </p>
        <div className="mt-7 grid gap-3">
          {GOOGLE_AUTH_ENABLED ? (
            <button
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 font-semibold text-nerd-paper transition hover:border-white/30 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
              type="button"
              disabled={fetchStatus === "fetching"}
              onClick={() => void startSso("oauth_google")}
            >
              <Globe2 aria-hidden="true" size={19} />
              Continue with Google
            </button>
          ) : null}
          {APPLE_AUTH_ENABLED ? (
            <button
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 font-semibold text-nerd-paper transition hover:border-white/30 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
              type="button"
              disabled={fetchStatus === "fetching"}
              onClick={() => void startSso("oauth_apple")}
            >
              <Apple aria-hidden="true" size={19} />
              Continue with Apple
            </button>
          ) : null}
          <TelegramSignInButton returnTo={returnTo} />
        </div>
        {error ? (
          <p className="mt-4 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
        <p className="mt-6 text-xs leading-relaxed text-nerd-muted">
          Wallet sign-in stays available on desktop. On phones, wallets are opened only when you choose a currency while funding.
        </p>
      </div>
      <Link className="mt-6 text-center text-sm text-nerd-muted hover:text-nerd-paper" href="/">
        Back to Money Nerds
      </Link>
    </div>
  );
}
