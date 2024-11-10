import { ClerkProvider } from "@clerk/nextjs";
import { NavigationBar } from "@/components/navigation-bar";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";

export const metadata = {
  title: "IfcLCA",
  description: "LCA Analysis for IFC Models",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="relative flex min-h-screen flex-col">
              <NavigationBar />
              <div className="flex flex-1">
                <SidebarNavigation currentPage="" collapsed={false} />
                <main className="flex-1 p-6">{children}</main>
              </div>
            </div>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
