document.addEventListener("DOMContentLoaded", function () {
  const projectId = window.location.pathname.split("/").pop();
  const progressBar = document.getElementById("uploadProgressBar");

  async function checkProgress() {
    try {
      const response = await fetch(`/api/projects/${projectId}/progress`);
      const progress = await response.json();

      if (progress === "error") {
        progressBar.textContent = "Error processing file.";
        return;
      }

      progressBar.style.width = `${progress}%`;
      progressBar.textContent = `Processing: ${progress}%`;

      if (progress < 100) {
        setTimeout(checkProgress, 1000); // Poll every second
      } else {
        progressBar.textContent = "Processing complete!";
      }
    } catch (error) {
      console.error("Error checking progress:", error);
    }
  }

  checkProgress();
});
