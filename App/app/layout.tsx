import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ace Laundry",
  description: "Book a laundry pickup — see the cost upfront, track it to your door.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-bg text-ink">
        {children}
      </body>
    </html>
  );
}
