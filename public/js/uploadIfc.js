document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('ifcUploadForm');
    const messageContainer = document.getElementById('uploadMessage');
    const navBar = document.querySelector('.navbar');

    function createUploadButton() {
        let uploadButton = document.createElement('button');
        uploadButton.id = 'dynamicUploadButton';
        uploadButton.textContent = 'Upload IFC';
        uploadButton.classList.add('btn', 'btn-primary');
        uploadButton.style.cssText = 'margin-left: auto; display: block;'; // Ensures alignment to the right
        uploadButton.onclick = function() { document.getElementById('ifcFile').click(); };
        const navItem = document.createElement('li');
        navItem.classList.add('nav-item', 'ml-auto'); // Align to the right using Bootstrap class
        navItem.appendChild(uploadButton);
        navBar.querySelector('.navbar-nav').appendChild(navItem);
    }

    if(uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const actionUrl = uploadForm.getAttribute('action');
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
                if(messageContainer) {
                    messageContainer.innerHTML = '<div class="alert alert-success" role="alert">IFC file uploaded and analyzed successfully!</div>';
                } else {
                    console.error('Message container not found.');
                }

                // Redirect to project home page after successful upload
                window.location.href = `/projects/${data.projectId}`;

                // Ensure the upload button is aligned to the right
                let dynamicUploadButton = document.getElementById('dynamicUploadButton');
                if (!dynamicUploadButton) {
                    createUploadButton();
                }
            })
            .catch((error) => {
                console.error('Error uploading IFC file:', error.message, error.stack);
                if(messageContainer) {
                    messageContainer.innerHTML = `<div class="alert alert-danger" role="alert">Error uploading file: ${error.message}</div>`;
                } else {
                    console.error('Message container not found.');
                }
            });
        });

        // Immediately creating the upload button if the form is present, indicating that the page is for project details.
        createUploadButton();
    } else {
        console.error('Upload form not found.');
    }
});