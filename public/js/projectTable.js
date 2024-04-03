// Initialize Tabulator on DOM element
var table = new Tabulator("#elements-table", {
    height: "auto",
    layout: "fitColumns",
    // Function to set the AJAX URL dynamically to fetch the latest elements by project name
    ajaxURL: function(url){
        console.log("Fetching building elements data from URL:", url);
        return "/api/projects/latest/" + projectName + "/elements";
    },
    ajaxResponse:function(url, params, response){
        console.log("Received response for building elements data:", response);
        return response; //return the tableData property of a response json object
    },
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
        {title: "Matched Material", field: "matched_material", editor: "select", editorParams: {values: ["Material 1", "Material 2", "Material 3"]}},
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
