require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
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

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Too many requests from this IP, please try again later.",
  headers: true,
});

app.use(globalLimiter);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {})
  .catch((err) => {
    console.error(`Database connection error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });

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

app.use((req, res, next) => {
  if (req.query.uploadSuccess) {
    res.locals.uploadSuccess = true;
  }
  next();
});

app.use((req, res, next) => {
  const sess = req.session;
  res.locals.session = sess;
  if (!sess.views) {
    sess.views = 1;
  } else {
    sess.views++;
  }
  next();
});

app.use(authRoutes);
app.use(projectRoutes);

app.use(express.static(path.join(__dirname, "build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.use((req, res, next) => {
  res.status(404).send("Page not found.");
});

app.use((err, req, res, next) => {
  console.error(`Unhandled application error: ${err.message}`);
  console.error(err.stack);
  res.status(500).send("There was an error serving your request.");
});

app.listen(port, () => {});
