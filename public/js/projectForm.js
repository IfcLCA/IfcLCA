document.getElementById('newProjectForm').addEventListener('submit', function(e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById('name').value,
    phase: document.getElementById('phase').value,
    description: document.getElementById('description').value,
    customImage: document.getElementById('customImage').value
  };

  fetch('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  })
  .then(response => {
    if (!response.ok) {
      return response.json().then(errorData => {
        throw new Error(errorData.message || 'Failed to create project');
      });
    }
    return response.json();
  })
  .then(data => {
    if(data && data.url) {
      // Display success message before redirecting
      document.getElementById('message').innerHTML = `<div class="alert alert-success" role="alert">Project created successfully! Redirecting...</div>`;
      setTimeout(() => {
        window.location.href = data.url; // Redirect to the project's home page
      }, 2000); // Delay redirection to allow the user to read the success message
    } else {
      throw new Error('Missing project URL for redirection');
    }
  })
  .catch((error) => {
    console.error('Error creating project:', error);
    document.getElementById('message').innerHTML = `<div class="alert alert-danger" role="alert">Error creating project: ${error.message}</div>`;
  });
});