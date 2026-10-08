import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import NavLinks from "@/components/NavLinks";
import BrandMark from "@/components/BrandMark";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Telegram Reminder",
  description: "Local Telegram reminder scheduler",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/reminders", label: "Reminders" },
  { href: "/settings", label: "Settings" },
  { href: "/logs", label: "Logs" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={roboto.className}>
      <body>
        <header className="app-header">
          <div className="brand">
            <span className="brand-mark">
              <BrandMark size={24} />
            </span>
            Telegram Reminder
          </div>
          <nav className="app-nav">
            <NavLinks items={NAV} />
          </nav>
        </header>
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
