import { Material, KBOBMaterial, Element, Types, ClientSession, Project } from "@/models";
import mongoose from "mongoose";

interface ILCAIndicators {
  gwp: number;
  ubp: number;
  penre: number;
}

export class MaterialService {
  /**
   * Sets KBOB material match for all materials with the same name across all projects
   * @param materialId ID of the reference material
   * @param kbobMatchId ID of the KBOB material to match
   * @param density Optional density value to set
   * @param session Optional mongoose session for transaction support
   * @returns Number of materials updated
   */
  static async setKBOBMatch(
    materialId: Types.ObjectId,
    kbobMatchId: Types.ObjectId,
    density?: number,
    session?: ClientSession
  ): Promise<number> {
    // First get the reference material to get its name
    const referenceMaterial = await Material.findById(materialId)
      .select('name projectId')
      .session(session)
      .lean();
    
    if (!referenceMaterial) {
      throw new Error(`Material ${materialId} not found`);
    }

    if (!referenceMaterial.name) {
      throw new Error(`Material ${materialId} has no name`);
    }

    console.debug(`Starting update for material name "${referenceMaterial.name}" (reference ID: ${materialId})`);

    // First find all materials with this name across all projects
    const materialsToUpdate = await Material.find({ 
      name: referenceMaterial.name 
    })
    .select('_id name projectId')
    .populate('projectId', 'name')
    .session(session)
    .lean();

    console.debug(`Found ${materialsToUpdate.length} materials with name "${referenceMaterial.name}" across projects:`);
    materialsToUpdate.forEach(mat => {
      console.debug(`- Material ID=${mat._id}, Project=${mat.projectId?.name || mat.projectId}`);
    });

    // Update all materials with this name
    const updateResult = await Material.updateMany(
      { name: referenceMaterial.name }, // Update by name instead of ID list
      {
        $set: {
          kbobMatchId,
          ...(density !== undefined ? { density } : {}),
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { session }
    );

    console.debug(`Update result: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`);

    // Get all updated materials to verify the update
    const updatedMaterials = await Material.find({ 
      name: referenceMaterial.name 
    })
    .select('_id name projectId kbobMatchId density')
    .populate('projectId', 'name')
    .session(session)
    .lean();

    console.debug('Verification of updated materials:');
    updatedMaterials.forEach(mat => {
      console.debug(`- Material ID=${mat._id}, Project=${mat.projectId?.name || mat.projectId}`);
      console.debug(`  KBOB Match=${mat.kbobMatchId}, Density=${mat.density}`);
    });

    // Get all elements that use any of these materials
    const elements = await Element.find({
      'materials.material': { $in: updatedMaterials.map(m => m._id) }
    })
    .select('_id projectId')
    .populate('projectId', 'name')
    .session(session);

    console.debug(`Found ${elements.length} elements to update across projects:`);
    const elementsByProject = new Map<string, number>();
    elements.forEach(elem => {
      const projectName = elem.projectId?.name || elem.projectId?.toString() || 'unknown';
      elementsByProject.set(projectName, (elementsByProject.get(projectName) || 0) + 1);
    });
    elementsByProject.forEach((count, project) => {
      console.debug(`- Project "${project}": ${count} elements`);
    });

    // Recalculate elements for all materials with this name
    const recalcResult = await this.recalculateElementsForMaterials(
      updatedMaterials.map(m => m._id),
      session
    );

    console.debug(`Final result: Updated ${updateResult.modifiedCount} materials and recalculated ${recalcResult} elements`);
    console.debug(`Affected projects: ${Array.from(elementsByProject.keys()).join(', ')}`);

    return updateResult.modifiedCount;
  }

  /**
   * Recalculates all elements that use any of the given materials
   * @param materialIds List of material IDs to recalculate elements for
   * @param session Optional mongoose session for transaction support
   * @returns Number of elements modified
   */
  static async recalculateElementsForMaterials(
    materialIds: Types.ObjectId[],
    session?: ClientSession
  ): Promise<number> {
    console.debug(`Recalculating elements for ${materialIds.length} materials`);

    // Get all materials with their KBOB matches
    const materials = await Material.find({ _id: { $in: materialIds } })
      .select('_id name kbobMatchId density')
      .populate('kbobMatchId')
      .session(session)
      .lean();

    if (!materials.length) {
      console.warn('No materials found to recalculate');
      return 0;
    }

    const materialMap = new Map(materials.map(m => [m._id.toString(), m]));

    // Process elements in batches of 500 to avoid memory issues
    const BATCH_SIZE = 500;
    let processedElements = 0;
    let totalModified = 0;

    while (true) {
      // Get next batch of elements
      const elements = await Element.find({
        'materials.material': { $in: materialIds }
      })
        .skip(processedElements)
        .limit(BATCH_SIZE)
        .session(session);

      if (!elements.length) break;

      console.debug(`Processing batch of ${elements.length} elements (offset: ${processedElements})`);

      // Prepare bulk operations for this batch
      const bulkOps = elements.map(element => {
        const updatedMaterials = element.materials.map(mat => {
          const material = materialMap.get(mat.material.toString());
          if (!material) {
            console.warn(`Material ${mat.material} not found in materialMap`);
            return mat;
          }

          // Calculate new indicators
          const indicators = MaterialService.calculateIndicators(
            mat.volume,
            material.density,
            material.kbobMatchId
          );

          return {
            ...mat,
            indicators
          };
        });

        return {
          updateOne: {
            filter: { _id: element._id },
            update: {
              $setOnInsert: { createdAt: new Date() },
              $set: {
                materials: updatedMaterials,
                updatedAt: new Date()
              }
            }
          }
        };
      });

      if (bulkOps.length) {
        // Execute bulk update with write concern
        const result = await Element.bulkWrite(bulkOps, {
          ordered: false,
          session,
          writeConcern: { w: 1 }
        });

        totalModified += result.modifiedCount;
        console.debug(`Batch processed: Modified ${result.modifiedCount} of ${bulkOps.length} elements`);

        // Verify a sample of updated elements
        const sampleSize = Math.min(3, result.modifiedCount);
        if (sampleSize > 0) {
          const updatedElements = await Element.find({
            _id: { $in: elements.slice(0, sampleSize).map(e => e._id) }
          }).session(session);

          console.debug('Updated elements sample:', updatedElements.map(e => ({
            _id: e._id,
            materialsCount: e.materials.length,
            hasIndicators: e.materials.every(m => m.indicators),
            sampleIndicators: e.materials[0]?.indicators,
            materialNames: e.materials.map(m => materialMap.get(m.material.toString())?.name).filter(Boolean)
          })));
        }
      }

      processedElements += elements.length;
    }

    return totalModified;
  }

  /**
   * Gets all projects and their associated materials
   */
  static async getProjectsWithMaterials(): Promise<Array<{
    id: string;
    name: string;
    materialIds: string[];
  }>> {
    try {
      // First get all projects
      const projects = await Project.find().lean();
      
      // Get all elements with their materials and project info
      const elements = await Element.find()
        .populate('projectId')
        .select('materials.material projectId')
        .lean();

      // Create a map to store materials for each project
      const projectMaterials = new Map<string, Set<string>>();

      // Initialize the map with all projects
      projects.forEach(project => {
        projectMaterials.set(project._id.toString(), new Set());
      });

      // Process elements to map materials to projects
      elements.forEach(element => {
        if (element.projectId && typeof element.projectId === 'object' && '_id' in element.projectId) {
          const projectId = element.projectId._id.toString();
          
          // Get or create the Set for this project
          let materialSet = projectMaterials.get(projectId);
          if (!materialSet) {
            materialSet = new Set();
            projectMaterials.set(projectId, materialSet);
          }

          // Add all materials from this element to the project's set
          element.materials.forEach(mat => {
            if (mat.material) {
              const materialId = typeof mat.material === 'string' 
                ? mat.material 
                : mat.material.toString();
              materialSet?.add(materialId);
            }
          });
        }
      });

      // Convert the map data into the required format
      const result = projects.map(project => ({
        id: project._id.toString(),
        name: project.name,
        materialIds: Array.from(projectMaterials.get(project._id.toString()) || new Set())
      }));

      console.log('Projects with materials:', result);
      return result;
    } catch (error) {
      console.error('Error in getProjectsWithMaterials:', error);
      throw error;
    }
  }

  /**
   * Get preview data for material changes
   */
  async getKBOBMatchPreview(
    materialIds: string[],
    kbobMatchId: string,
    density?: number
  ): Promise<{
    changes: Array<{
      materialId: string;
      materialName: string;
      oldKbobMatch?: string;
      newKbobMatch: string;
      oldDensity?: number;
      newDensity: number;
      affectedElements: number;
      projects: string[];
    }>;
  }> {
    // Convert string IDs to ObjectIds
    const objectIds = materialIds.map(id => new mongoose.Types.ObjectId(id));
    const kbobObjectId = new mongoose.Types.ObjectId(kbobMatchId);

    // Get materials with their current KBOB matches
    const materials = await Material.find({ _id: { $in: objectIds } })
      .populate('kbobMatchId')
      .lean();

    // Get the new KBOB material
    const newKBOBMaterial = await KBOBMaterial.findById(kbobObjectId).lean();
    if (!newKBOBMaterial) {
      throw new Error('KBOB material not found');
    }

    // Get elements with their project information
    const elements = await Element.find({
      'materials.material': { $in: objectIds }
    })
    .populate({
      path: 'projectId',
      select: 'name'
    })
    .lean();

    // Create a map of material IDs to their projects
    const materialProjects = new Map<string, Set<string>>();
    elements.forEach(element => {
      if (element.projectId && typeof element.projectId === 'object' && 'name' in element.projectId) {
        element.materials.forEach(mat => {
          const materialId = typeof mat.material === 'string' 
            ? mat.material 
            : mat.material.toString();
          
          if (!materialProjects.has(materialId)) {
            materialProjects.set(materialId, new Set());
          }
          materialProjects.get(materialId)?.add(element.projectId.name);
        });
      }
    });

    // Calculate affected elements per material
    const affectedElementsCount = new Map<string, number>();
    elements.forEach(element => {
      element.materials.forEach(mat => {
        const materialId = typeof mat.material === 'string' 
          ? mat.material 
          : mat.material.toString();
        affectedElementsCount.set(
          materialId,
          (affectedElementsCount.get(materialId) || 0) + 1
        );
      });
    });

    const changes = materials.map(material => {
      const materialId = material._id.toString();
      const projectNames = Array.from(materialProjects.get(materialId) || new Set()).sort();
      
      return {
        materialId,
        materialName: material.name,
        oldKbobMatch: material.kbobMatchId ? 
          (typeof material.kbobMatchId === 'object' && 'Name' in material.kbobMatchId ? 
            material.kbobMatchId.Name : undefined) : undefined,
        newKbobMatch: newKBOBMaterial.Name,
        oldDensity: material.density,
        newDensity: density || newKBOBMaterial['kg/unit'] || 
          (newKBOBMaterial['min density'] && newKBOBMaterial['max density'] ? 
            (newKBOBMaterial['min density'] + newKBOBMaterial['max density']) / 2 : 0),
        affectedElements: affectedElementsCount.get(materialId) || 0,
        projects: projectNames
      };
    });

    return { changes };
  }

  /**
   * Recalculates all elements that use any of the given materials
   * @param materialIds List of material IDs to recalculate elements for
   * @param session Optional mongoose session for transaction support
   * @returns Number of elements modified
   */
  static async recalculateElementsForMaterials(
    materialIds: Types.ObjectId[],
    session?: ClientSession
  ): Promise<number> {
    console.debug(`Recalculating elements for ${materialIds.length} materials`);

    // Get all materials with their KBOB matches
    const materials = await Material.find({ _id: { $in: materialIds } })
      .select('_id name kbobMatchId density')
      .populate('kbobMatchId')
      .session(session)
      .lean();

    if (!materials.length) {
      console.warn('No materials found to recalculate');
      return 0;
    }

    const materialMap = new Map(materials.map(m => [m._id.toString(), m]));

    // Process elements in batches of 500 to avoid memory issues
    const BATCH_SIZE = 500;
    let processedElements = 0;
    let totalModified = 0;

    while (true) {
      // Get next batch of elements
      const elements = await Element.find({
        'materials.material': { $in: materialIds }
      })
        .skip(processedElements)
        .limit(BATCH_SIZE)
        .session(session);

      if (!elements.length) break;

      console.debug(`Processing batch of ${elements.length} elements (offset: ${processedElements})`);

      // Prepare bulk operations for this batch
      const bulkOps = elements.map(element => {
        const updatedMaterials = element.materials.map(mat => {
          const material = materialMap.get(mat.material.toString());
          if (!material) {
            console.warn(`Material ${mat.material} not found in materialMap`);
            return mat;
          }

          // Calculate new indicators
          const indicators = MaterialService.calculateIndicators(
            mat.volume,
            material.density,
            material.kbobMatchId
          );

          return {
            ...mat,
            indicators
          };
        });

        return {
          updateOne: {
            filter: { _id: element._id },
            update: {
              $setOnInsert: { createdAt: new Date() },
              $set: {
                materials: updatedMaterials,
                updatedAt: new Date()
              }
            }
          }
        };
      });

      if (bulkOps.length) {
        // Execute bulk update with write concern
        const result = await Element.bulkWrite(bulkOps, {
          ordered: false,
          session,
          writeConcern: { w: 1 }
        });

        totalModified += result.modifiedCount;
        console.debug(`Batch processed: Modified ${result.modifiedCount} of ${bulkOps.length} elements`);

        // Verify a sample of updated elements
        const sampleSize = Math.min(3, result.modifiedCount);
        if (sampleSize > 0) {
          const updatedElements = await Element.find({
            _id: { $in: elements.slice(0, sampleSize).map(e => e._id) }
          }).session(session);

          console.debug('Updated elements sample:', updatedElements.map(e => ({
            _id: e._id,
            materialsCount: e.materials.length,
            hasIndicators: e.materials.every(m => m.indicators),
            sampleIndicators: e.materials[0]?.indicators,
            materialNames: e.materials.map(m => materialMap.get(m.material.toString())?.name).filter(Boolean)
          })));
        }
      }

      processedElements += elements.length;
    }

    return totalModified;
  }

  /**
   * Calculates LCA indicators for given volume and material
   */
  private async calculateIndicators(
    element: ElementDocument,
    materials: MaterialDocument[],
    kbobMaterials: KBOBMaterialDocument[],
    session?: ClientSession
  ): Promise<boolean> {
    console.debug(`Calculating indicators for element ${element._id}`);
    console.debug(`Found ${materials.length} materials and ${kbobMaterials.length} KBOB materials`);

    const updatedMaterials = element.materials.map((elementMaterial) => {
      const material = materials.find((m) => m._id.equals(elementMaterial.material));
      const kbobMaterial = kbobMaterials.find((k) => 
        k._id.equals(material?.kbobMatchId)
      );

      if (!material || !kbobMaterial) {
        console.debug(`Skipping calculation for material ${elementMaterial.material} - Missing material or KBOB match`);
        return elementMaterial;
      }

      console.debug(`Calculating for material: ${material.name}`);
      console.debug(`Using KBOB material: ${kbobMaterial.name}`);
      console.debug(`Volume: ${elementMaterial.volume}, Density: ${material.density}, Fraction: ${elementMaterial.fraction}`);

      // Calculate mass in kg
      const mass = elementMaterial.volume * (material.density || 0) * elementMaterial.fraction;
      console.debug(`Calculated mass: ${mass} kg`);

      // Calculate indicators
      const indicators = {
        gwp: mass * (kbobMaterial.gwp || 0),
        ubp: mass * (kbobMaterial.ubp || 0),
        penre: mass * (kbobMaterial.penre || 0),
      };

      console.debug(`Calculated indicators:`, indicators);

      return {
        ...elementMaterial,
        indicators,
      };
    });

    element.materials = updatedMaterials;
    element.markModified('materials');
    
    try {
      await element.save({ session });
      console.debug(`Successfully saved updated indicators for element ${element._id}`);
      return true;
    } catch (error) {
      console.error(`Error saving element ${element._id}:`, error);
      return false;
    }
  }

  /**
   * Calculate density from KBOB material data
   */
  private static calculateDensity(kbobMaterial: any): number | null {
    if (kbobMaterial["kg/unit"] && typeof kbobMaterial["kg/unit"] === "number") {
      return kbobMaterial["kg/unit"];
    } 
    if (kbobMaterial["min density"] && kbobMaterial["max density"]) {
      return (kbobMaterial["min density"] + kbobMaterial["max density"]) / 2;
    }
    return null;
  }
}
