import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "EngageIQ — AI Engagement Analytics",
    template: "%s | EngageIQ",
  },
  description:
    "Understand what your audience cares about with AI-powered video and social engagement intelligence.",
  applicationName: "EngageIQ",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "EngageIQ — AI Engagement Analytics",
    description:
      "Turn audience signals into a clearer content strategy with EngageIQ.",
    siteName: "EngageIQ",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
