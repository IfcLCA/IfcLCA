import { Dashboard } from "@/components/dashboard";

export default function HomePage() {
  // Add mock data for testing
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
    activities: [
      {
        id: "1",
        user: {
          name: "John Doe",
          avatar: "/placeholder-avatar.jpg",
        },
        action: "uploaded an IFC file",
        project: "Test Project 1",
        timestamp: "2 hours ago",
      },
    ],
  };

  return <Dashboard {...dashboardData} />;
}
