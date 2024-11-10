"use client";

import { useAuth } from "@clerk/nextjs";
import { NavigationBar } from "@/components/navigation-bar";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import { useEffect, useState } from "react";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, userId } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show nothing until client-side hydration completes
  if (!mounted) {
    return null;
  }

  // After mounting, wait for auth to load
  if (!isLoaded) {
    return <div className="min-h-screen" />; // Empty container to maintain layout
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      {userId ? (
        <>
          <NavigationBar />
          <div className="flex flex-1">
            <SidebarNavigation currentPage="" collapsed={false} />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </>
      ) : (
        children
      )}
    </div>
  );
}
