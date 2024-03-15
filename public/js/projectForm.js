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
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    console.log('Project created successfully:', data);
    document.getElementById('message').innerHTML = `<div class="alert alert-success" role="alert">Project created successfully!</div>`;
  })
  .catch((error) => {
    console.error('Error creating project:', error);
    document.getElementById('message').innerHTML = `<div class="alert alert-danger" role="alert">Error creating project: ${error.message}</div>`;
  });
});