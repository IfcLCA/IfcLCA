import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    fetch('/api/projects')
      .then(response => response.json())
      .then(data => setProjects(data))
      .catch(error => console.error('Error fetching projects:', error));
  }, []);

  return (
    <div className="container mt-4">
      <div className="text-center mb-4">
        <h1>Dashboard</h1>
        {projects.length > 0 ? (
          <div className="d-flex flex-wrap justify-content-around">
            {projects.map(project => (
              <Link
                key={project._id}
                to={`/projects/${project._id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="card" style={{ width: '21.5rem', margin: '10px' }}>
                  {project.customImage && (
                    <img
                      src={project.customImage}
                      className="card-img-top"
                      alt={project.name}
                    />
                  )}
                  <div className="card-body">
                    <h5 className="card-title">{project.name}</h5>
                    <p className="card-text">
                      <small>{project.description}</small>
                    </p>
                    <p className="card-text">
                      Carbon Footprint: <span className="bold-value">{project.totalCarbonFootprint}</span>
                    </p>
                    <p className="card-text">
                      Phase: <span className="bold-value">{project.phase}</span>
                    </p>
                    <p className="card-text">
                      EBF: <span className="bold-value">{project.EBF} m²</span>
                    </p>
                    <p className="card-text">
                      CO₂-eq / m²: <span className="bold-value">{project.co2PerSquareMeter} kg</span>
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center" style={{ marginTop: '50px' }}>
            <p>No projects found. Start by creating a new project.</p>
            <Link to="/newProject" className="btn btn-primary">Create New Project</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
