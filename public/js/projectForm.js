document.getElementById('newProjectForm').addEventListener('submit', async function (event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  const projectData = {
    name: formData.get('name'),
    phase: formData.get('phase'),
    description: formData.get('description'),
    customImage: formData.get('customImage'),
    EBF: formData.get('EBF') // Ensure EBF is sent as a string
  };

  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(projectData)
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const result = await response.json();
    if (result.status === 'success') {
      window.location.href = result.url;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error creating project:', error);
    document.getElementById('message').textContent = error.message;
    document.getElementById('message').classList.add('alert', 'alert-danger');
  }
});
