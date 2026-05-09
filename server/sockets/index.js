// Socket.IO handlers — admin dashboard joins "ops" room for live updates.
module.exports = function registerSockets(io) {
  io.on("connection", (socket) => {
    socket.on("ops:join", () => socket.join("ops"));
    socket.on("disconnect", () => {});
  });

  // Helper: emit to ops room from anywhere via app.get("io").to("ops").emit(...)
};
