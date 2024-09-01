document.addEventListener("DOMContentLoaded", function () {
  const ifcUploadForm = document.getElementById("ifcUploadForm");
  const uploadSpinner = document.getElementById("uploadSpinner");
  const uploadProgressBar = document.getElementById("uploadProgressBar");
  const uploadMessage = document.getElementById("uploadMessage");

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

        // Replace the project details, charts, and table sections with the new HTML
        document.querySelector(".project-container").innerHTML =
          data.projectDetails;
        document.getElementById("chart-wrapper").innerHTML = data.charts;
        document.getElementById("table-wrapper").innerHTML = data.table;

        uploadMessage.innerHTML = "IFC file uploaded successfully!";
      } catch (error) {
        uploadMessage.innerHTML = `Error: ${error.message}`;
      } finally {
        uploadSpinner.style.display = "none";
        uploadProgressBar.style.display = "none";
      }
    });
  }
});
