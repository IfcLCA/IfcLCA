/**
 * Migration Script: Recalculate Project Emissions
 * 
 * This script recalculates emissions for all projects to fix the bug where
 * updateProjectEmissions was using old field names (GWP, UBP, PENRE) instead
 * of new field names (gwpTotal, ubp21Total, primaryEnergyNonRenewableTotal).
 * 
 * Usage: npx tsx scripts/recalculate-emissions.ts
 */

import { connectToDatabase } from '../src/lib/mongodb';
import { MaterialService } from '../src/lib/services/material-service';
import { Project } from '../src/models';
import mongoose from 'mongoose';

async function recalculateAllProjects() {
    console.log('🔄 Starting emissions recalculation for all projects...\n');

    try {
        await connectToDatabase();
        console.log('✅ Connected to database\n');

        const projects = await Project.find()
            .select('_id name userId emissions')
            .lean();

        console.log(`📊 Found ${projects.length} projects to process\n`);

        let successCount = 0;
        let errorCount = 0;
        let unchangedCount = 0;

        for (let i = 0; i < projects.length; i++) {
            const project = projects[i] as any;
            const projectNum = i + 1;

            try {
                const oldEmissions = project.emissions || { gwp: 0, ubp: 0, penre: 0 };

                const result = await MaterialService.updateProjectEmissions(
                    project._id.toString()
                );

                const changed =
                    oldEmissions.gwp !== result.totalGWP ||
                    oldEmissions.ubp !== result.totalUBP ||
                    oldEmissions.penre !== result.totalPENRE;

                if (changed) {
                    console.log(
                        `✅ [${projectNum}/${projects.length}] ${project.name}:`
                    );
                    console.log(`   OLD: GWP=${oldEmissions.gwp.toFixed(0)}, UBP=${oldEmissions.ubp.toFixed(0)}, PENRE=${oldEmissions.penre.toFixed(0)}`);
                    console.log(`   NEW: GWP=${result.totalGWP.toFixed(0)}, UBP=${result.totalUBP.toFixed(0)}, PENRE=${result.totalPENRE.toFixed(0)}\n`);
                    successCount++;
                } else {
                    unchangedCount++;
                    if (unchangedCount <= 5) {
                        console.log(`⏭️  [${projectNum}/${projects.length}] ${project.name}: No change needed\n`);
                    }
                }
            } catch (error) {
                console.error(`❌ [${projectNum}/${projects.length}] ${project.name}:`, error);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📈 Summary:');
        console.log(`   Total projects: ${projects.length}`);
        console.log(`   ✅ Updated: ${successCount}`);
        console.log(`   ⏭️  Unchanged: ${unchangedCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log('='.repeat(60) + '\n');

        if (successCount > 0) {
            console.log('🎉 Migration completed successfully!');
        } else if (errorCount === 0) {
            console.log('✨ All projects already have correct emissions.');
        }

    } catch (error) {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
    }
}

// Run the migration
recalculateAllProjects()
    .then(() => {
        console.log('✅ Script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Script failed:', error);
        process.exit(1);
    });

