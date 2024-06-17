// Track current grouping state and combined rows map
let currentGrouping = [];
let combinedRowsMap = {};

// Fetch and update project details
function updateProjectDetails(projectId) {
    fetch(`/projects/${projectId}`)
        .then(response => response.json())
        .then(project => {
            console.log("Updated project details:", project);  // Debug print
            $('#carbonFootprint').text(`${(Math.round(project.totalCarbonFootprint) / 1000).toFixed(3)} tons`);
            $('#co2PerM2').text(`${project.co2PerSquareMeter} kg`);
        })
        .catch(error => console.error('Error updating project details:', error));
}

// Fetch material names from the backend
function fetchMaterialNames() {
    return $.ajax({
        url: '/api/materials/names',
        type: 'GET',
        dataType: 'json'
    }).then(data => {
        return data;
    }).catch(error => {
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
    }).then(data => {
        return data;
    }).catch(error => {
        console.error("Error fetching building elements:", error);
        return [];
    });
}

// Initialize Tabulator after preloading material names
function initializeTable(projectId, materialNames) {
    fetchBuildingElements(projectId).then(buildingElements => {
        var table = new Tabulator("#elements-table", {
            height: "800px",
            layout: "fitColumns",
            data: flattenElements(buildingElements),
            columns: getColumns(materialNames, projectId),
            headerSortClickElement: "icon" // Sorting only on icon click
        });

        window.mainTable = table;
    });
}

// Generate columns with combine rows icon
function getColumns(materialNames, projectId) {
    // Add a display value for "No Match"
    const materialLookup = materialNames.reduce((acc, name) => {
        acc[name] = name;
        return acc;
    }, {});
    materialLookup["No Match"] = "No Match"; // Ensure "No Match" has a display value

    return [
        { title: `<div>GUID</div>`, field: "guid", width: 85, headerWordWrap: true, hozAlign: "left" },
        { title: `<div>IfcClass<br><i class='fa fa-compress' style='cursor: pointer; margin-left: 5px;' onclick='toggleColumnGrouping("ifc_class")'></i></div>`, field: "ifc_class", width: 100, headerWordWrap: true, hozAlign: "left" },
        { title: `<div>Name<br><i class='fa fa-compress' style='cursor: pointer; margin-left: 5px;' onclick='toggleColumnGrouping("instance_name")'></i></div>`, field: "instance_name", width: 300, headerWordWrap: true, hozAlign: "left" },
        { title: `<div>Building-Storey<br><i class='fa fa-compress' style='cursor: pointer; margin-left: 5px;' onclick='toggleColumnGrouping("building_storey")'></i></div>`, field: "building_storey", width: 100, headerWordWrap: true, hozAlign: "left" },
        { title: `<div>Load-bearing<br><i class='fa fa-compress' style='cursor: pointer; margin-left: 5px;' onclick='toggleColumnGrouping("is_loadbearing")'></i></div>`, field: "is_loadbearing", formatter: "tickCross", width: 85, headerWordWrap: true },
        { title: `<div>External<br><i class='fa fa-compress' style='cursor: pointer; margin-left: 5px;' onclick='toggleColumnGrouping("is_external")'></i></div>`, field: "is_external", formatter: "tickCross", width: 85, headerWordWrap: true },
        { title: `<div>Volume</div>`, field: "volume", formatter: "money", formatterParams: { precision: 3, thousand:"'" }, width: 100, headerWordWrap: true, hozAlign: "left" },
        { title: `<div>Material<br><i class='fa fa-compress' style='cursor: pointer; margin-left: 5px;' onclick='toggleColumnGrouping("name")'></i></div>`, field: "name", width: 200, headerWordWrap: true, hozAlign: "left" },
        {
            title: `<div>Matched Material<br><i class='fa fa-compress' style='cursor: pointer; margin-left: 5px;' onclick='toggleColumnGrouping("matched_material")'></i></div>`,
            field: "matched_material",
            headerWordWrap: true,
            hozAlign: "left",
            editor: "list",
            editorParams: {
                values: materialNames,
                autocomplete: true,
                clearable: true,
                sort: "asc",
            },
            formatter: "lookup",
            formatterParams: materialLookup, // Use materialLookup object
            width: 300,
            cellEdited: function (cell) {
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

                        // Update the combined row in the UI
                        row.update({
                            density: newDensity,
                            indikator: newIndicator,
                            total_co2: newTotalCO2.toFixed(3)
                        });

                        // Update the database for all original rows
                        const materialIds = data._ids ? data._ids.split(',') : [data._id];
                        const validMaterialIds = materialIds.filter(id => id && id !== "<varies>");

                        const updatePromises = validMaterialIds.map(materialId => {
                            return $.ajax({
                                url: `/api/projects/${projectId}/building_elements/update`,
                                method: 'POST',
                                contentType: 'application/json',
                                data: JSON.stringify({
                                    materialId: materialId,
                                    matched_material_name: updatedMaterialName,
                                    density: newDensity,
                                    indikator: newIndicator,
                                    total_co2: newTotalCO2.toFixed(3)
                                })
                            });
                        });

                        Promise.all(updatePromises)
                            .then(() => {
                                updateProjectDetails(projectId);

                                // Refresh the data in the table
                                fetchBuildingElements(window.projectId).then(buildingElements => {
                                    const flattenedData = flattenElements(buildingElements);
                                    const table = window.mainTable; // Ensure table is referenced correctly
                                    table.replaceData(flattenedData);
                                    if (currentGrouping.length > 0) {
                                        updateTableGrouping();
                                    }
                                });
                            })
                            .catch(error => {
                                console.error('Error updating materials:', error);
                            });
                    });
            }
        },
        { title: `<div>Density (kg/m³)</div>`, field: "density", formatter: "money", formatterParams: { precision: 2 }, width: 100, headerWordWrap: true },
        { title: `<div>Indicator (kg CO₂-eq/kg)</div>`, field: "indikator", formatter: "money", formatterParams: { precision: 3, thousand:"'" }, width: 100, headerWordWrap: true },
        { title: `<div>CO₂-eq (kg)</div>`, field: "total_co2", formatter: "money", formatterParams: { precision: 2, thousand:"'" }, width: 200, headerWordWrap: true, hozAlign: "left" }
    ];
}


// Toggle column grouping
function toggleColumnGrouping(field) {
    const headerElement = document.querySelector(`.tabulator-col[data-field="${field}"] .tabulator-col-title`);
    const iconElement = headerElement ? headerElement.querySelector('i.fa-compress') : null;

    if (currentGrouping.includes(field)) {
        // Remove grouping for the specified field
        currentGrouping = currentGrouping.filter(f => f !== field);
        if (headerElement) {
            headerElement.style.backgroundColor = "";
            headerElement.style.color = "";  // Reset text color
        }
        if (iconElement) iconElement.style.color = "";  // Reset icon color
    } else {
        // Add grouping for the specified field
        currentGrouping.push(field);
        if (headerElement) {
            headerElement.style.backgroundColor = "lightorange";
            headerElement.style.color = "orange";  // Change text color
        }
        if (iconElement) iconElement.style.color = "orange";  // Change icon color
    }
    updateTableGrouping();
}


// Update table grouping
function updateTableGrouping() {
    const table = window.mainTable;
    const data = table.getData();

    if (currentGrouping.length === 0) {
        // Reset table to original data
        fetchBuildingElements(window.projectId).then(buildingElements => {
            const flattenedData = flattenElements(buildingElements);
            table.replaceData(flattenedData);
        });
    } else {
        const groupedData = groupDataByFields(data, currentGrouping);
        table.replaceData(groupedData);
    }

    // Reset all headers
    document.querySelectorAll('.tabulator-col-title').forEach(header => {
        header.style.backgroundColor = "";  // Reset background color
        header.style.color = "";  // Reset text color
    });
    document.querySelectorAll('.fa-compress').forEach(icon => {
        icon.style.color = "";  // Reset icon color
    });

    // Mark grouped headers
    currentGrouping.forEach(field => {
        const headerElement = document.querySelector(`.tabulator-col[data-field="${field}"] .tabulator-col-title`);
        const iconElement = headerElement ? headerElement.querySelector('i.fa-compress') : null;

        if (headerElement) {
            headerElement.style.backgroundColor = "lightorange";
            headerElement.style.color = "orange";  // Change text color
        }
        if (iconElement) iconElement.style.color = "orange";  // Change icon color
    });
}

// Group data by current grouping fields
function groupDataByFields(data, fields) {
    const groupedData = {};

    data.forEach(item => {
        const key = fields.map(field => item[field]).join('||');
        if (!groupedData[key]) {
            groupedData[key] = [];
        }
        groupedData[key].push(item);
    });

    const combinedGroups = Object.values(groupedData).map(group => combineGroup(group, fields));
    return combinedGroups;
}

// Combine group data
function combineGroup(group, fields) {
    const combined = {};

    // Initialize combined object with keys
    Object.keys(group[0]).forEach(key => {
        if (key === "_id" || key === "_ids") return; // Skip internal IDs

        const allValues = group.map(item => item[key]);

        // Determine if all values for the key are the same
        if (fields.includes(key) || allValues.every(value => value === allValues[0])) {
            combined[key] = allValues[0];
        } else {
            combined[key] = "<varies>";
        }
    });

    combined.volume = group.reduce((sum, item) => sum + parseFloat(item.volume), 0).toFixed(3);
    combined.total_co2 = group.reduce((sum, item) => sum + parseFloat(item.total_co2), 0).toFixed(3);

    // Include MongoDB Object IDs for all original rows
    combined._ids = group.map(item => {
        // Handle different formats of _id
        if (item._id && item._id.$oid) {
            return item._id.$oid;
        } else if (typeof item._id === 'string') {
            return item._id;
        }
        return null;
    }).filter(id => id !== null).join(',');

    return combined;
}

// Flatten building elements data
function flattenElements(buildingElements) {
    return buildingElements.flatMap(element => {
        return element.materials_info.map(material => ({
            _id: material.materialId.$oid || material.materialId,  // Ensure ObjectID format
            guid: element.guid,
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
    window.projectId = projectId; // Store projectId globally for reuse
    fetchMaterialNames().then(materialNames => {
        initializeTable(projectId, materialNames);
    });
});
