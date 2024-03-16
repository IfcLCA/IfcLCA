const formatProjectNameForDisplay = (projectName) => {
    // Assuming the timestamp is appended with a '-' as a separator
    const separator = '-';
    // Check if the separator exists in the project name
    const separatorIndex = projectName.lastIndexOf(separator);
    if (separatorIndex > -1) {
        // Extract and return the original project name without the timestamp
        return projectName.substring(0, separatorIndex);
    }
    // If the separator does not exist, return the project name as is
    return projectName;
};

const appendTimestampToProjectName = (projectName) => {
    // Use the current timestamp to ensure uniqueness
    const timestamp = Date.now();
    // Append the timestamp to the project name with a '-' as a separator
    return `${projectName}-${timestamp}`;
};

module.exports = {
    formatProjectNameForDisplay,
    appendTimestampToProjectName
};