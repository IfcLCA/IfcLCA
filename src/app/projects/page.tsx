"use client";

import { ProjectOverview } from "@/components/project-overview";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import Link from "next/link";

export default function ProjectsPage() {
  return (
    <div className="main-container">
      <section className="space-y-4">
        <div className="page-header">
          <div>
            <h1 className="page-title">Projects</h1>
            <p className="page-description">
              Manage and analyze your construction projects
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button asChild>
              <Link href="/projects/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Project
              </Link>
            </Button>
          </div>
        </div>
        <ProjectOverview />
      </section>
    </div>
  );
}
