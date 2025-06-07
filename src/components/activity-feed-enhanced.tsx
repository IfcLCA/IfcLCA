"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import {
    Activity,
    FileText,
    Filter,
    Image as ImageIcon,
    Package,
    PlusCircle,
    Trash2,
    Upload,
    UserPlus,
    ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { Activity as ActivityType } from "@/lib/types/activity";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const activityConfig: Record<ActivityType["type"], { icon: React.ReactNode; color: string; label: string }> = {
    project_created: { icon: <PlusCircle className="h-3 w-3" />, color: "text-green-600", label: "Created" },
    file_uploaded: { icon: <Upload className="h-3 w-3" />, color: "text-blue-600", label: "Uploaded" },
    material_created: { icon: <Package className="h-3 w-3" />, color: "text-purple-600", label: "Material" },
    project_deleted: { icon: <Trash2 className="h-3 w-3" />, color: "text-red-600", label: "Deleted" },
    material_deleted: { icon: <Trash2 className="h-3 w-3" />, color: "text-red-600", label: "Deleted" },
    project_updated: { icon: <FileText className="h-3 w-3" />, color: "text-yellow-600", label: "Updated" },
    new_user: { icon: <UserPlus className="h-3 w-3" />, color: "text-indigo-600", label: "New User" },
    project_member_added: { icon: <UserPlus className="h-3 w-3" />, color: "text-green-600", label: "Added" },
    project_member_removed: { icon: <UserPlus className="h-3 w-3" />, color: "text-red-600", label: "Removed" },
    image_uploaded: { icon: <ImageIcon className="h-3 w-3" />, color: "text-blue-600", label: "Image" },
};

interface ActivityFeedEnhancedProps {
    initialActivities?: ActivityType[];
    className?: string;
    limit?: number;
    compact?: boolean;
}

export function ActivityFeedEnhanced({
    initialActivities = [],
    className,
    limit = 5, // Reduced default limit for faster loading
    compact = true,
}: ActivityFeedEnhancedProps) {
    const [activities, setActivities] = useState<ActivityType[]>(initialActivities);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const [isInitialized, setIsInitialized] = useState(initialActivities.length > 0);
    const [selectedTypes, setSelectedTypes] = useState<Set<ActivityType["type"]>>(new Set());
    const [showAll, setShowAll] = useState(false);

    const fetchActivities = useCallback(
        async (pageNum: number) => {
            if (isLoading) return;

            setIsLoading(true);
            try {
                const response = await fetch(
                    `/api/activities?page=${pageNum}&limit=${limit}`,
                    { cache: "no-store" }
                );

                if (!response.ok) throw new Error("Failed to fetch activities");

                const data = await response.json();

                if (pageNum === 1) {
                    setActivities(data.activities || []);
                } else {
                    setActivities((prev) => [...prev, ...(data.activities || [])]);
                }

                setHasMore(data.hasMore ?? false);
            } catch (error) {
                console.error("Failed to fetch activities:", error);
            } finally {
                setIsLoading(false);
            }
        },
        [limit]
    );

    // Initialize with data fetch if no initial activities
    useEffect(() => {
        if (!isInitialized && initialActivities.length === 0) {
            setIsInitialized(true);
            fetchActivities(1);
        }
    }, [isInitialized, initialActivities.length, fetchActivities]);

    // Get available activity types from current activities
    const availableTypes = useMemo(() => {
        const types = new Set<ActivityType["type"]>();
        activities.forEach(activity => types.add(activity.type));
        return Array.from(types).sort();
    }, [activities]);

    // Filter activities based on selected types
    const filteredActivities = useMemo(() => {
        if (selectedTypes.size === 0) return activities;
        return activities.filter(activity => selectedTypes.has(activity.type));
    }, [activities, selectedTypes]);

    // Display limited activities unless "show all" is enabled
    const displayedActivities = useMemo(() => {
        const filtered = filteredActivities;
        return showAll ? filtered : filtered.slice(0, 10);
    }, [filteredActivities, showAll]);

    const toggleType = (type: ActivityType["type"]) => {
        setSelectedTypes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(type)) {
                newSet.delete(type);
            } else {
                newSet.add(type);
            }
            return newSet;
        });
    };

    const clearFilters = () => {
        setSelectedTypes(new Set());
    };

    const ActivityItem = ({ activity }: { activity: ActivityType }) => {
        const config = activityConfig[activity.type] || {
            icon: <Activity className="h-3 w-3" />,
            color: "text-gray-600",
            label: "Activity"
        };

        return (
            <div className={cn(
                "flex items-start gap-2 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors",
                compact && "py-1.5"
            )}>
                <div className={cn("mt-0.5", config.color)}>
                    {config.icon}
                </div>

                <div className="flex-1 min-w-0 text-sm">
                    <div className="flex flex-wrap items-baseline gap-1">
                        <span className="font-medium text-xs">{activity.user?.name || "System"}</span>
                        <span className="text-muted-foreground text-xs">{activity.action}</span>
                        {activity.projectId && (
                            <Link
                                href={`/projects/${activity.projectId}`}
                                className="font-medium text-primary hover:underline text-xs"
                            >
                                {activity.project}
                            </Link>
                        )}
                        <span className="text-muted-foreground text-xs">
                            • {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </span>
                    </div>

                    {activity.details?.fileName && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                            {activity.details.fileName}
                        </p>
                    )}

                    {activity.details?.description && !compact && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {activity.details.description}
                        </p>
                    )}
                </div>

                <Badge variant="outline" className="text-xs px-1.5 py-0">
                    {config.label}
                </Badge>
            </div>
        );
    };

    const LoadingSkeleton = () => (
        <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-2 py-2">
                    <Skeleton className="h-3 w-3 rounded mt-0.5" />
                    <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-full" />
                    </div>
                </div>
            ))}
        </div>
    );

    const remainingCount = filteredActivities.length - displayedActivities.length;

    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
                        {selectedTypes.size > 0 && (
                            <Badge variant="secondary" className="text-xs">
                                {selectedTypes.size} filter{selectedTypes.size !== 1 && 's'}
                            </Badge>
                        )}
                    </div>
                    {availableTypes.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 px-2">
                                    <Filter className="h-3 w-3 mr-1" />
                                    Filter
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Activity Types</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {availableTypes.length === 0 ? (
                                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                        No activities to filter
                                    </div>
                                ) : (
                                    <>
                                        {availableTypes.map((type) => {
                                            const config = activityConfig[type];
                                            return (
                                                <DropdownMenuCheckboxItem
                                                    key={type}
                                                    checked={selectedTypes.has(type)}
                                                    onCheckedChange={() => toggleType(type)}
                                                >
                                                    <span className={cn("mr-2", config.color)}>{config.icon}</span>
                                                    {config.label}
                                                </DropdownMenuCheckboxItem>
                                            );
                                        })}
                                        {selectedTypes.size > 0 && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={clearFilters}>
                                                    Clear filters
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </CardHeader>
            <CardContent className="px-2 pb-2">
                <div className="space-y-0.5">
                    {displayedActivities.length === 0 && !isLoading ? (
                        <div className="py-8 text-center text-muted-foreground">
                            <Activity className="h-6 w-6 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">
                                {selectedTypes.size > 0 ? "No activities match your filters" : "No recent activity"}
                            </p>
                        </div>
                    ) : (
                        <>
                            {displayedActivities.map((activity) => (
                                <ActivityItem key={activity.id} activity={activity} />
                            ))}

                            {isLoading && <LoadingSkeleton />}

                            {!showAll && remainingCount > 0 && !isLoading && (
                                <div className="pt-2 pb-1 text-center">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowAll(true)}
                                        className="text-xs h-7"
                                    >
                                        <ChevronDown className="h-3 w-3 mr-1" />
                                        Show {remainingCount} more
                                    </Button>
                                </div>
                            )}

                            {showAll && hasMore && !isLoading && (
                                <div className="pt-2 pb-1 text-center">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setPage(prev => prev + 1);
                                            fetchActivities(page + 1);
                                        }}
                                        className="text-xs h-7"
                                    >
                                        Load more activities
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}