document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('ifcUploadForm');
    const messageContainer = document.getElementById('uploadMessage');
    const navBar = document.querySelector('.navbar');


    // Ensure the upload button is aligned to the right
    let dynamicUploadButton = document.getElementById('dynamicUploadButton');
    if (!dynamicUploadButton) {
        createUploadButton();
    }


});