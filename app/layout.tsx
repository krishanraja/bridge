import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BRIDGE",
  description: "For Amperity's leadership table.",
  applicationName: "BRIDGE",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BRIDGE",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F4EF" },
    { media: "(prefers-color-scheme: dark)", color: "#0B141F" },
  ],
};

const nightScript = `(function(){try{var h=new Date().getHours();if(h>=21||h<6){document.documentElement.dataset.night="1";}}catch(e){}})();`;

/* Scale the whole app so the 412px phone design fills the real viewport,
   whatever CSS width the device reports (a low pixel-ratio or screen-zoom
   phone can report ~900px). Runs before paint to avoid a flash, and re-fits on
   resize and rotation. Capped so it never blows up on a true desktop. */
const fitScript = `(function(){function f(){try{document.documentElement.style.zoom=Math.min(2.6,window.innerWidth/412);}catch(e){}}f();window.addEventListener("resize",f);window.addEventListener("orientationchange",f);})();`;

const swScript = `if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})})}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: fitScript }} />
        <script dangerouslySetInnerHTML={{ __html: nightScript }} />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
      </body>
    </html>
  );
}
