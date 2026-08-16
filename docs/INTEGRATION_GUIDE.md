# 🔌 FlareCall Developer Integration Guide

Welcome to the **FlareCall Developer Integration Guide**. This document provides complete, copy-pasteable code examples, protocol specifications, and best practices for embedding real-time voice and video calling into your own web, mobile, and backend applications.

---

## 📑 Table of Contents
1. [Architecture & How It Works](#1-architecture--how-it-works)
2. [Signaling Protocol Specification (JSON over WebSocket)](#2-signaling-protocol-specification)
3. [Integration Recipes](#3-integration-recipes)
   - [A. React / Next.js Hook & Component](#a-react--nextjs-plug-and-play-component)
   - [B. Vanilla JavaScript / HTML (Zero Dependencies)](#b-vanilla-javascript--html-embed)
   - [C. Vue.js 3 / Nuxt 3](#c-vuejs-3--nuxt-3)
   - [D. Node.js Backend / Automated Call Bot](#d-nodejs-backend-bot)
   - [E. Android (Kotlin / Java)](#e-android-kotlin--java)
   - [F. Flutter / React Native](#f-flutter--react-native)
4. [Custom Self-Hosting & STUN/TURN Setup](#4-custom-self-hosting--stunturn-setup)
5. [Troubleshooting & Best Practices](#5-troubleshooting--best-practices)

---

## 1. Architecture & How It Works

FlareCall is built on two core principles:
1. **P2P WebRTC Media**: Audio, 1080p HD video, and screen sharing flow **directly between participants' devices** (end-to-end encrypted). Server bandwidth is **$0 / 0 bytes**.
2. **Cloudflare SQLite Durable Objects Signaling**: A globally distributed signaling hub running across 300+ edge locations handles room coordination and SDP/ICE candidate exchange in <50ms.

```
                    ┌──────────────────────────────────────────────┐
                    │    Cloudflare Durable Object (Signaling)     │
                    │   wss://flare-call-signaling.aarifgmr.../ws  │
                    └──────────────────────────────────────────────┘
                                          ▲
                   ┌──────────────────────┴──────────────────────┐
            WebSocket Handshake                           WebSocket Handshake
                   │                                             │
        ┌─────────────────────┐                       ┌─────────────────────┐
        │  Your App (Peer A)  │ ◄═══════════════════► │  Your App (Peer B)  │
        └─────────────────────┘   Direct Encrypted    └─────────────────────┘
                                  P2P WebRTC Media
```

---

## 2. Signaling Protocol Specification

### WebSocket Endpoint:
```
wss://flare-call-signaling.aarifgmr.workers.dev/ws?room=<YOUR_ROOM_ID>
```

All signaling messages are formatted as standard JSON objects.

### Message Reference:

#### 1. Join Room
Sent by a client immediately after WebSocket connection opens.
```json
{
  "type": "join",
  "roomId": "room-abc-123",
  "peerId": "user_client_a",
  "name": "Alex",
  "mediaState": { "audio": true, "video": true }
}
```

#### 2. Joined Acknowledgement (Server $\rightarrow$ Client)
Returned by the server with a list of existing peers in the room.
```json
{
  "type": "joined",
  "roomId": "room-abc-123",
  "peerId": "user_client_a",
  "peers": [
    {
      "peerId": "user_client_b",
      "name": "Sarah",
      "mediaState": { "audio": true, "video": true }
    }
  ],
  "timestamp": 1786868272493
}
```

#### 3. Peer Joined Event (Server $\rightarrow$ Room)
Broadcast to existing peers when a new user enters.
```json
{
  "type": "peer-joined",
  "roomId": "room-abc-123",
  "peerId": "user_client_a",
  "name": "Alex",
  "mediaState": { "audio": true, "video": true }
}
```

#### 4. SDP Offer (Peer A $\rightarrow$ Server $\rightarrow$ Peer B)
```json
{
  "type": "offer",
  "roomId": "room-abc-123",
  "targetPeerId": "user_client_b",
  "fromPeerId": "user_client_a",
  "sdp": "v=0\r\no=- 4213 2 IN IP4 127.0.0.1..."
}
```

#### 5. SDP Answer (Peer B $\rightarrow$ Server $\rightarrow$ Peer A)
```json
{
  "type": "answer",
  "roomId": "room-abc-123",
  "targetPeerId": "user_client_a",
  "fromPeerId": "user_client_b",
  "sdp": "v=0\r\no=- 8921 2 IN IP4 127.0.0.1..."
}
```

#### 6. ICE Candidate (Peer A $\leftrightarrow$ Peer B)
```json
{
  "type": "ice-candidate",
  "roomId": "room-abc-123",
  "targetPeerId": "user_client_b",
  "fromPeerId": "user_client_a",
  "candidate": {
    "candidate": "candidate:842163049 1 udp 1686052607 192.168.1.5 52820 typ host ...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

#### 7. In-Call Chat Message
```json
{
  "type": "chat",
  "roomId": "room-abc-123",
  "fromPeerId": "user_client_a",
  "fromName": "Alex",
  "text": "Hello world!",
  "timestamp": 1786868280000
}
```

---

## 3. Integration Recipes

---

### A. React / Next.js (Plug-and-Play Component)

Here is a ready-to-use React hook `useFlareCall` and `<FlareVideoCall />` component:

#### `useFlareCall.js`:
```javascript
import { useEffect, useRef, useState } from "react";

const SIGNALING_SERVER = "wss://flare-call-signaling.aarifgmr.workers.dev/ws";

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" }
  ]
};

export function useFlareCall({ roomId, userName }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const myPeerId = useRef("peer_" + Math.random().toString(36).substring(2, 9));

  useEffect(() => {
    if (!roomId) return;

    let localMediaStream = null;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    // 1. Get User Media (1080p / 720p HD)
    navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
    }).then(stream => {
      localMediaStream = stream;
      setLocalStream(stream);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }).catch(err => console.error("Camera access failed:", err));

    // 2. Handle Remote Tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // 3. Connect to Cloudflare Signaling Hub
    const ws = new WebSocket(`${SIGNALING_SERVER}?room=${encodeURIComponent(roomId)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "join",
        roomId,
        peerId: myPeerId.current,
        name: userName || "User"
      }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "ice-candidate",
          roomId,
          candidate: event.candidate
        }));
      }
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "joined" && msg.peers?.length > 0) {
        // First peer initiates call
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({
          type: "offer",
          roomId,
          targetPeerId: msg.peers[0].peerId,
          fromPeerId: myPeerId.current,
          sdp: offer.sdp
        }));
      }

      if (msg.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: msg.sdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({
          type: "answer",
          roomId,
          targetPeerId: msg.fromPeerId,
          fromPeerId: myPeerId.current,
          sdp: answer.sdp
        }));
      }

      if (msg.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: msg.sdp }));
        setIsConnected(true);
      }

      if (msg.type === "ice-candidate") {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (_) {}
      }

      if (msg.type === "chat") {
        setChatMessages(prev => [...prev, msg]);
      }
    };

    return () => {
      if (localMediaStream) localMediaStream.getTracks().forEach(t => t.stop());
      pc.close();
      ws.close();
    };
  }, [roomId, userName]);

  const sendChat = (text) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "chat",
        roomId,
        fromPeerId: myPeerId.current,
        fromName: userName,
        text,
        timestamp: Date.now()
      }));
    }
  };

  return { localStream, remoteStream, isConnected, chatMessages, sendChat };
}
```

#### Component Example (`VideoCallView.jsx`):
```jsx
import React, { useRef, useEffect } from "react";
import { useFlareCall } from "./useFlareCall";

export function VideoCallView({ roomId, userName }) {
  const { localStream, remoteStream, isConnected } = useFlareCall({ roomId, userName });
  const localVideo = useRef();
  const remoteVideo = useRef();

  useEffect(() => {
    if (localVideo.current && localStream) localVideo.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideo.current && remoteStream) remoteVideo.current.srcObject = remoteStream;
  }, [remoteStream]);

  return (
    <div style={{ display: "flex", gap: "20px", background: "#0f172a", padding: "20px", borderRadius: "16px" }}>
      <div>
        <h4>You ({userName})</h4>
        <video ref={localVideo} autoPlay playsInline muted style={{ width: "320px", borderRadius: "12px" }} />
      </div>
      <div>
        <h4>Remote Peer {isConnected ? "🟢 Connected" : "⏳ Calling..."}</h4>
        <video ref={remoteVideo} autoPlay playsInline style={{ width: "480px", borderRadius: "12px" }} />
      </div>
    </div>
  );
}
```

---

### B. Vanilla JavaScript / HTML (Embed Anywhere in 1 File)

Copy and paste this single `.html` file into any website:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FlareCall Embed</title>
  <style>
    body { font-family: sans-serif; background: #0b0f19; color: #fff; text-align: center; }
    .video-grid { display: flex; justify-content: center; gap: 16px; margin-top: 20px; }
    video { width: 45%; border-radius: 12px; background: #000; }
  </style>
</head>
<body>
  <h2>🔥 FlareCall WebRTC Direct Embed</h2>
  <button id="btnStart" onclick="startCall('demo-room-101')">Join Call (demo-room-101)</button>
  
  <div class="video-grid">
    <video id="localVideo" autoPlay playsInline muted></video>
    <video id="remoteVideo" autoPlay playsInline></video>
  </div>

  <script>
    async function startCall(roomId) {
      document.getElementById("btnStart").disabled = true;
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun.cloudflare.com:3478" }]
      });

      // 1. Get Camera
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      document.getElementById("localVideo").srcObject = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 2. Render Remote Video
      pc.ontrack = (e) => {
        if (e.streams[0]) document.getElementById("remoteVideo").srcObject = e.streams[0];
      };

      // 3. Connect to Cloudflare Signaling Hub
      const myId = "peer_" + Math.random().toString(36).substring(2, 8);
      const ws = new WebSocket(`wss://flare-call-signaling.aarifgmr.workers.dev/ws?room=${roomId}`);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", roomId, peerId: myId, name: "WebClient" }));
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) ws.send(JSON.stringify({ type: "ice-candidate", roomId, candidate: e.candidate }));
      };

      ws.onmessage = async (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "joined" && msg.peers?.length > 0) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: "offer", roomId, targetPeerId: msg.peers[0].peerId, fromPeerId: myId, sdp: offer.sdp }));
        }
        if (msg.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: msg.sdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", roomId, targetPeerId: msg.fromPeerId, fromPeerId: myId, sdp: answer.sdp }));
        }
        if (msg.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: msg.sdp }));
        }
        if (msg.type === "ice-candidate") {
          pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
        }
      };
    }
  </script>
</body>
</html>
```

---

### C. Vue.js 3 / Nuxt 3

```vue
<template>
  <div class="flare-call-wrapper">
    <video ref="localVideo" autoplay playsinline muted class="video-preview" />
    <video ref="remoteVideo" autoplay playsinline class="video-remote" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const props = defineProps({
  roomId: { type: String, required: true },
  userName: { type: String, default: "User" }
});

const localVideo = ref(null);
const remoteVideo = ref(null);
let pc = null;
let ws = null;

onMounted(async () => {
  pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  localVideo.value.srcObject = stream;
  stream.getTracks().forEach(t => pc.addTrack(t, stream));

  pc.ontrack = (e) => {
    if (e.streams[0]) remoteVideo.value.srcObject = e.streams[0];
  };

  ws = new WebSocket(`wss://flare-call-signaling.aarifgmr.workers.dev/ws?room=${props.roomId}`);
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "join", roomId: props.roomId, peerId: "vue_" + Date.now(), name: props.userName }));
  };
  // ... Handle offer, answer, ice-candidate as shown above
});

onUnmounted(() => {
  pc?.close();
  ws?.close();
});
</script>
```

---

### D. Node.js Backend Bot / Automated Assistant

Connect an automated backend bot or transcription pipeline directly into a FlareCall room:

```javascript
// npm install ws
const WebSocket = require("ws");

const ROOM_ID = "support-room-99";
const ws = new WebSocket(`wss://flare-call-signaling.aarifgmr.workers.dev/ws?room=${ROOM_ID}`);

ws.on("open", () => {
  console.log("Connected to FlareCall Room!");
  ws.send(JSON.stringify({
    type: "join",
    roomId: ROOM_ID,
    peerId: "ai_bot_01",
    name: "AI Support Assistant"
  }));
});

ws.on("message", (data) => {
  const msg = JSON.parse(data);
  
  if (msg.type === "peer-joined") {
    // Send automated greeting in chat
    ws.send(JSON.stringify({
      type: "chat",
      roomId: ROOM_ID,
      fromPeerId: "ai_bot_01",
      fromName: "AI Assistant",
      text: `Hello ${msg.name}! Welcome to live support. How can I help you today?`,
      timestamp: Date.now()
    }));
  }
});
```

---

### E. Android (Kotlin / Java)

Integrate into native Android applications using Google WebRTC (`org.webrtc:google-webrtc`):

```kotlin
// Android Studio Kotlin Example
val peerConnectionFactory = PeerConnectionFactory.builder().createPeerConnectionFactory()
val rtcConfig = PeerConnection.RTCConfiguration(listOf(
    PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
))

val pc = peerConnectionFactory.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
    override fun onIceCandidate(candidate: IceCandidate) {
        // Send candidate to WebSocket
    }
    override fun onTrack(transceiver: RtpTransceiver) {
        val track = transceiver.receiver.track() as? VideoTrack
        track?.addSink(binding.remoteSurfaceView)
    }
    // ... other overrides
})

// Connect to Cloudflare Signaling Hub:
val ws = okHttpClient.newWebSocket(
    Request.Builder().url("wss://flare-call-signaling.aarifgmr.workers.dev/ws?room=room101").build(),
    object : WebSocketListener() {
        override fun onMessage(webSocket: WebSocket, text: String) {
            // Handle SDP Offer / Answer and IceCandidate
        }
    }
)
```

---

## 4. Custom Self-Hosting & STUN/TURN Setup

If you want to deploy your own private signaling backend:

### 1. Clone & Configure:
```bash
git clone https://github.com/techxsarwar/flare-call.git
cd flare-call/server
```

### 2. Deploy to Cloudflare Workers ($0 / Free Tier):
```bash
npx wrangler deploy
```

### 3. Adding TURN Relay Servers (Optional for Strict Enterprise Firewalls):
In `client-web/src/services/webrtc.js`, you can add your custom TURN credentials:
```javascript
export const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:your-turn-server.com:3478",
      username: "user123",
      credential: "securepassword"
    }
  ]
};
```

---

## 5. Troubleshooting & Best Practices

1. **HTTPS Context Required**: Browsers will block `navigator.mediaDevices.getUserMedia` unless served over `https://` or `localhost`.
2. **Mobile Safari Autoplay**: iOS Safari requires `<video playsinline autoplay>` and user gesture before playing audio.
3. **ICE Candidate Queuing**: Always buffer ICE candidates if they arrive before `setRemoteDescription` completes.

---

<div align="center">
  <sub>Released under GNU General Public License v3.0 • Maintained by <a href="https://github.com/techxsarwar">Sarwar Altaf Dar</a></sub>
</div>
