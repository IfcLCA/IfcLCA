import { Dashboard } from "@/components/dashboard";

export default function DashboardPage() {
  const dashboardData = {
    recentProjects: [],
    statistics: {
      totalProjects: 0,
      activeProjects: 0,
      totalCO2Savings: 0,
      recentActivities: 0,
    },
    activities: [],
  };

  return <Dashboard {...dashboardData} />;
}
