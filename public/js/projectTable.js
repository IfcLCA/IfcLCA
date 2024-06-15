// Fetch materials names from the backend
function fetchMaterialNames() {
    return $.ajax({
        url: '/api/materials/names',
        type: 'GET',
        dataType: 'json'
    }).then(function(data) {
        return data;  // Assuming the data is an array of material names
    }).catch(function(error) {
        console.error("Error fetching material names:", error);
        return [];
    });
}

// Fetch building elements from the backend
function fetchBuildingElements(projectId) {
    return $.ajax({
        url: `/api/projects/${projectId}/building_elements`,
        type: 'GET',
        dataType: 'json'
    }).then(function(data) {
        return data;  // Assuming the data is an array of building elements
    }).catch(function(error) {
        console.error("Error fetching building elements:", error);
        return [];
    });
}

// Initialize Tabulator after preloading material names
function initializeTable(projectId, materialNames) {
    fetchBuildingElements(projectId).then(buildingElements => {
        var table = new Tabulator("#elements-table", {
            height: "622px",
            layout: "fitColumns",
            data: flattenElements(buildingElements),
            columns: [
                { title: "GUID", field: "guid", width: 100 },
                { title: "IfcClass", field: "ifc_class", width: 100 },
                { title: "Name", field: "instance_name", widthGrow: 3 },
                { title: "Building-Storey", field: "building_storey", width: 150 },
                { title: "Load-bearing", field: "is_loadbearing", formatter: "tickCross", width: 100 },
                { title: "External", field: "is_external", formatter: "tickCross", width: 100 },
                { title: "Volume", field: "volume", formatter: "money", formatterParams: { precision: 3 }, width: 120 },
                { title: "Material", field: "name", widthGrow: 2 },
                {
                    title: "Matched Material",
                    field: "matched_material",
                    editor: "list",
                    editorParams: {
                        values: materialNames,
                        autocomplete: true,
                        clearable: true,
                        sort: "asc",
                    },
                    formatter: "lookup",
                    formatterParams: materialNames.reduce((acc, name) => {
                        acc[name] = name;
                        return acc;
                    }, {}),
                    widthGrow: 2,
                    cellEdited: function (cell) {
                        // Get updated material name
                        const updatedMaterialName = cell.getValue();
                        const row = cell.getRow();
                        const data = row.getData();

                        // Fetch material details and update density and CO2
                        fetch(`/api/materials/details/${updatedMaterialName}`)
                            .then(response => response.json())
                            .then(materialDetails => {
                                const newDensity = materialDetails.density;
                                const newIndicator = materialDetails.indicator;
                                const newTotalCO2 = data.volume * newDensity * newIndicator;

                                // Update the table row
                                row.update({
                                    density: newDensity,
                                    indikator: newIndicator,
                                    total_co2: newTotalCO2.toFixed(3)
                                });

                                // Update the database
                                $.ajax({
                                    url: `/api/projects/${projectId}/building_elements/update`,
                                    method: 'POST',
                                    contentType: 'application/json',
                                    data: JSON.stringify({
                                        materialId: data.materialId,
                                        matched_material_name: updatedMaterialName,
                                        density: newDensity,
                                        indikator: newIndicator,
                                        total_co2: newTotalCO2.toFixed(3)
                                    }),
                                    success: function () {
                                        console.log('Material updated successfully');
                                    },
                                    error: function (xhr, status, error) {
                                        console.error('Error updating material:', error);
                                    }
                                });
                            });
                    }
                },
                { title: "Density (kg/m³)", field: "density", formatter: "money", formatterParams: { precision: 2 }, width: 150 },
                { title: "Indicator (kg CO₂-eq/kg)", field: "indikator", formatter: "money", formatterParams: { precision: 3 }, width: 150 },
                { title: "CO₂-eq (kg)", field: "total_co2", formatter: "money", formatterParams: { precision: 3 }, width: 150 }
            ],
        });
    });
}

// Flatten building elements data
function flattenElements(buildingElements) {
    return buildingElements.flatMap(element => {
        return element.materials_info.map(material => ({
            guid: element.guid,
            materialId: material.materialId, // Ensure materialId is present
            ifc_class: element.ifc_class,
            instance_name: element.instance_name,
            building_storey: element.building_storey,
            is_loadbearing: element.is_loadbearing,
            is_external: element.is_external,
            volume: material.volume,
            name: material.name,
            matched_material: material.matched_material_name || "No Match",
            density: material.density || 0,
            indikator: material.indikator || 0,
            total_co2: material.total_co2 || 0
        }));
    });
}

// Preload material names and initialize Tabulator
document.addEventListener('DOMContentLoaded', function () {
    const projectId = window.location.pathname.split('/').pop();
    fetchMaterialNames().then(materialNames => {
        initializeTable(projectId, materialNames);
    });
});
