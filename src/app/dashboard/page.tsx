import { auth } from "@clerk/nextjs/server";
import { Dashboard } from "@/components/dashboard";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { Metadata } from "next";

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

interface ProjectCount {
  _count?: {
    elements: number;
    materials: number;
  };
}

// Cache the data fetching functions
const getInitialData = unstable_cache(
  async () => {
    try {
      const [projectsRes, activitiesRes, emissionsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects`, {
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
        }),
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/activities?page=1`, {
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
        }),
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/emissions`, {
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
        }),
      ]);

      const [projects, activitiesData, emissions] = await Promise.all([
        projectsRes.json(),
        activitiesRes.json(),
        emissionsRes.json(),
      ]);

      const recentProjects = projects.slice(0, 3);
      const totalElements = projects.reduce(
        (acc: number, project: ProjectCount) =>
          acc + (project._count?.elements || 0),
        0
      );
      const totalMaterials = projects.reduce(
        (acc: number, project: ProjectCount) =>
          acc + (project._count?.materials || 0),
        0
      );

      return {
        initialRecentProjects: recentProjects,
        statistics: {
          totalProjects: projects.length,
          totalElements,
          totalMaterials,
          recentActivities: activitiesData.activities.length,
          totalEmissions: emissions,
        },
        initialActivities: activitiesData.activities,
      };
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
      return {
        initialRecentProjects: [],
        statistics: {
          totalProjects: 0,
          totalElements: 0,
          totalMaterials: 0,
          recentActivities: 0,
        },
        initialActivities: [],
      };
    }
  },
  ["dashboard-initial-data"],
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ["dashboard"],
  }
);

export const dynamic = "force-dynamic";
export const revalidate = 300; // Revalidate page every 5 minutes

export default async function DashboardPage() {
  const { userId } = auth();

  if (!userId) {
    return redirect("/");
  }

  const initialData = await getInitialData();

  return <Dashboard {...initialData} />;
}
