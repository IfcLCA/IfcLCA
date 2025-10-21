import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload, Element, Material, MaterialDeletion } from "@/models";
import { auth } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";

export interface DashboardStats {
    totalProjects: number;
    totalElements: number;
    totalMaterials: number;
    totalEmissions: {
        gwp: number;
        ubp: number;
        penre: number;
    };
}

export interface RecentProject {
    id: string;
    name: string;
    description: string;
    imageUrl?: string;
    updatedAt: string;
    _count: {
        elements: number;
        uploads: number;
        materials: number;
    };
}

export interface Activity {
    id: string;
    type: "project_created" | "file_uploaded" | "material_deleted";
    user: {
        name: string;
        imageUrl?: string;
    };
    action: string;
    project: string;
    projectId: string;
    timestamp: string;
    details: {
        description?: string;
        fileName?: string;
        elementCount?: number;
        materialName?: string;
        reason?: string;
    };
}


// Cache recent projects for 5 minutes - scoped per user
async function getRecentProjects(userId: string): Promise<RecentProject[]> {
    const cachedFn = unstable_cache(
        async (uid: string): Promise<RecentProject[]> => {
            await connectToDatabase();

            const projects = await Project.aggregate([
                { $match: { userId: uid } },
                {
                    $lookup: {
                        from: "elements",
                        localField: "_id",
                        foreignField: "projectId",
                        as: "elements",
                    },
                },
                {
                    $lookup: {
                        from: "uploads",
                        localField: "_id",
                        foreignField: "projectId",
                        as: "uploads",
                    },
                },
                {
                    $lookup: {
                        from: "materials",
                        localField: "_id",
                        foreignField: "projectId",
                        as: "materials",
                    },
                },
                {
                    $addFields: {
                        lastActivityAt: {
                            $max: [
                                "$updatedAt",
                                { $max: "$uploads.createdAt" },
                                { $max: "$elements.createdAt" },
                                { $max: "$materials.createdAt" },
                            ],
                        },
                        _count: {
                            elements: { $size: "$elements" },
                            uploads: { $size: "$uploads" },
                            materials: { $size: "$materials" },
                        },
                    },
                },
                { $sort: { lastActivityAt: -1 } },
                { $limit: 3 },
            ]);

            return projects.map((project) => ({
                id: project._id.toString(),
                name: project.name,
                description: project.description || "",
                imageUrl: project.imageUrl,
                updatedAt: project.lastActivityAt || project.updatedAt,
                _count: project._count,
            }));
        },
        ["recent-projects", userId],
        {
            revalidate: 300, // 5 minutes
            tags: ["dashboard"],
        }
    );

    return cachedFn(userId);
}

// Cache recent activities for 2 minutes (more frequent updates) - scoped per user and limit
async function getRecentActivities(userId: string, limit: number = 6): Promise<Activity[]> {
    const cachedFn = unstable_cache(
        async (uid: string, lim: number): Promise<Activity[]> => {
            await connectToDatabase();

            // Single aggregation query using $unionWith for better performance
            const activities = await Project.aggregate([
                { $match: { userId: uid } },
                {
                    $facet: {
                        projects: [
                            {
                                $addFields: {
                                    type: "project_created",
                                    user: { name: "You" },
                                    action: "created a new project",
                                    project: "$name",
                                    projectId: { $toString: "$_id" },
                                    timestamp: "$createdAt",
                                    details: {
                                        description: { $ifNull: ["$description", "No description provided"] },
                                    },
                                },
                            },
                            { $sort: { createdAt: -1 } },
                            { $limit: lim },
                        ],
                        uploads: [
                            {
                                $lookup: {
                                    from: "uploads",
                                    localField: "_id",
                                    foreignField: "projectId",
                                    as: "uploads",
                                },
                            },
                            { $unwind: "$uploads" },
                            {
                                $addFields: {
                                    type: "file_uploaded",
                                    user: { name: "You" },
                                    action: "uploaded a file to",
                                    project: "$name",
                                    projectId: { $toString: "$_id" },
                                    timestamp: "$uploads.createdAt",
                                    details: {
                                        fileName: "$uploads.filename",
                                        elementCount: "$uploads.elementCount",
                                    },
                                },
                            },
                            { $sort: { timestamp: -1 } },
                            { $limit: lim },
                        ],
                        deletions: [
                            {
                                $lookup: {
                                    from: "material_deletions",
                                    localField: "_id",
                                    foreignField: "projectId",
                                    as: "deletions",
                                },
                            },
                            { $unwind: "$deletions" },
                            {
                                $addFields: {
                                    type: "material_deleted",
                                    user: { name: "You" },
                                    action: "deleted a material from",
                                    project: "$name",
                                    projectId: { $toString: "$_id" },
                                    timestamp: "$deletions.createdAt",
                                    details: {
                                        materialName: "$deletions.materialName",
                                        reason: { $ifNull: ["$deletions.reason", "No reason provided"] },
                                    },
                                },
                            },
                            { $sort: { timestamp: -1 } },
                            { $limit: lim },
                        ],
                    },
                },
                {
                    $project: {
                        allActivities: {
                            $concatArrays: ["$projects", "$uploads", "$deletions"],
                        },
                    },
                },
                { $unwind: "$allActivities" },
                { $replaceRoot: { newRoot: "$allActivities" } },
                { $sort: { timestamp: -1 } },
                { $limit: lim },
            ]);

            return activities.map((activity) => ({
                id: `${activity.type}_${activity.projectId}_${activity.timestamp}`,
                type: activity.type,
                user: activity.user,
                action: activity.action,
                project: activity.project,
                projectId: activity.projectId,
                timestamp: activity.timestamp,
                details: activity.details,
            }));
        },
        ["recent-activities", userId, limit.toString()],
        {
            revalidate: 120, // 2 minutes
            tags: ["dashboard"],
        }
    );

    return cachedFn(userId, limit);
}

export async function getDashboardData(userId: string, includeEmissions: boolean = false) {
    try {
        // Fetch non-emissions data first (fast)
        const [basicStats, recentProjects, recentActivities] = await Promise.all([
            getDashboardBasicStats(userId),
            getRecentProjects(userId),
            getRecentActivities(userId),
        ]);

        // Only fetch expensive emissions if requested
        const emissions = includeEmissions
            ? await getDashboardEmissions(userId)
            : { gwp: 0, ubp: 0, penre: 0 };

        return {
            stats: {
                ...basicStats,
                totalEmissions: emissions,
            },
            recentProjects,
            recentActivities,
        };
    } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        return {
            stats: {
                totalProjects: 0,
                totalElements: 0,
                totalMaterials: 0,
                totalEmissions: { gwp: 0, ubp: 0, penre: 0 },
            },
            recentProjects: [],
            recentActivities: [],
        };
    }
}

// Separate basic stats (fast) from emissions (slow) - scoped per user
async function getDashboardBasicStats(userId: string) {
    const cachedFn = unstable_cache(
        async (uid: string) => {
            await connectToDatabase();

            const statsResult = await Project.aggregate([
                { $match: { userId: uid } },
                {
                    $lookup: {
                        from: "elements",
                        localField: "_id",
                        foreignField: "projectId",
                        as: "elements",
                    },
                },
                {
                    $lookup: {
                        from: "materials",
                        localField: "_id",
                        foreignField: "projectId",
                        as: "materials",
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalProjects: { $sum: 1 },
                        totalElements: { $sum: { $size: "$elements" } },
                        totalMaterials: { $sum: { $size: "$materials" } },
                    },
                },
            ]);

            const stats = statsResult[0] || {
                totalProjects: 0,
                totalElements: 0,
                totalMaterials: 0,
            };

            return {
                totalProjects: stats.totalProjects,
                totalElements: stats.totalElements,
                totalMaterials: stats.totalMaterials,
            };
        },
        ["dashboard-basic-stats", userId],
        {
            revalidate: 300,
            tags: ["dashboard"],
        }
    );

    return cachedFn(userId);
}

// Fast emissions calculation using pre-calculated project emissions - scoped per user
async function getDashboardEmissions(userId: string) {
    const cachedFn = unstable_cache(
        async (uid: string) => {
            await connectToDatabase();

            // Sum pre-calculated emissions from all projects (100x faster!)
            const emissionsResult = await Project.aggregate([
                {
                    $match: {
                        userId: uid,
                        isArchived: { $ne: true }
                    }
                },
                {
                    $group: {
                        _id: null,
                        gwp: { $sum: { $ifNull: ["$emissions.gwp", 0] } },
                        ubp: { $sum: { $ifNull: ["$emissions.ubp", 0] } },
                        penre: { $sum: { $ifNull: ["$emissions.penre", 0] } },
                        projectCount: { $sum: 1 },
                        projectNames: { $push: "$name" },
                    },
                },
            ]);

            const emissions = emissionsResult[0] || { gwp: 0, ubp: 0, penre: 0 };
            return emissions;
        },
        ["dashboard-emissions", userId],
        {
            revalidate: 300, // Cache for 5 minutes (can be shorter since it's fast)
            tags: ["dashboard"],
        }
    );

    return cachedFn(userId);
}

// Helper function to invalidate dashboard cache
export async function invalidateDashboardCache() {
    const { revalidateTag } = await import("next/cache");
    revalidateTag("dashboard");
}
