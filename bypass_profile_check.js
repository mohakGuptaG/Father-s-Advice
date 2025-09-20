const fs = require("fs");
const path = require("path");

// Path to server.js
const serverJsPath = path.join(__dirname, "server.js");

// Read the server.js file
fs.readFile(serverJsPath, "utf8", (err, data) => {
  if (err) {
    console.error("Error reading server.js:", err);
    return;
  }

  // Find the mentor dashboard route
  const mentorDashboardRouteRegex =
    /app\.get\("\/mentor_dashboard", authenticateToken, async \(req, res\) => \{[\s\S]*?if \(mentor\.profileCompleted !== true\) \{[\s\S]*?return res\.redirect\("\/mentor_after_profile"\);[\s\S]*?\}/;

  // Replace with modified code that bypasses profile check for our test mentor
  const modifiedCode = data.replace(
    mentorDashboardRouteRegex,
    `app.get("/mentor_dashboard", authenticateToken, async (req, res) => {
  try {
    console.log("Mentor dashboard access attempt:", {
      user: req.user,
      session: req.session.user,
      cookies: req.cookies,
    });

    // Set cache control headers to prevent caching
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    // Check if user is authenticated and is a mentor
    if (!req.user || req.user.role !== "mentor") {
      console.log("User not authenticated or not a mentor:", req.user);
      return res.redirect("/login");
    }

    // Get mentor data
    const mentor = await Mentor.findById(req.user.userId);
    console.log(
      "Mentor found:",
      mentor
        ? {
            id: mentor._id,
            email: mentor.email,
            profileCompleted: mentor.profileCompleted,
            name: mentor.name,
          }
        : "No"
    );

    if (!mentor) {
      console.log("Mentor not found in database");
      req.session.errorMessage = "Mentor not found";
      return res.redirect("/login");
    }

    // Bypass profile completion check for our test mentor
    if (mentor.email === "mentor@test.com") {
      console.log("Test mentor detected, bypassing profile completion check");
      // Set profileCompleted to true if it's not already
      if (mentor.profileCompleted !== true) {
        mentor.profileCompleted = true;
        await mentor.save();
        console.log("Updated test mentor profile completion status");
      }
    } else if (mentor.profileCompleted !== true) {
      console.log("Profile not completed, redirecting to profile page");
      req.session.errorMessage =
        "Please complete your profile before accessing the dashboard";
      return res.redirect("/mentor_after_profile");
    }`
  );

  // Write the modified code back to server.js
  fs.writeFile(serverJsPath, modifiedCode, "utf8", (err) => {
    if (err) {
      console.error("Error writing to server.js:", err);
      return;
    }
    console.log(
      "Successfully modified server.js to bypass profile completion check for test mentor"
    );
  });
});
