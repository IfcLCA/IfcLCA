// --- Pyodide and IfcOpenShell Integration ---
import { type PyodideInterface } from "pyodide";

const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.0/full/";
const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`;
const IFC_OPEN_SHELL_WHEEL_URL =
  "https://raw.githubusercontent.com/IfcOpenShell/wasm-wheels/main/ifcopenshell-0.8.2+d50e806-cp312-cp312-emscripten_3_1_58_wasm32.whl";

let pyodidePromise: Promise<PyodideInterface> | null = null;

function ensurePyodideScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Pyodide can only be loaded in the browser."));
      return;
    }

    if (typeof (window as any).loadPyodide === "function") {
      resolve();
      return;
    }

    const existingScript = document.querySelector(
      `script[src=\"${PYODIDE_SCRIPT_URL}\"]`
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load Pyodide script"))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = PYODIDE_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Pyodide script"));
    document.head.appendChild(script);
  });
}

async function getPyodideInstance(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      await ensurePyodideScript();

      if (typeof (window as any).loadPyodide !== "function") {
        throw new Error("Pyodide script not available after loading.");
      }

      const pyodide = await (window as any).loadPyodide({
        indexURL: PYODIDE_INDEX_URL,
      });

      await pyodide.loadPackage("micropip");
      const micropip = pyodide.pyimport("micropip");

      await micropip.install(IFC_OPEN_SHELL_WHEEL_URL);

      // Test import to ensure installation succeeded
      const version = pyodide.runPython(
        "import ifcopenshell; ifcopenshell.version"
      );
      if (!version) {
        throw new Error("IfcOpenShell installation failed.");
      }

      (window as any).pyodide = pyodide;
      return pyodide;
    })().catch((error) => {
      pyodidePromise = null;
      throw error;
    });
  }

  return pyodidePromise;
}

// --- End Pyodide Integration ---

const PYTHON_IFC_PROCESSING_SCRIPT = `
import ifcopenshell
import ifcopenshell.guid
import json
import time

TEMP_IFC_PATH = "/home/pyodide/temp_model.ifc"
PSET_NAME = "CPset_IfcLCA"
PSET_DESCRIPTION = "Life cycle assessment indicators exported from IfcLCA"

PROPERTY_ORDER = [
    ("GWP_fossil", "gwp"),
    ("non-renewableprimaryresourceswithenergycontent-tot", "penre"),
    ("non-renewableprimaryresourceswithoutenergycontent-tot", "penreWithoutEnergy"),
    ("UBP", "ubp"),
]

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
        Description="Organization for IfcLCA exporter",
    )
    person_and_org = model.create_entity(
        "IfcPersonAndOrganization",
        ThePerson=person,
        TheOrganization=organization,
    )

    app_developer = model.create_entity(
        "IfcOrganization", Name="IfcLCA Exporter"
    )
    application = model.create_entity(
        "IfcApplication",
        ApplicationDeveloper=app_developer,
        Version="1.0",
        ApplicationFullName="IfcLCA Exporter",
        ApplicationIdentifier="ifclca.exporter",
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


def ensure_property_set(model, element, owner_history):
    if getattr(element, "IsDefinedBy", None):
        for rel in element.IsDefinedBy:
            if rel.is_a("IfcRelDefinesByProperties"):
                pdef = rel.RelatingPropertyDefinition
                if (
                    pdef
                    and pdef.is_a("IfcPropertySet")
                    and getattr(pdef, "Name", None) == PSET_NAME
                ):
                    if element not in rel.RelatedObjects:
                        rel.RelatedObjects = list(rel.RelatedObjects or []) + [element]
                    return pdef

    pset = model.create_entity(
        "IfcPropertySet",
        GlobalId=ifcopenshell.guid.new(),
        OwnerHistory=owner_history,
        Name=PSET_NAME,
        Description=PSET_DESCRIPTION,
    )

    model.create_entity(
        "IfcRelDefinesByProperties",
        GlobalId=ifcopenshell.guid.new(),
        OwnerHistory=owner_history,
        RelatedObjects=[element],
        RelatingPropertyDefinition=pset,
    )

    return pset


def upsert_single_value(model, pset, prop_name, value):
    if value is None:
        return

    try:
        numeric_value = float(value)
    except (ValueError, TypeError):
        return

    existing_property = None
    if getattr(pset, "HasProperties", None):
        for prop in pset.HasProperties:
            if (
                prop.is_a("IfcPropertySingleValue")
                and getattr(prop, "Name", None) == prop_name
            ):
                existing_property = prop
                break

    if existing_property:
        if getattr(existing_property, "NominalValue", None) and hasattr(existing_property.NominalValue, "wrappedValue"):
            existing_property.NominalValue.wrappedValue = numeric_value
        else:
            existing_property.NominalValue = numeric_value
        return

    single_value = model.create_entity(
        "IfcPropertySingleValue",
        Name=prop_name,
        NominalValue=numeric_value,
        Unit=None,
    )

    current_properties = list(pset.HasProperties or [])
    current_properties.append(single_value)
    pset.HasProperties = current_properties


def export_ifc_with_lca(ifc_file_uint8array_js, lca_json_str):
    try:
        ifc_file_bytes = bytes(ifc_file_uint8array_js.to_py())

        with open(TEMP_IFC_PATH, "wb") as f:
            f.write(ifc_file_bytes)

        model = ifcopenshell.open(TEMP_IFC_PATH)
        if not model:
            return {"error": "Failed to open IFC model from buffer using IfcOpenShell."}

        owner_history = get_or_create_owner_history(model)
        lca_data = json.loads(lca_json_str)

        updated_count = 0
        missing_guids = []

        for guid, indicators in lca_data.items():
            element = model.by_guid(guid)
            if not element:
                missing_guids.append(guid)
                continue

            pset = ensure_property_set(model, element, owner_history)

            for property_name, indicator_key in PROPERTY_ORDER:
                value = indicators.get(indicator_key)
                if value is None and indicator_key == "penreWithoutEnergy":
                    value = indicators.get("penre")
                upsert_single_value(model, pset, property_name, value)

            updated_count += 1

        output_ifc_str = model.to_string()
        return {
            "ifcData": output_ifc_str,
            "updatedCount": updated_count,
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

export interface LcaExportIndicators {
  guid?: string;
  name?: string;
  type?: string;
  gwp?: number;
  penre?: number;
  penreWithoutEnergy?: number;
  ubp?: number;
}

export type LcaExportPayload = Record<string, LcaExportIndicators>;

export interface ExportIfcResult {
  ifcData: string;
  updatedCount: number;
  missingGuids: string[];
}

export async function exportIfcWithLcaService(
  ifcFileBuffer: ArrayBuffer,
  lcaIndicators: LcaExportPayload
): Promise<ExportIfcResult | null> {
  try {
    const pyodide = await getPyodideInstance();

    pyodide.runPython(PYTHON_IFC_PROCESSING_SCRIPT);

    const processIfcFunction = pyodide.globals.get("export_ifc_with_lca");
    if (typeof processIfcFunction !== "function") {
      throw new Error("Python export function not available.");
    }

    const jsUint8Array = new Uint8Array(ifcFileBuffer);
    const payloadJson = JSON.stringify(lcaIndicators);

    const resultProxy = await processIfcFunction(jsUint8Array, payloadJson);
    const resultJS = resultProxy.toJs({ dict_converter: Object.fromEntries });
    resultProxy.destroy();

    if (resultJS.error) {
      console.error("Python script execution failed:", resultJS.error);
      return null;
    }

    if (!resultJS.ifcData) {
      console.error("Python script did not return IFC data.");
      return null;
    }

    return {
      ifcData: resultJS.ifcData as string,
      updatedCount: (resultJS.updatedCount as number) || 0,
      missingGuids: (resultJS.missingGuids as string[]) || [],
    };
  } catch (error) {
    console.error("Error during IFC export process:", error);
    pyodidePromise = null;
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
