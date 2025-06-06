"use client";

import { ProjectOverview } from "./project-overview";
import { Breadcrumbs } from "./breadcrumbs";
import { Button } from "./ui/button";
import { UploadIfcButton } from "./upload-ifc-button";
import { PlusCircle } from "lucide-react";
import Link from "next/link";

export function ProjectsPageClient() {
    const breadcrumbItems = [
        { label: "Projects", href: undefined },
    ];

    return (
        <div className="container mx-auto p-6 space-y-8">
            <Breadcrumbs items={breadcrumbItems} />

            <section>
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Projects</h1>
                        <p className="page-description">
                            Manage and analyze your construction projects with IfcLCA
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <Button asChild>
                            <Link href="/projects/new">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create New Project
                            </Link>
                        </Button>
                        <UploadIfcButton variant="outline" />
                    </div>
                </div>
            </section>

            <ProjectOverview />
        </div>
    );
}
