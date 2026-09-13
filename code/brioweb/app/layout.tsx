import type { Metadata, Viewport } from "next";
import { Inter, Spectral } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const spectral = Spectral({ variable: "--font-spectral", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Brio — decisions from training, nutrition and recovery", template: "%s · Brio" },
  description: "A decision-led training, nutrition and recovery workspace with inspectable evidence and editable recommendations.",
  applicationName: "Brio",
};

export const viewport: Viewport = { themeColor: "#F7F5F0", colorScheme: "light" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en" className={`${inter.variable} ${spectral.variable}`}><body>{children}<ServiceWorkerRegistration/></body></html>;
}
