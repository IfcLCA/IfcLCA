import { ClerkProvider } from "@clerk/nextjs";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";
import AuthenticatedLayout from "@/components/authenticated-layout";
import { nunitoSans } from "@/styles/fonts";

export const metadata = {
  title: "IfcLCA",
  description: "LCA Analysis for Ifc Models",
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
  return (
    <ClerkProvider appearance={{ baseTheme: undefined }} dynamic>
      <html lang="en" className={nunitoSans.variable} suppressHydrationWarning>
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
