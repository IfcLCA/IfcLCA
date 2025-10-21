import { type PyodideInterface } from "pyodide";

declare global {
  interface Window {
    loadPyodide: (config?: { indexURL?: string }) => Promise<PyodideInterface>;
    pyodide?: PyodideInterface;
  }
}

const IFC_OPEN_SHELL_WHEEL_URL =
  "https://raw.githubusercontent.com/IfcOpenShell/wasm-wheels/main/ifcopenshell-0.8.2+d50e806-cp312-cp312-emscripten_3_1_58_wasm32.whl";

let pyodidePromise: Promise<PyodideInterface> | null = null;

async function getPyodideInstance(): Promise<PyodideInterface> {
  if (typeof window === "undefined") {
    throw new Error("Pyodide can only be loaded in the browser environment.");
  }

  if (!pyodidePromise) {
    pyodidePromise = new Promise(async (resolve, reject) => {
      try {
        if (!window.loadPyodide) {
          // Dynamically load Pyodide script
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
          script.async = true;
          script.onload = async () => {
            try {
              console.log("Loading Pyodide...");
              const pyodide = await window.loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
              });
              console.log("Pyodide loaded successfully.");

              console.log("Loading micropip and numpy packages...");
              await pyodide.loadPackage(["micropip", "numpy"]);
              const micropip = pyodide.pyimport("micropip");
              console.log("Micropip and numpy loaded successfully.");

              console.log(`Installing IfcOpenShell from: ${IFC_OPEN_SHELL_WHEEL_URL}`);
              await micropip.install(IFC_OPEN_SHELL_WHEEL_URL);
              console.log("IfcOpenShell installed successfully via micropip.");

              // Test import - numpy should already be loaded
              const version = pyodide.runPython(
                "import numpy; import ifcopenshell; ifc_version = ifcopenshell.version; ifc_version"
              );
              console.log("IfcOpenShell version:", version);
              if (!version) {
                throw new Error(
                  "IfcOpenShell imported but version is undefined. Installation might be incomplete."
                );
              }

              window.pyodide = pyodide;
              resolve(pyodide);
            } catch (error) {
              console.error("Error loading Pyodide or IfcOpenShell:", error);
              pyodidePromise = null;
              reject(error);
            }
          };
          script.onerror = () => {
            const error = new Error("Failed to load Pyodide script");
            pyodidePromise = null;
            reject(error);
          };
          document.head.appendChild(script);
        } else {
          // Pyodide already loaded
          console.log("Loading Pyodide...");
          const pyodide = await window.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
          });
          console.log("Pyodide loaded successfully.");

          console.log("Loading micropip and numpy packages...");
          await pyodide.loadPackage(["micropip", "numpy"]);
          const micropip = pyodide.pyimport("micropip");
          console.log("Micropip and numpy loaded successfully.");

          console.log(`Installing IfcOpenShell from: ${IFC_OPEN_SHELL_WHEEL_URL}`);
          await micropip.install(IFC_OPEN_SHELL_WHEEL_URL);
          console.log("IfcOpenShell installed successfully via micropip.");

          // Test import - numpy should already be loaded
          const version = pyodide.runPython(
            "import numpy; import ifcopenshell; ifc_version = ifcopenshell.version; ifc_version"
          );
          console.log("IfcOpenShell version:", version);
          if (!version) {
            throw new Error(
              "IfcOpenShell imported but version is undefined. Installation might be incomplete."
            );
          }

          window.pyodide = pyodide;
          resolve(pyodide);
        }
      } catch (error) {
        console.error("Error during Pyodide initialization:", error);
        pyodidePromise = null;
        reject(error);
      }
    });
  }

  return pyodidePromise;
}

const PYTHON_IFC_PROCESSING_SCRIPT = `
import ifcopenshell
import ifcopenshell.guid
import json
import time

TEMP_IFC_PATH = "/home/pyodide/temp_model.ifc"

PSET_NAME = "CPset_IfcLCA"


def get_or_create_owner_history(model):
    owner_history = model.by_type("IfcOwnerHistory")
    if owner_history:
        return owner_history[0]

    person = model.create_entity(
        "IfcPerson",
        Identification="N/A",
        GivenName="Default",
        FamilyName="User",
    )
    organization = model.create_entity(
        "IfcOrganization",
        Name="Default Organization",
        Description="Organization for IFC LCA exporter",
    )
    person_and_org = model.create_entity(
        "IfcPersonAndOrganization",
        ThePerson=person,
        TheOrganization=organization,
    )

    app_developer = model.create_entity(
        "IfcOrganization", Name="IFC LCA Exporter"
    )
    application = model.create_entity(
        "IfcApplication",
        ApplicationDeveloper=app_developer,
        Version="1.0",
        ApplicationFullName="IFC LCA Exporter",
        ApplicationIdentifier="ifc-lca.app",
    )

    current_time = int(time.time())

    new_owner_history = model.create_entity(
        "IfcOwnerHistory",
        OwningUser=person_and_org,
        OwningApplication=application,
        State="READWRITE",
        ChangeAction="ADDED",
        CreationDate=current_time,
    )
    return new_owner_history


def get_or_create_unit_assignment(model):
    assignments = model.by_type("IfcUnitAssignment")
    if assignments:
        return assignments[0]

    project = model.by_type("IfcProject")
    unit_assignment = model.create_entity("IfcUnitAssignment", Units=[])
    if project:
        project[0].UnitsInContext = unit_assignment
    return unit_assignment


def find_unit_in_assignment(unit_assignment, predicate):
    units = list(unit_assignment.Units or [])
    for unit in units:
        try:
            if predicate(unit):
                return unit
        except Exception:
            continue
    return None


def add_unit_to_assignment(unit_assignment, unit):
    units = list(unit_assignment.Units or [])
    if unit not in units:
        units.append(unit)
        unit_assignment.Units = units


def get_or_reuse_si_unit(model, unit_assignment, unit_type, name, prefix=None):
    existing = find_unit_in_assignment(
        unit_assignment,
        lambda u: u.is_a("IfcSIUnit")
        and getattr(u, "UnitType", None) == unit_type
        and getattr(u, "Name", None) == name
        and (prefix is None or getattr(u, "Prefix", None) == prefix),
    )
    if existing:
        return existing

    params = {"UnitType": unit_type, "Name": name}
    if prefix:
        params["Prefix"] = prefix
    unit = model.create_entity("IfcSIUnit", **params)
    add_unit_to_assignment(unit_assignment, unit)
    return unit


def get_or_create_hour_unit(model, unit_assignment, second_unit):
    existing = find_unit_in_assignment(
        unit_assignment,
        lambda u: u.is_a("IfcConversionBasedUnit") and getattr(u, "Name", None) == "hour",
    )
    if existing:
        return existing

    conversion = model.create_entity(
        "IfcMeasureWithUnit",
        ValueComponent=model.create_entity("IfcReal", 3600.0),
        UnitComponent=second_unit,
    )
    dimensions = model.create_entity(
        "IfcDimensionalExponents",
        LengthExponent=0,
        MassExponent=0,
        TimeExponent=1,
        ElectricCurrentExponent=0,
        ThermodynamicTemperatureExponent=0,
        AmountOfSubstanceExponent=0,
        LuminousIntensityExponent=0,
    )
    hour_unit = model.create_entity(
        "IfcConversionBasedUnit",
        Dimensions=dimensions,
        UnitType="TIMEUNIT",
        Name="hour",
        ConversionFactor=conversion,
    )
    add_unit_to_assignment(unit_assignment, hour_unit)
    return hour_unit


def get_or_create_lca_units(model):
    unit_assignment = get_or_create_unit_assignment(model)

    kg_unit = get_or_reuse_si_unit(model, unit_assignment, "MASSUNIT", "GRAM", "KILO")
    watt_unit = get_or_reuse_si_unit(model, unit_assignment, "POWERUNIT", "WATT")
    kw_unit = get_or_reuse_si_unit(model, unit_assignment, "POWERUNIT", "WATT", "KILO")
    second_unit = get_or_reuse_si_unit(model, unit_assignment, "TIMEUNIT", "SECOND")
    hour_unit = get_or_create_hour_unit(model, unit_assignment, second_unit)

    gwp_unit = find_unit_in_assignment(
        unit_assignment,
        lambda u: u.is_a("IfcDerivedUnit")
        and getattr(u, "UnitType", None) == "USERDEFINED"
        and getattr(u, "UserDefinedType", None) == "CO2 equivalent",
    )
    if not gwp_unit:
        gwp_unit = model.create_entity(
            "IfcDerivedUnit",
            Elements=[
                model.create_entity("IfcDerivedUnitElement", Unit=kg_unit, Exponent=1)
            ],
            UnitType="USERDEFINED",
            UserDefinedType="CO2 equivalent",
        )
        add_unit_to_assignment(unit_assignment, gwp_unit)

    penre_unit = find_unit_in_assignment(
        unit_assignment,
        lambda u: u.is_a("IfcDerivedUnit")
        and getattr(u, "UnitType", None) == "USERDEFINED"
        and getattr(u, "UserDefinedType", None) == "kWh",
    )
    if not penre_unit:
        penre_unit = model.create_entity(
            "IfcDerivedUnit",
            Elements=[
                model.create_entity("IfcDerivedUnitElement", Unit=kw_unit, Exponent=1),
                model.create_entity("IfcDerivedUnitElement", Unit=hour_unit, Exponent=1),
            ],
            UnitType="USERDEFINED",
            UserDefinedType="kWh",
        )
        add_unit_to_assignment(unit_assignment, penre_unit)

    ubp_unit = find_unit_in_assignment(
        unit_assignment,
        lambda u: u.is_a("IfcContextDependentUnit")
        and getattr(u, "Name", None) == "UBP",
    )
    if not ubp_unit:
        dimensions = model.create_entity(
            "IfcDimensionalExponents",
            LengthExponent=0,
            MassExponent=0,
            TimeExponent=0,
            ElectricCurrentExponent=0,
            ThermodynamicTemperatureExponent=0,
            AmountOfSubstanceExponent=0,
            LuminousIntensityExponent=0,
        )
        ubp_unit = model.create_entity(
            "IfcContextDependentUnit",
            Dimensions=dimensions,
            UnitType="USERDEFINED",
            Name="UBP",
        )
        add_unit_to_assignment(unit_assignment, ubp_unit)

    return {
        "GWP": gwp_unit,
        "PENRE": penre_unit,
        "UBP": ubp_unit,
    }


def find_or_create_lca_pset(model, element, owner_history):
    existing_relation = None
    existing_pset = None

    relations = getattr(element, "IsDefinedBy", []) or []
    for rel in relations:
        if not rel or not rel.is_a("IfcRelDefinesByProperties"):
            continue
        prop_def = rel.RelatingPropertyDefinition
        if prop_def and prop_def.is_a("IfcPropertySet") and prop_def.Name == PSET_NAME:
            existing_relation = rel
            existing_pset = prop_def
            break

    if existing_pset:
        return existing_pset

    new_pset = model.create_entity(
        "IfcPropertySet",
        GlobalId=ifcopenshell.guid.new(),
        OwnerHistory=owner_history,
        Name=PSET_NAME,
        HasProperties=[],
    )

    model.create_entity(
        "IfcRelDefinesByProperties",
        GlobalId=ifcopenshell.guid.new(),
        OwnerHistory=owner_history,
        RelatedObjects=[element],
        RelatingPropertyDefinition=new_pset,
    )

    return new_pset


def ensure_property(model, pset, prop_name, value, unit=None):
    # Handle string values (for MaterialName, MaterialID, etc.)
    if isinstance(value, str):
        properties = list(getattr(pset, "HasProperties", []) or [])
        target_property = None
        for prop in properties:
            if prop and prop.is_a("IfcPropertySingleValue") and prop.Name == prop_name:
                target_property = prop
                break
        
        ifc_value = model.create_entity("IfcText", value)
        
        if target_property:
            target_property.NominalValue = ifc_value
            return
        
        new_property = model.create_entity(
            "IfcPropertySingleValue",
            Name=prop_name,
            NominalValue=ifc_value,
        )
        properties.append(new_property)
        pset.HasProperties = properties
        return
    
    # Handle numeric values (existing behavior)
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return

    # Round to 3 decimal places
    numeric_value = round(numeric_value, 3)

    properties = list(getattr(pset, "HasProperties", []) or [])

    target_property = None
    for prop in properties:
        if prop and prop.is_a("IfcPropertySingleValue") and prop.Name == prop_name:
            target_property = prop
            break

    # Create IfcReal value entity
    ifc_value = model.create_entity("IfcReal", numeric_value)

    if target_property:
        target_property.NominalValue = ifc_value
        if unit:
            target_property.Unit = unit
        return

    new_property = model.create_entity(
        "IfcPropertySingleValue",
        Name=prop_name,
        NominalValue=ifc_value,
        Unit=unit,
    )
    properties.append(new_property)
    pset.HasProperties = properties


def export_ifc_with_lca_results(ifc_file_uint8array_js, results_json_str):
    try:
        ifc_file_bytes = bytes(ifc_file_uint8array_js.to_py())

        with open(TEMP_IFC_PATH, "wb") as f:
            f.write(ifc_file_bytes)

        model = ifcopenshell.open(TEMP_IFC_PATH)
        if not model:
            return {"error": "Failed to open IFC model from buffer using IfcOpenShell."}

        owner_history = get_or_create_owner_history(model)
        lca_units = get_or_create_lca_units(model)

        payload = json.loads(results_json_str)
        results_data = payload.get("results") if isinstance(payload, dict) else None
        if results_data is None:
            results_data = payload if isinstance(payload, dict) else {}

        if not isinstance(results_data, dict):
            return {"error": "Invalid results data provided to exporter."}

        updated_elements = 0
        missing_guids = []

        for guid, properties in results_data.items():
            if not isinstance(properties, dict):
                continue

            element = model.by_guid(guid)
            if not element:
                missing_guids.append(guid)
                continue

            property_items = [
                (name, value)
                for name, value in properties.items()
                if value is not None
            ]

            if not property_items:
                continue

            pset = find_or_create_lca_pset(model, element, owner_history)

            for prop_name, prop_value in property_items:
                prop_name_upper = prop_name.upper()
                unit = lca_units.get(prop_name_upper)
                ensure_property(model, pset, prop_name_upper, prop_value, unit)

            updated_elements += 1

        output_ifc_str = model.to_string()
        return {
            "ifcData": output_ifc_str,
            "updatedCount": updated_elements,
            "missingGuids": missing_guids,
        }

    except Exception as e:
        import traceback

        error_message = f"Python error during IFC processing: {str(e)}"
        tb_str = traceback.format_exc()
        print(error_message)
        print(tb_str)
        return {"error": error_message, "traceback": tb_str}
`;

export interface ElementLcaPropertyMap {
  [propertyName: string]: number | string | null | undefined;
}

export type ElementLcaResultsMap = Record<string, ElementLcaPropertyMap>;

export interface ExportIfcResult {
  ifcData: string;
  updatedCount?: number;
  missingGuids?: string[];
}

export async function exportIfcWithLcaResultsService(
  ifcFileBuffer: ArrayBuffer,
  elementResults: ElementLcaResultsMap
): Promise<ExportIfcResult | null> {
  console.log("Starting IFC export with LCA results...");

  try {
    const pyodide = await getPyodideInstance();
    console.log("Pyodide instance obtained for export.");

    pyodide.runPython(PYTHON_IFC_PROCESSING_SCRIPT);
    console.log("Python IFC processing script loaded into Pyodide.");

    const processIfcFunction = pyodide.globals.get(
      "export_ifc_with_lca_results"
    );
    if (typeof processIfcFunction !== "function") {
      console.error(
        "Python function 'export_ifc_with_lca_results' not found in Pyodide scope."
      );
      throw new Error("Python export function not available.");
    }
    console.log("Python export function retrieved from Pyodide.");

    const jsUint8Array = new Uint8Array(ifcFileBuffer);
    const payload = { results: elementResults };
    const resultsJsonStr = JSON.stringify(payload);
    console.log("Data prepared for Python script.");

    const resultProxy = await processIfcFunction(jsUint8Array, resultsJsonStr);
    console.log("Python script executed. Processing result...");

    const resultJS = resultProxy.toJs({ dict_converter: Object.fromEntries }) as
      | ExportIfcResult & { error?: string; traceback?: string }
      | undefined;
    resultProxy.destroy();
    console.log("Python result converted to JS:", resultJS);

    if (!resultJS) {
      console.error("Python script did not return a result.");
      return null;
    }

    if ((resultJS as any).error) {
      console.error("Python script execution failed:", (resultJS as any).error);
      return null;
    }

    if (resultJS.ifcData) {
      console.log("IFC export successful.");
      return {
        ifcData: resultJS.ifcData,
        updatedCount: resultJS.updatedCount,
        missingGuids: Array.isArray(resultJS.missingGuids)
          ? (resultJS.missingGuids as string[])
          : [],
      };
    }

    console.error("Python script did not return IFC data.");
    return null;
  } catch (error) {
    console.error("Error during IFC export process:", error);
    if (error instanceof Error && error.message.includes("IfcOpenShell")) {
      pyodidePromise = null;
    }
    return null;
  }
}

export function downloadFile(
  content: BlobPart,
  fileName: string,
  contentType: string
) {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  document.body.removeChild(a);
}
