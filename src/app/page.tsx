import { auth } from "@clerk/nextjs/server";
import LandingPage from "@/components/landing-page";
import { Dashboard } from "@/components/dashboard";

export default async function HomePage() {
  const { userId } = await auth();

  // If user is not authenticated, show landing page
  if (!userId) {
    return <LandingPage />;
  }

  // Mock data for authenticated dashboard view
  const dashboardData = {
    recentProjects: [
      {
        id: "1",
        name: "Test Project 1",
        description: "Test Description",
        progress: 50,
        thumbnail: "/placeholder.jpg",
      },
      {
        id: "2",
        name: "Test Project 2",
        description: "Test Description",
        progress: 75,
        thumbnail: "/placeholder.jpg",
      },
    ],
    statistics: {
      totalProjects: 2,
      activeProjects: 1,
      totalCO2Savings: 1000,
      recentActivities: 5,
    },
    activities: [],
  };

  // If user is authenticated, show dashboard
  return <Dashboard {...dashboardData} />;
}
