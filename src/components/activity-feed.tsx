"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import Link from "next/link";

interface Activity {
  id: string;
  type: "project_created" | "file_uploaded";
  user: {
    name: string;
    avatar: string;
  };
  action: string;
  project: string;
  projectId: string;
  timestamp: string;
  details: {
    description?: string;
    fileName?: string;
    elementCount?: number;
  };
}

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
          No activities yet
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
            className={`flex items-start p-4 ${
              index !== activities.length - 1 ? "border-b" : ""
            }`}
          >
            <Avatar className="h-9 w-9">
              <AvatarImage
                src={activity.user.avatar}
                alt={activity.user.name}
              />
              <AvatarFallback>{activity.user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="ml-4 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{activity.user.name}</p>
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(activity.timestamp), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                <span>{activity.action} </span>
                <Link
                  href={`/projects/${activity.projectId}`}
                  className="text-primary hover:underline font-medium inline-block"
                >
                  {activity.project}
                </Link>
              </div>
              {activity.type === "project_created" &&
                activity.details.description && (
                  <p className="mt-2 text-sm text-muted-foreground bg-muted p-2 rounded-md">
                    {activity.details.description}
                  </p>
                )}
              {activity.type === "file_uploaded" && (
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>File: {activity.details.fileName}</p>
                  <p>Elements: {activity.details.elementCount}</p>
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
