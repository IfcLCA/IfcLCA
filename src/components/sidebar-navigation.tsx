"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  BarChart3,
  FileStack,
  FolderTree,
  Home,
  LayoutDashboard,
  Library,
  Menu,
  Upload,
  Box,
  X,
  PlusCircle,
  Pin,
} from "lucide-react";

interface SidebarProps {
  currentPage: string;
  projectId?: string;
  collapsed: boolean;
}

interface SidebarItem {
  title: string;
  icon: React.ReactNode;
  href: string;
}

const primaryItems: SidebarItem[] = [
  {
    title: "Home",
    icon: <LayoutDashboard className="h-4 w-4" />,
    href: "/",
  },
  {
    title: "Projects",
    icon: <FolderTree className="h-4 w-4" />,
    href: "/projects",
  },
  {
    title: "Materials",
    icon: <Library className="h-4 w-4" />,
    href: "/materials-library",
  },
  {
    title: "Reports",
    icon: <FileStack className="h-4 w-4" />,
    href: "/reports",
  },
];

const projectItems: SidebarItem[] = [
  {
    title: "Project Overview",
    icon: <Home className="h-4 w-4" />,
    href: "/project/:id",
  },
  {
    title: "Building Elements",
    icon: <Box className="h-4 w-4" />,
    href: "/project/:id/elements",
  },
  {
    title: "LCA Analysis",
    icon: <BarChart3 className="h-4 w-4" />,
    href: "/project/:id/lca",
  },
  {
    title: "3D Viewer",
    icon: <Box className="h-4 w-4" />,
    href: "/project/:id/viewer",
  },
  {
    title: "Upload History",
    icon: <Upload className="h-4 w-4" />,
    href: "/project/:id/uploads",
  },
];

export function SidebarNavigation({
  currentPage,
  projectId,
  collapsed: defaultCollapsed,
}: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isPinned, setIsPinned] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const items = projectId ? [...primaryItems, ...projectItems] : primaryItems;

  const isExpanded = isPinned || isHovered;

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div
      className={cn(
        "flex h-full flex-col gap-4",
        !isExpanded && !mobile ? "items-center" : ""
      )}
      onMouseEnter={() => !mobile && setIsHovered(true)}
      onMouseLeave={() => !mobile && setIsHovered(false)}
    >
      <div className="flex h-[60px] items-center justify-between px-4">
        {mobile ? (
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsPinned(!isPinned)}
            className={cn(
              "opacity-0 transition-opacity",
              isExpanded && "opacity-100"
            )}
          >
            <Pin className={cn("h-4 w-4", isPinned && "fill-current")} />
            <span className="sr-only">
              {isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
            </span>
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div
          className={cn(
            "flex flex-col gap-4",
            !isExpanded && !mobile ? "items-center" : "px-4"
          )}
        >
          {items.map((item, index) => (
            <Link
              key={index}
              href={item.href.replace(":id", projectId || "")}
              className={cn(
                "flex items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent",
                pathname === item.href ? "bg-accent" : "transparent",
                !isExpanded && !mobile ? "justify-center w-10" : ""
              )}
              onClick={() => mobile && setIsOpen(false)}
            >
              {item.icon}
              {(isExpanded || mobile) && (
                <span className="ml-3">{item.title}</span>
              )}
            </Link>
          ))}
        </div>
      </ScrollArea>
      <div className={cn("p-4", !isExpanded && !mobile ? "w-full" : "")}>
        <Link
          href="/projects/new"
          className={cn(
            "flex items-center justify-center rounded-lg bg-primary p-2 text-primary-foreground hover:bg-primary/90",
            !isExpanded && !mobile ? "h-10 w-10" : "w-full"
          )}
        >
          <PlusCircle className="h-5 w-5" />
          {(isExpanded || mobile) && <span className="ml-2">New Project</span>}
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden border-r bg-background lg:block transition-all duration-300",
          isExpanded ? "w-64" : "w-[60px]"
        )}
      >
        <SidebarContent />
      </aside>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed left-4 top-4 z-40 lg:hidden"
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-full max-w-xs p-0">
          <SidebarContent mobile />
        </SheetContent>
      </Sheet>
    </>
  );
}
