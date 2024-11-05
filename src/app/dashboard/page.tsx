import { Dashboard } from "@/components/dashboard";

export default function DashboardPage() {
  // In a real application, you would fetch this data from an API
  const dashboardData = {
    recentProjects: [],
    statistics: {},
    activities: [],
  };

  return <Dashboard {...dashboardData} />;
}
