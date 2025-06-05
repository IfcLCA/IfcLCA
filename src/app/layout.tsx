import { ClerkProvider } from "@clerk/nextjs";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";
import AuthenticatedLayout from "@/components/authenticated-layout";
import { nunitoSans } from "@/styles/fonts";

export const metadata = {
  title: "IfcLCA",
  description: "LCA Analysis for Ifc Models",
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
