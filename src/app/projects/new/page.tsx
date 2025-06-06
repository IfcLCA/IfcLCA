import ProjectNewPage from "@/components/projects-new-page";
import { Metadata } from "next";

// Since this page is behind authentication, prevent indexing
export const metadata: Metadata = {
  title: "New Project - IfcLCA",
  description: "Create a new IfcLCA project for environmental analysis",
  robots: {
    index: false, // Don't index authenticated pages
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function ProjectsPage() {
  return <ProjectNewPage />;
}
