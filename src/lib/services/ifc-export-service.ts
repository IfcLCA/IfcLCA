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

  if (typeof window.loadPyodide !== "function") {
    console.error(
      "Pyodide script not loaded. Please ensure it's included in your HTML page."
    );
    throw new Error("Pyodide script not loaded.");
  }

  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      console.log("Loading Pyodide...");
      const pyodide = await window.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.0/full/",
      });
      console.log("Pyodide loaded successfully.");

      console.log("Loading micropip package...");
      await pyodide.loadPackage("micropip");
      const micropip = pyodide.pyimport("micropip");
      console.log("Micropip loaded successfully.");

      console.log(`Installing IfcOpenShell from: ${IFC_OPEN_SHELL_WHEEL_URL}`);
      try {
        await micropip.install(IFC_OPEN_SHELL_WHEEL_URL);
        console.log("IfcOpenShell installed successfully via micropip.");

        const version = pyodide.runPython(
          "import ifcopenshell; ifc_version = ifcopenshell.version; ifc_version"
        );
        console.log("IfcOpenShell version:", version);
        if (!version) {
          throw new Error(
            "IfcOpenShell imported but version is undefined. Installation might be incomplete."
          );
        }
      } catch (error) {
        console.error("Error installing or testing IfcOpenShell:", error);
        pyodidePromise = null;
        throw error;
      }

      window.pyodide = pyodide;
      return pyodide;
    })();
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


def ensure_property(model, pset, prop_name, value):
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return

    properties = list(getattr(pset, "HasProperties", []) or [])

    target_property = None
    for prop in properties:
        if prop and prop.is_a("IfcPropertySingleValue") and prop.Name == prop_name:
            target_property = prop
            break

    if target_property:
        target_property.NominalValue = ("IfcReal", numeric_value)
        return

    new_property = model.create_entity(
        "IfcPropertySingleValue",
        Name=prop_name,
        NominalValue=("IfcReal", numeric_value),
        Unit=None,
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

        payload = json.loads(results_json_str)
        results_data = payload.get("results") if isinstance(payload, dict) else None
        if results_data is None:
            results_data = payload if isinstance(payload, dict) else {}

        if not isinstance(results_data, dict):
            return {"error": "Invalid results data provided to exporter."}

        updated_elements = 0

        for guid, properties in results_data.items():
            if not isinstance(properties, dict):
                continue

            element = model.by_guid(guid)
            if not element:
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
                ensure_property(model, pset, prop_name, prop_value)

            updated_elements += 1

        output_ifc_str = model.to_string()
        return {"ifcData": output_ifc_str, "updatedCount": updated_elements}

    except Exception as e:
        import traceback

        error_message = f"Python error during IFC processing: {str(e)}"
        tb_str = traceback.format_exc()
        print(error_message)
        print(tb_str)
        return {"error": error_message, "traceback": tb_str}
`;

export interface ElementLcaPropertyMap {
  [propertyName: string]: number | null | undefined;
}

export type ElementLcaResultsMap = Record<string, ElementLcaPropertyMap>;

export interface ExportIfcResult {
  ifcData: string;
  updatedCount?: number;
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
