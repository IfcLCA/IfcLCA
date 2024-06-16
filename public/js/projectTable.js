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
            columns: getColumns(materialNames, projectId),
        });
    });
}

// Generate columns with combine rows icon
function getColumns(materialNames, projectId) {
    const columns = [
        { title: "GUID", field: "guid", width: 100, headerContextMenu: combineRowsIcon("guid") },
        { title: "IfcClass", field: "ifc_class", width: 100, headerContextMenu: combineRowsIcon("ifc_class") },
        { title: "Name", field: "instance_name", widthGrow: 3, headerContextMenu: combineRowsIcon("instance_name") },
        { title: "Building-Storey", field: "building_storey", width: 150, headerContextMenu: combineRowsIcon("building_storey") },
        { title: "Load-bearing", field: "is_loadbearing", formatter: "tickCross", width: 100, headerContextMenu: combineRowsIcon("is_loadbearing") },
        { title: "External", field: "is_external", formatter: "tickCross", width: 100, headerContextMenu: combineRowsIcon("is_external") },
        { title: "Volume", field: "volume", formatter: "money", formatterParams: { precision: 3 }, width: 120, headerContextMenu: combineRowsIcon("volume") },
        { title: "Material", field: "name", widthGrow: 2, headerContextMenu: combineRowsIcon("name") },
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
            headerContextMenu: combineRowsIcon("matched_material"),
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
        { title: "Density (kg/m³)", field: "density", formatter: "money", formatterParams: { precision: 2 }, width: 150, headerContextMenu: combineRowsIcon("density") },
        { title: "Indicator (kg CO₂-eq/kg)", field: "indikator", formatter: "money", formatterParams: { precision: 3 }, width: 150, headerContextMenu: combineRowsIcon("indikator") },
        { title: "CO₂-eq (kg)", field: "total_co2", formatter: "money", formatterParams: { precision: 3 }, width: 150, headerContextMenu: combineRowsIcon("total_co2") }
    ];
    return columns;
}

// Create combine rows icon for column headers
function combineRowsIcon(field) {
    return function(e, column) {
        e.preventDefault();  // Prevent default context menu from appearing
        combineRowsByField(column.getTable(), field);
    };
}

// Create combine rows icon for column headers
function combineRowsIcon(field) {
    return [
        {
            label: "Combine Rows",
            action: function(e, column) {
                combineRowsByField(column.getTable(), field);
            },
            icon: "<i class='fa fa-compress'></i>"
        }
    ];
}

// Combine rows by specified field
function combineRowsByField(table, field) {
    var rows = table.getRows();
    var groupedData = {};
    rows.forEach(row => {
        var data = row.getData();
        var key = data[field];
        if (!groupedData[key]) {
            groupedData[key] = [];
        }
        groupedData[key].push(data);
    });

    var combinedRows = [];
    for (var key in groupedData) {
        var group = groupedData[key];
        var combined = combineGroup(group, field);
        combinedRows.push(combined);
    }

    table.replaceData(combinedRows);
}

// Combine group data
function combineGroup(group, field) {
    var combined = Object.assign({}, group[0]);
    combined.volume = group.reduce((sum, item) => sum + parseFloat(item.volume), 0).toFixed(3);
    combined.total_co2 = group.reduce((sum, item) => sum + parseFloat(item.total_co2), 0).toFixed(3);

    for (var key in combined) {
        if (group.some(item => item[key] !== combined[key])) {
            combined[key] = "<varies>";
        }
    }
    combined[field] = group[0][field];  // Preserve the combined value
    return combined;
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
