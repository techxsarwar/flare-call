# ? FlareCall ? Real-Time WebRTC Calling on Cloudflare

A modern, production-grade, 100% free real-time audio & video calling system powered by:
- ?? **Cloudflare Workers**: Ultra-low latency WebSocket signaling & room hub.
- ?? **Direct P2P WebRTC**: End-to-end encrypted HD Audio (Opus 48kHz) and Video (VP8/VP9/H.264) with **$0 bandwidth costs**.
- ?? **Modern React Web App**: Dark glassmorphic interface, dynamic glowing audio waveform visualizer, screen sharing, device selection, in-call chat, and synthesized sound effects.
- ? **Native Java Client & Android SDK**: Standalone Java 21 client (`com.flarecall.FlareCallApp`) with modern Swing GUI & CLI mode, and Android WebRTC adapter architecture.

---

## ??? System Architecture

```
                      ???????????????????????????????????????????
                      ?      Cloudflare Worker (Signaling)      ?
                      ?     - Edge WebSockets Hub & Rooms       ?
                      ?     - SDP Offer / Answer Exchange       ?
                      ?     - ICE Candidate Relay               ?
                      ???????????????????????????????????????????
                                    ?
               ???????????????????????????????????????????
               ? WebSocket          ? WebSocket          ? WebSocket
               ?                    ?                    ?
     ???????????????????? ???????????????????? ????????????????????
     ?  React Web App   ? ?  Native Java App ? ? Android / Mobile ?
     ?  (Vite + React)  ? ? (Java 21 Client) ? ?  (Java Adapter)  ?
     ???????????????????? ???????????????????? ????????????????????
               ?                   ?                    ?
               ??????????????????????????????????????????
                     Direct P2P Encrypted Audio / Video (WebRTC)
                            ($0 Bandwidth Forever!)
```

---

## ?? Quick Start Guide

### 1. Start the Cloudflare Signaling Server (Port 8787)
```bash
cd server
npm install
npx wrangler dev
```
*Your edge WebSocket signaling server is now live at `ws://localhost:8787/ws`!*

---

### 2. Start the Modern React Web Client (Port 5173)
```bash
cd client-web
npm install
npm run dev
```
*Open `http://localhost:5173` in your browser. Create a room or share the room link!*

---

### 3. Run the Native Java Calling Client (Swing GUI or CLI)

#### GUI Mode (Interactive Desktop Window):
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

The Java Client connects directly to your Cloudflare Worker WebSocket server, joins room sessions, receives incoming call alerts from web or mobile callers, exchanges WebRTC SDP/ICE signals, and participates in real-time chat!

---

## ?? Android WebRTC Integration Guide

If you are integrating calling into an Android application (e.g. FitRace Android / React Native Native Module):

1. Include the Google WebRTC dependency in your Android `build.gradle`:
   ```groovy
   implementation "org.webrtc:google-webrtc:1.0.32007"
   ```
2. Reference [`client-java/src/com/flarecall/AndroidWebRTCAdapter.java`](./client-java/src/com/flarecall/AndroidWebRTCAdapter.java) to connect the `FlareCallClient` WebSocket signaling events to your Android `PeerConnectionFactory`.

---

## ?? Deploying to Cloudflare ($0 / Free Tier)

Deploying your signaling server to Cloudflare's global edge network across 300+ cities takes one command:

```bash
cd server
npx wrangler deploy
```

Once deployed, update the WebSocket URL in `client-web` and `client-java` to your Cloudflare worker URL (`wss://<your-worker-name>.workers.dev/ws`).

### Why is this 100% Free?
- **Cloudflare Workers Free Tier**: Gives you **100,000 free requests per day**. WebSockets signaling uses tiny text messages (<1KB) during call setup.
- **P2P WebRTC Media**: Audio & Video stream directly device-to-device with Google/Cloudflare STUN. Cloudflare server bandwidth = **0 KB**.

---

## ?? Repository Structure

```
flare-call/
??? server/                    # Cloudflare Worker Signaling Server
?   ??? worker.js              # WebSocket room hub & WebRTC signal router
?   ??? wrangler.jsonc         # Cloudflare Worker configuration
?   ??? package.json
?
??? client-web/                # Modern React 19 + Vite Web Application
?   ??? src/
?   ?   ??? components/
?   ?   ?   ??? Lobby.jsx      # Pre-call test, camera/mic preview, room generator
?   ?   ?   ??? CallView.jsx   # In-call video grid, PiP view, toolbar, diagnostics
?   ?   ?   ??? ChatDrawer.jsx # Synchronized live chat drawer
?   ?   ?   ??? SettingsModal.jsx # Device & resolution switcher
?   ?   ?   ??? AudioVisualizer.jsx # Canvas glowing audio waveform analyzer
?   ?   ??? services/
?   ?   ?   ??? webrtc.js      # RTCPeerConnection lifecycle & stats collector
?   ?   ?   ??? sounds.js      # Web Audio synthesized ringtones & chimes
?   ?   ??? App.jsx            # Main app controller
?   ?   ??? index.css          # Design system & dark glassmorphism styling
?   ?   ??? main.jsx
?   ??? index.html
?   ??? vite.config.js
?   ??? package.json
?
??? client-java/               # Native Java 21 Calling Client & Android Bridge
?   ??? src/com/flarecall/
?   ?   ??? FlareCallApp.java  # Interactive Swing GUI & CLI Application
?   ?   ??? FlareCallClient.java # Java 11+ HttpClient WebSocket calling client
?   ?   ??? CallSession.java   # Call state machine (IDLE -> RINGING -> IN_CALL)
?   ?   ??? CallEventListener.java # Listener interface for call events
?   ?   ??? SignalingMessage.java # JSON parser & signaling data model
?   ?   ??? AndroidWebRTCAdapter.java # Reference Android Google WebRTC bridge
?   ??? run.bat                # 1-click run script for Java GUI
?   ??? run-cli.bat            # 1-click run script for Java CLI
?
??? package.json               # Root monorepo orchestrator
```
