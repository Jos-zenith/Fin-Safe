import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { APP_NAME } from "@/config/brand";
import { AppProvider } from "@/store/AppProvider";
import { WorkflowProvider } from "@/store/WorkflowProvider";
import { IndicFonts } from "@/components/IndicFonts";
import { Shell } from "@/components/Shell";
import "./globals.css";

// Absolute address for the link-preview image. Set SITE_URL for a custom domain; on Vercel the production domain is used.
const SITE = process.env.SITE_URL?.trim() || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
const TITLE = `${APP_NAME} - See your money clearly. Decide with someone accountable.`;
const DESCRIPTION = "A plain-language plan, checked by a person, with every change recorded. No stock tips. No promised returns. A demo with synthetic data. Not regulated investment advice.";

export const metadata: Metadata = {
  ...(SITE ? { metadataBase: new URL(SITE) } : {}),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: APP_NAME,
  // what WhatsApp, LinkedIn, Slack and search results show for a shared link (the image is src/app/opengraph-image.tsx)
  openGraph: { type: "website", siteName: APP_NAME, title: TITLE, description: DESCRIPTION, locale: "en_IN" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#171717",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Inter for text and Space Grotesk for headings (the approved type pair). Hindi and Tamil fonts are added by
            <IndicFonts /> when those languages are used, with the same weights. The system stack in globals.css is the
            fallback, so a slow font host never blocks reading. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" />
      </head>
      <body>
        <noscript>
          <p className="bg-[#2A2418] px-4 py-3 text-center text-sm font-semibold text-[#F3E2B3]">
            {APP_NAME} needs JavaScript to run. Please turn it on in your browser, or open this page in another browser.
          </p>
        </noscript>
        <AppProvider>
          <WorkflowProvider>
            <IndicFonts />
            <Shell>{children}</Shell>
          </WorkflowProvider>
        </AppProvider>
      </body>
    </html>
  );
}
