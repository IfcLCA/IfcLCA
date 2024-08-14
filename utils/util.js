const formatProjectNameForDisplay = (projectName) => {
  const separator = "-";
  const separatorIndex = projectName.lastIndexOf(separator);
  if (separatorIndex > -1) {
    return projectName.substring(0, separatorIndex);
  }
  return projectName;
};

const appendTimestampToProjectName = (projectName) => {
  const timestamp = Date.now();
  return `${projectName}-${timestamp}`;
};

module.exports = {
  formatProjectNameForDisplay,
  appendTimestampToProjectName,
};
