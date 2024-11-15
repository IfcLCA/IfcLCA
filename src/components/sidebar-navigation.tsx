"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  BarChart3,
  Home,
  Box,
  PlusCircle,
  Building,
  Database,
  FileBarChart2,
  Boxes,
  History,
} from "lucide-react";
import { UploadIfcButton } from "@/components/upload-ifc-button";

interface SidebarProps {
  currentPage: string;
  projectId?: string;
}

interface SidebarItem {
  title: string;
  icon: React.ReactNode;
  href: string;
  badge?: {
    text: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  };
}

const primaryItems: SidebarItem[] = [
  {
    title: "Home",
    icon: <LayoutDashboard className="h-5 w-5" />,
    href: "/",
  },
  {
    title: "Projects",
    icon: <Building className="h-5 w-5" />,
    href: "/projects",
  },
  {
    title: "Materials",
    icon: <Database className="h-5 w-5" />,
    href: "/materials-library",
  },
  {
    title: "Reports",
    icon: <FileBarChart2 className="h-5 w-5" />,
    href: "#",
    badge: {
      text: "Coming Soon",
      variant: "secondary",
    },
  },
];

const projectItems: SidebarItem[] = [
  {
    title: "Project Overview",
    icon: <Home className="h-5 w-5" />,
    href: "/project/:id",
  },
  {
    title: "Building Elements",
    icon: <Boxes className="h-5 w-5" />,
    href: "/project/:id/elements",
  },
  {
    title: "LCA Analysis",
    icon: <BarChart3 className="h-5 w-5" />,
    href: "/project/:id/lca",
  },
  {
    title: "3D Viewer",
    icon: <Box className="h-5 w-5" />,
    href: "/project/:id/viewer",
  },
  {
    title: "Upload History",
    icon: <History className="h-5 w-5" />,
    href: "/project/:id/uploads",
  },
];

export function SidebarNavigation({
  currentPage,
  projectId,
}: SidebarProps) {
  const pathname = usePathname();
  const items = projectId ? [...primaryItems, ...projectItems] : primaryItems;

  return (
    <TooltipProvider>
      <aside className="fixed left-0 top-0 h-screen z-10">
        <div className="h-full pt-[64px] -mt-px">
          <nav className="h-full flex flex-col bg-background border-r shadow-sm w-16">
            <div className="flex-1" />
            <div className="p-2 flex flex-col items-center gap-2">
              {items.map((item, index) => (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors relative group",
                        pathname === item.href ? "bg-accent text-accent-foreground" : "transparent",
                        item.href === "#" && "opacity-60 pointer-events-none"
                      )}
                    >
                      {item.icon}
                      {item.badge && (
                        <span className="absolute bottom-0 right-0 -mr-1 mb-0">
                          <span className="flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                          </span>
                        </span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="flex items-center gap-2">
                    <span>{item.title}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground rounded">
                        {item.badge.text}
                      </span>
                    )}
                    {item.title === "Reports" && (
                      <span className="text-xs text-muted-foreground">
                        Generate detailed environmental impact reports
                      </span>
                    )}
                  </TooltipContent>
                </Tooltip>
              ))}
              <div className="my-2 w-10 border-t" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-10 h-10">
                    <UploadIfcButton
                      variant="ghost"
                      className="w-full h-full p-0"
                      showText={false}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Add new IFC
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/projects/new"
                    className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <PlusCircle className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  New Project
                </TooltipContent>
              </Tooltip>
            </div>
          </nav>
        </div>
      </aside>
    </TooltipProvider>
  );
}
