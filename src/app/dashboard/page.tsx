import { auth } from "@clerk/nextjs/server";
import { Dashboard } from "@/components/dashboard";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import { getDashboardData } from "@/lib/services/dashboard-service";

// Since this page is behind authentication, prevent indexing
export const metadata: Metadata = {
  title: "Dashboard - IfcLCA",
  description: "Your personal IfcLCA dashboard with project statistics and recent activity",
  robots: {
    index: false, // Don't index authenticated pages
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export const revalidate = 300; // Revalidate page every 5 minutes

export default async function DashboardPage() {
  const { userId } = auth();

  if (!userId) {
    return redirect("/");
  }

  const dashboardData = await getDashboardData(userId);

  return (
    <Dashboard
      initialRecentProjects={dashboardData.recentProjects}
      statistics={{
        totalProjects: dashboardData.stats.totalProjects,
        totalElements: dashboardData.stats.totalElements,
        totalMaterials: dashboardData.stats.totalMaterials,
        recentActivities: dashboardData.recentActivities.length,
        totalEmissions: dashboardData.stats.totalEmissions,
      }}
      initialActivities={dashboardData.recentActivities}
    />
  );
}
