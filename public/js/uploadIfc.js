document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('ifcUploadForm');
    const messageContainer = document.getElementById('uploadMessage');
    const navBar = document.querySelector('.navbar');


    // Ensure the upload button is aligned to the right
    let dynamicUploadButton = document.getElementById('dynamicUploadButton');
    if (!dynamicUploadButton) {
        createUploadButton();
    }

    // Handle the form submission event to perform the upload and analysis
    uploadForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData(uploadForm);
        fetch(`/api/projects/${projectId}/upload`, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('File upload failed');
            }
            return response.json();
        })
        .then(data => {
            // Refresh the table data after successful upload and analysis
            table.setData(`/api/projects/${projectId}/elements`);
            messageContainer.textContent = 'IFC file uploaded and analyzed successfully!';
        })
        .catch(error => {
            messageContainer.textContent = error.message;
        });
    });

});