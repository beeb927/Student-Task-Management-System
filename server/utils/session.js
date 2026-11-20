const jwt = require("jsonwebtoken");

// Same cookie settings as authController, so a Google sign-in produces exactly the
// same session as an email/password login.
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
};

function startSession(res, userId) {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "1d" });
  res.cookie("token", token, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 });
}

module.exports = { cookieOptions, startSession };
