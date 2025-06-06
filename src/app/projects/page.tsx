import { ProjectsPageClient } from "@/components/projects-page-client";
import { Metadata } from "next";

// Since this page is behind authentication, prevent indexing
export const metadata: Metadata = {
  title: "Projects - IfcLCA Dashboard",
  description: "Manage and analyze your construction projects with IfcLCA",
  robots: {
    index: false, // Don't index authenticated pages
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function ProjectsPage() {
  return <ProjectsPageClient />;
}
