const jwt = require("jsonwebtoken");

// Runs BEFORE protected routes. Lets the request through only if the cookie has a valid JWT.
function protect(req, res, next) {
  const token = req.cookies.token; // cookie-parser makes this available

  if (!token) {
    return res.status(401).json({ message: "Not logged in." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id }; // make the user id available to later code
    next(); // continue to the controller
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Session expired or invalid. Please log in again." });
  }
}

module.exports = protect;