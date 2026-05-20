const { io } = require("socket.io-client");

const token =
  "PEGA_AQUI_EL_JWT_COMPLETO";

const socket = io("http://localhost:8080/notifications", {
  path: "/socket.io",
  transports: ["websocket"],
  auth: {
    token: token,
  },
});

socket.on("connect", () => {
  console.log("✅ Conectado:", socket.id);
});

socket.on("transfer_sent", (data) => {
  console.log("📤 transfer_sent");
  console.log(data);
});

socket.on("transfer_received", (data) => {
  console.log("📥 transfer_received");
  console.log(data);
});

socket.on("balance.updated", (data) => {
  console.log("💰 balance.updated");
  console.log(data);
});

socket.on("disconnect", () => {
  console.log("❌ Desconectado");
});

socket.on("connect_error", (err) => {
  console.log("❌ ERROR");
  console.log(err.message);
});