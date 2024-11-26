import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";
import AuthenticatedLayout from "@/components/authenticated-layout";
import { Nunito_Sans } from 'next/font/google';

const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  variable: '--font-nunito-sans',
});

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
      <html lang="en" suppressHydrationWarning className={`${nunitoSans.variable}`}>
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthenticatedLayout>{children}</AuthenticatedLayout>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
