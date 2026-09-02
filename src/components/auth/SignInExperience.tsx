"use client";

import {
  AuthenticateWithRedirectCallback,
  SignIn,
  SignUp,
  useUser,
} from "@clerk/nextjs";
import { ExternalLink, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TelegramSignInButton } from "@/components/auth/TelegramSignInButton";

interface MobileWalletLinks {
  phantom: string;
  metamask: string;
}

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
  const [mobileWalletLinks, setMobileWalletLinks] = useState<MobileWalletLinks | null>(null);
  const returnTo = useMemo(
    () => safeReturnTo(searchParams.get("redirect_url")),
    [searchParams],
  );
  const isCallback = pathname.includes("/sso-callback");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const update = () => {
      if (!media.matches) {
        setMobileWalletLinks(null);
        return;
      }

      const target = new URL(window.location.href);
      target.hash = "";
      const encodedTarget = encodeURIComponent(target.toString());
      const referrer = encodeURIComponent(window.location.origin);
      setMobileWalletLinks({
        phantom: `https://phantom.app/ul/browse/${encodedTarget}?ref=${referrer}`,
        metamask: `https://metamask.app.link/dapp/${target.host}${target.pathname}${target.search}`,
      });
    };
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

  if (!isLoaded || isSignedIn) {
    return (
      <div className="flex min-h-[60svh] items-center justify-center gap-3 text-nerd-muted">
        <RefreshCw className="spin" aria-hidden="true" size={20} />
        Preparing secure sign-in…
      </div>
    );
  }

  return (
    <div className="mx-auto grid min-h-[70svh] w-full max-w-5xl items-center gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:py-12">
      <div className="mx-auto w-full max-w-lg lg:mx-0">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-nerd-lime/15 text-nerd-lime">
          <ShieldCheck aria-hidden="true" size={25} />
        </div>
        <span className="eyebrow">One identity, every device</span>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-nerd-paper sm:text-5xl">
          {mode === "sign-up" ? "Join Money Nerds" : "Sign in to Money Nerds"}
        </h1>
        <p className="mt-5 text-lg text-nerd-muted">
          Continue with a private email code, Telegram, or any enabled Clerk Web3 wallet. Every method maps to one durable Supabase-backed public profile.
        </p>
        {mobileWalletLinks ? (
          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 shrink-0 text-nerd-lime" aria-hidden="true" size={20} />
              <div>
                <strong className="text-sm text-nerd-paper">Using a wallet app on this phone?</strong>
                <p className="mt-1 text-sm leading-relaxed text-nerd-muted">
                  Open this secure page inside the wallet, then choose its Web3 option in Clerk below.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <a
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-nerd-paper transition hover:border-white/30 hover:bg-white/10"
                href={mobileWalletLinks.phantom}
                rel="external nofollow"
              >
                Phantom
                <ExternalLink aria-hidden="true" size={15} />
              </a>
              <a
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-nerd-paper transition hover:border-white/30 hover:bg-white/10"
                href={mobileWalletLinks.metamask}
                rel="external nofollow"
              >
                MetaMask
                <ExternalLink aria-hidden="true" size={15} />
              </a>
            </div>
          </div>
        ) : null}
        <div className="mt-7 max-w-sm">
          <TelegramSignInButton returnTo={returnTo} />
        </div>
        <p className="mt-5 text-xs leading-relaxed text-nerd-muted">
          Email addresses and provider IDs stay in Clerk. Money Nerds stores only the stable profile link needed for posts, comments, likes, and transparent funding history.
        </p>
      </div>
      <div className="mx-auto min-w-0 max-w-full">
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
      <Link className="text-center text-sm text-nerd-muted hover:text-nerd-paper lg:col-span-2" href="/">
        Back to Money Nerds
      </Link>
    </div>
  );
}
