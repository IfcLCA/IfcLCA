import { io } from "socket.io-client";

const socket = io();
const uploadForm = document.getElementById("ifcUploadForm");
const messageContainer = document.getElementById("uploadMessage");
const projectId = window.location.pathname.split("/").pop();
const progressBar = document.getElementById("uploadProgressBar");
const progressText = document.getElementById("uploadProgressText");
const spinner = document.getElementById("uploadSpinner");

document.addEventListener("DOMContentLoaded", function () {
  uploadForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const fileInput = document.querySelector('input[type="file"]');
    const file = fileInput.files[0];

    // Client-side validation for file extension
    if (!file.name.endsWith(".ifc")) {
      messageContainer.textContent = "Error: Only .ifc files are allowed.";
      setTimeout(() => {
        window.location.href = `/projects/${projectId}`;
      }, 5000);
      return;
    }

    const formData = new FormData(uploadForm);

    // Show progress bar and spinner
    progressBar.style.display = "block";
    spinner.style.display = "block";

    fetch(`/api/projects/${projectId}/upload`, {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("File upload failed");
        }
        return response.json();
      })
      .then((data) => {
        // Hide progress bar and spinner
        progressBar.style.display = "none";
        spinner.style.display = "none";
      })
      .catch((error) => {
        // Hide progress bar and spinner
        progressBar.style.display = "none";
        spinner.style.display = "none";

        messageContainer.textContent = `Error: ${error.message}`;
      });
  });

  // WebSocket event listeners
  socket.on("uploadProgress", (data) => {
    progressBar.value = data.progress;
    progressText.textContent = `${data.progress}% - ${data.status}`;
  });

  socket.on("processingComplete", (data) => {
    progressBar.value = 100;
    progressText.textContent = "Processing complete!";
    messageContainer.textContent = data.message;
    setTimeout(() => {
      window.location.href = `/projects/${projectId}`;
    }, 3000);
  });
});
