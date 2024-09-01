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
        // Here, replace `projectId` with a valid variable or ID reference as appropriate
        const projectId = response.data.projectId || window.projectId;

        // Update project details
        return axios.get(`/projects/${projectId}/details`);
      })
      .then((res) => {
        projectDetailsWrapper.innerHTML = res.data;
        // Update charts
        return axios.get(`/projects/${projectId}/charts`);
      })
      .then((res) => {
        chartWrapper.innerHTML = res.data;
        // Optionally reinitialize charts if necessary
      })
      .then(() => {
        // Update table
        return axios.get(`/projects/${projectId}/table`);
      })
      .then((res) => {
        tableWrapper.innerHTML = res.data;
        // Optionally reinitialize table if necessary
      })
      .then(() => {
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
});
