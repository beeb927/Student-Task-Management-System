const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  findUserByEmail,
  findUserById,
  createUser,
} = require("../models/userModel");

// Settings for the cookie that stores the JWT
const cookieOptions = {
  httpOnly: true, // JavaScript in the browser cannot read this cookie (protects against XSS)
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  sameSite: "lax",
};

// POST /api/auth/register
async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    // 1. Validate input
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required." });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      return res.status(400).json({ message: "Name cannot be empty." });
    }

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return res.status(400).json({ message: "Please enter a valid email." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters." });
    }

    // 2. Prevent duplicate emails
    const existingUser = await findUserByEmail(cleanEmail);
    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    // 3. Hash the password (10 = salt rounds) and save the user
    const hashedPassword = await bcrypt.hash(password, 10);
    await createUser(cleanName, cleanEmail, hashedPassword);

    res.status(201).json({ message: "Registration successful. Please log in." });
  } catch (error) {
    // Safety net: MySQL's UNIQUE rule caught a duplicate email
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email is already registered." });
    }
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error during registration." });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Find the user
    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Accounts created through Google sign-in have no password
    if (!user.password) {
      return res.status(401).json({
        message: "This account uses Google sign-in. Please use the \"Continue with Google\" button.",
      });
    }

    // 2. Compare the typed password with the stored hash
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // 3. Create the JWT (valid for 1 day)
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // 4. Store the JWT in an HTTP-only cookie
    res.cookie("token", token, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000, // 1 day in milliseconds
    });

    res.json({
      message: "Login successful.",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login." });
  }
}

// POST /api/auth/logout
function logout(req, res) {
  res.clearCookie("token", cookieOptions);
  res.json({ message: "Logged out successfully." });
}

// GET /api/auth/me  (protected: returns the logged-in user)
async function getMe(req, res) {
  try {
    const user = await findUserById(req.user.id); // req.user is set by authMiddleware
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json({ user });
  } catch (error) {
    console.error("GetMe error:", error);
    res.status(500).json({ message: "Server error." });
  }
}

module.exports = { register, login, logout, getMe };