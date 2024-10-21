import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';

const EditProject = () => {
  const { projectId } = useParams();
  const history = useHistory();
  const [project, setProject] = useState({
    name: '',
    phase: '',
    description: '',
    customImage: '',
    EBF: 0,
  });

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(response => response.json())
      .then(data => setProject(data))
      .catch(error => console.error('Error fetching project details:', error));
  }, [projectId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProject(prevProject => ({
      ...prevProject,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    fetch(`/api/projects/${projectId}/edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(project),
    })
      .then(response => {
        if (response.ok) {
          history.push(`/projects/${projectId}`);
        } else {
          throw new Error('Error updating project');
        }
      })
      .catch(error => console.error('Error updating project:', error));
  };

  return (
    <div className="container mt-4">
      <h2>Edit Project</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="name" className="form-label">Project Name</label>
          <input
            type="text"
            id="name"
            name="name"
            className="form-control"
            value={project.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="phase" className="form-label">Phase</label>
          <input
            type="text"
            id="phase"
            name="phase"
            className="form-control"
            value={project.phase}
            onChange={handleChange}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="description" className="form-label">Description</label>
          <textarea
            id="description"
            name="description"
            className="form-control"
            rows="3"
            value={project.description}
            onChange={handleChange}
          ></textarea>
        </div>
        <div className="mb-3">
          <label htmlFor="customImage" className="form-label">Custom Image URL</label>
          <input
            type="text"
            id="customImage"
            name="customImage"
            className="form-control"
            value={project.customImage}
            onChange={handleChange}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="EBF" className="form-label">Project m² (EBF)</label>
          <input
            type="number"
            id="EBF"
            name="EBF"
            className="form-control"
            value={project.EBF}
            onChange={handleChange}
            step="0.01"
            min="0"
            required
          />
        </div>
        <div className="d-flex justify-content-between">
          <button type="submit" className="btn btn-success">Confirm</button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => history.push('/dashboard')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProject;
