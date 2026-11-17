import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pastebin Lite — a little space for your text",
  description: "Share plain text with a link. Set an expiration time or view limit.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <header className="site-header"><a className="brand" href="/">pastebin<span>lite</span><i aria-hidden="true">↗</i></a><span className="header-note">A little space for your text.</span></header>
    <main>{children}</main>
    <footer>Small links. Useful things.<span>Plain text, simply shared.</span></footer>
  </body></html>;
}
