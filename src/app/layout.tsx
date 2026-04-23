import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { AppStateProvider } from "@/components/app-state-provider";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "VocabMinder",
  description:
    "A cloud-ready English vocabulary app with automatic saving, usage caps, and Anki-style review.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authConfigured = hasSupabaseEnv();
  let authUserEmail: string | null = null;
  let storageScope = "guest";

  if (authConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    authUserEmail = user?.email ?? null;
    storageScope = user?.id ?? "guest";
  }

  const remotePersistenceEnabled = authConfigured && storageScope !== "guest";

  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppStateProvider
          key={storageScope}
          remotePersistenceEnabled={remotePersistenceEnabled}
          storageScope={storageScope}
        >
          <AppShell
            authConfigured={authConfigured}
            authUserEmail={authUserEmail}
            remotePersistenceEnabled={remotePersistenceEnabled}
          >
            {children}
          </AppShell>
        </AppStateProvider>
      </body>
    </html>
  );
}
