import jwt from "jsonwebtoken";

function auth(req, res, next) {
  const token = req.header("x-auth-token");

  if (!token) {
    res.status(401).send("unautharized");
  } else {
    try {
      const decoded = jwt.verify(token, "JWTSecret");
      req.user = decoded;
      next();
    } catch (e) {
      res.status(400).send("token is not valid");
    }
  }
}

module.exports = auth;
