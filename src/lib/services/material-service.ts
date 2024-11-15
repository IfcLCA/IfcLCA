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

    console.log(`🔍 Starting update for material name "${referenceMaterial.name}" (reference ID: ${materialId})`);

    // First find all materials with this name across all projects
    const materialsToUpdate = await Material.find({ 
      name: referenceMaterial.name 
    })
    .select('_id name projectId')
    .populate('projectId', 'name')
    .session(session)
    .lean();

    console.log(`📊 Found ${materialsToUpdate.length} materials with name "${referenceMaterial.name}" across projects:`);
    materialsToUpdate.forEach(mat => {
      console.log(`- Material ID=${mat._id}, Project=${mat.projectId?.name || mat.projectId}`);
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

    console.log(`📊 Update result: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`);

    // Get all updated materials to verify the update
    const updatedMaterials = await Material.find({ 
      name: referenceMaterial.name 
    })
    .select('_id name projectId kbobMatchId density')
    .populate('projectId', 'name')
    .session(session)
    .lean();

    console.log('🔍 Verification of updated materials:');
    updatedMaterials.forEach(mat => {
      console.log(`- Material ID=${mat._id}, Project=${mat.projectId?.name || mat.projectId}`);
      console.log(`  KBOB Match=${mat.kbobMatchId}, Density=${mat.density}`);
    });

    // Get all elements that use any of these materials
    const elements = await Element.find({
      'materials.material': { $in: updatedMaterials.map(m => m._id) }
    })
    .select('_id projectId')
    .populate('projectId', 'name')
    .session(session);

    console.log(`📊 Found ${elements.length} elements to update across projects:`);
    const elementsByProject = new Map<string, number>();
    elements.forEach(elem => {
      const projectName = elem.projectId?.name || elem.projectId?.toString() || 'unknown';
      elementsByProject.set(projectName, (elementsByProject.get(projectName) || 0) + 1);
    });
    elementsByProject.forEach((count, project) => {
      console.log(`- Project "${project}": ${count} elements`);
    });

    // Recalculate elements for all materials with this name
    const recalcResult = await this.recalculateElementsForMaterials(
      updatedMaterials.map(m => m._id),
      session
    );

    console.log(`📊 Final result: Updated ${updateResult.modifiedCount} materials and recalculated ${recalcResult} elements`);
    console.log(`📊 Affected projects: ${Array.from(elementsByProject.keys()).join(', ')}`);

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
    console.log(`🔍 Recalculating elements for ${materialIds.length} materials`);

    // Get all materials with their KBOB matches
    const materials = await Material.find({ _id: { $in: materialIds } })
      .select('_id name kbobMatchId density')
      .populate('kbobMatchId')
      .session(session)
      .lean();

    if (!materials.length) {
      console.log('⚠️ No materials found to recalculate');
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

      console.log(`📊 Processing batch of ${elements.length} elements (offset: ${processedElements})`);

      // Prepare bulk operations for this batch
      const bulkOps = elements.map(element => {
        const updatedMaterials = element.materials.map(mat => {
          const material = materialMap.get(mat.material.toString());
          if (!material) {
            console.log(`⚠️ Material ${mat.material} not found in materialMap`);
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
        console.log(`📊 Batch processed: Modified ${result.modifiedCount} of ${bulkOps.length} elements`);

        // Verify a sample of updated elements
        const sampleSize = Math.min(3, result.modifiedCount);
        if (sampleSize > 0) {
          const updatedElements = await Element.find({
            _id: { $in: elements.slice(0, sampleSize).map(e => e._id) }
          }).session(session);

          console.log('🔍 Updated elements sample:', updatedElements.map(e => ({
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

      console.log('📊 Projects with materials:', result);
      return result;
    } catch (error) {
      console.error('🚨 Error in getProjectsWithMaterials:', error);
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
   * Finds the best matching KBOB material for a given material name
   * Uses exact matching
   */
  static async findBestKBOBMatch(
    materialName: string
  ): Promise<{ kbobMaterial: any; score: number } | null> {
    console.log('🔍 Finding exact KBOB match for:', materialName);
    
    // Clean the material name but preserve case and special characters
    const cleanedName = materialName.trim();
    console.log('📝 Cleaned material name:', cleanedName);
    
    // First try exact match
    const exactMatch = await KBOBMaterial.findOne({
      Name: cleanedName
    }).lean();

    if (exactMatch) {
      console.log('✅ Found exact match:', {
        name: exactMatch.Name,
        category: exactMatch.Category
      });
      return { kbobMaterial: exactMatch, score: 1.0 };
    }

    // If no exact match, try case-insensitive match
    const caseInsensitiveMatch = await KBOBMaterial.findOne({
      Name: { $regex: `^${cleanedName}$`, $options: 'i' }
    }).lean();

    if (caseInsensitiveMatch) {
      console.log('✅ Found case-insensitive match:', {
        name: caseInsensitiveMatch.Name,
        category: caseInsensitiveMatch.Category
      });
      return { kbobMaterial: caseInsensitiveMatch, score: 0.99 };
    }

    console.log('❌ No exact match found for:', cleanedName);
    return null;
  }

  /**
   * Calculate density from KBOB material data
   */
  static calculateDensity(kbobMaterial: any): number | null {
    console.log('🔍 [calculateDensity] Input:', {
      kbobId: kbobMaterial._id,
      name: kbobMaterial.Name,
      kgPerUnit: kbobMaterial['kg/unit'],
      minDensity: kbobMaterial['min density'],
      maxDensity: kbobMaterial['max density']
    });

    // First try kg/unit if it's a valid number
    if (typeof kbobMaterial['kg/unit'] === 'number' && !isNaN(kbobMaterial['kg/unit'])) {
      console.log('✨ [calculateDensity] Using kg/unit as density:', kbobMaterial['kg/unit']);
      return kbobMaterial['kg/unit'];
    }

    // Then try min/max density average
    if (typeof kbobMaterial['min density'] === 'number' && 
        typeof kbobMaterial['max density'] === 'number' &&
        !isNaN(kbobMaterial['min density']) && 
        !isNaN(kbobMaterial['max density'])) {
      const avgDensity = (kbobMaterial['min density'] + kbobMaterial['max density']) / 2;
      console.log('✨ [calculateDensity] Using average of min/max density:', avgDensity);
      return avgDensity;
    }

    console.log('⚠️ [calculateDensity] No valid density found');
    return null;
  }

  /**
   * Calculates LCA indicators for a material volume
   */
  static calculateIndicators(
    volume: number,
    density: number | undefined,
    kbobMaterial: any
  ): ILCAIndicators | undefined {
    console.log('🔍 [calculateIndicators] Input:', {
      volume,
      density,
      kbobMaterial: kbobMaterial ? {
        id: kbobMaterial._id,
        name: kbobMaterial.Name,
        gwp: kbobMaterial.GWP,
        ubp: kbobMaterial.UBP,
        penre: kbobMaterial.PENRE
      } : null
    });

    if (!kbobMaterial) {
      console.log('⚠️ [calculateIndicators] Missing KBOB material');
      return undefined;
    }

    if (typeof density !== 'number' || isNaN(density) || density <= 0) {
      console.log('⚠️ [calculateIndicators] Invalid density:', density);
      return undefined;
    }

    if (typeof volume !== 'number' || isNaN(volume)) {
      console.log('⚠️ [calculateIndicators] Invalid volume:', volume);
      return undefined;
    }

    if (typeof kbobMaterial.GWP !== 'number' || 
        typeof kbobMaterial.UBP !== 'number' || 
        typeof kbobMaterial.PENRE !== 'number') {
      console.log('⚠️ [calculateIndicators] Missing indicator values:', {
        gwp: kbobMaterial.GWP,
        ubp: kbobMaterial.UBP,
        penre: kbobMaterial.PENRE
      });
      return undefined;
    }

    // Calculate mass in kg
    const mass = volume * density;
    console.log('📊 [calculateIndicators] Calculated mass:', mass, 'kg');

    // Calculate indicators
    const indicators = {
      gwp: mass * kbobMaterial.GWP,
      ubp: mass * kbobMaterial.UBP,
      penre: mass * kbobMaterial.PENRE
    };

    console.log('✨ [calculateIndicators] Calculated indicators:', indicators);
    return indicators;
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
    console.log(`🔍 Recalculating elements for ${materialIds.length} materials`);

    // Get all materials with their KBOB matches
    const materials = await Material.find({ _id: { $in: materialIds } })
      .select('_id name kbobMatchId density')
      .populate('kbobMatchId')
      .session(session)
      .lean();

    if (!materials.length) {
      console.log('⚠️ No materials found to recalculate');
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

      console.log(`📊 Processing batch of ${elements.length} elements (offset: ${processedElements})`);

      // Prepare bulk operations for this batch
      const bulkOps = elements.map(element => {
        const updatedMaterials = element.materials.map(mat => {
          const material = materialMap.get(mat.material.toString());
          if (!material) {
            console.log(`⚠️ Material ${mat.material} not found in materialMap`);
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
        console.log(`📊 Batch processed: Modified ${result.modifiedCount} of ${bulkOps.length} elements`);

        // Verify a sample of updated elements
        const sampleSize = Math.min(3, result.modifiedCount);
        if (sampleSize > 0) {
          const updatedElements = await Element.find({
            _id: { $in: elements.slice(0, sampleSize).map(e => e._id) }
          }).session(session);

          console.log('🔍 Updated elements sample:', updatedElements.map(e => ({
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
}
