import type { Metadata } from "next";
import "./globals.css";
import NavLinks from "@/components/NavLinks";
import BrandMark from "@/components/BrandMark";

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
    <html lang="en">
      <body>
        <header className="app-header">
          <div className="brand">
            <span className="brand-mark">
              <BrandMark size={22} />
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
