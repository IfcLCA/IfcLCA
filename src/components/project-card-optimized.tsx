"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
    Box,
    Building,
    Calendar,
    FileText,
    Layers,
    Loader2,
    MoreVertical,
    Trash2,
    Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
    project: {
        id: string;
        name: string;
        description?: string | null;
        imageUrl?: string | null;
        updatedAt: string;
        _count: {
            elements: number;
            uploads: number;
            materials: number;
        };
    };
    onDelete?: (id: string) => void;
    className?: string;
    priority?: boolean;
}

export function ProjectCardOptimized({
    project,
    onDelete,
    className,
    priority = false,
}: ProjectCardProps) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    const formatCount = (count: number) => {
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M`;
        }
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}k`;
        }
        return count.toString();
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onDelete) {
            onDelete(project.id);
        }
    };

    return (
        <Link href={`/projects/${project.id}`} className="block">
            <Card
                className={cn(
                    "group relative overflow-hidden transition-all duration-200",
                    "hover:shadow-lg hover:scale-[1.02] hover:border-primary/20",
                    "cursor-pointer",
                    className
                )}
            >
                {/* Image Section */}
                <div className="relative aspect-video bg-muted overflow-hidden">
                    {project.imageUrl && !imageError ? (
                        <>
                            {!imageLoaded && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
                                </div>
                            )}
                            <Image
                                src={project.imageUrl}
                                alt={project.name}
                                fill
                                className={cn(
                                    "object-cover transition-opacity duration-300",
                                    imageLoaded ? "opacity-100" : "opacity-0"
                                )}
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                priority={priority}
                                onLoad={() => setImageLoaded(true)}
                                onError={() => setImageError(true)}
                            />
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                            <Building className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                    )}

                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Content Section */}
                <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base line-clamp-1 group-hover:text-primary transition-colors">
                                {project.name}
                            </h3>
                            {project.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                    {project.description}
                                </p>
                            )}
                        </div>

                        {onDelete && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem asChild>
                                        <Link href={`/projects/${project.id}`} className="cursor-pointer">
                                            <FileText className="mr-2 h-4 w-4" />
                                            View Details
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive cursor-pointer"
                                        onClick={handleDelete}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Project
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs px-2 py-0.5">
                            <Box className="mr-1 h-3 w-3" />
                            {formatCount(project._count.elements)} elements
                        </Badge>
                        <Badge variant="secondary" className="text-xs px-2 py-0.5">
                            <Upload className="mr-1 h-3 w-3" />
                            {formatCount(project._count.uploads)} uploads
                        </Badge>
                        {project._count.materials > 0 && (
                            <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                <Layers className="mr-1 h-3 w-3" />
                                {formatCount(project._count.materials)} materials
                            </Badge>
                        )}
                    </div>

                    {/* Updated time */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                            Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}

export function ProjectCardSkeleton() {
    return (
        <Card className="overflow-hidden">
            <Skeleton className="aspect-video" />
            <CardContent className="p-4 space-y-3">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-3 w-32" />
            </CardContent>
        </Card>
    );
} 