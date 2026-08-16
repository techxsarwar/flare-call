# 🔥 FlareCall — Real-Time WebRTC Calling on Cloudflare

[![Live App](https://img.shields.io/badge/Live%20Demo-flare--call.pages.dev-brightgreen.svg?style=for-the-badge&logo=cloudflare)](https://flare-call.pages.dev)
[![Signaling Server](https://img.shields.io/badge/Signaling%20Edge-aarifgmr.workers.dev-orange.svg?style=for-the-badge&logo=cloudflareworkers)](https://flare-call-signaling.aarifgmr.workers.dev)
[![Author](https://img.shields.io/badge/Author-Sarwar%20Altaf%20Dar-6366f1.svg?style=for-the-badge&logo=github)](https://github.com/techxsarwar)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge)](https://www.gnu.org/licenses/gpl-3.0)

[![WebRTC P2P](https://img.shields.io/badge/Media-Encrypted%20WebRTC%20P2P-success.svg)](https://webrtc.org)
[![React 19](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61dafb.svg)](https://react.dev)
[![Java 21](https://img.shields.io/badge/Native%20Client-Java%2021%20%2F%20Android-red.svg)](https://www.oracle.com/java/)

**FlareCall** is a modern, production-grade, 100% free real-time audio & video calling system powered by:
- ⚡ **Cloudflare Workers**: Ultra-low latency edge WebSocket signaling & room coordinator running across 300+ global data centers.
- 🔒 **Direct P2P WebRTC**: End-to-end encrypted HD Audio (Opus 48kHz) and Video (VP8/VP9/H.264) with **$0 bandwidth costs**.
- 🎨 **Modern React Web App**: Dark glassmorphic interface, dynamic glowing audio waveform visualizer, screen sharing, device selection, in-call chat, and synthesized sound effects.
- ☕ **Native Java Client & Android SDK**: Standalone Java 21 client (`com.flarecall.FlareCallApp`) with zero external JAR dependencies, modern Swing GUI & CLI mode, and Android WebRTC adapter architecture.

---

## 🌐 Live Production Endpoints

| Resource | URL |
| :--- | :--- |
| 📱 **Web Application (Cloudflare Pages)** | **[https://flare-call.pages.dev](https://flare-call.pages.dev)** |
| ⚡ **Signaling Server (Cloudflare Workers)** | **[`https://flare-call-signaling.aarifgmr.workers.dev`](https://flare-call-signaling.aarifgmr.workers.dev)** |
| 🔒 **WebSocket Signaling Endpoint** | **`wss://flare-call-signaling.aarifgmr.workers.dev/ws`** |

---

## 👨‍💻 Author & Credits

**Developed and Maintained by:**
- **Sarwar Altaf Dar**
- **GitHub**: [@techxsarwar](https://github.com/techxsarwar)
- **Repository**: [techxsarwar/flare-call](https://github.com/techxsarwar/flare-call)

---

## 📜 License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**. See the [LICENSE](./LICENSE) file for complete details.

```text
Copyright (C) 2026 Sarwar Altaf Dar <https://github.com/techxsarwar>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
```

---

## 🏛️ System Architecture

```
                      ┌───────────────────────────────────────────┐
                      │      Cloudflare Worker (Signaling)        │
                      │     - Edge WebSockets Hub & Rooms         │
                      │     - SDP Offer / Answer Exchange         │
                      │     - ICE Candidate Relay                 │
                      └───────────────────────────────────────────┘
                                           ▲
                ┌──────────────────────────┼──────────────────────────┐
                │ WebSocket                │ WebSocket                │ WebSocket
                │                          │                          │
      ┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
      │   React Web App    │     │  Native Java App   │     │  Android / Mobile  │
      │   (Vite + React)   │     │  (Java 21 Client)  │     │   (Java Adapter)   │
      └────────────────────┘     └────────────────────┘     └────────────────────┘
                ▲                          ▲                          ▲
                └──────────────────────────┼──────────────────────────┘
                      Direct P2P Encrypted Audio / Video (WebRTC)
                             ($0 Bandwidth Forever!)
```

---

## 🚀 Quick Start Guide

### 1. Test Instantly on Mobile / Web
No setup needed! Open **[https://flare-call.pages.dev](https://flare-call.pages.dev)** on your phone (Safari/Chrome) or laptop, tap **"Start Call"**, and share the invite link.

---

### 2. Run the Web App Locally (Port 5173)
```bash
cd client-web
npm install
npm run dev
```
*Open `http://localhost:5173` in your browser.*

---

### 3. Start Local Cloudflare Signaling Server (Port 8787)
```bash
cd server
npm install
npx wrangler dev
```
*Local WebSocket signaling runs at `ws://localhost:8787/ws`.*

---

### 4. Run the Native Java Client (Swing GUI or CLI)

#### GUI Mode (Desktop Window):
```bash
cd client-java
run.bat
```
*(Or manually: `javac -d bin src/com/flarecall/*.java && java -cp bin com.flarecall.FlareCallApp`)*

#### CLI Mode (Command-Line Terminal):
```bash
cd client-java
run-cli.bat
```

---

## 📖 Complete Integration Guide: Embed FlareCall in Your App

You can integrate FlareCall calling into any existing React, Next.js, Vue, Android, or Java application.

### 🅰️ Integrating into a React / Next.js / Vue / Web App

#### Step 1: Copy the WebRTC Service
Copy [`client-web/src/services/webrtc.js`](./client-web/src/services/webrtc.js) into your application.

#### Step 2: Establish the Call Session
```javascript
import { WebRTCService } from "./services/webrtc";

// 1. Initialize WebRTC Service
const rtc = new WebRTCService({
  onRemoteStream: (peerId, stream) => {
    // Attach remote stream to <video> tag
    document.getElementById("remoteVideo").srcObject = stream;
  },
  onIceCandidate: (peerId, candidate) => {
    // Relay candidate to signaling worker
    ws.send(JSON.stringify({
      type: "ice-candidate",
      roomId: "my-room-101",
      targetPeerId: peerId,
      candidate
    }));
  }
});

// 2. Acquire local camera & microphone
const localStream = await rtc.getLocalMedia({ audio: true, video: true });
document.getElementById("localVideo").srcObject = localStream;

// 3. Connect to live Cloudflare Signaling Worker
const ws = new WebSocket("wss://flare-call-signaling.aarifgmr.workers.dev/ws");

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "join",
    roomId: "my-room-101",
    peerId: "user_" + Math.random().toString(36).substring(2, 8),
    name: "Sarwar"
  }));
};

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);
  
  if (msg.type === "joined" && msg.peers?.length > 0) {
    // We joined an existing room -> send SDP offer to peers
    for (const peer of msg.peers) {
      const offer = await rtc.createOffer(peer.peerId);
      ws.send(JSON.stringify({
        type: "offer",
        roomId: "my-room-101",
        targetPeerId: peer.peerId,
        sdp: offer.sdp
      }));
    }
  }

  if (msg.type === "offer") {
    // Handle incoming offer and reply with SDP answer
    const answer = await rtc.handleOfferAndCreateAnswer(msg.fromPeerId, msg.sdp);
    ws.send(JSON.stringify({
      type: "answer",
      roomId: "my-room-101",
      targetPeerId: msg.fromPeerId,
      sdp: answer.sdp
    }));
  }

  if (msg.type === "answer") {
    await rtc.handleAnswer(msg.fromPeerId, msg.sdp);
  }

  if (msg.type === "ice-candidate") {
    await rtc.addIceCandidate(msg.fromPeerId, msg.candidate);
  }
};
```

---

### 🅱️ Integrating into Android Applications (Kotlin / Java)

#### Step 1: Add Google WebRTC to your Android `build.gradle`:
```groovy
dependencies {
    implementation "org.webrtc:google-webrtc:1.0.32007"
}
```

#### Step 2: Use the FlareCall Client
Copy the Java client source files from [`client-java/src/com/flarecall/`](./client-java/src/com/flarecall/) into your Android project.

```java
import com.flarecall.FlareCallClient;
import com.flarecall.CallEventListener;

FlareCallClient client = new FlareCallClient("AndroidUser");

client.setListener(new CallEventListener() {
    @Override
    public void onSignalingConnected() {
        client.joinRoom("support-room");
    }

    @Override
    public void onIncomingCall(String fromPeerId, String fromName) {
        // Trigger Android Fullscreen Notification / Ringtone
        // When user taps Accept:
        client.acceptCall(fromPeerId);
    }

    @Override
    public void onRemoteSdpOffer(String fromPeerId, String sdp) {
        // Set remote description on Android PeerConnection:
        // peerConnection.setRemoteDescription(new SessionDescription(Type.OFFER, sdp));
    }

    @Override
    public void onRemoteIceCandidate(String fromPeerId, String candidateJson) {
        // Add candidate to Android PeerConnection:
        // peerConnection.addIceCandidate(new IceCandidate(...));
    }

    @Override
    public void onChatMessage(String fromPeerId, String fromName, String text, long timestamp) {
        // Update in-call chat view
    }
});

// Connect to Cloudflare signaling
client.connect("wss://flare-call-signaling.aarifgmr.workers.dev/ws");
```

---

### 🅲️ Integrating into Java Desktop / Spring Boot Services

The Java client requires **zero external JARs** and runs on any standard Java 11+ / 21 JVM.

```java
import com.flarecall.FlareCallClient;

FlareCallClient client = new FlareCallClient("BackendBot");
client.connect("wss://flare-call-signaling.aarifgmr.workers.dev/ws").thenRun(() -> {
    client.joinRoom("operations-room");
    client.sendChatMessage("Server cluster deployment complete!");
});
```

---

## 🌐 Deploying to Cloudflare ($0 / Free Tier)

Deploying both the signaling worker and the React web app to Cloudflare takes two commands:

### 1. Deploy Signaling Worker (Cloudflare Workers)
```bash
cd server
npx wrangler deploy
```

### 2. Deploy Web App (Cloudflare Pages)
```bash
cd client-web
npm run build
npx wrangler pages deploy dist --project-name flare-call
```

### Why is FlareCall 100% Free?
- **Cloudflare Workers Free Tier**: Gives you **100,000 free requests per day**. WebSockets signaling uses tiny text messages (<1KB) during call setup.
- **P2P WebRTC Media**: Audio & Video stream directly device-to-device with Google/Cloudflare STUN. Cloudflare server bandwidth = **0 KB**.

---

## 📂 Repository Structure

```
flare-call/
├── LICENSE                    # GNU General Public License v3.0 (GPLv3)
├── README.md                  # Master documentation & integration guide
├── package.json               # Monorepo scripts
│
├── server/                    # Cloudflare Worker Signaling Server
│   ├── worker.js              # WebSocket room hub & WebRTC signal router
│   ├── wrangler.jsonc         # Cloudflare Worker configuration
│   └── package.json
│
├── client-web/                # Modern React 19 + Vite Web Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Lobby.jsx      # Pre-call preview & invite room handler
│   │   │   ├── CallView.jsx   # In-call video grid, PiP, diagnostics
│   │   │   ├── ChatDrawer.jsx # Synchronized live chat drawer
│   │   │   ├── SettingsModal.jsx # Device & resolution switcher
│   │   │   └── AudioVisualizer.jsx # 30 FPS glowing canvas waveform analyzer
│   │   ├── services/
│   │   │   ├── webrtc.js      # RTCPeerConnection lifecycle & stats collector
│   │   │   └── sounds.js      # Web Audio synthesized ringtones & chimes
│   │   ├── App.jsx            # Main application controller
│   │   └── index.css          # Design system & dark glassmorphism styling
│   └── package.json
│
└── client-java/               # Native Java 21 Calling Client & Android Bridge
    ├── src/com/flarecall/
    │   ├── FlareCallApp.java  # Interactive Swing GUI & CLI Application
    │   ├── FlareCallClient.java # Java 11+ HttpClient WebSocket calling client
    │   ├── CallSession.java   # Call state machine (IDLE -> RINGING -> IN_CALL)
    │   ├── CallEventListener.java # Listener interface for call events
    │   ├── SignalingMessage.java # Zero-dependency JSON parser
    │   └── AndroidWebRTCAdapter.java # Reference Android Google WebRTC bridge
    ├── run.bat                # 1-click run script for Java GUI
    └── run-cli.bat            # 1-click run script for Java CLI
```

---

<div align="center">
  <sub>Crafted with ❤️ by <a href="https://github.com/techxsarwar">Sarwar Altaf Dar</a> • Released under the GNU General Public License v3.0</sub>
</div>
