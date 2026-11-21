import type { NextConfig } from "next";

const prod = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy. Next.js injects small inline scripts, so script-src needs 'unsafe-inline' (a nonce-based
 * policy is the next step; see docs/PRODUCTION_GAP.md). Everything else is locked to this site, the two Google Font
 * hosts the stylesheet link uses, and data: images. frame-ancestors 'none' stops other sites framing the app.
 * Development also needs 'unsafe-eval' for hot reload.
 */
export const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${prod ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // the microphone is used only for optional voice input, from this origin
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // a different build directory lets a test build with sentinel secrets without disturbing the main build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // The first version of the app used shorter addresses. They are kept as permanent redirects so links and bookmarks
  // still work (/plan and /activity depend on the case and redirect in the browser, see src/app/plan and src/app/activity).
  async redirects() {
    return [
      { source: "/home", destination: "/dashboard", permanent: true },
      { source: "/check", destination: "/second-opinion", permanent: true },
      { source: "/fall", destination: "/guardrail/market-fall", permanent: true },
      { source: "/improve", destination: "/actions", permanent: true },
    ];
  },
};

export default nextConfig;
