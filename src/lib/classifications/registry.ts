import { ClassificationSystem, ClassificationRegistry } from './types';

class ClassificationRegistryImpl implements ClassificationRegistry {
    private systems = new Map<string, ClassificationSystem>();
    private defaultSystemId = 'ebkp';

    registerSystem(system: ClassificationSystem): void {
        this.systems.set(system.id, system);
    }

    getSystem(id: string): ClassificationSystem | undefined {
        // Try direct lookup first
        const directMatch = this.systems.get(id);
        if (directMatch) return directMatch;

        // Try lowercase lookup
        const lowerMatch = this.systems.get(id.toLowerCase());
        if (lowerMatch) return lowerMatch;

        // Try finding by name (e.g., "eBKP-H" -> "ebkp")
        for (const system of this.systems.values()) {
            if (system.name.toLowerCase() === id.toLowerCase() ||
                system.id.toLowerCase() === id.toLowerCase()) {
                return system;
            }
        }

        return undefined;
    }

    listSystems(): ClassificationSystem[] {
        return Array.from(this.systems.values());
    }

    getDefaultSystem(): ClassificationSystem {
        const system = this.systems.get(this.defaultSystemId);
        if (!system) {
            throw new Error(`Default classification system '${this.defaultSystemId}' not found`);
        }
        return system;
    }

    setDefaultSystem(id: string): void {
        if (!this.systems.has(id)) {
            throw new Error(`Classification system '${id}' not registered`);
        }
        this.defaultSystemId = id;
    }
}

export const classificationRegistry = new ClassificationRegistryImpl();

