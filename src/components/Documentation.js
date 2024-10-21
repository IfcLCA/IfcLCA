import React from 'react';

const Documentation = () => {
  return (
    <div className="container mt-4">
      <h1>Documentation</h1>
      <p>Welcome to the IfcLCA Documentation page. Here you will find all the information you need to get started with IfcLCA, including guides, tutorials, and reference materials.</p>
      <h2>Getting Started</h2>
      <p>To get started with IfcLCA, follow these steps:</p>
      <ol>
        <li>Download and install the IfcLCA software.</li>
        <li>Create a new project and upload your IFC file.</li>
        <li>Review the extracted materials and their environmental impact.</li>
        <li>Adjust the calculations as needed to fit your project's requirements.</li>
        <li>Export the results for further analysis or reporting.</li>
      </ol>
      <h2>Guides</h2>
      <p>Our guides cover a range of topics to help you make the most of IfcLCA:</p>
      <ul>
        <li><a href="/guides/installation">Installation Guide</a></li>
        <li><a href="/guides/creating-projects">Creating Projects</a></li>
        <li><a href="/guides/uploading-ifc-files">Uploading IFC Files</a></li>
        <li><a href="/guides/reviewing-materials">Reviewing Materials</a></li>
        <li><a href="/guides/exporting-results">Exporting Results</a></li>
      </ul>
      <h2>Reference</h2>
      <p>For detailed information on IfcLCA's features and functionality, refer to our reference materials:</p>
      <ul>
        <li><a href="/reference/api">API Reference</a></li>
        <li><a href="/reference/materials">Materials Reference</a></li>
        <li><a href="/reference/calculations">Calculations Reference</a></li>
      </ul>
    </div>
  );
};

export default Documentation;
