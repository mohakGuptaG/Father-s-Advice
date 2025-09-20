const { exec } = require("child_process");
const path = require("path");

// Function to run a Python script
function runPythonScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`Running Python script: ${scriptPath}`);
    exec(`python ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing Python script: ${error}`);
        reject(error);
        return;
      }
      console.log(`Python script output: ${stdout}`);
      if (stderr) {
        console.error(`Python script stderr: ${stderr}`);
      }
      resolve(stdout);
    });
  });
}

// Function to run a Node.js script
function runNodeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`Running Node.js script: ${scriptPath}`);
    exec(`node ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing Node.js script: ${error}`);
        reject(error);
        return;
      }
      console.log(`Node.js script output: ${stdout}`);
      if (stderr) {
        console.error(`Node.js script stderr: ${stderr}`);
      }
      resolve(stdout);
    });
  });
}

// Main function to run both scripts
async function setupTestMentor() {
  try {
    // Run the Python script to create the mentor profile
    await runPythonScript(path.join(__dirname, "create_simple_mentor.py"));

    // Run the Node.js script to bypass profile completion check
    await runNodeScript(path.join(__dirname, "bypass_profile_check.js"));

    console.log("Test mentor setup completed successfully!");
    console.log("You can now log in with:");
    console.log("Email: mentor@test.com");
    console.log("Password: password123");
  } catch (error) {
    console.error("Error setting up test mentor:", error);
  }
}

// Run the setup
setupTestMentor();
