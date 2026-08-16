import React, { useEffect, useRef, useState } from "react";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Settings,
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  Globe,
  Radio,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Share2
} from "lucide-react";
import { AudioVisualizer } from "./AudioVisualizer";

function GitHubIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export function Lobby({
  displayName,
  onNameChange,
  roomId,
  onRoomIdChange,
  onJoinRoom,
  onCreateRoom,
  localStream,
  isAudioMuted,
  isVideoMuted,
  onToggleAudio,
  onToggleVideo,
  onOpenSettings,
  onOpenShare,
  audioAnalyser
}) {
  const videoRef = useRef(null);
  const [joinInput, setJoinInput] = useState(roomId || "");
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoMuted]);

  const cleanRoomId = (input) => {
    if (!input) return "";
    let clean = input.trim();
    if (clean.includes("?room=")) {
      clean = clean.split("?room=")[1].split("&")[0];
    } else if (clean.includes("/room/")) {
      clean = clean.split("/room/")[1].split("?")[0];
    }
    return decodeURIComponent(clean).trim();
  };

  const handleJoin = (e) => {
    if (e) e.preventDefault();
    const clean = cleanRoomId(joinInput || roomId);
    if (clean) {
      onJoinRoom(clean);
    }
  };

  const handleCreate = () => {
    const randomSlug = "call-" + Math.random().toString(36).substring(2, 8);
    onCreateRoom(randomSlug);
  };

  const copyCurrentRoomLink = (id) => {
    const url = `${window.location.origin}/?room=${encodeURIComponent(id)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="lobby-container">
      {/* Background glowing gradient orbs */}
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />

      {/* Navigation Brand Header */}
      <header className="lobby-header">
        <div className="brand-logo">
          <div className="brand-icon-box">
            <Zap size={22} className="brand-icon" />
          </div>
          <div className="brand-text">
            <h2>Flare<span>Call</span></h2>
            <span className="brand-badge">Cloudflare WebRTC</span>
          </div>
        </div>

        <div className="header-badges">
          <a
            href="https://github.com/techxsarwar"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-github-header"
            title="GitHub: @techxsarwar"
          >
            <GitHubIcon size={15} />
            <span>@techxsarwar</span>
          </a>
          <span className="feature-pill">
            <Shield size={14} /> 100% Encrypted P2P
          </span>
          <span className="feature-pill">
            <Radio size={14} /> Edge Signaling
          </span>
          {roomId && onOpenShare && (
            <button className="btn-share-header" onClick={onOpenShare} title="Share Call & QR Code">
              <QrCode size={16} />
              <span>Share QR</span>
            </button>
          )}
          <button className="btn-settings-header" onClick={onOpenSettings} title="Device Settings">
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Center Layout */}
      <div className="lobby-grid">
        {/* Left Card: Camera/Mic Live Preview */}
        <div className="preview-card">
          <div className="preview-video-wrapper">
            {!isVideoMuted && localStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="preview-video"
              />
            ) : (
              <div className="preview-avatar-placeholder">
                <div className="avatar-circle">
                  <span>{(displayName || "U")[0].toUpperCase()}</span>
                </div>
                <p className="avatar-subtext">Camera is currently turned off</p>
              </div>
            )}

            {/* Live Audio Visualizer Overlay */}
            {!isAudioMuted && (
              <div className="preview-visualizer-badge">
                <AudioVisualizer analyser={audioAnalyser} active={!isAudioMuted} color="#22c55e" height={28} />
              </div>
            )}

            {/* In-Preview Floating Media Toggles */}
            <div className="preview-floating-controls">
              <button
                className={`btn-preview-control ${isAudioMuted ? "muted" : "active"}`}
                onClick={onToggleAudio}
                title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                {isAudioMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              <button
                className={`btn-preview-control ${isVideoMuted ? "muted" : "active"}`}
                onClick={onToggleVideo}
                title={isVideoMuted ? "Turn On Camera" : "Turn Off Camera"}
              >
                {isVideoMuted ? <VideoOff size={18} /> : <Video size={18} />}
              </button>

              <button
                className="btn-preview-control secondary"
                onClick={onOpenSettings}
                title="Settings"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>

          <div className="preview-card-footer">
            <div className="display-name-input-group">
              <label htmlFor="user-name-input">Your Display Name</label>
              <input
                id="user-name-input"
                type="text"
                value={displayName}
                onChange={e => onNameChange(e.target.value)}
                placeholder="Enter your name..."
                maxLength={30}
                className="styled-input name-input"
              />
            </div>
          </div>
        </div>

        {/* Right Card: Instant Room Actions */}
        <div className="action-card">
          <div className="action-card-header">
            <h3>Start or Join a Room</h3>
            <p>Connect instantly with HD video, crystal-clear audio, and screen sharing.</p>
          </div>

          {/* If invited to a specific room, show prominent Join button */}
          {roomId ? (
            <div className="action-box highlight-box" style={{ borderColor: "#22c55e", background: "rgba(34, 197, 94, 0.08)" }}>
              <div className="action-box-icon">
                <Sparkles size={24} className="text-emerald-400" />
              </div>
              <div className="action-box-content">
                <h4>Join Call: <code style={{ color: "#4ade80", fontSize: "14px" }}>{roomId}</code></h4>
                <p>You have been invited to join this room.</p>
              </div>
              <div className="action-box-actions">
                <button className="btn-action-primary" style={{ background: "#16a34a" }} onClick={() => onJoinRoom(cleanRoomId(roomId))}>
                  Join Now <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            /* Quick Create Room */
            <div className="action-box highlight-box">
              <div className="action-box-icon">
                <Sparkles size={24} className="text-indigo-400" />
              </div>
              <div className="action-box-content">
                <h4>Start New Instant Call</h4>
                <p>Creates a fresh secure room link you can share with anyone.</p>
              </div>
              <button className="btn-action-primary" onClick={handleCreate}>
                Start Call <ArrowRight size={16} />
              </button>
            </div>
          )}

          <div className="divider-text">
            <span>OR JOIN EXISTING</span>
          </div>

          {/* Join with Code/URL Form */}
          <form className="join-form" onSubmit={handleJoin}>
            <div className="form-group">
              <label htmlFor="room-id-input">Room Code or Invite Link</label>
              <div className="join-input-group">
                <input
                  id="room-id-input"
                  type="text"
                  placeholder="e.g. fitrace-coach or paste full link"
                  value={joinInput}
                  onChange={e => setJoinInput(e.target.value)}
                  className="styled-input join-input"
                />
                <button
                  type="submit"
                  disabled={!joinInput.trim()}
                  className="btn-action-secondary"
                >
                  Join Room
                </button>
              </div>
            </div>
          </form>

          {/* Multi-client info pill */}
          <div className="multiplatform-banner">
            <Globe size={16} className="text-emerald-400 shrink-0" />
            <p>
              Compatible with Web browsers, iOS Safari, Android Chrome, and the <strong>Java Calling Client</strong>.
            </p>
          </div>

          {/* Author Credits & License Footer */}
          <div className="lobby-credits-footer">
            <span>Crafted with ❤️ by <a href="https://github.com/techxsarwar" target="_blank" rel="noopener noreferrer" className="author-link"><strong>Sarwar Altaf Dar</strong> <ExternalLink size={11} className="inline-icon" /></a></span>
            <span className="credits-divider">•</span>
            <span className="credits-license">GPLv3 Open Source</span>
          </div>
        </div>
      </div>
    </div>
  );
}
