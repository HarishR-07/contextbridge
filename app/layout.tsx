import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContextBridge: your AI projects, portable anywhere",
  description: "Save your AI project state and continue your work in any AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="mx-auto max-w-3xl px-4 pb-10 text-xs text-slate-500"><a href="/privacy" className="underline">Privacy</a></footer>
      </body>
    </html>
  );
}
