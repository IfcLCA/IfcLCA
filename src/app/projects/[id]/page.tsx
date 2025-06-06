import ProjectsIdPage from "@/components/projects-id-page";
import { Metadata } from "next";

// Since this page is behind authentication, prevent indexing
export const metadata: Metadata = {
  title: "Project Details - IfcLCA",
  description: "View and manage your IfcLCA project details and environmental analysis",
  robots: {
    index: false, // Don't index authenticated pages
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function ProjectPage() {
  return <ProjectsIdPage />;
}
