// Load environment variables
require("dotenv").config();

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/user.model.js");
const Mentor = require("./models/mentor.model.js");
const app = express();
const MentorProfile = require("./models/mentor.after.profile.model.js"); // Import the schema
const {
  authenticateToken,
} = require("./middleware/authentication.middleware.js");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const MenteeRequest = require("./models/mentee.request.model.js");
const { spawn } = require("child_process");
const axios = require("axios"); // Make sure axios is installed
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const Mentee = require("./models/mentee.model.js");
const Doubt = require("./models/doubt.model.js");
const Match = require("./models/match.model.js");
const Session = require("./models/session.model.js");

// Ensure process.env is available
if (typeof process === "undefined") {
  global.process = require("process");
}

// Ensure __dirname is available
if (typeof __dirname === "undefined") {
  global.__dirname = path.dirname(require.main.filename);
}

console.log("MongoDB URI:", process.env.MONGO_URI); // Debugging

// retry connection to database 5 times
const MAX_DB_RETRY_ATTEMPTS = 5;

// sounaks own enchanced fucntion for database connection
async function connectDatabase() {
  const connectOptions = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4 // Use IPv4, skip trying IPv6
  };

  mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to database');
  });

  mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('Mongoose disconnected, attempting reconnect...');
  });
  
  let retryCount = 0;
  
  async function connectWithRetry() {
    if (retryCount >= MAX_DB_RETRY_ATTEMPTS) {
      console.error(`Failed to connect to MongoDB after ${MAX_DB_RETRY_ATTEMPTS} attempts.`);
      console.warn('Server will continue without database functionality.');
      return false;
    }
    
    try {
      retryCount++;
      await mongoose.connect(process.env.MONGO_URI, connectOptions);
      console.log(`Connected to MongoDB (attempt ${retryCount})`);
      retryCount = 0; // Reset counter on success
      return true;
    } catch (err) {
      console.error(`Failed to connect to MongoDB (attempt ${retryCount}/${MAX_DB_RETRY_ATTEMPTS})`, err);
      
      if (retryCount < MAX_DB_RETRY_ATTEMPTS) {
        const delay = Math.min(5000 * retryCount, 30000); // Exponential backoff with 30s max
        console.log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return connectWithRetry();
      }
      return false;
    }
  }

  return connectWithRetry();
}

// Script to run the python files
const runPythonScript = (scriptName) => {
  console.log(`Starting ${scriptName}...`);
  const pythonCommand = process.platform === "win32" ? "python" : "python3";
  const process = spawn(pythonCommand, [scriptName], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  process.stdout.on("data", (data) => {
    console.log(`Output from ${scriptName}: ${data.toString()}`);
  });

  process.stderr.on("data", (data) => {
    console.error(`Error from ${scriptName}: ${data.toString()}`);
  });

  process.on("error", (err) => {
    console.error(`Failed to start ${scriptName}:`, err);
  });

  process.on("close", (code) => {
    console.log(`${scriptName} exited with code ${code}`);
  });
};

// Start both Python scripts
async function startPythonServices() {
  try {
    console.log("Starting Python services...");
    const pythonCommand = process.platform === "win32" ? "python" : "python3";

    // Start services in sequence to ensure proper initialization
    const services = [
      { name: "mentor_processor.py", port: 5003 },
      { name: "api.py", port: 5001 },
      { name: "algo.py", port: 5000 },
    ];

    for (const service of services) {
      console.log(`Starting ${service.name} on port ${service.port}...`);
      const pythonProcess = spawn(pythonCommand, [service.name], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      pythonProcess.stdout.on("data", (data) => {
        console.log(`${service.name} output:`, data.toString());
      });

      pythonProcess.stderr.on("data", (data) => {
        console.error(`${service.name} error:`, data.toString());
      });

      pythonProcess.on("close", (code) => {
        console.log(`${service.name} exited with code ${code}`);
      });

      // Wait for service to start
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log("All Python services started");
    return true;
  } catch (error) {
    console.error("Error starting Python services:", error);
    return false;
  }
}

// Wait for Python servers to start before continuing
async function waitForServices() {
  try {
    console.log("Waiting for services to be ready...");

    // Check each service's health endpoint
    const services = [
      { url: "http://localhost:5003/health", name: "Mentor Processor" },
      { url: "http://localhost:5001/health", name: "API" },
      { url: "http://localhost:5000/health", name: "Algorithm" },
    ];

    for (const service of services) {
      let retries = 3;
      while (retries > 0) {
        try {
          const response = await axios.get(service.url);
          console.log(`${service.name} is healthy:`, response.data);
          break;
        } catch (error) {
          retries--;
          if (retries === 0) {
            console.error(`${service.name} failed health check`);
            return false;
          }
          console.log(
            `Retrying ${service.name} health check... (${retries} attempts left)`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    console.log("All services are healthy");
    return true;
  } catch (error) {
    console.error("Error checking service health:", error);
    return false;
  }
}

// Initialize the application
async function initializeApp() {
  try {
    // Connect to MongoDB using the new function
    const dbConnected = await connectDatabase();
    if (!dbConnected) {
      console.error("Failed to connect to database. Some features may not work.");
    }

    // Start Python services
    console.log("Starting Python services...");
    const pythonCommand = process.platform === "win32" ? "python" : "python3";
    const services = [
      { name: "mentor_processor.py", port: 5003 },
      { name: "api.py", port: 5001 },
      { name: "algo.py", port: 5000 },
    ];

    for (const service of services) {
      console.log(`Starting ${service.name} on port ${service.port}...`);
      const pythonProcess = spawn(pythonCommand, [service.name], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      pythonProcess.stdout.on("data", (data) => {
        console.log(`${service.name} output:`, data.toString());
      });

      pythonProcess.stderr.on("data", (data) => {
        console.error(`${service.name} error:`, data.toString());
      });

      pythonProcess.on("close", (code) => {
        console.log(`${service.name} exited with code ${code}`);
      });

      // Wait for service to start
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Configure middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(
      session({
        secret: process.env.SESSION_SECRET || "your-secret-key",
        resave: false,
        saveUninitialized: false,
        cookie: { secure: process.env.NODE_ENV === "production" },
      })
    );

    // Serve static files
    app.use(express.static(path.join(__dirname, "public")));

    // Set view engine
    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "views"));

    // Start server
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to initialize application:", error);
    process.exit(1);
  }
}

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser()); // Add this before any routes or middleware using req.cookies
// Set the view engine to EJS
app.set("view engine", "ejs");

// Specify the views folder for EJS templates
app.set("views", path.join(__dirname, "views"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "yourSecretKey",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, // Set to false for HTTP in development
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Add this after session middleware
app.use((req, res, next) => {
  // Initialize error message if it doesn't exist
  if (!req.session.errorMessage) {
    req.session.errorMessage = null;
  }
  next();
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// Serve static files
app.use("/css", express.static(path.join(__dirname, "public", "css")));
app.use("/html", express.static(path.join(__dirname, "public", "html")));
app.use("/js", express.static(path.join(__dirname, "public", "js")));
app.use("/images", express.static(path.join(__dirname, "public", "images")));

// Define JWT_SECRET at the top level
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-here";

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /pdf|doc|docx/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb("Error: Only PDF, DOC, and DOCX files are allowed!");
    }
  },
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Serve the main index.html file
app.get("/", (req, res) => {
  if (!req.session.userId) {
    // Allow public access to home page
    res.sendFile(path.join(__dirname, "public", "html", "index.html"));
  } else {
    // If logged in, redirect to the appropriate dashboard based on role
    if (req.session.user && req.session.user.role === "mentor") {
      res.redirect("/mentor_dashboard");
    } else {
      res.redirect("/mentee_profile");
    }
  }
});

app.get("/html/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "html", "login.html"));
});

// Login page route
app.get("/login", (req, res) => {
  // Get error message from session and clear it
  const errorMessage = req.session.errorMessage;
  req.session.errorMessage = null;

  // Render login page with error message if any
  res.render("login", {
    errorMessage: errorMessage,
    user: req.session.user || null,
  });
});

// Login Route
app.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    console.log("Login attempt:", { email, role });

    // Input validation
    if (!email || !password || !role) {
      console.log("Missing required fields");
      if (req.headers["content-type"] === "application/json") {
        return res.status(400).json({ error: "All fields are required" });
      }
      return res.redirect(
        `/html/login.html?error=${encodeURIComponent(
          "All fields are required"
        )}`
      );
    }

    // Find user based on role
    let user;
    if (role === "mentor") {
      user = await Mentor.findOne({ email: email });
      console.log("Mentor found:", user ? "Yes" : "No");
      if (user) {
        console.log("Mentor details:", {
          id: user._id,
          name: user.name,
          email: user.email,
          profileCompleted: user.profileCompleted,
          fullUser: JSON.stringify(user),
        });
      }
    } else if (role === "mentee") {
      user = await User.findOne({ email: email, role: "mentee" });
      console.log("Mentee found:", user ? "Yes" : "No");
      if (user) {
        console.log("Mentee details:", {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        });
      }
    }

    // Check if user exists
    if (!user) {
      console.log("User not found");
      if (req.headers["content-type"] === "application/json") {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      return res.redirect(
        `/html/login.html?error=${encodeURIComponent(
          "Invalid email or password"
        )}`
      );
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Password valid:", isPasswordValid);
    if (!isPasswordValid) {
      if (req.headers["content-type"] === "application/json") {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      return res.redirect(
        `/html/login.html?error=${encodeURIComponent(
          "Invalid email or password"
        )}`
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Set token in cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // Set to false for HTTP in development
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Set user info in session
    req.session.user = {
      id: user._id,
      email: user.email,
      role: user.role,
    };

    // Handle role-specific redirects
    if (role === "mentor") {
      console.log("Mentor profile check:", {
        mentorExists: !!user,
        profileCompleted: user.profileCompleted,
        mentorId: user._id,
        fullUser: JSON.stringify(user),
      });

      // If mentor has a completed profile, redirect to dashboard
      if (user.profileCompleted === true) {
        console.log("Redirecting to mentor dashboard - profile is completed");
        if (req.headers["content-type"] === "application/json") {
          return res.json({ redirect: "/mentor_dashboard" });
        }
        return res.redirect("/mentor_dashboard");
      }

      // If profile is not completed, redirect to profile completion
      console.log(
        "Redirecting to mentor_after_profile - profile not completed"
      );
      if (req.headers["content-type"] === "application/json") {
        return res.json({ redirect: "/mentor_after_profile" });
      }
      return res.redirect("/mentor_after_profile");
    } else {
      // For mentees, redirect directly to dashboard
      console.log("Redirecting mentee to profile page");
      if (req.headers["content-type"] === "application/json") {
        return res.json({ redirect: "/mentee_profile" });
      }
      return res.redirect("/mentee_profile");
    }
  } catch (error) {
    console.error("Login error:", error);
    if (req.headers["content-type"] === "application/json") {
      return res.status(500).json({ error: "An error occurred during login" });
    }
    return res.redirect(
      `/html/login.html?error=${encodeURIComponent(
        "An error occurred during login"
      )}`
    );
  }
});

// Signup Route
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role, phone, address } = req.body;
    console.log("Signup attempt:", { name, email, role });

    // Input validation
    if (!name || !email || !password || !role) {
      console.log("Missing required fields");
      if (req.headers["content-type"] === "application/json") {
        return res.status(400).json({ error: "All fields are required" });
      }
      return res.redirect(
        `/html/signup.html?error=${encodeURIComponent(
          "All fields are required"
        )}`
      );
    }

    // Check if user already exists
    const existingUser =
      role === "mentor"
        ? await Mentor.findOne({ email: email })
        : await User.findOne({ email: email, role: "mentee" });

    if (existingUser) {
      console.log("User already exists");
      if (req.headers["content-type"] === "application/json") {
        return res.status(400).json({ error: "User already exists" });
      }
      return res.redirect(
        `/html/signup.html?error=${encodeURIComponent("User already exists")}`
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user based on role
    let newUser;
    if (role === "mentor") {
      newUser = new Mentor({
        name,
        email,
        password: hashedPassword,
        role,
        phone: phone || "",
        address: address || "",
        profileCompleted: false,
      });
    } else {
      newUser = new User({
        name,
        email,
        password: hashedPassword,
        role,
        phone: phone || "",
        address: address || "",
      });
    }

    // Save user to database
    await newUser.save();
    console.log("New user created:", {
      id: newUser._id,
      email: newUser.email,
      role: newUser.role,
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: newUser._id,
        email: newUser.email,
        role: newUser.role,
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Set token in cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // Set to false for HTTP in development
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Set user info in session
    req.session.user = {
      id: newUser._id,
      email: newUser.email,
      role: newUser.role,
    };

    // Handle role-specific redirects
    if (role === "mentor") {
      if (req.headers["content-type"] === "application/json") {
        return res.json({
          redirect:
            "/html/login.html?message=Signup successful! Please login to continue.",
        });
      }
      return res.redirect(
        "/html/login.html?message=Signup successful! Please login to continue."
      );
    } else {
      if (req.headers["content-type"] === "application/json") {
        return res.json({
          redirect:
            "/html/login.html?message=Signup successful! Please login to continue.",
        });
      }
      return res.redirect(
        "/html/login.html?message=Signup successful! Please login to continue."
      );
    }
  } catch (error) {
    console.error("Signup error:", error);
    if (req.headers["content-type"] === "application/json") {
      return res.status(500).json({ error: "An error occurred during signup" });
    }
    return res.redirect(
      `/html/signup.html?error=${encodeURIComponent(
        "An error occurred during signup"
      )}`
    );
  }
});

app.get("/mentee_profile", authenticateToken, async (req, res) => {
  try {
    console.log("Mentee profile route accessed:", {
      user: req.user,
      session: req.session.user,
      cookies: req.cookies,
    });

    // Check if user is authenticated and is a mentee
    if (!req.user || req.user.role !== "mentee") {
      console.log("User not authenticated or not a mentee:", req.user);
      return res.redirect("/login");
    }

    // Get mentee data
    const mentee = await User.findById(req.user.userId);
    console.log(
      "Mentee found:",
      mentee
        ? {
            id: mentee._id,
            email: mentee.email,
            name: mentee.name,
            role: mentee.role,
            phone: mentee.phone,
            address: mentee.address,
          }
        : "No"
    );

    if (!mentee) {
      console.log("Mentee not found in database");
      req.session.errorMessage = "Mentee not found";
      return res.redirect("/login");
    }

    // Ensure all required fields have default values
    const studentData = {
      _id: mentee._id,
      name: mentee.name || "Not provided",
      email: mentee.email || "Not provided",
      phone: mentee.phone || "Not provided",
      address: mentee.address || "Not provided",
      education: mentee.education || "Not provided",
      institution: mentee.institution || "Not provided",
      fieldOfInterest: mentee.fieldOfInterest || "Not provided",
    };

    // Render the mentee profile
    console.log("Rendering mentee profile with data:", {
      student: studentData,
    });

    res.render("mentee_profile", {
      student: studentData,
      errorMessage: req.session.errorMessage,
      successMessage: req.session.successMessage,
    });

    // Clear messages after rendering
    req.session.errorMessage = null;
    req.session.successMessage = null;
  } catch (error) {
    console.error("Error in mentee profile route:", error);
    req.session.errorMessage = "An error occurred while loading the dashboard";
    res.redirect("/login");
  }
});

// Mentor Dashboard Route
app.get("/mentor_dashboard", authenticateToken, async (req, res) => {
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
    }

    // Get processed mentor data from Python service - make it optional
    let processedData = null;
    try {
      const response = await axios.get(
        `http://localhost:5003/get_mentor_dashboard/${req.user.userId}`
      );
      if (!response.data.error) {
        processedData = response.data.dashboard_data;
        console.log("Processed mentor data retrieved successfully");
      }
    } catch (error) {
      console.log("Processed data not available, continuing without it");
    }

    // Prepare user data for template
    const userData = {
      id: mentor._id,
      name: mentor.name,
      email: mentor.email,
      role: mentor.role,
      phone: mentor.phone || "",
      address: mentor.address || "",
    };

    console.log("Rendering mentor dashboard with data:", {
      userData,
      profileCompleted: mentor.profileCompleted,
      hasProcessedData: !!processedData,
    });

    // Render the mentor dashboard with all necessary data
    res.render("mentor_dashboard", {
      user: userData,
      profile: mentor,
      processedData: processedData,
      successMessage: req.session.successMessage,
      errorMessage: req.session.errorMessage,
    });

    // Clear messages after rendering
    req.session.successMessage = null;
    req.session.errorMessage = null;
  } catch (error) {
    console.error("Mentor dashboard error:", error);
    req.session.errorMessage = "An error occurred while loading the dashboard";
    res.redirect("/login");
  }
});

// Logout route
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Failed to log out");
    }
    res.redirect("/");
  });
});

// Get offline mentors
app.get("/api/offline-mentors", authenticateToken, async (req, res) => {
  try {
    const mentors = await Mentor.find(
      {},
      "name expertise experience rating skills fieldOfInterest"
    ).limit(5); // Limit to 5 mentors for now

    res.json(mentors);
  } catch (error) {
    console.error("Error fetching offline mentors:", error);
    res.status(500).json({ error: "Failed to fetch mentors" });
  }
});

// Get Mentor Match Results
app.get("/mentor-match-results", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "mentee") {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    // Find the latest mentee request
    const latestRequest = await MenteeRequest.findOne({
      mentee: req.user.userId,
    }).sort({ createdAt: -1 });

    if (!latestRequest) {
      return res.status(404).json({ error: "No mentor match found" });
    }

    // Get matched mentor details if there is a match
    let matchedMentor = null;
    if (latestRequest.matchedMentorId) {
      matchedMentor = await Mentor.findById(latestRequest.matchedMentorId);
    }

    // Fetch offline mentors
    const offlineMentors = await Mentor.find(
      {},
      "name expertise experience rating skills fieldOfInterest"
    ).limit(5);

    res.render("matching_interface", {
      menteeRequest: latestRequest,
      mentor: matchedMentor,
      compatibilityScore: latestRequest.compatibilityScore || 0,
      status: latestRequest.status,
      title: "Matching Interface",
      offlineMentors: offlineMentors || [],
    });
  } catch (error) {
    console.error("Error fetching mentor match results:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Find Mentee Route
app.post("/find-mentee", async (req, res) => {
  try {
    // Immediately redirect to matching interface
    res.redirect("/matching_interface");

    // Run the matching process in the background
    const mentorId = req.user?.userId || "default"; // Use default if no user
    console.log("Starting background matching process for mentor:", mentorId);

    const pythonCommand = process.platform === "win32" ? "python" : "python3";
    const pythonProcess = spawn(pythonCommand, ["algo.py", mentorId]);
    let output = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error(`Python Error: ${data}`);
    });

    pythonProcess.on("close", async (code) => {
      try {
        if (code !== 0) {
          console.error("Algorithm failed with code:", code);
          return;
        }

        const result = JSON.parse(output);
        if (!result.success) {
          console.error("Algorithm returned error:", result.error);
          return;
        }

        if (!result.matches || result.matches.length === 0) {
          console.log("No matches found");
          return;
        }

        // Process successful matches
        const menteeIds = result.matches.map((m) => m.mentee_id);
        const mentees = await User.find({ _id: { $in: menteeIds } });

        const matchesWithDetails = result.matches.map((match) => ({
          ...match,
          mentee: mentees.find((m) => m._id.toString() === match.mentee_id),
        }));

        // Store the matches in a global variable or cache for later retrieval
        global.latestMatches = matchesWithDetails;
        console.log("Matching process completed successfully");
      } catch (error) {
        console.error("Error in background matching process:", error);
      }
    });
  } catch (error) {
    console.error("Error in find-mentee route:", error);
  }
});

// Submit Mentee Question Route
app.post("/find-mentor", async (req, res) => {
  try {
    console.log("Submit mentee question route accessed");

    const { doubt } = req.body;
    const menteeId = req.user?.userId || "guest_" + Date.now(); // Use guest ID if not authenticated

    if (!doubt) {
      return res.status(400).json({ error: "Question is required" });
    }

    console.log("Processing question for mentee:", menteeId);

    // Create a new mentee request in the database
    const menteeRequest = new MenteeRequest({
      mentee: menteeId,
      doubt: doubt,
      status: "processing",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await menteeRequest.save();
    console.log("Mentee request created:", menteeRequest._id);

    // Run the API and algorithm services in the background
    try {
      console.log("Calling API service to process doubt");

      // First, redirect the user to the matching interface
      // This ensures the user sees the interface immediately
      const redirectResponse = {
        success: true,
        redirectUrl: `/matching_interface?request=${menteeRequest._id}`,
      };

      // Send the response to the client immediately
      res.json(redirectResponse);

      // Then process the doubt in the background
      try {
        // For guest users, we need to handle the API call differently
        // since the API expects a valid MongoDB ObjectId
        const apiResponse = await axios.post(
          "http://localhost:5001/submit_doubt",
          {
            mentee_id: menteeId,
            doubt: doubt,
            request_id: menteeRequest._id.toString(),
            is_guest: !req.user, // Flag to indicate if this is a guest user
          }
        );

        console.log("API service response:", apiResponse.data);

        // Update the mentee request with the subject breakdown
        if (apiResponse.data.subject_breakdown) {
          const subjectBreakdown = {};
          apiResponse.data.subject_breakdown.results.forEach((item) => {
            subjectBreakdown[item.subject] = item.percentage;
          });

          menteeRequest.subjectBreakdown = subjectBreakdown;
          await menteeRequest.save();
        }

        // Update the status to pending after processing
        menteeRequest.status = "pending";
        await menteeRequest.save();
      } catch (error) {
        console.error("Error processing doubt:", error);
        // Update the status to error if processing fails
        menteeRequest.status = "error";
        await menteeRequest.save();
      }
    } catch (error) {
      console.error("Error in background processing:", error);
      // The user has already been redirected, so we don't need to send a response
    }
  } catch (error) {
    console.error("Error in find-mentor route:", error);
    return res.status(500).json({ error: "Failed to process your request" });
  }
});

// Add a route to check matching status
app.get("/check-matching-status", async (req, res) => {
  try {
    if (global.latestMatches) {
      res.json({
        status: "completed",
        matches: global.latestMatches,
      });
    } else {
      res.json({
        status: "processing",
      });
    }
  } catch (error) {
    console.error("Error checking matching status:", error);
    res.json({
      status: "error",
      message: "Error checking matching status",
    });
  }
});

// Background process to fetch matches
async function fetchMatchesInBackground(mentorId) {
  try {
    // Check if ALGO_SERVICE_URL is defined
    if (!process.env.ALGO_SERVICE_URL) {
      console.error("ALGO_SERVICE_URL environment variable is not defined");
      return;
    }

    console.log(
      `Calling matching service at: ${process.env.ALGO_SERVICE_URL}/get_mentor_matching_interface/${mentorId}`
    );

    // Call algo.py service to get matched mentees
    const response = await axios.get(
      `${process.env.ALGO_SERVICE_URL}/get_mentor_matching_interface/${mentorId}`
    );

    if (response.data.error) {
      console.error("Error from matching service:", response.data.error);
      return;
    }

    // Check if matches exist in the response
    if (!response.data.matches || !Array.isArray(response.data.matches)) {
      console.error(
        "Invalid response format from matching service:",
        response.data
      );
      return;
    }

    const matchedMentees = response.data.matches.map((match) => ({
      _id: match.mentee_id,
      name: match.mentee_details.name,
      email: match.mentee_details.email,
      skills: match.mentee_details.skills || [],
      education: match.mentee_details.education || "Not specified",
      compatibility_score: match.compatibility_score || 0.5,
      matching_subject: match.mentee_details.matching_subject || "General",
      matching_percentage: match.mentee_details.matching_percentage || 0.5,
    }));

    // Store matches in session for retrieval
    global.matchesCache = global.matchesCache || {};
    global.matchesCache[mentorId] = {
      matches: matchedMentees,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Error fetching matches in background:", error);
  }
}

// API endpoint to get matches
app.get("/api/matches", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== "mentor") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const mentorId = req.session.user._id;
    const cachedMatches = global.matchesCache?.[mentorId];

    if (cachedMatches && Date.now() - cachedMatches.timestamp < 5 * 60 * 1000) {
      // 5 minutes cache
      return res.json({ matches: cachedMatches.matches });
    }

    // If no cached matches or cache expired, trigger a new fetch
    fetchMatchesInBackground(mentorId);
    res.json({ matches: [], message: "Fetching matches..." });
  } catch (error) {
    console.error("Error in matches API:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Mentee profile view route
app.get("/mentor/mentee/:id", authenticateToken, async (req, res) => {
  try {
    // Check if user is authenticated and is a mentor
    if (!req.user || req.user.role !== "mentor") {
      return res.redirect("/login");
    }

    // Find the mentee
    const mentee = await Mentee.findById(req.params.id);
    if (!mentee) {
      req.session.errorMessage = "Mentee not found";
      return res.redirect("/mentor/matching");
    }

    // Render the mentee profile
    res.render("mentee_profile_view", {
      user: req.user,
      mentee: mentee,
    });
  } catch (error) {
    console.error("Error viewing mentee profile:", error);
    req.session.errorMessage =
      "An error occurred while loading the mentee profile";
    res.redirect("/mentor/matching");
  }
});

// Update mentee profile route
app.post("/update-student-profile", authenticateToken, async (req, res) => {
  try {
    console.log("Update mentee profile route accessed:", {
      user: req.user,
      body: req.body,
    });

    // Check if user is authenticated and is a mentee
    if (!req.user || req.user.role !== "mentee") {
      console.log("User not authenticated or not a mentee:", req.user);
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    // Get mentee data
    const mentee = await User.findById(req.user.userId);
    console.log(
      "Mentee found:",
      mentee
        ? {
            id: mentee._id,
            email: mentee.email,
            name: mentee.name,
          }
        : "No"
    );

    if (!mentee) {
      console.log("Mentee not found in database");
      return res
        .status(404)
        .json({ success: false, error: "Mentee not found" });
    }

    // Update mentee data
    const { name, phone, address } = req.body;

    // Only update fields that are provided
    if (name && name.trim() !== "") mentee.name = name;
    if (phone && phone.trim() !== "") mentee.phone = phone;
    if (address && address.trim() !== "") mentee.address = address;

    // Save changes
    await mentee.save();

    console.log("Mentee profile updated successfully:", {
      id: mentee._id,
      name: mentee.name,
      phone: mentee.phone,
      address: mentee.address,
    });

    return res.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating mentee profile:", error);
    return res.status(500).json({
      success: false,
      error: "An error occurred while updating the profile",
    });
  }
});

// Redirect /mentor/matching to /matching_interface
app.get("/mentor/matching", (req, res) => {
  console.log("Accessing /mentor/matching route");

  // Check if user is authenticated
  if (!req.cookies.token) {
    console.log("No token found, redirecting to login");
    return res.redirect("/login?error=Please log in to continue");
  }

  // Redirect to matching interface
  console.log("Redirecting to /matching_interface");
  res.redirect("/matching_interface");
});

// Matching Interface Route
app.get("/matching_interface", async (req, res) => {
  try {
    console.log("Accessing /matching_interface route");

    // Get request ID from query params
    const requestId = req.query.request;
    const userId = req.user?.userId || "guest";

    // If we have a request ID, find the mentee request
    let menteeRequest = null;
    if (requestId) {
      menteeRequest = await MenteeRequest.findById(requestId);
    } else {
      // If no request ID, find the latest request for this user
      menteeRequest = await MenteeRequest.findOne({ mentee: userId })
        .sort({ createdAt: -1 });
    }

    // Get offline mentors if no match found
    let offlineMentors = [];
    if (menteeRequest && !menteeRequest.matchedMentorId && menteeRequest.status === "pending") {
      offlineMentors = await Mentor.find({ isOnline: false })
        .limit(5)
        .select("name expertise experience rating");
    }

    // Get matched mentor details if available
    let matchedMentor = null;
    if (menteeRequest?.matchedMentorId) {
      matchedMentor = await Mentor.findById(menteeRequest.matchedMentorId)
        .select("name expertise experience rating briefBio");
    }

    // Handle different status cases
    let errorMessage = null;
    let statusMessage = null;

    if (menteeRequest) {
      if (menteeRequest.status === "error") {
        errorMessage = "There was an error processing your request. Please try again.";
      } else if (menteeRequest.status === "processing") {
        statusMessage = "Your question is being analyzed. This may take a few moments...";
      } else if (menteeRequest.status === "pending" && !menteeRequest.matchedMentorId) {
        statusMessage = "Searching for the best mentor match. This may take a few moments...";
      }
    }

    return res.render("matching_interface", {
      isMentor: false,
      userRole: "mentee",
      menteeRequest: menteeRequest,
      matchedMentor: matchedMentor,
      offlineMentors: offlineMentors,
      errorMessage: errorMessage,
      statusMessage: statusMessage,
      user: req.user || {
        _id: "guest",
        userId: "guest",
        role: "guest",
        email: "guest@example.com",
      },
      isProcessing: menteeRequest ? ["processing", "pending"].includes(menteeRequest.status) : false,
    });
  } catch (error) {
    console.error("Error in matching interface route:", error);
    res.render("matching_interface", {
      isMentor: false,
      userRole: "mentee",
      errorMessage: "An error occurred. Please try again.",
      user: req.user || {
        _id: "guest",
        userId: "guest",
        role: "guest",
        email: "guest@example.com",
      },
      isProcessing: false,
    });
  }
});

// Mentee Request Page Route
app.get("/mentee_request", async (req, res) => {
  try {
    console.log("Mentee request page accessed");

    // Render the mentee request page for all users
    res.render("mentee_request", {
      user: req.user || {
        _id: "guest",
        userId: "guest",
        role: "guest",
        email: "guest@example.com",
      },
      title: "Ask a Question | Father's Advice",
      errorMessage: req.session.errorMessage || null,
    });

    // Clear any error message after rendering
    if (req.session.errorMessage) {
      req.session.errorMessage = null;
    }
  } catch (error) {
    console.error("Error rendering mentee request page:", error);
    res.status(500).render("error", {
      error: "Failed to load the request page",
      user: req.user || {
        _id: "guest",
        userId: "guest",
        role: "guest",
        email: "guest@example.com",
      },
    });
  }
});

// Check request status route
app.get("/api/request-status/:requestId", async (req, res) => {
  try {
    const request = await MenteeRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }
    return res.json({ status: request.status });
  } catch (error) {
    console.error("Error checking request status:", error);
    return res.status(500).json({ error: "Failed to check request status" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500);
  res.render("error", {
    message: err.message || "An error occurred while processing your request.",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404);
  res.render("error", {
    message: "The page you are looking for could not be found.",
  });
});

// Start the application
initializeApp().catch(error => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
