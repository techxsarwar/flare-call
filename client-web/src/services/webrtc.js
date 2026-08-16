/**
 * FlareCall WebRTC PeerConnection Engine
 * Handles ICE candidate queuing, SDP negotiation, camera/mic/screen streams,
 * robust mobile ontrack handling, and real-time connection diagnostics.
 */

export const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.services.mozilla.com" }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle"
};

export class WebRTCService {
  constructor(options = {}) {
    this.localStream = null;
    this.screenStream = null;
    this.peerConnections = new Map(); // peerId -> RTCPeerConnection
    this.remoteStreams = new Map(); // peerId -> MediaStream
    this.iceCandidateQueues = new Map(); // peerId -> RTCIceCandidateInit[]

    this.onRemoteStream = options.onRemoteStream || (() => {});
    this.onRemoteStreamRemoved = options.onRemoteStreamRemoved || (() => {});
    this.onIceCandidate = options.onIceCandidate || (() => {});
    this.onConnectionStateChange = options.onConnectionStateChange || (() => {});
    this.onStats = options.onStats || (() => {});

    this.statsInterval = null;
    this.audioContext = null;
    this.localAnalyser = null;
    this.remoteAnalyser = null;
    this.localSource = null;
    this.remoteSource = null;
  }

  /**
   * Acquire local camera and microphone stream with graceful fallbacks
   */
  async getLocalMedia(constraints = { audio: true, video: true }) {
    if (this.localStream) {
      this.stopLocalMedia();
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn("[WebRTC] navigator.mediaDevices.getUserMedia is not available. Check HTTPS / secure context.");
      return null;
    }

    const defaultConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: constraints.video ? {
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
        frameRate: { ideal: 24, max: 30 },
        facingMode: "user"
      } : false
    };

    const finalConstraints = {
      audio: constraints.audio !== undefined ? (constraints.audio ? defaultConstraints.audio : false) : defaultConstraints.audio,
      video: constraints.video !== undefined ? (constraints.video ? defaultConstraints.video : false) : defaultConstraints.video
    };

    if (constraints.audioDeviceId && finalConstraints.audio) {
      finalConstraints.audio = { ...finalConstraints.audio, deviceId: { exact: constraints.audioDeviceId } };
    }
    if (constraints.videoDeviceId && finalConstraints.video) {
      finalConstraints.video = { ...finalConstraints.video, deviceId: { exact: constraints.videoDeviceId } };
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(finalConstraints);
    } catch (err) {
      console.warn("[WebRTC] Failed to acquire video+audio, trying audio-only fallback:", err);
      // Fallback: Try audio only if video failed (e.g. camera busy or not available)
      if (finalConstraints.video && finalConstraints.audio) {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: finalConstraints.audio, video: false });
        } catch (audioErr) {
          console.warn("[WebRTC] Audio-only fallback also failed:", audioErr);
          this.localStream = null;
          throw audioErr;
        }
      } else {
        this.localStream = null;
        throw err;
      }
    }

    if (this.localStream) {
      this.setupAudioAnalyser(this.localStream, "local");
      // Update tracks on all active peer connections
      for (const [peerId, pc] of this.peerConnections.entries()) {
        this.attachLocalTracks(pc);
      }
    }

    return this.localStream;
  }

  /**
   * Helper: Attach or replace local media tracks on an active RTCPeerConnection
   */
  attachLocalTracks(pc) {
    if (!pc || !this.localStream) return;

    try {
      const senders = pc.getSenders();
      const localTracks = this.localStream.getTracks();

      localTracks.forEach(track => {
        const existingSender = senders.find(s => s.track && s.track.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track).catch(e => {
            console.warn(`[WebRTC] Failed to replace ${track.kind} track:`, e);
          });
        } else {
          try {
            pc.addTrack(track, this.localStream);
          } catch (e) {
            console.warn(`[WebRTC] Failed to add ${track.kind} track:`, e);
          }
        }
      });
    } catch (e) {
      console.warn("[WebRTC] attachLocalTracks error:", e);
    }
  }

  /**
   * Start screen sharing and replace video track on active peer connections
   */
  async startScreenShare() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Screen sharing is not supported on this device/browser.");
      }

      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: true
      });

      const screenTrack = this.screenStream.getVideoTracks()[0];
      if (screenTrack) {
        screenTrack.onended = () => {
          this.stopScreenShare();
        };

        // Replace video tracks on all active peer connections
        for (const [peerId, pc] of this.peerConnections.entries()) {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === "video");
          if (videoSender) {
            await videoSender.replaceTrack(screenTrack);
          }
        }
      }

      return this.screenStream;
    } catch (err) {
      console.warn("Screen share cancelled or failed:", err);
      throw err;
    }
  }

  /**
   * Stop screen sharing and revert to camera track
   */
  async stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }

    if (this.localStream) {
      const cameraTrack = this.localStream.getVideoTracks()[0];
      if (cameraTrack) {
        for (const [peerId, pc] of this.peerConnections.entries()) {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === "video");
          if (videoSender) {
            await videoSender.replaceTrack(cameraTrack);
          }
        }
      }
    }
  }

  /**
   * Create or retrieve an RTCPeerConnection for a specific remote peer
   */
  getOrCreatePeerConnection(peerId) {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnections.set(peerId, pc);

    // Attach local media tracks if ready
    this.attachLocalTracks(pc);

    // Handle incoming remote media tracks (Mobile Safari & Chrome safe)
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track (${event.track?.kind}) from peer ${peerId}`);
      let stream = this.remoteStreams.get(peerId);
      if (!stream) {
        if (event.streams && event.streams[0]) {
          stream = event.streams[0];
        } else {
          stream = new MediaStream();
        }
        this.remoteStreams.set(peerId, stream);
      }

      if (event.track && !stream.getTracks().some(t => t.id === event.track.id)) {
        stream.addTrack(event.track);
      }

      this.setupAudioAnalyser(stream, "remote");
      this.onRemoteStream(peerId, stream);
    };

    // Handle ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidate(peerId, event.candidate);
      }
    };

    // Monitor connection states
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${peerId} connection state: ${pc.connectionState}`);
      this.onConnectionStateChange(peerId, pc.connectionState);

      if (pc.connectionState === "connected") {
        this.startStatsMonitor(peerId);
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.stopStatsMonitor();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${peerId} ICE state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "failed" && typeof pc.restartIce === "function") {
        console.log(`[WebRTC] ICE failed for peer ${peerId}, restarting ICE...`);
        pc.restartIce();
      }
    };

    return pc;
  }

  /**
   * Create and set local SDP Offer
   */
  async createOffer(peerId) {
    const pc = this.getOrCreatePeerConnection(peerId);
    this.attachLocalTracks(pc);

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await pc.setLocalDescription(offer);
    return pc.localDescription;
  }

  /**
   * Handle incoming SDP Offer and generate SDP Answer
   */
  async handleOfferAndCreateAnswer(peerId, remoteSdp) {
    const pc = this.getOrCreatePeerConnection(peerId);
    this.attachLocalTracks(pc);

    await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: remoteSdp }));
    await this.drainQueuedIceCandidates(peerId);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return pc.localDescription;
  }

  /**
   * Handle incoming SDP Answer
   */
  async handleAnswer(peerId, remoteSdp) {
    const pc = this.peerConnections.get(peerId);
    if (pc && pc.signalingState !== "stable") {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: remoteSdp }));
      await this.drainQueuedIceCandidates(peerId);
    }
  }

  /**
   * Add ICE candidate received from remote peer with queuing support
   */
  async addIceCandidate(peerId, candidateInit) {
    const pc = this.peerConnections.get(peerId);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
      } catch (e) {
        console.warn("[WebRTC] Error adding ICE candidate directly:", e);
      }
    } else {
      // Buffer candidate until remote description is set
      if (!this.iceCandidateQueues.has(peerId)) {
        this.iceCandidateQueues.set(peerId, []);
      }
      this.iceCandidateQueues.get(peerId).push(candidateInit);
      console.log(`[WebRTC] Buffered ICE candidate for peer ${peerId} (queue length: ${this.iceCandidateQueues.get(peerId).length})`);
    }
  }

  /**
   * Drain and apply all queued ICE candidates for a peer
   */
  async drainQueuedIceCandidates(peerId) {
    const pc = this.peerConnections.get(peerId);
    const queue = this.iceCandidateQueues.get(peerId) || [];
    if (!pc || !pc.remoteDescription || queue.length === 0) return;

    console.log(`[WebRTC] Draining ${queue.length} buffered ICE candidate(s) for peer ${peerId}`);
    while (queue.length > 0) {
      const candidateInit = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
      } catch (e) {
        console.warn("[WebRTC] Error adding queued ICE candidate:", e);
      }
    }
  }

  /**
   * Toggle local microphone audio track
   */
  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => {
        t.enabled = enabled !== undefined ? enabled : !t.enabled;
      });
      return this.isAudioEnabled();
    }
    return false;
  }

  /**
   * Toggle local camera video track
   */
  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(t => {
        t.enabled = enabled !== undefined ? enabled : !t.enabled;
      });
      return this.isVideoEnabled();
    }
    return false;
  }

  isAudioEnabled() {
    if (!this.localStream) return false;
    const track = this.localStream.getAudioTracks()[0];
    return track ? track.enabled : false;
  }

  isVideoEnabled() {
    if (!this.localStream) return false;
    const track = this.localStream.getVideoTracks()[0];
    return track ? track.enabled : false;
  }

  /**
   * Audio frequency visualizer analyser setup
   */
  setupAudioAnalyser(stream, type = "local") {
    try {
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) this.audioContext = new AudioContextClass();
      }
      if (this.audioContext && this.audioContext.state === "suspended") {
        this.audioContext.resume().catch(() => {});
      }

      if (this.audioContext && stream && stream.getAudioTracks().length > 0) {
        if (type === "local" && this.localSource) {
          try { this.localSource.disconnect(); } catch (_) {}
        }
        if (type === "remote" && this.remoteSource) {
          try { this.remoteSource.disconnect(); } catch (_) {}
        }

        const source = this.audioContext.createMediaStreamSource(stream);
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 32;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);

        if (type === "local") {
          this.localSource = source;
          this.localAnalyser = analyser;
        } else {
          this.remoteSource = source;
          this.remoteAnalyser = analyser;
        }
      }
    } catch (e) {
      console.warn("Audio analyser setup skipped:", e);
    }
  }

  /**
   * Collect real-time WebRTC metrics (RTT, packet loss, resolution)
   */
  startStatsMonitor(peerId) {
    this.stopStatsMonitor();
    this.statsInterval = setInterval(async () => {
      const pc = this.peerConnections.get(peerId);
      if (!pc) return;

      try {
        const stats = await pc.getStats();
        let rtt = 0;
        let packetsLost = 0;
        let bytesReceived = 0;
        let frameWidth = 0;
        let frameHeight = 0;
        let fps = 0;

        stats.forEach(report => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            rtt = Math.round((report.currentRoundTripTime || 0) * 1000);
          }
          if (report.type === "inbound-rtp" && report.kind === "video") {
            packetsLost = report.packetsLost || 0;
            bytesReceived = report.bytesReceived || 0;
            frameWidth = report.frameWidth || 0;
            frameHeight = report.frameHeight || 0;
            fps = report.framesPerSecond || 0;
          }
        });

        this.onStats({
          rtt,
          packetsLost,
          bytesReceived,
          resolution: frameWidth ? `${frameWidth}x${frameHeight}` : "Audio/HD",
          fps
        });
      } catch (err) {
        // Ignore stats polling errors
      }
    }, 1500);
  }

  stopStatsMonitor() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  /**
   * Clean up all active peer connections and local media
   */
  close() {
    this.stopStatsMonitor();
    this.stopScreenShare();
    this.stopLocalMedia();

    for (const [peerId, pc] of this.peerConnections.entries()) {
      pc.close();
    }
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this.iceCandidateQueues.clear();
  }

  stopLocalMedia() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
  }
}
