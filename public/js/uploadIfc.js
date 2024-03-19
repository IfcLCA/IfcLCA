document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('ifcUploadForm');
    const messageContainer = document.getElementById('uploadMessage');
    const navBar = document.querySelector('.navbar');


    // Ensure the upload button is aligned to the right
    let dynamicUploadButton = document.getElementById('dynamicUploadButton');
    if (!dynamicUploadButton) {
        createUploadButton();
    }

    // Check if the Tabulator table container exists before attempting to initialize
    const tableContainer = document.getElementById('elements-table');
    if (tableContainer) {
        fetch(`/api/projects/${data.projectId}/elements`)
            .then(response => response.json())
            .then(elements => {
                // Initialize Tabulator on DOM element
                var table = new Tabulator("#elements-table", {
                    data: elements, // Use the fetched data
                    layout: "fitColumns", // Fit columns to width of table
                    responsiveLayout: "collapse", // Enable responsive layout
                    columns: [
                        {title: "IFC GUID", field: "guid", sorter: "string"},
                        {title: "IFC Instance Name", field: "instance_name", sorter: "string"},
                        {title: "IFC Class", field: "ifc_class", sorter: "string"},
                        {title: "Building Storey", field: "building_storey", sorter: "string"},
                        {title: "Is Loadbearing", field: "is_loadbearing", sorter: "string", formatter: "tickCross"},
                        {title: "Is External", field: "is_external", sorter: "string", formatter: "tickCross"},
                        {title: "Volume", field: "volume", sorter: "number", formatter: "plaintext"},
                        {title: "Material", field: "materials_info", sorter: "string", formatter: "textarea"}
                    ],
                });
            })
            .catch(error => console.error('Error:', error));
    }
});