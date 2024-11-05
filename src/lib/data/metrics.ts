import { Building, Users, BarChart2, FileText } from "lucide-react";

export type MetricType = {
  title: string;
  value: string;
  description: string;
  icon: string;
};

export const defaultMetrics: MetricType[] = [
  {
    title: "Total Projects",
    value: "15",
    description: "Active projects in progress",
    icon: "Building",
  },
  {
    title: "Team Members",
    value: "24",
    description: "Across all projects",
    icon: "Users",
  },
  {
    title: "Carbon Tracked",
    value: "1,234t",
    description: "Total CO2e calculated",
    icon: "BarChart2",
  },
  {
    title: "Documents",
    value: "123",
    description: "Reports and analyses",
    icon: "FileText",
  },
];

// Map string icon names to actual components
export const iconMap = {
  Building,
  Users,
  BarChart2,
  FileText,
} as const;
