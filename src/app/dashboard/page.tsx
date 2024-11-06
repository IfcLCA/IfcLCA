import { Dashboard } from "@/components/dashboard";

export default function DashboardPage() {
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

  return <Dashboard {...dashboardData} />;
}
