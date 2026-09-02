const isDevelopment = process.env.NODE_ENV !== "production";

const configuredOrigins = [
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
].flatMap((value) => {
  if (!value) return [];
  try {
    const url = new URL(value);
    if (!["https:", "http:", "wss:", "ws:"].includes(url.protocol)) return [];
    const socketUrl = new URL(url.origin);
    if (url.protocol === "https:") socketUrl.protocol = "wss:";
    if (url.protocol === "http:") socketUrl.protocol = "ws:";
    return [url.origin, socketUrl.origin];
  } catch {
    return [];
  }
});

const connectSources = [
  "'self'",
  "blob:",
  "http://localhost:*",
  "ws://localhost:*",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://api.mainnet-beta.solana.com",
  "https://*.solana.com",
  "wss://*.solana.com",
  "https://*.helius-rpc.com",
  "wss://*.helius-rpc.com",
  "https://*.helius.xyz",
  "wss://*.helius.xyz",
  "https://*.alchemy.com",
  "wss://*.alchemy.com",
  "https://*.quiknode.pro",
  "wss://*.quiknode.pro",
  "wss://mm-sdk-relay.api.cx.metamask.io",
  "https://*.clerk.accounts.dev",
  "https://*.clerk.com",
  "https://*.protect.clerk.com",
  "https://challenges.cloudflare.com",
  "https://clerk.moneynerds.online",
  "https://accounts.moneynerds.online",
  "https://phantom.app",
  "https://*.phantom.app",
  "https://solflare.com",
  "https://*.solflare.com",
  "wss://*.solflare.com",
  ...configuredOrigins,
];

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://telegram.org https://*.clerk.accounts.dev https://*.clerk.com https://*.protect.clerk.com https://challenges.cloudflare.com https://clerk.moneynerds.online https://accounts.moneynerds.online${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${[...new Set(connectSources)].join(" ")}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'self' https://oauth.telegram.org https://*.clerk.accounts.dev https://*.clerk.com https://*.protect.clerk.com https://challenges.cloudflare.com https://clerk.moneynerds.online https://accounts.moneynerds.online https://phantom.app https://*.phantom.app https://solflare.com https://*.solflare.com",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/icon.svg",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(), browsing-topics=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
