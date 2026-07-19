// backend/src/middleware/wsAuth.js
// WebSocket authentication middleware for Socket.io

const API_KEY = process.env.ALTHR_API_KEY;

function wsAuthMiddleware(socket, next) {
  // If no API key configured, allow all (dev mode)
  if (!API_KEY) {
    socket.user = { username: "ws-client", role: "admin" };
    return next();
  }

  // Check auth from handshake query or headers
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.query?.token ||
    socket.handshake.headers?.["x-api-key"];

  if (token === API_KEY) {
    socket.user = { username: "ws-client", role: "admin" };
    return next();
  }

  // Check Bearer token
  const authHeader = socket.handshake.headers?.authorization;
  if (authHeader) {
    const bearerToken = authHeader.replace("Bearer ", "");
    if (bearerToken === API_KEY) {
      socket.user = { username: "ws-client", role: "admin" };
      return next();
    }
  }

  console.warn("[ws-auth] Connection rejected: invalid or missing token");
  return next(new Error("Unauthorized: invalid or missing token"));
}

module.exports = { wsAuthMiddleware };
