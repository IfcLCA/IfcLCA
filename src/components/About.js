import React from 'react';

const About = () => {
  return (
    <div className="container mt-4">
      <h1>About IfcLCA</h1>
      <p>IfcLCA is a free and open-source tool designed to help professionals in the construction industry perform Life Cycle Assessment (LCA) based on Industry Foundation Classes (IFC) files. Our mission is to provide a transparent and accessible solution for sustainable construction analytics.</p>
      <h2>Our Mission</h2>
      <p>Our mission is to promote sustainability in the construction industry by providing a tool that allows for the easy and accurate assessment of the environmental impact of building materials and processes. We believe that by making this tool freely available, we can help drive positive change in the industry.</p>
      <h2>Features</h2>
      <ul>
        <li>Easy file upload and material extraction</li>
        <li>Automatic environmental impact calculation</li>
        <li>Customizable calculations to fit project needs</li>
        <li>Free and open-source</li>
      </ul>
      <h2>Get Involved</h2>
      <p>We welcome contributions from developers, researchers, and industry professionals. Whether you want to contribute code, report issues, or provide feedback, we encourage you to get involved and help us improve IfcLCA.</p>
      <p>Visit our <a href="/opensource">Open Source</a> page to learn more about how you can contribute.</p>
    </div>
  );
};

export default About;
