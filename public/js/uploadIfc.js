document.addEventListener("DOMContentLoaded", function () {
  const uploadForm = document.getElementById("ifcUploadForm");
  const projectDetailsWrapper = document.getElementById(
    "project-details-wrapper"
  );
  const chartWrapper = document.getElementById("chart-wrapper");
  const tableWrapper = document.getElementById("table-wrapper");
  const uploadSpinner = document.getElementById("uploadSpinner");
  const uploadProgressBar = document.getElementById("uploadProgressBar");
  const uploadMessage = document.getElementById("uploadMessage");

  uploadForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const formData = new FormData(uploadForm);

    uploadSpinner.style.display = "block";
    uploadProgressBar.style.display = "block";

    axios
      .post(uploadForm.action, formData)
      .then((response) => {
        // Update project details
        document.getElementById("project-details-wrapper").innerHTML =
          response.data.projectDetails;

        // Update charts
        document.getElementById("chart-wrapper").innerHTML =
          response.data.charts;

        // Update table
        document.getElementById("table-wrapper").innerHTML =
          response.data.table;

        // Reinitialize any necessary components (e.g., charts, tables)
        initializeTableAndChart(window.projectId);
      })
      .catch((error) => {
        console.error("Error during upload and update:", error);
      });
  });

  function reinitializeCharts() {
    // Reinitialize charts here if necessary
    loadCo2Chart(window.projectId); // Assuming this loads the CO2 and Bubble charts
  }

  function reinitializeTable(projectId) {
    // Reinitialize the table after updating the content
    fetchMaterialNames().then((materialNames) => {
      initializeTable(projectId, materialNames);
    });
  }
});
