document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('ifcUploadForm');
    const messageContainer = document.getElementById('messageContainer'); // Assumes there's a div with id="messageContainer" in projectHome.ejs

    if(uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const actionUrl = uploadForm.getAttribute('action');
            const projectId = actionUrl.split('/')[3]; // Assumes '/api/projects/:projectId/upload' as the action URL format
            const fileInput = document.getElementById('ifcFile');
            if (!fileInput.files[0]) {
                console.error('No file selected.');
                alert('Please select a file to upload.');
                return;
            }
            const formData = new FormData();
            formData.append('ifcFile', fileInput.files[0]);

            fetch(actionUrl, {
                method: 'POST',
                body: formData,
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log('IFC file uploaded and analyzed successfully:', data);
                // Update the DOM with the new Total Carbon Footprint
                const carbonFootprintElement = document.getElementById('carbonFootprint');
                if(carbonFootprintElement) {
                    carbonFootprintElement.innerText = data.totalCarbonFootprint;
                } else {
                    console.error('Carbon Footprint element not found.');
                }
                // Display success message
                if(messageContainer) {
                    messageContainer.innerHTML = '<div class="alert alert-success" role="alert">IFC file uploaded and analyzed successfully!</div>';
                } else {
                    console.error('Message container not found.');
                }
            })
            .catch((error) => {
                console.error('Error uploading IFC file:', error.message, error.stack);
                alert('Error uploading file: ' + error.message);
                if(messageContainer) {
                    messageContainer.innerHTML = '<div class="alert alert-danger" role="alert">Error uploading file: ' + error.message + '</div>';
                } else {
                    console.error('Message container not found.');
                }
            });
        });
    } else {
        console.error('Upload form not found.');
    }
});