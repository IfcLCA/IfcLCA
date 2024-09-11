// Load environment variables
require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const rateLimit = require("express-rate-limit");

if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) {
  console.error(
    "Error: config environment variables not set. Please create/edit .env configuration file."
  );
  process.exit(-1);
}

const app = express();
const port = process.env.PORT || 3000;

// Define global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  headers: true, // Send rate limit info in headers
});

// Apply the global rate limiter
app.use(globalLimiter);

// Middleware to parse request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set base URL based on the environment (production or preview)
const baseUrl = process.env.NODE_ENV === "preview" ? "/preview" : "/";

// Setting the templating engine to EJS
app.set("view engine", "ejs");

// Serve static files
app.use(express.static("public"));

// Database connection
mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {})
  .catch((err) => {
    console.error(`Database connection error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });

// Session configuration with connect-mongo
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.DATABASE_URL }),
  })
);

app.on("error", (error) => {
  console.error(`Server error: ${error.message}`);
  console.error(error.stack);
});

// Middleware to inject success message into response locals based on URL query
app.use((req, res, next) => {
  if (req.query.uploadSuccess) {
    res.locals.uploadSuccess = true;
  }
  next();
});

// Logging session creation and destruction
app.use((req, res, next) => {
  const sess = req.session;
  // Make session available to all views
  res.locals.session = sess;
  if (!sess.views) {
    sess.views = 1;
  } else {
    sess.views++;
  }
  next();
});

// Dynamic route prefix middleware for preview environment
if (process.env.NODE_ENV === "preview") {
  app.use((req, res, next) => {
    if (req.originalUrl.startsWith("/preview")) {
      req.url = req.originalUrl.replace("/preview", ""); // Remove '/preview' prefix for internal routing
    }
    next();
  });
}

// Authentication Routes
app.use(baseUrl, authRoutes);

// Project Routes
app.use(baseUrl, projectRoutes);

// Preview route (index page)
app.get(`${baseUrl}`, (req, res) => {
  res.render("index");
});

// Dashboard route
app.get(`${baseUrl}dashboard`, (req, res) => {
  res.render("dashboard", { page: "dashboard" });
});

// 404 route handling
app.use((req, res, next) => {
  res.status(404).send("Page not found.");
});

// Error handling
app.use((err, req, res, next) => {
  console.error(`Unhandled application error: ${err.message}`);
  console.error(err.stack);
  res.status(500).send("There was an error serving your request.");
});

// Start the server
app.listen(port, () => {
  console.log(`App running on port ${port} in ${process.env.NODE_ENV} mode`);
});
