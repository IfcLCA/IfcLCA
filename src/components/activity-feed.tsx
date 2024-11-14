"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import {
  Loader2,
  PlusCircle,
  Upload,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Activity,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Activity {
  id: string;
  type:
    | "project_created"
    | "file_uploaded"
    | "project_updated"
    | "project_deleted"
    | "image_uploaded";
  user: {
    name: string;
    imageUrl: string;
  };
  action: string;
  project: string;
  projectId: string;
  timestamp: string;
  details: {
    description?: string;
    fileName?: string;
    elementCount?: number;
    imageUrl?: string;
    changes?: {
      name?: string;
      description?: string;
    };
  };
}

const getActivityIcon = (type: Activity["type"]) => {
  switch (type) {
    case "project_created":
      return <PlusCircle className="h-4 w-4" />;
    case "file_uploaded":
      return <Upload className="h-4 w-4" />;
    case "project_updated":
      return <Pencil className="h-4 w-4" />;
    case "project_deleted":
      return <Trash2 className="h-4 w-4" />;
    case "image_uploaded":
      return <ImageIcon className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
};

interface ActivityFeedProps {
  activities: Activity[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function ActivityFeed({
  activities,
  isLoading,
  hasMore,
  onLoadMore,
}: ActivityFeedProps) {
  if (!activities.length && !isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No recent activity
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {activities.map((activity, index) => (
          <div
            key={activity.id}
            className={`flex items-start space-x-4 p-4 ${
              index !== activities.length - 1 ? "border-b" : ""
            } hover:bg-muted/50 transition-colors`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{activity.user.name}</p>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(activity.timestamp), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                <span>{activity.action} </span>
                {activity.type !== "project_deleted" ? (
                  <Link
                    href={`/projects/${activity.projectId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {activity.project}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">
                    {activity.project}
                  </span>
                )}
              </div>
              {activity.type === "project_created" &&
                activity.details.description && (
                  <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                    {activity.details.description}
                  </p>
                )}
              {activity.type === "file_uploaded" && (
                <div className="text-xs space-y-1 bg-muted/50 p-2 rounded-md">
                  <p className="font-medium">{activity.details.fileName}</p>
                  <p>{activity.details.elementCount} elements</p>
                </div>
              )}
              {activity.type === "image_uploaded" &&
                activity.details.imageUrl && (
                  <div className="relative h-24 w-full rounded-md overflow-hidden mt-2">
                    <Image
                      src={activity.details.imageUrl}
                      alt="Uploaded image"
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
            </div>
          </div>
        ))}
        {hasMore && (
          <div className="p-4 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={onLoadMore}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load More"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
