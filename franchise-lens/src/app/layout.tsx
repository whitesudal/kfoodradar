import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "kfoodradar | K-food trend intelligence",
  description:
    "Track K-food trend signals across Reddit, YouTube, Naver Blog, and AI channels.",
};

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/privacy", label: "Privacy" },
  { href: "/contact", label: "Contact" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <header className="site-header">
            <Link className="brand-mark" href="/">
              <span className="brand-mark__dot" />
              <span>kfoodradar</span>
            </Link>

            <nav className="site-nav" aria-label="Main">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </header>

          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
