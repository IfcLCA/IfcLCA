import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import Chart from 'chart.js/auto';
import Tabulator from 'tabulator-tables';

const ProjectHome = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [buildingElements, setBuildingElements] = useState([]);
  const [materialsInfo, setMaterialsInfo] = useState([]);
  const [co2Chart, setCo2Chart] = useState(null);
  const [bubbleChart, setBubbleChart] = useState(null);

  useEffect(() => {
    fetchProjectDetails();
    fetchBuildingElements();
  }, [projectId]);

  const fetchProjectDetails = async () => {
    try {
      const response = await axios.get(`/api/projects/${projectId}`);
      setProject(response.data);
    } catch (error) {
      console.error('Error fetching project details:', error);
    }
  };

  const fetchBuildingElements = async () => {
    try {
      const response = await axios.get(`/api/projects/${projectId}/building_elements`);
      setBuildingElements(response.data);
      setMaterialsInfo(flattenElements(response.data));
    } catch (error) {
      console.error('Error fetching building elements:', error);
    }
  };

  const flattenElements = (elements) => {
    return elements.flatMap((element) => {
      return element.materials_info.map((material) => ({
        ...material,
        instance_name: element.instance_name,
        ifc_class: element.ifc_class,
      }));
    });
  };

  useEffect(() => {
    if (project && buildingElements.length > 0) {
      renderCo2Chart();
      renderBubbleChart();
    }
  }, [project, buildingElements]);

  const renderCo2Chart = () => {
    const ctx = document.getElementById('co2Chart').getContext('2d');
    const storeyData = buildingElements.reduce((acc, element) => {
      const storey = element.building_storey || 'Unknown';
      if (!acc[storey]) {
        acc[storey] = { co2_eq: 0, count: 0 };
      }
      acc[storey].co2_eq += element.materials_info.reduce(
        (sum, material) => sum + parseFloat(material.total_co2 || 0),
        0
      );
      acc[storey].count += 1;
      return acc;
    }, {});

    const labels = Object.keys(storeyData);
    const co2Values = labels.map((storey) => storeyData[storey].co2_eq);

    const minCo2 = Math.min(...co2Values);
    const maxCo2 = Math.max(...co2Values);
    const barColors = co2Values.map((value) => getCo2Color(value, minCo2, maxCo2));

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'CO₂-eq per Building Storey',
            data: co2Values,
            backgroundColor: barColors,
            borderColor: barColors.map((color) => color.replace('0.8', '1.0')),
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.raw;
                const formattedValue =
                  value > 10000
                    ? `${(value / 1000).toLocaleString('de-CH')} tons`
                    : `${value.toLocaleString('de-CH')} kg`;
                return `${formattedValue}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Building Storey',
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'CO₂-eq',
            },
            ticks: {
              callback: function (value) {
                if (value >= 1000) {
                  return `${(value / 1000).toLocaleString('de-CH')} tons`;
                }
                return value.toLocaleString('de-CH');
              },
            },
          },
        },
      },
    });

    setCo2Chart(chart);
  };

  const renderBubbleChart = () => {
    const ctx = document.getElementById('bubbleChart').getContext('2d');

    const bubbleData = buildingElements.reduce((acc, element) => {
      element.materials_info.forEach((material) => {
        const existing = acc.find(
          (entry) => entry.material === material.matched_material_name
        );
        if (existing) {
          existing.totalVolume += parseFloat(material.volume);
          existing.totalCo2 += parseFloat(material.total_co2);
        } else {
          acc.push({
            material: material.matched_material_name,
            totalVolume: parseFloat(material.volume),
            totalCo2: parseFloat(material.total_co2),
          });
        }
      });
      return acc;
    }, []);

    const bubbleChartData = bubbleData.map((item) => ({
      x: item.totalVolume,
      y: item.totalCo2,
      r: Math.sqrt(item.totalVolume),
      label: item.material,
    }));

    const minCo2 = Math.min(...bubbleChartData.map((item) => item.y));
    const maxCo2 = Math.max(...bubbleChartData.map((item) => item.y));

    const maxVolume = Math.max(...bubbleChartData.map((item) => item.x));
    const maxRadius = Math.min(ctx.canvas.width, ctx.canvas.height) / 6;

    bubbleChartData.forEach((item) => {
      item.r = Math.sqrt(item.x / maxVolume) * maxRadius;
    });

    const bubbleColors = bubbleChartData.map((item) =>
      getCo2Color(item.y, minCo2, maxCo2)
    );

    const chart = new Chart(ctx, {
      type: 'bubble',
      data: {
        datasets: [
          {
            label: 'CO₂eq per Material',
            data: bubbleChartData,
            backgroundColor: bubbleColors,
            borderColor: bubbleColors.map((color) => color.replace('0.8', '1.0')),
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.raw.y;
                const formattedValue =
                  value > 10000
                    ? `${(value / 1000).toLocaleString('de-CH')} tons`
                    : `${value.toLocaleString('de-CH')} kg`;
                return `${
                  context.raw.label
                }: Volume: ${context.raw.x.toLocaleString(
                  'de-CH'
                )} m³, CO₂eq: ${formattedValue}`;
              },
            },
          },
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Volume per Material (m³)',
            },
          },
          y: {
            type: 'logarithmic',
            ticks: {
              callback: function (value, index, values) {
                if (value >= 1000) {
                  return `${(value / 1000).toLocaleString('de-CH')} tons`;
                }
                return value.toLocaleString('de-CH');
              },
              min: 1,
              max: Math.max(...bubbleChartData.map((item) => item.y)) * 1.1,
              count: 5,
            },
            title: {
              display: true,
              text: 'CO₂eq / Material',
              position: 'left',
            },
          },
        },
      },
    });

    setBubbleChart(chart);
  };

  const getCo2Color = (value, min, max) => {
    const thresholds = {
      low: min + (max - min) * 0.25,
      medium: min + (max - min) * 0.5,
      high: min + (max - min) * 0.75,
    };

    if (value < thresholds.low) return 'rgba(75, 192, 192, 0.8)';
    if (value < thresholds.medium) return 'rgba(255, 205, 86, 0.8)';
    if (value < thresholds.high) return 'rgba(255, 159, 64, 0.8)';
    return 'rgba(255, 99, 132, 0.8)';
  };

  return (
    <div className="container mt-4">
      {project && (
        <>
          <div className="project-container">
            <div className="details-container">
              <h2 id="project-name">{project.name}</h2>
              <p>Phase: {project.phase}</p>
              <p>Description: {project.description}</p>
              <p>
                Carbon Footprint: <span id="carbonFootprint">{(project.totalCarbonFootprint / 1000).toFixed(1)} tons</span>
              </p>
              <p>
                m²: <strong id="ebfPerM2">{project.EBF.toLocaleString()} m²</strong>
              </p>
              <p>
                CO₂-eq / m²: <strong id="co2PerM2">{project.co2PerSquareMeter.toFixed(1)} kg</strong>
              </p>
              <div className="editbtn-container">
                <Link to={`/projects/${project._id}/edit`} id="btn-edit-project" className="btn btn-primary">
                  Edit Project Details & Settings
                </Link>
              </div>
            </div>
            <div className="chart-container">
              <canvas id="co2Chart" width="auto"></canvas>
            </div>
          </div>
          <div className="charts-container">
            <div className="chart-container">
              <canvas id="bubbleChart" width="auto"></canvas>
            </div>
          </div>
          <div className="btn-container">
            <button id="btn-delete-material" className="btn btn-secondary">
              Delete
            </button>
            <Link to={`/projects/${project._id}/add-row`} id="btn-add-material" className="btn btn-success">
              Add Material
            </Link>
            <div id="confirm-buttons" className="btn-row" style={{ display: 'none' }}>
              <button id="btn-apply-delete" className="btn btn-danger">
                Apply Changes
              </button>
              <button id="btn-cancel" className="btn btn-secondary" style={{ marginLeft: '10px' }}>
                Cancel
              </button>
            </div>
          </div>
          <div id="elements-table-container" style={{ position: 'relative', marginBottom: '60px' }}>
            <div id="elements-table" className="mt-4"></div>
            <div id="table-overlay" className="overlay">
              <p>
                Upload any <a href="#" id="upload-link">IFC file</a> to see data
              </p>
              <input type="file" id="hidden-file-input" name="ifcFile" style={{ display: 'none' }} />
            </div>
            <form id="ifcUploadForm" action={`/api/projects/${project._id}/upload`} method="POST" enctype="multipart/form-data" style={{ display: 'none' }}>
              <input type="file" id="hiddenFileInput" name="ifcFile" required />
            </form>
          </div>
          <div id="invalid-density-notification" style={{ display: 'none', position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#ffc', border: '1px solid #ffa', padding: '10px', borderRadius: '5px', zIndex: '1000', boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)', fontSize: '14px', color: '#a00' }}>
            <p>Some density fields are invalid. Please check and enter valid values.</p>
          </div>
          <div id="uploadMessage"></div>
          <div id="uploadProgressBar" style={{ display: 'none', background: '#e0e0e0', height: '20px', width: '100%', position: 'relative' }}>
            <div style={{ background: '#76c7c0', height: '100%', width: '100%' }}></div>
          </div>
          <div id="uploadSpinner" style={{ display: 'none', textAlign: 'center', marginTop: '10px' }}>
            <i className="fa fa-spinner fa-spin" style={{ fontSize: '24px' }}></i>
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectHome;
