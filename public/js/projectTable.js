// Initialize Tabulator on DOM element
var table = new Tabulator("#elements-table", {
    height: "auto",
    layout: "fitColumns",
    ajaxURL: "/api/projects/" + projectId + "/elements", // URL to fetch data
    columns: [
        {title: "GUID", field: "guid"},
        {title: "Name", field: "name"},
        {title: "Type", field: "type"},
        {title: "IfcClass", field: "ifc_class"},
        {title: "BuildingStorey", field: "building_storey"},
        {title: "IsLoadbearing", field: "is_loadbearing"},
        {title: "IsExternal", field: "is_external"},
        {title: "Volume", field: "volume"},
        {title: "Surface", field: "surface"},
        {title: "Material", field: "material"},
        // Matched Material as a dropdown with KBOB Materials as selection
        {title: "Matched Material", field: "matched_material", editor: "select", editorParams: {values: ["Material 1", "Material 2", "Material 3"]}}, // Replace with actual KBOB Materials
        {title: "Rohdichte (kg/m3)", field: "rohdichte", editor: "input"},
        {title: "Indikator (kgCO2eq/kg)", field: "indikator", editor: "input"},
        {title: "Total CO2", field: "total_co2", formatter: "textarea"},
        {title: "Bewehrung", field: "bewehrung", editor: "input"},
        // ... rest of the columns ...
    ],
    // Additional Tabulator options for sorting, filtering, and collapsing will be added here
    // ...
});
