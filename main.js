// MQTT Configuration
const MQTT_BROKER = "wss://broker.emqx.io:8084/mqtt";
const MQTT_TOPIC = "role/led";
let client = null;
let messageCount = 0;

// DOM Elements
const statusElement = document.getElementById("statusText");
const connectionStatus = document.getElementById("connectionStatus");
const ledStatus = document.getElementById("ledStatus");
const messageLog = document.getElementById("messageLog");
const btnOn = document.getElementById("btnOn");
const btnOff = document.getElementById("btnOff");

// Check if DOM elements exist
if (!statusElement || !connectionStatus) {
  console.error("DOM elements not found: statusElement =", statusElement, "connectionStatus =", connectionStatus);
}

// Initialize connection when page loads
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing MQTT...");
  connectToMQTT();
  addLogMessage("System", "Initializing MQTT connection...");
});

// Connect to MQTT Broker
function connectToMQTT() {
  try {
    updateConnectionStatus("connecting");
    addLogMessage("System", "Connecting to broker.emqx.io...");

    const clientId = `web-client-${Math.random().toString(16).substr(2, 8)}`;

    client = mqtt.connect(MQTT_BROKER, {
      clientId: clientId,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 1000,
      keepalive: 60,
    });

    client.on("connect", () => {
      console.log("Connected to MQTT broker at:", new Date().toLocaleTimeString());
      updateConnectionStatus("connected");
      addLogMessage("MQTT", "Connected successfully!");

      client.subscribe(MQTT_TOPIC, { qos: 1 }, (err) => {
        if (!err) {
          console.log(`Subscribed to ${MQTT_TOPIC}`);
          addLogMessage("MQTT", `Subscribed to topic: ${MQTT_TOPIC}`);
        } else {
          console.error("Subscription error:", err);
          addLogMessage("Error", `Subscription failed: ${err.message}`);
        }
      });
    });

    client.on("error", (err) => {
      console.error("Connection error details:", err);
      updateConnectionStatus("error");
      addLogMessage("Error", `Connection failed: ${err.message}`);
    });

    client.on("reconnect", () => {
      console.log("Reconnecting...");
      updateConnectionStatus("connecting");
      addLogMessage("MQTT", "Attempting to reconnect...");
    });

    client.on("offline", () => {
      console.log("Client offline");
      updateConnectionStatus("error");
      addLogMessage("MQTT", "Connection lost - client offline");
    });

    client.on("message", (topic, message) => {
      const payload = message.toString();
      console.log("Received message:", payload, "on topic:", topic);
      messageCount++;
      addLogMessage("Received", `${payload} (from ESP32)`);
      updateLedStatus(payload);
    });
  } catch (error) {
    console.error("Failed to connect:", error);
    updateConnectionStatus("error");
    addLogMessage("Error", `Failed to initialize: ${error.message}`);
  }
}

// Send command to ESP32
function sendCommand(command) {
  if (client && client.connected) {
    try {
      client.publish(MQTT_TOPIC, command, { qos: 1 }, (err) => {
        if (err) {
          console.error("Publish error:", err);
          addLogMessage("Error", `Failed to publish ${command}: ${err.message}`);
        } else {
          console.log("Published:", command);
          addLogMessage("Sent", `${command} command to ESP32`);
        }
      });
      updateLedStatus(command);

      const button = command === "ON" ? btnOn : btnOff;
      button.style.transform = "scale(0.95)";
      setTimeout(() => {
        button.style.transform = "";
      }, 150);
    } catch (error) {
      console.error("Failed to send command:", error);
      addLogMessage("Error", `Failed to send ${command}: ${error.message}`);
    }
  } else {
    addLogMessage("Error", "Not connected to MQTT broker");
    alert("Please wait for connection to be established before sending commands.");
  }
}

// Update connection status display
function updateConnectionStatus(status) {
  if (!connectionStatus || !statusElement) {
    console.error("Cannot update connection status: elements missing");
    return;
  }
  connectionStatus.className = `connection-status ${status}`;
  switch (status) {
    case "connected":
      statusElement.textContent = "Connected";
      connectionStatus.innerHTML = '<i class="fas fa-wifi"></i><span>Connected</span>';
      btnOn.disabled = false;
      btnOff.disabled = false;
      break;
    case "connecting":
      statusElement.textContent = "Connecting...";
      connectionStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Connecting...</span>';
      btnOn.disabled = true;
      btnOff.disabled = true;
      break;
    case "error":
      statusElement.textContent = "Connection Error";
      connectionStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Error</span>';
      btnOn.disabled = true;
      btnOff.disabled = true;
      break;
    default:
      statusElement.textContent = "Disconnected";
      connectionStatus.innerHTML = '<i class="fas fa-wifi-slash"></i><span>Disconnected</span>';
      btnOn.disabled = true;
      btnOff.disabled = true;
  }
}

// Update LED status display
function updateLedStatus(command) {
  if (!ledStatus) {
    console.error("ledStatus element not found");
    return;
  }
  const indicator = ledStatus.querySelector(".status-indicator");
  const statusText = ledStatus.querySelector("span");
  if (command === "ON") {
    indicator.className = "status-indicator on";
    statusText.textContent = "Status: LED ON";
    ledStatus.style.background = "rgba(74, 222, 128, 0.1)";
    ledStatus.style.border = "1px solid #4ade80";
  } else if (command === "OFF") {
    indicator.className = "status-indicator off";
    statusText.textContent = "Status: LED OFF";
    ledStatus.style.background = "rgba(107, 114, 128, 0.1)";
    ledStatus.style.border = "1px solid #6b7280";
  }
}

// Add message to log
function addLogMessage(type, message) {
  if (!messageLog) {
    console.error("messageLog element not found");
    return;
  }
  const timestamp = new Date().toLocaleTimeString();
  const logItem = document.createElement("div");
  logItem.className = "log-item";
  logItem.innerHTML = `
    <span class="timestamp">${timestamp}</span>
    <span class="message">[${type}] ${message}</span>
  `;
  messageLog.appendChild(logItem);
  while (messageLog.children.length > 50) {
    messageLog.removeChild(messageLog.firstChild);
  }
  messageLog.scrollTop = messageLog.scrollHeight;
}

// Retry connection function
function retryConnection() {
  if (client) {
    client.end();
  }
  setTimeout(() => {
    connectToMQTT();
  }, 1000);
}

// Auto-retry on connection failure
setInterval(() => {
  if (!client || !client.connected) {
    console.log("Auto-retry connection...");
    retryConnection();
  }
}, 10000);

// Add visual effects and other event listeners
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.style.scrollBehavior = "smooth";
  const cards = document.querySelectorAll(".manual-card");
  cards.forEach((card, index) => {
    card.style.animationDelay = `${index * 0.1}s`;
  });
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    console.log("Page hidden - maintaining connection");
  } else {
    console.log("Page visible - checking connection");
    if (!client || !client.connected) {
      addLogMessage("System", "Page resumed - reconnecting...");
      retryConnection();
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case "1":
        event.preventDefault();
        sendCommand("ON");
        break;
      case "2":
        event.preventDefault();
        sendCommand("OFF");
        break;
    }
  }
});

btnOn.title = "Click to turn LED ON (Ctrl+1)";
btnOff.title = "Click to turn LED OFF (Ctrl+2)";
