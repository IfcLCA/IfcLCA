import { connectToDatabase } from "@/lib/mongodb";
import { Project, Element } from "@/models";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

export async function POST() {
    try {
        const { userId } = await auth();

        // Require authentication to prevent accidental runs
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectToDatabase();

        console.log("[MIGRATION] Starting emissions recalculation for all projects...");

        // Get all projects
        const projects = await Project.find({}).select("_id name userId").lean();
        console.log(`[MIGRATION] Found ${projects.length} projects`);

        let updatedProjects = 0;
        let errors = 0;
        const errorDetails: string[] = [];

        // Process each project
        for (const project of projects) {
            try {
                console.log(`[MIGRATION] Processing project: ${project.name} (${project._id})`);

                // Calculate emissions by fetching elements with populated materials
                const elements = await Element.find({ projectId: project._id })
                    .select("materials.volume materials.material")
                    .populate({
                        path: "materials.material",
                        select: "density kbobMatchId",
                        populate: {
                            path: "kbobMatchId",
                            select: "GWP UBP PENRE"
                        }
                    })
                    .lean();

                console.log(`[MIGRATION]   - Found ${elements.length} elements`);

                // Calculate totals
                const totals = elements.reduce(
                    (acc, element: any) => {
                        const elementTotals = element.materials.reduce(
                            (matAcc: any, material: any) => {
                                const volume = material.volume || 0;
                                const density = material.material?.density || 0;
                                const kbobMatch = material.material?.kbobMatchId;
                                const mass = volume * density;

                                return {
                                    gwp: matAcc.gwp + mass * (kbobMatch?.GWP || 0),
                                    ubp: matAcc.ubp + mass * (kbobMatch?.UBP || 0),
                                    penre: matAcc.penre + mass * (kbobMatch?.PENRE || 0)
                                };
                            },
                            { gwp: 0, ubp: 0, penre: 0 }
                        );

                        return {
                            gwp: acc.gwp + elementTotals.gwp,
                            ubp: acc.ubp + elementTotals.ubp,
                            penre: acc.penre + elementTotals.penre
                        };
                    },
                    { gwp: 0, ubp: 0, penre: 0 }
                );

                console.log(`[MIGRATION]   - Calculated totals:`, totals);

                // Update project - ONLY update emissions field, nothing else to prevent data loss
                const updateResult = await Project.updateOne(
                    { _id: project._id },
                    {
                        $set: {
                            "emissions.gwp": totals.gwp,
                            "emissions.ubp": totals.ubp,
                            "emissions.penre": totals.penre,
                            "emissions.lastCalculated": new Date()
                        }
                    }
                );

                if (updateResult.modifiedCount === 0) {
                    console.warn(`[MIGRATION]   ⚠ Project not modified (already had correct values?)`);
                } else {
                    updatedProjects++;
                    console.log(`[MIGRATION]   ✓ Updated project emissions`);
                }

            } catch (error) {
                errors++;
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`[MIGRATION]   ✗ Error processing project ${project.name}:`, error);
                errorDetails.push(`${project.name}: ${errorMsg}`);
            }
        }

        console.log("[MIGRATION] Completed!");
        console.log(`[MIGRATION] Updated: ${updatedProjects} projects`);
        console.log(`[MIGRATION] Errors: ${errors} projects`);

        return NextResponse.json({
            success: errors === 0,
            totalProjects: projects.length,
            updatedProjects,
            errors,
            errorDetails: errors > 0 ? errorDetails : [],
            message: `Recalculated emissions for ${projects.length} projects (${updatedProjects} updated, ${errors} errors)`
        });

    } catch (error) {
        console.error("[MIGRATION] Fatal error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Migration failed",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
