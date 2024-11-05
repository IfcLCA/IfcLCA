import { NavigationBar } from "@/components/navigation-bar";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";

interface Notification {
  id: string;
  message: string;
  // ... other notification properties
}

export const metadata = {
  title: "IfcLCA",
  description: "LCA Analysis for IFC Models",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Mock user and notifications data
  const user = {
    name: "John Doe",
    email: "john@example.com",
    avatar: "/avatars/user.png",
  };

  const notifications: never[] = [];

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="relative flex min-h-screen flex-col">
            <NavigationBar user={user} notifications={notifications} />
            <div className="flex flex-1">
              <SidebarNavigation currentPage="" collapsed={false} />
              <main className="flex-1 p-6">{children}</main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
