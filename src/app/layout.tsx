import { ClerkProvider } from "@clerk/nextjs";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";
import AuthenticatedLayout from "@/components/authenticated-layout";
import { nunitoSans } from "@/styles/fonts";

export const metadata = {
  metadataBase: new URL('https://ifclca.com'),
  title: {
    default: "IfcLCA - Life Cycle Assessment for the Built Environment",
    template: "%s | IfcLCA"
  },
  description: "Open-source Life Cycle Assessment (LCA) tool for architects, engineers, and sustainability experts. Analyze environmental impact of buildings using IFC models and Swiss KBOB data.",
  keywords: [
    "LCA", "Life Cycle Assessment", "IFC", "BIM", "sustainability",
    "construction", "environmental impact", "carbon footprint", "green building",
    "architecture", "engineering", "KBOB", "openBIM", "built environment"
  ],
  authors: [{ name: "IfcLCA Team" }],
  creator: "IfcLCA",
  publisher: "IfcLCA",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ifclca.com',
    siteName: 'IfcLCA',
    title: 'IfcLCA - Life Cycle Assessment for the Built Environment',
    description: 'Open-source Life Cycle Assessment (LCA) tool for architects, engineers, and sustainability experts. Analyze environmental impact of buildings using IFC models and Swiss KBOB data.',
    images: [
      {
        url: '/LandingPage.jpg',
        width: 1200,
        height: 630,
        alt: 'IfcLCA - Life Cycle Assessment for Buildings',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IfcLCA - Life Cycle Assessment for the Built Environment',
    description: 'Open-source Life Cycle Assessment (LCA) tool for architects, engineers, and sustainability experts. Analyze environmental impact of buildings using IFC models.',
    images: ['/LandingPage.jpg'],
    creator: '@ifclca',
  },

  alternates: {
    canonical: 'https://ifclca.com',
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    other: [
      { rel: "manifest", url: "/site.webmanifest" },
      { rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#000000" },
      { rel: "msapplication-TileImage", url: "/mstile-150x150.png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "IfcLCA",
    "description": "Open-source Life Cycle Assessment (LCA) tool for architects, engineers, and sustainability experts. Analyze environmental impact of buildings using IFC models and Swiss KBOB data.",
    "url": "https://ifclca.com",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "author": {
      "@type": "Organization",
      "name": "IfcLCA Team",
      "url": "https://ifclca.com"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "42"
    },
    "featureList": [
      "IFC file integration and analysis",
      "Environmental impact assessment",
      "Swiss KBOB data integration",
      "Real-time LCA calculations",
      "Open-source transparency",
      "Collaborative project management"
    ]
  };

  return (
    <ClerkProvider appearance={{ baseTheme: undefined }} dynamic>
      <html lang="en" className={nunitoSans.variable} suppressHydrationWarning>
        <head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(structuredData),
            }}
          />
        </head>
        <body suppressHydrationWarning>
          <PostHogProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
              storageKey="ifclca-theme"
              enableColorScheme={false}
              forcedTheme={undefined}
            >
              <AuthenticatedLayout>{children}</AuthenticatedLayout>
            </ThemeProvider>
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
