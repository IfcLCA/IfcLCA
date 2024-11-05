"use client";

import * as React from "react";
import {
  Bell,
  ChevronDown,
  HelpCircle,
  Menu,
  Search,
  PlusCircle,
  Database,
  FileText,
  BarChart,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Breadcrumbs } from "@/components/breadcrumbs";
import Image from "next/image";

interface Project {
  id: string;
  name: string;
}

interface User {
  name: string;
  email: string;
  avatar: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
}

interface NavBarProps {
  currentProject?: Project;
  user: User;
  notifications: Notification[];
}

// Temporary solution while waiting for logo
const LogoPlaceholder = () => (
  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold overflow-hidden">
    L
  </div>
);

export function NavigationBar({
  currentProject,
  user,
  notifications,
}: NavBarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const pathname = usePathname();

  const unreadNotifications =
    notifications?.filter((notification) => !notification.read) || [];

  // Generate breadcrumb items from the current path
  const pathSegments = pathname.split("/").filter(Boolean);
  const breadcrumbItems = pathSegments.map((segment, index) => {
    const href = "/" + pathSegments.slice(0, index + 1).join("/");
    return {
      label:
        segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " "),
      href,
    };
  });

  // Add Home as the first item if we're not on the homepage
  if (pathname !== "/") {
    breadcrumbItems.unshift({ label: "Home", href: "/" });
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex pl-4">
          <Link className="mr-6 flex items-center space-x-2" href="/">
            <div className="rounded-full overflow-hidden">
              <Image
                src="/logo.png"
                alt="IfcLCA Logo"
                width={32}
                height={32}
                className="h-8 w-8"
              />
            </div>
            <span className="hidden font-bold sm:inline-block">IfcLCA</span>
          </Link>
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Projects</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                    <li className="row-span-3">
                      <NavigationMenuLink asChild>
                        <Link
                          href="/projects/new"
                          className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                        >
                          <PlusCircle className="h-6 w-6 mb-2" />
                          <div className="mb-2 text-lg font-medium">
                            Create New Project
                          </div>
                          <p className="text-sm leading-tight text-muted-foreground">
                            Start a new LCA analysis for your building project.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/projects"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            All Projects
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            View and manage all your LCA projects.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/projects?filter=active"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Active Projects
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            View and manage your ongoing LCA projects.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/projects?filter=completed"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Completed Projects
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Access your finished LCA projects and reports.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Materials</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                    <li className="row-span-3">
                      <NavigationMenuLink asChild>
                        <Link
                          href="/materials/new"
                          className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                        >
                          <Database className="h-6 w-6 mb-2" />
                          <div className="mb-2 text-lg font-medium">
                            Create New Material
                          </div>
                          <p className="text-sm leading-tight text-muted-foreground">
                            Add a new material to your LCA database.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/materials-library"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Material Library
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Browse and manage your material database.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/custom-materials"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Custom Materials
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Create and manage custom material entries.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/material-reports"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Material Reports
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Generate reports on material usage and impact.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Reports</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                    <li className="row-span-3">
                      <NavigationMenuLink asChild>
                        <Link
                          href="/reports"
                          className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                        >
                          <FileText className="h-6 w-6 mb-2" />
                          <div className="mb-2 mt-4 text-lg font-medium">
                            LCA Reports
                          </div>
                          <p className="text-sm leading-tight text-muted-foreground">
                            Comprehensive Life Cycle Assessment reports for your
                            projects.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/reports/carbon-footprint"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Carbon Footprint
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Analyze and report on project carbon emissions.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/reports/material-impact"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Material Impact
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Detailed reports on material environmental impact.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link
                          href="/reports/comparison"
                          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <div className="text-sm font-medium leading-none">
                            Comparison
                          </div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Compare LCA results across multiple projects or
                            scenarios.
                          </p>
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="pr-0">
            <NavigationMenu className="flex flex-col gap-4">
              <NavigationMenuList className="flex-col items-start gap-4">
                {/* Mobile menu content (similar to desktop, but adapted for mobile) */}
                {/* ... */}
              </NavigationMenuList>
            </NavigationMenu>
          </SheetContent>
        </Sheet>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <Input
              className="hidden md:flex"
              placeholder="Search projects..."
              type="search"
            />
          </div>
          <nav className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    {user ? (
                      <AvatarImage src={user.avatar} alt={user.name} />
                    ) : (
                      <AvatarFallback>?</AvatarFallback>
                    )}
                    {user && (
                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    )}
                  </Avatar>
                  {unreadNotifications.length > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs"
                    >
                      {unreadNotifications.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {user ? (
                  <>
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Profile</DropdownMenuItem>
                    <DropdownMenuItem>Settings</DropdownMenuItem>
                    <DropdownMenuItem>Notifications</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Log out</DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem>Log in</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <HelpCircle className="h-4 w-4" />
              <span className="sr-only">Help</span>
            </Button>
          </nav>
        </div>
      </div>
      {breadcrumbItems.length > 0 && (
        <div className="container border-t py-2">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
      )}
    </nav>
  );
}
