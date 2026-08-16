/**
 * FlareCall WebRTC PeerConnection Engine
 * Handles ICE, SDP negotiation, camera/mic/screen streams, and real-time stats diagnostics.
 */

export const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.services.mozilla.com" }
  ],
  iceCandidatePoolSize: 10
};

export class WebRTCService {
  constructor(options = {}) {
    this.localStream = null;
    this.screenStream = null;
    this.peerConnections = new Map(); // peerId -> RTCPeerConnection
    this.remoteStreams = new Map(); // peerId -> MediaStream
    this.onRemoteStream = options.onRemoteStream || (() => {});
    this.onRemoteStreamRemoved = options.onRemoteStreamRemoved || (() => {});
    this.onIceCandidate = options.onIceCandidate || (() => {});
    this.onConnectionStateChange = options.onConnectionStateChange || (() => {});
    this.onStats = options.onStats || (() => {});

    this.statsInterval = null;
    this.audioContext = null;
    this.localAnalyser = null;
    this.remoteAnalyser = null;
  }

  /**
   * Acquire local camera and microphone stream
   */
  async getLocalMedia(constraints = { audio: true, video: true }) {
    if (this.localStream) {
      this.stopLocalMedia();
    }

    const defaultConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: constraints.video ? {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
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

    this.localStream = await navigator.mediaDevices.getUserMedia(finalConstraints);
    this.setupAudioAnalyser(this.localStream, "local");
    return this.localStream;
  }

  /**
   * Start screen sharing and replace video track on active peer connections
   */
  async startScreenShare() {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: true
      });

      const screenTrack = this.screenStream.getVideoTracks()[0];

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

    // Add local media tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Handle incoming remote media tracks
    pc.ontrack = (event) => {
      let stream = this.remoteStreams.get(peerId);
      if (!stream) {
        stream = new MediaStream();
        this.remoteStreams.set(peerId, stream);
      }
      event.streams[0].getTracks().forEach(track => {
        if (!stream.getTracks().some(t => t.id === track.id)) {
          stream.addTrack(track);
        }
      });

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
      this.onConnectionStateChange(peerId, pc.connectionState);
      if (pc.connectionState === "connected") {
        this.startStatsMonitor(peerId);
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.stopStatsMonitor();
      }
    };

    return pc;
  }

  /**
   * Create and set local SDP Offer
   */
  async createOffer(peerId) {
    const pc = this.getOrCreatePeerConnection(peerId);
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
    await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: remoteSdp }));
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
    }
  }

  /**
   * Add ICE candidate received from remote peer
   */
  async addIceCandidate(peerId, candidateInit) {
    const pc = this.peerConnections.get(peerId);
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
      } catch (e) {
        console.warn("Error adding ICE candidate:", e);
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
        this.audioContext.resume();
      }

      if (this.audioContext && stream.getAudioTracks().length > 0) {
        const source = this.audioContext.createMediaStreamSource(stream);
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        if (type === "local") this.localAnalyser = analyser;
        else this.remoteAnalyser = analyser;
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
  }

  stopLocalMedia() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
  }
}
