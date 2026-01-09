/**
 * LCA Services - Multi-source Life Cycle Assessment data providers
 *
 * Supported sources:
 * - KBOB (Switzerland): GWP, UBP, PENRE
 * - ÖKOBAUDAT (Germany): GWP, PENRE
 * - OpenEPD/EC3 (Global): GWP
 */

export * from "./kbob-lca-service";
export * from "./okobaudat-lca-service";
export * from "./openepd-lca-service";
export * from "./lca-service-factory";
