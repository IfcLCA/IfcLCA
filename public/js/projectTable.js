// Track current grouping state and combined rows map
let currentGrouping = [];
let combinedRowsMap = {};
let isDeleteMode = false;
const rowHeight = 39; // Approximate height per row in pixels
const maxTableHeight = 800; // Maximum table height in pixels
const minTableHeight = 150; // Minimum table height in pixels

// Initialize the table and chart on page load
function initializeTableAndChart(projectId) {
    fetchMaterialNames().then(materialNames => {
        initializeTable(projectId, materialNames);
    });

    loadCo2Chart(projectId);
}

// Check if any density fields are invalid
function checkForInvalidDensities(data) {
    return data.some(row => !Number.isFinite(parseFloat(row.density)) || parseFloat(row.density) <= 0);
}


// Show or hide notification for invalid densities
function toggleInvalidDensityNotification(hasInvalidDensities) {
    const notification = document.getElementById('invalid-density-notification');
    if (notification) {
        notification.style.display = hasInvalidDensities ? 'block' : 'none';
    }
}

function initializeTable(projectId, materialNames) {
    fetchBuildingElements(projectId).then(buildingElements => {
        const flattenedData = flattenElements(buildingElements);
        const numRows = flattenedData.length;

        // Determine initial height
        const initialHeight = calculateTableHeight(numRows) + "px";

        var table = new Tabulator("#elements-table", {
            height: initialHeight, // Set initial height
            layout: "fitColumns",
            data: flattenedData,
            columns: getColumns(materialNames, projectId),
            headerSortClickElement: "icon",
            initialSort: [{ column: "name", dir: "asc" }], // Sort by Material by default
            selectable: true, // Enable row selection
            rowSelectionChanged: function(data, rows) {
            if (isDeleteMode) {
                const selectedGuids = new Set(rows.map(row => row.getData().guid));
                table.getRows().forEach(row => {
                if (selectedGuids.has(row.getData().guid)) {
                    row.select();
                } else {
                    row.deselect();
                }
                });
            }
            },
            rowSelectionChanged: function(data, rows) {
                const selectedRows = table.getSelectedRows();
                const selectedMaterialIds = selectedRows.map(row => row.getData()._id); // Collect unique _ids
                const applyDeleteButton = document.getElementById('btn-apply-delete');
                applyDeleteButton.disabled = selectedMaterialIds.length === 0;
            },
            rowFormatter: function(row) {
                const data = row.getData();
                if (data.density <= 0) {
                    row.getElement().style.backgroundColor = "rgba(255, 0, 0, 0.2)";
                }           
            }
        });
        window.mainTable = table;
        setupDeleteButton();
        setupSelectAllCheckbox();
        // Initial overlay check
        toggleOverlay(flattenedData.length === 0);
        toggleInvalidDensityNotification(checkForInvalidDensities(flattenedData)); // Check for invalid densities initially
    });
}



// Calculate the table height based on number of rows
function calculateTableHeight(numRows) {
    if (numRows > 25) {
        return maxTableHeight;
    } else {
        return Math.max(Math.min(numRows * rowHeight, maxTableHeight), minTableHeight);
    }
}

function setupDeleteButton() {
    const deleteButton = document.getElementById('btn-delete-material');
    const applyDeleteButton = document.getElementById('btn-apply-delete');
    const cancelButton = document.getElementById('btn-cancel');

    // Enter delete mode
    deleteButton.addEventListener('click', function() {
        isDeleteMode = true;
        // Show the delete checkbox column
        window.mainTable.updateColumnDefinition("delete_checkbox", { visible: true });
        window.mainTable.options.selectable = true; // Enable row selection
        toggleDeleteUI(true);
    });

    // Apply delete action
    applyDeleteButton.addEventListener('click', function() {
        const selectedRows = window.mainTable.getSelectedRows();
        
        // Collect unique _ids from combined rows and individual rows
        let selectedMaterialIds = [];
        selectedRows.forEach(row => {
            const data = row.getData();
            if (data._ids) {
                selectedMaterialIds = selectedMaterialIds.concat(data._ids.split(',').filter(id => id && id !== "<varies>"));
            } else {
                selectedMaterialIds.push(data._id);
            }
        });
        
        selectedMaterialIds = [...new Set(selectedMaterialIds)]; // Remove duplicates
    
        if (selectedMaterialIds.length > 0) {
            axios.post(`/api/projects/${window.projectId}/building_elements/materials/delete`, { materialIds: selectedMaterialIds })
                .then(() => {
                    // Refresh table data after deletion
                    fetchBuildingElements(window.projectId).then(buildingElements => {
                        const flattenedData = flattenElements(buildingElements);
                        window.mainTable.replaceData(flattenedData)
                            .then(() => {
                                updateProjectSummary(window.mainTable); // Update project summary data
                                toggleInvalidDensityNotification(checkForInvalidDensities(flattenedData)); // Check for invalid densities
                                toggleOverlay(flattenedData.length === 0); // Toggle overlay visibility
                                adjustTableHeight(window.mainTable); // Adjust table height
                            }
                        );
                    });
    
                    // Hide the delete checkbox column
                    window.mainTable.updateColumnDefinition("delete_checkbox", { visible: false });
                    window.mainTable.deselectRow();
                    window.mainTable.options.selectable = false; // Disable row selection
                    toggleDeleteUI(false);
                })
                .catch(error => {
                    console.error('Error deleting materials:', error);
                });
        }
    });

    // Cancel delete mode
    cancelButton.addEventListener('click', function() {
        isDeleteMode = false;
        // Hide the delete checkbox column
        window.mainTable.updateColumnDefinition("delete_checkbox", { visible: false });
        window.mainTable.deselectRow();
        window.mainTable.options.selectable = false; // Disable row selection
        toggleDeleteUI(false);
    });
}


function toggleDeleteUI(showDelete) {
    document.getElementById('btn-delete-material').style.display = showDelete ? 'none' : 'block';
    document.getElementById('btn-add-material').style.display = showDelete ? 'none' : 'block';
    document.getElementById('btn-edit-project').style.display = showDelete ? 'none' : 'block';
    document.getElementById('confirm-buttons').style.display = showDelete ? 'flex' : 'none';

    if (!showDelete) {
        // Hide delete checkbox column and disable row selection
        window.mainTable.updateColumnDefinition("delete_checkbox", { visible: false });
        window.mainTable.deselectRow();
        window.mainTable.options.selectable = false;
    }
}


// Update project summary data
function updateProjectSummary(table) {
    const visibleRows = table.getRows().map(row => row.getData());
    const totalCarbonFootprint = visibleRows.reduce((sum, element) => sum + parseFloat(element.total_co2 || 0), 0) / 1000; // Convert to tons

    const EBFText = $('#ebfPerM2').text().trim();
    const EBF = parseFloat(EBFText.replace(/,/g, '')) || 1;

    if (isNaN(EBF) || EBF <= 0) {
        console.error('Invalid EBF value:', EBFText);
        return;
    }

    const co2PerSquareMeter = totalCarbonFootprint * 1000 / EBF; 

    $('#carbonFootprint').text(`${formatNumber(totalCarbonFootprint, 1)} tons`);
    $('#co2PerM2').text(`${formatNumber(co2PerSquareMeter, 1)} kg`);

    loadCo2Chart(window.projectId);
}

// Format numbers for display
function formatNumber(value, decimals) {
    if (value == null || isNaN(value)) return '0';
    return Number(value).toLocaleString('de-CH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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

// Helper function to update material details
function updateMaterial(url, data) {
    $.ajax({
        url: url,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data)
    }).then(() => {
        fetchBuildingElements(window.projectId)
            .then(buildingElements => {
                const flattenedData = flattenElements(buildingElements);
                const table = window.mainTable;
                table.replaceData(flattenedData).then(() => updateProjectSummary(window.mainTable)); // Ensure updateProjectSummary is called after table data update

                // Load and update the CO₂-eq per storey chart
                loadCo2Chart(window.projectId);
            });
    }).catch(error => console.error('Error updating materials:', error));
}

function updateMaterialForCombinedRow(url, data, combinedRowIds) {
    const updateData = combinedRowIds.map(materialId => ({
        ...data,
        materialId
    }));

    const updatePromises = updateData.map(data => {
        return $.ajax({
            url: url,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(data)
        });
    });

    Promise.all(updatePromises)
        .then(() => {
            return fetchBuildingElements(window.projectId);
        })
        .then(buildingElements => {
            const flattenedData = flattenElements(buildingElements);
            const table = window.mainTable;
            table.replaceData(flattenedData).then(() => updateProjectSummary(window.mainTable)); // Ensure updateProjectSummary is called after table data update

            if (currentGrouping.length > 0) {
                updateTableGrouping();
            }
        })
        .catch(error => {
            console.error('Error updating combined rows:', error);
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

// Toggle overlay visibility based on whether the table is empty
function toggleOverlay(isEmpty) {
    const overlay = document.getElementById('table-overlay');
    if (isEmpty) {
        overlay.style.display = 'block';
    } else {
        overlay.style.display = 'none';
    }
}


// Function to determine color based on CO₂ intensity
function getCo2Color(value, min, max) {
    const thresholds = {
        low: min + (max - min) * 0.25,
        medium: min + (max - min) * 0.5,
        high: min + (max - min) * 0.75
    };

    if (value < thresholds.low) return 'rgba(75, 192, 192, 0.8)'; // Light blue
    if (value < thresholds.medium) return 'rgba(255, 205, 86, 0.8)'; // Yellow
    if (value < thresholds.high) return 'rgba(255, 159, 64, 0.8)'; // Orange
    return 'rgba(255, 99, 132, 0.8)'; // Red
}

function loadCo2Chart(projectId) {
    fetch(`/api/projects/${projectId}/co2_per_storey`)
        .then(response => response.json())
        .then(data => {
            renderCo2Chart(data);
        })
        .catch(error => console.error('Error fetching CO₂-eq data per storey:', error));
}

let co2ChartInstance = null; // Reference to the existing chart instance

function renderCo2Chart(data) {
    const ctx = document.getElementById('co2Chart').getContext('2d');
    const labels = data.map(item => item.storey);
    const EBF = parseFloat($('#ebfPerM2').text().split(' ')[0].replace(/,/g, '')) || 1; // Ensure EBF is not zero
    
    // Divide each CO₂-eq value by EBF to get values per m²
    const co2Values = data.map(item => item.co2_eq / EBF); 

    // Calculate min and max CO₂ values
    const minCo2 = Math.min(...co2Values);
    const maxCo2 = Math.max(...co2Values);

    const barColors = co2Values.map(value => getCo2Color(value, minCo2, maxCo2));

    // Destroy the previous chart instance if it exists
    if (co2ChartInstance) {
        co2ChartInstance.destroy();
    }

    // Create a new chart instance and assign it to co2ChartInstance
    co2ChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'CO₂-eq per m² (kg/m²)', // Update chart title
                data: co2Values,
                backgroundColor: barColors,
                borderColor: barColors.map(color => color.replace('0.8', '1.0')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.raw.toLocaleString() + ' kg CO₂-eq/m²';
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Building Storey'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'CO₂-eq per m² (kg/m²)'
                    }
                }
            }
        }
    });
}

// Generate columns with combine rows icon
function getColumns(materialNames, projectId) {
    const materialLookup = materialNames.reduce((acc, name) => {
        acc[name] = name;
        return acc;
    }, {});
    materialLookup["No Match"] = "No Match";

    return [
        {
            title: `<input type='checkbox' id='select-all' style='margin: 0;'>`,
            formatter: "rowSelection", 
            titleFormatter: "rowSelection",
            field: "delete_checkbox",
            hozAlign: "center",
            headerSort: false,
            visible: false // Initially hidden
        },
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
            formatterParams: materialLookup,
            width: 300,
            cellEdited: function (cell) {
                const updatedMaterialName = cell.getValue();
                const row = cell.getRow();
                const data = row.getData();
        
                fetch(`/api/materials/details/${updatedMaterialName}`)
                    .then(response => response.json())
                    .then(materialDetails => {
                        const newDensity = materialDetails.density;
                        const newIndicator = materialDetails.indicator;
                        const newTotalCO2 = data.volume * newDensity * newIndicator;
        
                        row.update({
                            density: newDensity,
                            indikator: newIndicator,
                            total_co2: newTotalCO2.toFixed(3)
                        });
        
                        const materialIds = data._ids ? data._ids.split(',') : [data._id];
                        const validMaterialIds = materialIds.filter(id => id && id !== "<varies>");
        
                        updateMaterialForCombinedRow(`/api/projects/${projectId}/building_elements/update`, {
                            matched_material_name: updatedMaterialName,
                            density: newDensity,
                            indikator: newIndicator,
                            total_co2: newTotalCO2.toFixed(3)
                        }, validMaterialIds).then(() => {
                            // Refresh data in the table and update the summary after editing
                            fetchBuildingElements(projectId).then(buildingElements => {
                                const flattenedData = flattenElements(buildingElements);
                                window.mainTable.replaceData(flattenedData).then(() => {
                                    updateProjectSummary(window.mainTable);
                                    toggleInvalidDensityNotification(checkForInvalidDensities(flattenedData));
                                });
                            });
                        });
                    })
                    .catch(error => {
                        console.error('Error fetching material details:', error);
                    });
            }
        },
        {
            title: `<div>Density (kg/m³)</div>`, field: "density", formatter: "money", formatterParams: { precision: 2 }, width: 100, headerWordWrap: true, editor: "input",
            cellEdited: function (cell) {
                const newDensity = parseFloat(cell.getValue());
                const row = cell.getRow();
                const data = row.getData();
                const newTotalCO2 = data.volume * newDensity * data.indikator;

                row.update({ total_co2: newTotalCO2.toFixed(3) });

                const updateUrl = `/api/projects/${projectId}/building_elements/update`;

                // If the row is a combined row, update all associated rows
                const materialIds = data._ids ? data._ids.split(',') : [data._id];
                const validMaterialIds = materialIds.filter(id => id && id !== "<varies>");

                const updatePromises = validMaterialIds.map(materialId => {
                    return $.ajax({
                        url: updateUrl,
                        method: 'POST',
                        contentType: 'application/json',
                        data: JSON.stringify({
                            materialId: materialId,
                            density: newDensity,
                            total_co2: newTotalCO2.toFixed(3)
                        })
                    });
                });

                Promise.all(updatePromises)
                    .then(() => {
                        // Refresh data in the table
                        fetchBuildingElements(window.projectId).then(buildingElements => {
                            const flattenedData = flattenElements(buildingElements);
                            window.mainTable.replaceData(flattenedData).then(() => {
                                if (currentGrouping.length > 0) {
                                    updateTableGrouping();
                                }
                                updateProjectSummary(window.mainTable);
                                toggleInvalidDensityNotification(checkForInvalidDensities(flattenedData));
                            });
                        });
                    })
                    .catch(error => {
                        console.error('Error updating density for combined rows:', error);
                    });
            }

        },
        { title: `<div>Indicator (kg CO₂-eq/kg)</div>`, field: "indikator", formatter: "money", formatterParams: { precision: 3, thousand:"'" }, width: 100, headerWordWrap: true },
        { title: `<div>CO₂-eq (kg)</div>`, field: "total_co2", formatter: "money", formatterParams: { precision: 2, thousand:"'" }, width: 125, headerWordWrap: true, hozAlign: "left" }
    ];
}

function setupSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('click', function() {
            const isChecked = selectAllCheckbox.checked;
            if (isChecked) {
                window.mainTable.selectRow();
            } else {
                window.mainTable.deselectRow();
            }
        });
    }
}

// Toggle column grouping
function toggleColumnGrouping(field) {
    const headerElement = document.querySelector(`.tabulator-col[data-field="${field}"] .tabulator-col-title`);
    const iconElement = headerElement ? headerElement.querySelector('i.fa-compress') : null;

    if (currentGrouping.includes(field)) {
        // Remove grouping for the specified field
        currentGrouping = currentGrouping.filter(f => f !== field);
    } else {
        // Add grouping for the specified field
        currentGrouping.push(field);
        if (iconElement) iconElement.style.color = "orange";  // Change icon color
    }
    updateTableGrouping();
}

function updateCombiningColumnsDescription() {
    const descriptionElement = document.getElementById('combining-columns-description');
    if (descriptionElement) {
        if (currentGrouping.length > 0) {
            // Format column names in bold
            const formattedColumns = currentGrouping.map(col => `<strong>${getColumnDisplayName(col)}</strong>`).join(', ');
            descriptionElement.innerHTML = `Table grouped by: ${formattedColumns}`;
            descriptionElement.style.display = 'block';
        } else {
            // Show a hint when no columns are used for combining
            descriptionElement.innerHTML = `<small>Select the combine icon in some headers to group by identical values in that column.</small>`;
            descriptionElement.style.display = 'block';
        }
    }
}

function getColumnDisplayName(columnField) {
    const columns = window.mainTable.getColumns();
    const column = columns.find(col => col.getField() === columnField);
    return column ? column.getDefinition().title.replace(/<.*?>/g, '') : columnField;
}

function updateTableGrouping() {
    const table = window.mainTable;
    const data = table.getData();

    if (currentGrouping.length === 0) {
        // Reset table to original data
        fetchBuildingElements(window.projectId).then(buildingElements => {
            const flattenedData = flattenElements(buildingElements);
            table.replaceData(flattenedData).then(() => updateProjectSummary(window.mainTable)); // Update summary
        });
    } else {
        const groupedData = groupDataByFields(data, currentGrouping);
        table.replaceData(groupedData).then(() => updateProjectSummary(window.mainTable)); // Update summary
    }

    updateCombiningColumnsDescription(); // Update description of combining columns
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

// Add event listener for the "select-all" checkbox to handle bulk selection
document.addEventListener('DOMContentLoaded', function () {
    const projectId = window.location.pathname.split('/').pop();
    window.projectId = projectId; // Store projectId globally for reuse
    fetchMaterialNames().then(materialNames => {
        initializeTable(projectId, materialNames);
    });

    loadCo2Chart(projectId);

    const selectAllCheckbox = document.getElementById('select-all');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('click', function() {
            const isChecked = selectAllCheckbox.checked;
            window.mainTable.getRows().forEach(row => {
                if (isChecked) {
                    row.select();
                } else {
                    row.deselect();
                }
            });
        });
    }
});
