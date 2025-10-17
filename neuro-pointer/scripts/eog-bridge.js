#!/usr/bin/env node
const { SerialPort } = require("serialport");
const { WebSocketServer } = require("ws");

const SERIAL_PATH = process.env.SERIAL_PATH ?? "/dev/ttyUSB0";
const BAUD_RATE = Number(process.env.BAUD_RATE ?? 115200);
const WS_PORT = Number(process.env.WS_PORT ?? 8080);
const WS_PATH = process.env.WS_PATH ?? "/eog";

const wss = new WebSocketServer({ port: WS_PORT, path: WS_PATH });

function broadcast(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

const port = new SerialPort({ path: SERIAL_PATH, baudRate: BAUD_RATE });

port.on("open", () => {
  console.log(`Serial connected → ${SERIAL_PATH} @ ${BAUD_RATE} baud`);
  console.log(`WebSocket ready → ws://localhost:${WS_PORT}${WS_PATH}`);
});

const decoder = new TextDecoder();
let buffer = "";

port.on("data", (chunk) => {
  buffer += decoder.decode(chunk, { stream: true });
  let newlineIndex = buffer.indexOf("\n");

  while (newlineIndex >= 0) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    newlineIndex = buffer.indexOf("\n");

    if (!line) continue;

    try {
      const payload = JSON.parse(line);
      const messages = Array.isArray(payload) ? payload : [payload];
      messages.forEach((message) => {
        if (!message || !Array.isArray(message.channels)) return;
        const normalized = {
          timestamp: message.timestamp ?? Date.now(),
          channels: message.channels,
        };
        broadcast(JSON.stringify(normalized));
      });
    } catch (error) {
      console.warn("Skipping unparsable line", line);
    }
  }
});

port.on("error", (error) => {
  console.error("Serial error", error);
});

wss.on("connection", () => {
  console.log("Client connected to EOG stream");
});

wss.on("error", (error) => {
  console.error("WebSocket error", error);
});
