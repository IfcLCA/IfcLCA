document.addEventListener("DOMContentLoaded", function () {
  const ifcUploadForm = document.getElementById("ifcUploadForm");
  const uploadSpinner = document.getElementById("uploadSpinner");
  const uploadProgressBar = document.getElementById("uploadProgressBar");
  const uploadMessage = document.getElementById("uploadMessage");

  let co2Chart; // Global variable for CO2 chart
  let bubbleChart; // Global variable for Bubble chart

  if (ifcUploadForm) {
    ifcUploadForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const formData = new FormData(ifcUploadForm);

      try {
        uploadSpinner.style.display = "block";
        uploadProgressBar.style.display = "block";

        const response = await fetch(ifcUploadForm.action, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to upload IFC file.");
        }

        const data = await response.json();

        // Update the project details, charts, and table with the new data
        updateProjectDetails(data.project);
        updateCharts(data.project, data.buildingElements);
        updateTable(data.buildingElements);

        uploadMessage.innerHTML = "IFC file uploaded successfully!";
      } catch (error) {
        uploadMessage.innerHTML = `Error: ${error.message}`;
      } finally {
        uploadSpinner.style.display = "none";
        uploadProgressBar.style.display = "none";
      }
    });
  }

  function updateProjectDetails(project) {
    document.getElementById("project-name").textContent =
      formatProjectNameForDisplay(project.name);
    document.getElementById("carbonFootprint").textContent = `${formatNumber(
      Math.round(project.totalCarbonFootprint) / 1000,
      1
    )} tons`;
    document.getElementById("ebfPerM2").textContent = `${formatNumber(
      project.EBF,
      0
    )} m²`;
    document.getElementById("co2PerM2").textContent = `${formatNumber(
      project.co2PerSquareMeter,
      1
    )} kg`;
  }

  function updateCharts(project, buildingElements) {
    const ctxCo2 = document.getElementById("co2Chart").getContext("2d");
    const ctxBubble = document.getElementById("bubbleChart").getContext("2d");

    // If co2Chart is not initialized, create it
    if (!co2Chart) {
      co2Chart = new Chart(ctxCo2, {
        type: "bar",
        data: {
          labels: [],
          datasets: [
            {
              label: "CO₂-eq per Building Storey",
              data: [],
              backgroundColor: [],
              borderColor: [],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        },
      });
    }

    // If bubbleChart is not initialized, create it
    if (!bubbleChart) {
      bubbleChart = new Chart(ctxBubble, {
        type: "bubble",
        data: {
          datasets: [
            {
              label: "CO₂eq per Material",
              data: [],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
        },
      });
    }

    // Update the charts with new data
    const storeyData = buildingElements.reduce((acc, element) => {
      const storey = element.building_storey || "Unknown";
      if (!acc[storey]) {
        acc[storey] = { co2_eq: 0, count: 0 };
      }
      acc[storey].co2_eq += element.materials_info.reduce(
        (sum, material) => sum + parseFloat(material.total_co2 || 0),
        0
      );
      acc[storey].count += 1;
      return acc;
    }, {});

    const labels = Object.keys(storeyData);
    const co2Values = labels.map((storey) => storeyData[storey].co2_eq);
    const barColors = co2Values.map((value) =>
      getCo2Color(value, Math.min(...co2Values), Math.max(...co2Values))
    );

    co2Chart.data.labels = labels;
    co2Chart.data.datasets[0].data = co2Values;
    co2Chart.data.datasets[0].backgroundColor = barColors;
    co2Chart.data.datasets[0].borderColor = barColors.map((color) =>
      color.replace("0.8", "1.0")
    );
    co2Chart.update();

    // Process data for bubble chart
    const bubbleData = buildingElements.reduce((acc, element) => {
      element.materials_info.forEach((material) => {
        const existing = acc.find(
          (entry) => entry.material === material.matched_material_name
        );
        if (existing) {
          existing.totalVolume += parseFloat(material.volume);
          existing.totalCo2 += parseFloat(material.total_co2);
        } else {
          acc.push({
            material: material.matched_material_name,
            totalVolume: parseFloat(material.volume),
            totalCo2: parseFloat(material.total_co2),
          });
        }
      });
      return acc;
    }, []);

    const bubbleChartData = bubbleData.map((item) => ({
      x: item.totalVolume,
      y: item.totalCo2,
      r: Math.sqrt(item.totalVolume),
      label: item.material,
    }));

    const minCo2 = Math.min(...bubbleChartData.map((item) => item.y));
    const maxCo2 = Math.max(...bubbleChartData.map((item) => item.y));

    bubbleChart.data.datasets[0].data = bubbleChartData;
    bubbleChart.update();
  }

  function updateTable(buildingElements) {
    const flattenedData = flattenElements(buildingElements);

    // Update the table with new data
    if (window.mainTable) {
      window.mainTable.replaceData(flattenedData).then(() => {
        updateProjectSummary(window.mainTable); // Update project summary
        toggleInvalidDensityNotification(
          checkForInvalidDensities(flattenedData)
        ); // Check for invalid densities
        toggleOverlay(flattenedData.length === 0); // Toggle overlay visibility

        // Adjust table height based on the new row count
        const newNumRows = flattenedData.length;
        const newHeight = calculateTableHeight(newNumRows) + "px";
        window.mainTable.setHeight(newHeight); // Adjust table height
      });
    }
  }

  function formatProjectNameForDisplay(name) {
    // Function to format project name (as per your existing logic)
    return name;
  }

  function formatNumber(value, decimals) {
    // Function to format numbers (as per your existing logic)
    if (value == null || isNaN(value)) return "0";
    return Number(value).toLocaleString("de-CH", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function flattenElements(buildingElements) {
    return buildingElements.flatMap((element) => {
      return element.materials_info.map((material) => ({
        _id: material.materialId.$oid || material.materialId,
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
        total_co2: material.total_co2 || 0,
      }));
    });
  }

  function calculateTableHeight(numRows) {
    const rowHeight = 36; // Approximate height per row in pixels
    const maxTableHeight = 800; // Maximum table height in pixels
    const minTableHeight = 250; // Minimum table height in pixels

    if (numRows > 25) {
      return maxTableHeight;
    } else {
      return Math.max(
        Math.min(numRows * rowHeight, maxTableHeight),
        minTableHeight
      );
    }
  }

  function updateProjectSummary(table) {
    const visibleRows = table.getRows().map((row) => row.getData());
    const totalCarbonFootprint =
      visibleRows.reduce(
        (sum, element) => sum + parseFloat(element.total_co2 || 0),
        0
      ) / 1000; // Convert to tons

    const EBFText = $("#ebfPerM2").text().trim();
    const EBF = parseFloat(EBFText.replace(/,/g, "")) || 1;

    if (isNaN(EBF) || EBF <= 0) {
      console.error("Invalid EBF value:", EBFText);
      return;
    }

    const co2PerSquareMeter = (totalCarbonFootprint * 1000) / EBF;

    $("#carbonFootprint").text(`${formatNumber(totalCarbonFootprint, 1)} tons`);
    $("#co2PerM2").text(`${formatNumber(co2PerSquareMeter, 1)} kg`);

    loadCo2Chart(window.projectId);
  }

  function toggleOverlay(isEmpty) {
    const overlay = document.getElementById("table-overlay");
    if (isEmpty) {
      overlay.style.display = "block";
    } else {
      overlay.style.display = "none";
    }
  }

  function toggleInvalidDensityNotification(hasInvalidDensities) {
    const notification = document.getElementById(
      "invalid-density-notification"
    );
    if (notification) {
      notification.style.display = hasInvalidDensities ? "block" : "none";
    }
  }

  function checkForInvalidDensities(data) {
    return data.some(
      (row) =>
        !Number.isFinite(parseFloat(row.density)) ||
        parseFloat(row.density) <= 0
    );
  }

  function loadCo2Chart(projectId) {
    fetch(`/api/projects/${projectId}/building_elements`)
      .then((response) => response.json())
      .then((buildingElements) => {
        renderCo2Chart(buildingElements); // Render the CO2 chart per storey
        renderBubbleChart(buildingElements); // Render the bubble chart
      })
      .catch((error) =>
        console.error("Error fetching building elements:", error)
      );
  }

  function getCo2Color(value, min, max) {
    const thresholds = {
      low: min + (max - min) * 0.25,
      medium: min + (max - min) * 0.5,
      high: min + (max - min) * 0.75,
    };

    if (value < thresholds.low) return "rgba(75, 192, 192, 0.8)"; // Light blue
    if (value < thresholds.medium) return "rgba(255, 205, 86, 0.8)"; // Yellow
    if (value < thresholds.high) return "rgba(255, 159, 64, 0.8)"; // Orange
    return "rgba(255, 99, 132, 0.8)"; // Red
  }

  function renderBubbleChart(data) {
    const ctx = document.getElementById("bubbleChart").getContext("2d");

    const bubbleData = data.reduce((acc, element) => {
      element.materials_info.forEach((material) => {
        const existing = acc.find(
          (entry) => entry.material === material.matched_material_name
        );
        if (existing) {
          existing.totalVolume += parseFloat(material.volume);
          existing.totalCo2 += parseFloat(material.total_co2);
        } else {
          acc.push({
            material: material.matched_material_name,
            totalVolume: parseFloat(material.volume),
            totalCo2: parseFloat(material.total_co2),
          });
        }
      });
      return acc;
    }, []);

    const bubbleChartData = bubbleData.map((item) => ({
      x: item.totalVolume,
      y: item.totalCo2,
      r: Math.sqrt(item.totalVolume),
      label: item.material,
    }));

    const minCo2 = Math.min(...bubbleChartData.map((item) => item.y));
    const maxCo2 = Math.max(...bubbleChartData.map((item) => item.y));

    const maxVolume = Math.max(...bubbleChartData.map((item) => item.x));
    const maxRadius = Math.min(ctx.canvas.width, ctx.canvas.height) / 6;

    bubbleChartData.forEach((item) => {
      item.r = Math.sqrt(item.x / maxVolume) * maxRadius;
    });

    const bubbleColors = bubbleChartData.map((item) =>
      getCo2Color(item.y, minCo2, maxCo2)
    );

    new Chart(ctx, {
      type: "bubble",
      data: {
        datasets: [
          {
            label: "CO₂eq per Material",
            data: bubbleChartData,
            backgroundColor: bubbleColors,
            borderColor: bubbleColors.map((color) =>
              color.replace("0.8", "1.0")
            ),
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              mode: "xy",
              threshold: 10,
            },
            zoom: {
              enabled: true,
              drag: false,
              mode: "xy",
              speed: 0.1,
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.raw.y;
                const formattedValue =
                  value > 10000
                    ? `${(value / 1000).toLocaleString("de-CH")} tons`
                    : `${value.toLocaleString("de-CH")} kg`;
                return `${
                  context.raw.label
                }: Volume: ${context.raw.x.toLocaleString(
                  "de-CH"
                )} m³, CO₂eq: ${formattedValue}`;
              },
            },
          },
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Volume per Material (m³)",
            },
          },
          y: {
            type: "logarithmic",
            ticks: {
              callback: function (value, index, values) {
                if (value >= 1000) {
                  return `${(value / 1000).toLocaleString("de-CH")} tons`;
                }
                return value.toLocaleString("de-CH");
              },
              min: 1,
              max: Math.max(...bubbleChartData.map((item) => item.y)) * 1.1,
              count: 5,
            },
            title: {
              display: true,
              text: "CO₂eq / Material",
              position: "left",
            },
          },
        },
      },
    });
  }

  function renderCo2Chart(buildingElements) {
    const ctx = document.getElementById("co2Chart").getContext("2d");

    const storeyData = buildingElements.reduce((acc, element) => {
      const storey = element.building_storey || "Unknown";
      if (!acc[storey]) {
        acc[storey] = { co2_eq: 0, count: 0 };
      }
      acc[storey].co2_eq += element.materials_info.reduce(
        (sum, material) => sum + parseFloat(material.total_co2 || 0),
        0
      );
      acc[storey].count += 1;
      return acc;
    }, {});

    const labels = Object.keys(storeyData);
    const co2Values = labels.map((storey) => storeyData[storey].co2_eq);

    const minCo2 = Math.min(...co2Values);
    const maxCo2 = Math.max(...co2Values);
    const barColors = co2Values.map((value) =>
      getCo2Color(value, minCo2, maxCo2)
    );

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "CO₂-eq per Building Storey",
            data: co2Values,
            backgroundColor: barColors,
            borderColor: barColors.map((color) => color.replace("0.8", "1.0")),
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.raw;
                const formattedValue =
                  value > 10000
                    ? `${(value / 1000).toLocaleString("de-CH")} tons`
                    : `${value.toLocaleString("de-CH")} kg`;
                return `${formattedValue}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Building Storey",
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "CO₂-eq",
            },
            ticks: {
              callback: function (value) {
                if (value >= 1000) {
                  return `${(value / 1000).toLocaleString("de-CH")} tons`;
                }
                return value.toLocaleString("de-CH");
              },
            },
          },
        },
      },
    });
  }
});
