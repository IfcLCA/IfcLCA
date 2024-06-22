document.addEventListener("DOMContentLoaded", function () {
  const uploadForm = document.getElementById("ifcUploadForm");
  const messageContainer = document.getElementById("uploadMessage");
  const projectId = window.location.pathname.split("/").pop();

  uploadForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const formData = new FormData(uploadForm);

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
        messageContainer.textContent =
          "File uploaded and processed successfully.";
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      })
      .catch((error) => {
        messageContainer.textContent = `Error: ${error.message}`;
      });
  });
});
