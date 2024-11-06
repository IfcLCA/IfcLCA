"use client";

import * as React from "react";
import Link from "next/link";
import { defaultMetrics, iconMap } from "@/lib/data/metrics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Building,
  FileText,
  Users,
  BarChart2,
  Upload,
  PlusCircle,
} from "lucide-react";
import { UploadModal } from "@/components/upload-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Project {
  id: string;
  name: string;
  description: string;
  progress: number;
  thumbnail: string;
}

interface DashboardStatistics {
  totalProjects: number;
  activeProjects: number;
  totalCO2Savings: number;
  recentActivities: number;
}

interface Activity {
  id: string;
  user: {
    name: string;
    avatar: string;
  };
  action: string;
  project: string;
  timestamp: string;
}

interface DashboardProps {
  recentProjects: Project[];
  statistics: DashboardStatistics;
  activities: Activity[];
}

export function Dashboard({
  recentProjects,
  statistics,
  activities,
}: DashboardProps) {
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch("/api/projects");
        const data = await response.json();
        setProjects(data);
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      }
    };
    fetchProjects();
  }, []);

  const handleUploadClick = () => {
    if (projects.length === 0) {
      toast({
        title: "No Projects Available",
        description:
          "Please create a project first before uploading IFC files.",
        variant: "destructive",
      });
      return;
    }
    setShowProjectSelect(true);
  };

  console.log("Current state:", {
    showProjectSelect,
    selectedProjectId,
    recentProjects,
  });

  return (
    <div className="container mx-auto p-4 space-y-8">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Home</h1>
        <div className="flex flex-wrap gap-4">
          <Button className="bg-[#FF5722] hover:bg-[#F4511E]">
            Create New Project
          </Button>
          <Button variant="outline" onClick={handleUploadClick}>
            <Upload className="mr-2 h-4 w-4" />
            Upload IFC
          </Button>
          <Button variant="outline">Generate Report</Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {defaultMetrics.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap];
          return (
            <Card key={item.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {item.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{item.value}</div>
                <p className="text-xs text-muted-foreground">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Recent Projects</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recentProjects.map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
                <CardDescription>{project.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video mb-4 rounded-lg bg-muted overflow-hidden">
                  <img
                    src={project.thumbnail}
                    alt={project.name}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Progress</p>
                    <Progress value={project.progress} className="w-[60%]" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {project.progress}%
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Activity Feed</h2>
        <Card>
          <CardContent className="p-0">
            {activities.map((activity, index) => (
              <div
                key={activity.id}
                className={`flex items-center p-4 ${
                  index !== activities.length - 1 ? "border-b" : ""
                }`}
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage
                    src={activity.user.avatar}
                    alt={activity.user.name}
                  />
                  <AvatarFallback>
                    {activity.user.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {activity.user.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {activity.action} on {activity.project}
                  </p>
                </div>
                <div className="ml-auto font-medium text-sm text-muted-foreground">
                  {activity.timestamp}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Quick Access</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Button variant="outline" className="h-20 text-left justify-start">
            <FileText className="mr-2 h-5 w-5" />
            <div>
              <div className="font-semibold">Recent Files</div>
              <div className="text-sm text-muted-foreground">
                Access your latest work
              </div>
            </div>
          </Button>
          <Button variant="outline" className="h-20 text-left justify-start">
            <Users className="mr-2 h-5 w-5" />
            <div>
              <div className="font-semibold">Team Projects</div>
              <div className="text-sm text-muted-foreground">
                Collaborate with your team
              </div>
            </div>
          </Button>
          <Button variant="outline" className="h-20 text-left justify-start">
            <BarChart className="mr-2 h-5 w-5" />
            <div>
              <div className="font-semibold">Analytics</div>
              <div className="text-sm text-muted-foreground">
                View project insights
              </div>
            </div>
          </Button>
          <Button variant="outline" className="h-20 text-left justify-start">
            <Building className="mr-2 h-5 w-5" />
            <div>
              <div className="font-semibold">Material Library</div>
              <div className="text-sm text-muted-foreground">
                Browse and manage materials
              </div>
            </div>
          </Button>
        </div>
      </section>

      <Dialog open={showProjectSelect} onOpenChange={setShowProjectSelect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Project</DialogTitle>
            <DialogDescription>
              Choose a project to upload the IFC file to, or create a new one
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {projects.map((project) => (
              <Button
                key={project.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setShowProjectSelect(false);
                }}
              >
                <Building className="mr-2 h-4 w-4" />
                {project.name}
              </Button>
            ))}
            <Button asChild variant="default" className="w-full">
              <Link href="/projects/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Project
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedProjectId && (
        <UploadModal
          projectId={selectedProjectId}
          open={true}
          onOpenChange={(open) => {
            if (!open) setSelectedProjectId(null);
          }}
          onSuccess={async (upload) => {
            toast({
              title: "Upload Successful",
              description: "Your IFC file has been uploaded and processed.",
            });
            setSelectedProjectId(null);
            router.push(`/projects/${selectedProjectId}`);
          }}
          onProgress={(progress) => {
            console.log("Upload progress:", progress);
          }}
        />
      )}
    </div>
  );
}
