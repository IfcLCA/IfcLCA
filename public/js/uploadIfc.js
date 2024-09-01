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
        // Update the content of the project details, charts, and table
        projectDetailsWrapper.innerHTML = response.data.projectDetails;
        chartWrapper.innerHTML = response.data.charts;
        tableWrapper.innerHTML = response.data.table;

        // Reinitialize any necessary components after the content update
        reinitializeCharts();
        reinitializeTable(window.projectId);

        uploadMessage.innerHTML = "IFC file uploaded successfully!";
      })
      .catch((error) => {
        uploadMessage.innerHTML = `Error: ${error.message}`;
      })
      .finally(() => {
        uploadSpinner.style.display = "none";
        uploadProgressBar.style.display = "none";
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
