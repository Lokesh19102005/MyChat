import jwt from 'jsonwebtoken';

export const authenticateMiddleware = (req, res, next) => {
  console.log("🔥 RAW Cookie header:", req.headers.cookie);
  console.log("🔥 Parsed cookies:", req.cookies);

  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  console.log("VERIFY secret:", process.env.JWT_SECRET);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
