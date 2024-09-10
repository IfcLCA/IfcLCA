const express = require("express");
const path = require("path");
const fs = require("fs");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");
const router = express.Router();

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Extract first name from email
function extractFirstName(email) {
  const parts = email.split("@")[0].split(".");
  const firstName = parts[0];
  return firstName.charAt(0).toUpperCase() + firstName.slice(1);
}

// Rate limiter middleware for registration and login
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes.",
});

// Register Route
router.get("/auth/register", (req, res) => {
  res.render("register", { query: req.query });
});

router.post("/auth/register", authRateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const token = crypto.randomBytes(32).toString("hex");
    const firstName = extractFirstName(username);

    // Check if the user already exists
    let user = await User.findOne({ username });

    if (user && !user.isActive) {
      // If user exists and is not active, update token and password
      user.password = password; // Will be hashed in the pre-save hook
      user.confirmationToken = token;
      await user.save();
    } else if (!user) {
      // Create a new user
      user = new User({
        username,
        password, // Will be hashed in the pre-save hook
        confirmationToken: token,
        isActive: false,
      });
      await user.save();
    } else {
      // If user is active, prevent registration
      return res.status(400).send("User already exists and is active.");
    }

    // Read the email template
    const emailTemplatePath = path.join(
      __dirname,
      "../views/emailTemplates/emailTemplate.html"
    );
    const emailTemplate = await fs.promises.readFile(
      emailTemplatePath,
      "utf-8"
    );

    const baseUrl = process.env.BASE_URL || "http://localhost:3000";

    const emailContent = emailTemplate
      .replace(/<%= firstName %>/g, firstName)
      .replace(
        /<%= confirmUrl %>/g,
        `${baseUrl}/auth/confirm/${token}` // Use the trusted base URL
      );

    // Send the confirmation email
    await transporter.sendMail({
      to: username,
      subject: "Email Confirmation - IfcLCA",
      html: emailContent,
    });

    res.redirect(
      "/auth/login?message=Confirmation email sent. Please check your inbox❗and possibly your spam folder ❗"
    );
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).send("Error during registration. Please try again.");
  }
});

// Email Confirmation Route
router.get("/auth/confirm/:token", async (req, res) => {
  try {
    const user = await User.findOne({ confirmationToken: req.params.token });
    if (!user) {
      return res.status(400).send("Invalid or expired token");
    }

    user.confirmationToken = null;
    user.isActive = true;
    await user.save();

    res.redirect(
      "/auth/login?message=Email confirmed successfully. You can now log in."
    );
  } catch (error) {
    console.error("Confirmation error:", error);
    res.status(500).send("Error during email confirmation. Please try again.");
  }
});

// Login Route
router.get("/auth/login", (req, res) => {
  res.render("login", { query: req.query });
});

router.post("/auth/login", authRateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).send("User not found");
    }
    if (!user.isActive) {
      return res
        .status(400)
        .send("Email not confirmed. Please check your email.");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      req.session.userId = user._id; // Store user ID in session
      req.session.username = user.username; // Optionally store username
      return res.redirect("/");
    } else {
      return res.status(400).send("Password is incorrect");
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).send("An error occurred during login.");
  }
});

router.get("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error during session destruction:", err);
      return res.status(500).send("Error logging out");
    }
    res.redirect("/auth/login");
  });
});

module.exports = router;
