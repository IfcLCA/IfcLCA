// Fetch materials names from the backend
function fetchMaterialNames() {
    return $.ajax({
        url: '/api/materials/names',  // Adjust this URL to your actual API endpoint
        type: 'GET',
        dataType: 'json'
    }).then(function(data) {
        return data;  // Assuming the data is an array of material names
    }).catch(function(error) {
        console.error("Error fetching material names:", error);
        return [];
    });
}

// Preload material names and initialize Tabulator when ready
fetchMaterialNames().then(materialNames => {
    var table = new Tabulator("#elements-table", {
        height: "622px",
        layout: "fitColumns",
        ajaxURL: `/api/projects/${projectId}/building_elements`,
        layoutColumnsOnNewData: true,
        ajaxConfig: "GET",
        ajaxRequesting: function(url, params){
            console.log("Making AJAX request to:", url, "with params:", params);
        },
        ajaxResponse: function(url, params, response){
            // Flatten building elements to materials_info with additional details
            return response.map(buildingElement => buildingElement.materials_info.map(material => {
                const volume = parseFloat(material.volume || 0);
                const density = parseFloat(material.density || 0);
                const co2Indicator = parseFloat(material.indikator || 0);
                const totalCO2eq = volume * density * co2Indicator;
                return {
                    ...material,
                    guid: buildingElement.guid,
                    instance_name: buildingElement.instance_name,
                    ifc_class: buildingElement.ifc_class,
                    building_storey: buildingElement.building_storey,
                    is_loadbearing: buildingElement.is_loadbearing,
                    is_external: buildingElement.is_external,
                    rohdichte: density,
                    indikator: co2Indicator,
                    total_co2: Math.round(totalCO2eq),
                    matched_material: material.matched_material || "",  // ensure proper formatting
                };
            })).flat();
        },
        columns: [
            { title: "GUID", field: "guid", width: 68, widthGrow: 1 },
            { title: "IfcClass", field: "ifc_class", formatter: "plaintext", width: 100 },
            { title: "Name", field: "instance_name", formatter: "plaintext", width: 300 },
            { title: "BuildingStorey", field: "building_storey", formatter: "plaintext", widthGrow: 1 },
            { title: "IsLoadbearing", field: "is_loadbearing", formatter: "tickCross", widthGrow: 1 },
            { title: "IsExternal", field: "is_external", formatter: "tickCross", widthGrow: 1 },
            { title: "Volume", field: "volume", formatter: function(cell) { return parseFloat(cell.getValue()).toFixed(3); }, widthGrow: 1 },
            { title: "Material", field: "name", formatter: "plaintext", width: 200 },
            {
                title: "Matched Material",
                field: "matched_material",
                editor: "list",
                editorParams: {
                    values: materialNames,
                    autocomplete: true,
                    clearable: true,
                    sort: "asc",
                    itemFormatter: function(label, value, item, element) {
                        return "<strong>" + label + "</strong><br/><div>" + (item.subtitle || '') + "</div>";
                    }
                },
                formatter: "lookup",
                formatterParams: materialNames.reduce((acc, name) => {
                    acc[name] = name;  // Map each name to itself for lookup formatting
                    return acc;
                }, {}),
                cellEdited: (cell) => {
                    const newValue = cell.getValue();
                    updateMaterialDetails(cell);
                }
            },
            { title: "Rohdichte (kg/m³)", field: "rohdichte", formatter: "plaintext" },
            { title: "Indikator (kg CO₂-eq/kg)", field: "indikator", formatter: "plaintext" },
            { title: "CO₂-eq (kg)", field: "total_co2", formatter: "plaintext" }
            
        ],
    });
});

function updateMaterialDetails(cell) {
    // Fetch the new material details from the server
    const materialName = cell.getValue();
    $.ajax({
        url: `/api/materials/details/${materialName}`,  // Ensure this endpoint is correct and returning the expected fields
        type: 'GET',
        success: function(data) {
            console.log(data);  // Log the data received from the server
            if (data) {
                const row = cell.getRow();
                const volume = parseFloat(row.getCell('volume').getValue()) || 0;
                const density = parseFloat(data.density) || 0;
                const indicator = parseFloat(data.indicator) || 0;
                const totalCO2eq = volume * density * indicator;
        
                // Update the row with new values
                row.update({
                    rohdichte: density.toFixed(3),
                    indikator: indicator.toFixed(3),
                    total_co2: totalCO2eq.toFixed(3)
                });
            }
        }
        ,
        error: function(xhr, status, error) {
            console.error('Failed to fetch material details:', error);
        }
    });
}



// After Tabulator has been initialized and the table is rendered
table.on("tableBuilt", function(){
    // Extend column header setup with filtering, sorting, and collapse/expand logic
    $(".tabulator-col-content").each(function(){
        var headerContent = $(this);
        var columnName = headerContent.text().trim(); // Get column name directly
        var column = table.getColumn(columnName); // Retrieve the column component based on its field name

        // Sorting Icon
        var sortIcon = $("<i class='fas fa-sort' style='margin-left:5px; cursor:pointer;'></i>")
            .on("click", function(){
                // Toggle sort direction
                var currentSort = column.getSort();
                var sortDir = currentSort === "asc" ? "desc" : "asc";
                table.setSort(column.getField(), sortDir);
            });
        headerContent.append(sortIcon);

        // Filtering Input
        var filterInput = $("<input type='text' placeholder='Filter...' style='margin-left:5px; width: 50%;'></input>")
            .on("input", function(){
                var filterVal = $(this).val();
                table.setFilter(column.getField(), "like", filterVal);
            });
        headerContent.append(filterInput);

        // Collapse/Expand Icon
        var collapseIcon = $("<i class='fas fa-compress-arrows-alt' style='margin-left:5px; cursor:pointer;'></i>")
            .on("click", function(){
                var isVisible = column.isVisible();
                column.toggle(); // Toggle visibility
                isVisible ? $(this).removeClass('fa-compress-arrows-alt').addClass('fa-expand-arrows-alt') : $(this).removeClass('fa-expand-arrows-alt').addClass('fa-compress-arrows-alt');

                // Recalculate and display volume totals if needed
                recalculateVolumeTotals();
            });
        headerContent.append(collapseIcon);

        // Tooltip
        var tooltip = $("<span class='tooltip' style='display:none; position:absolute; background-color:#f9f9f9; border:1px solid #ccc; padding:5px; z-index:1000;'>"+columnName+"</span>");
        headerContent.hover(function(){ $(this).find(".tooltip").show(); }, function(){ $(this).find(".tooltip").hide(); });
        headerContent.append(tooltip);
    });
});

// Function to aggregate volumes based on visible columns and unique entries
function recalculateVolumeTotals() {
    let visibleColumns = table.getColumns().filter(column => column.isVisible()).map(column => column.getField());
    let data = table.getData();
    let aggregatedData = {};

    // Aggregate data based on visible columns
    data.forEach(row => {
        // Create a unique key based on values of visible columns
        let key = visibleColumns.map(col => row[col]).join('|');

        if (!aggregatedData[key]) {
            aggregatedData[key] = { ...row, count: 1 }; // Initialize if not exist
        } else {
            aggregatedData[key].volume += row.volume; // Aggregate volume
            aggregatedData[key].count += 1; // Count entries for this key
        }
    });

    // Convert aggregated data back to array format for Tabulator
    let aggregatedArray = Object.values(aggregatedData).map(item => {
        delete item.count; // Remove count property if it's not needed for display
        return item;
    });

    // Optionally, update the table with aggregated data
    // Note: Be mindful of replacing data if you need to toggle between views
    table.updateData(aggregatedArray);
}

// Event listener for column visibility changes
table.on("column-visibility-changed", recalculateVolumeTotals);