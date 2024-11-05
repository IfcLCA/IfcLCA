import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building,
  Users,
  Calendar,
  BarChart2,
  FileText,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import ErrorBoundaryComponent from "@/components/error-boundary";

async function getProjectData(id: string) {
  // In a real application, you would fetch this data from your API
  return {
    id,
    name: "Green Office Tower",
    description:
      "A 30-story office building with LEED Platinum certification goal",
    progress: 65,
    startDate: "2023-01-15",
    endDate: "2024-06-30",
    totalArea: 50000,
    totalVolume: 150000,
    carbonFootprint: 5000,
    team: [
      {
        id: 1,
        name: "Alice Johnson",
        role: "Project Manager",
        avatar: "/avatars/alice.jpg",
      },
      {
        id: 2,
        name: "Bob Smith",
        role: "Architect",
        avatar: "/avatars/bob.jpg",
      },
      {
        id: 3,
        name: "Carol Williams",
        role: "Structural Engineer",
        avatar: "/avatars/carol.jpg",
      },
      {
        id: 4,
        name: "David Brown",
        role: "Sustainability Consultant",
        avatar: "/avatars/david.jpg",
      },
    ],
    recentActivities: [
      {
        id: 1,
        description: "Updated floor plans for levels 15-20",
        date: "2023-05-10",
      },
      {
        id: 2,
        description: "Completed LCA analysis for structural elements",
        date: "2023-05-08",
      },
      {
        id: 3,
        description: "Revised material specifications for facade",
        date: "2023-05-05",
      },
    ],
  };
}

// Add this mock data (or fetch from your API)
const metrics = [
  {
    title: "Total Projects",
    value: "15",
    description: "Active projects in progress",
    icon: Building,
  },
  {
    title: "Team Members",
    value: "24",
    description: "Across all projects",
    icon: Users,
  },
  {
    title: "Carbon Tracked",
    value: "1,234t",
    description: "Total CO2e calculated",
    icon: BarChart2,
  },
  {
    title: "Documents",
    value: "123",
    description: "Reports and analyses",
    icon: FileText,
  },
];

export default async function ProjectOverviewPage({
  params,
}: {
  params: { id: string };
}) {
  const id = await params.id;

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProjectContent id={id} />
    </Suspense>
  );
}

async function ProjectContent({ id }: { id: string }) {
  const project = await getProjectData(id);

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        <Button>Edit Project</Button>
      </div>
      <p className="text-muted-foreground mb-8">{project.description}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Project Progress
            </CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.progress}%</div>
            <Progress value={project.progress} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Project Timeline
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.startDate}</div>
            <p className="text-xs text-muted-foreground">
              to {project.endDate}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Carbon Footprint
            </CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {project.carbonFootprint.toLocaleString()} kgCO2e
            </div>
            <p className="text-xs text-muted-foreground">
              Total embodied carbon
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Project Team</CardTitle>
            <CardDescription>
              Key members working on this project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-4">
              {project.team.map((member) => (
                <div key={member.id} className="flex items-center space-x-4">
                  <Avatar>
                    <AvatarImage src={member.avatar} alt={member.name} />
                    <AvatarFallback>
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium leading-none">
                      {member.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {member.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Latest updates on the project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-4">
              {project.recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex justify-between items-center"
                >
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.date}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link href={`/projects/${project.id}/building-elements`} passHref>
          <Button variant="outline" className="w-full justify-between">
            Building Elements
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <Link href={`/projects/${project.id}/lca-analysis`} passHref>
          <Button variant="outline" className="w-full justify-between">
            LCA Analysis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <Link href={`/projects/${project.id}/3d-viewer`} passHref>
          <Button variant="outline" className="w-full justify-between">
            3D Viewer
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <Link href={`/projects/${project.id}/upload-history`} passHref>
          <Button variant="outline" className="w-full justify-between">
            Upload History
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>
            Key metrics and information about the project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Total Area</p>
              <p className="text-2xl font-bold">
                {project.totalArea.toLocaleString()} m²
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Total Volume</p>
              <p className="text-2xl font-bold">
                {project.totalVolume.toLocaleString()} m³
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
