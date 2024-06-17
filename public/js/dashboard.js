document.addEventListener('DOMContentLoaded', function() {
  fetch('/api/projects')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(projects => {
      const projectsContainer = document.getElementById('projects-container');
      if (!projectsContainer) {
        console.error('Projects container not found on the page.');
        return;
      }
      let allProjectsHtml = '';
      projects.forEach(project => {
        const cardHtml = `
          <a href="/projects/${project._id}" style="text-decoration: none; color: inherit;">
            <div class="card" style="width: 18rem;">
              <img src="${project.customImage}" class="card-img-top" alt="${project.name}">
              <div class="card-body">
                <h5 class="card-title">${project.name}</h5>
                <p class="card-text">${project.description}</p>
                <p class="card-text">Phase: ${project.phase}</p>
                <p class="card-text">Carbon Footprint: ${project.totalCarbonFootprint}</p>
              </div>
            </div>
          </a>
        `;
        allProjectsHtml += cardHtml;
      });
      projectsContainer.innerHTML = allProjectsHtml;
    })
    .catch(error => {
      console.error('Error fetching projects:', error.message, error.stack);
    });
});