export * from './types';
export * from './registry';
export { ebkpSystem } from './ebkp';
export { classificationRegistry } from './registry';

// Auto-register systems
import { classificationRegistry } from './registry';
import { ebkpSystem } from './ebkp';

classificationRegistry.registerSystem(ebkpSystem);

// Future systems can be added here:
// import { uniformatSystem } from './uniformat';
// classificationRegistry.registerSystem(uniformatSystem);

