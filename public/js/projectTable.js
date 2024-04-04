console.log('projectTable.js is loaded');
console.log(`projectName: ${projectName}`);

// Check if the projectName variable is defined
if (typeof projectName === 'undefined') {
    console.error('projectName variable is not defined. Please check your code to make sure the projectName variable is defined before initializing Tabulator.');
} else {
    console.log(`projectName: ${projectName}`);
}

// Initialize Tabulator on DOM element
var table = new Tabulator("#elements-table", {
    height: "auto",
    layout: "fitColumns",
    ajaxURL:  `/api/projects/${projectId}/building-elements`, // Ensure projectId is correctly defined
    
    ajaxRequesting:function(url, params){
        // Log the AJAX request details
        console.log("Making AJAX request to:", url, "with params:", params);
    },
    
    ajaxResponse:function(url, params, response){
        // Log the response for debugging
        console.log("Received response for building elements data:", response);
        
        if (!response || response.length === 0) {
            console.error("No response or empty response received for building elements data.");
            return []; // Return an empty array to prevent errors in Tabulator
        }
        
        return response; // Directly return the response as it matches the expected format
    },
    
    ajaxError:function(xhr, textStatus, errorThrown){
        // Handle AJAX errors
        console.error("AJAX error:", textStatus, errorThrown);
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
        // Matched Material as a dropdown with KBOB Materials as selection
        {title: "Matched Material", field: "matched_material", editor: "select", editorParams: {values: ["Material 1", "Material 2", "Material 3"]}}, // Replace with actual KBOB Materials
        {title: "Rohdichte (kg/m3)", field: "rohdichte", editor: "input"},
        {title: "Indikator (kgCO2eq/kg)", field: "indikator"},
        {title: "Total CO2", field: "total_co2", formatter: "textarea"},
        {title: "Bewehrung", field: "bewehrung", editor: "input"},
    ],
    // Additional Tabulator options for sorting, filtering, and collapsing will be added here
    // ...  
    // Add a button to save the table data
    footerElement: "<button id='save-table-data'>Save Table Data</button>",
    // Add a callback to handle the button click event
    footerElementClick: function(e, element){
        if(element._item.id === 'save-table-data'){
            // Get the table data
            var tableData = table.getData();
            console.log("Table data:", tableData);
            // Send the table data to the server
            fetch("/api/projects/latest/" + projectName + "/elements", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(tableData),
            })
            .then(function(response) {
                if (response.ok) {
                    console.log("Table data saved successfully");
                } else {
                    console.error("Failed to save table data:", response.statusText);
                }
            })
            .catch(function(error) {
                console.error("Error saving table data:", error);
            });
        }
    }
    
});
