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
  Check
} from "lucide-react";
import { AudioVisualizer } from "./AudioVisualizer";

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

  const handleJoin = (e) => {
    e.preventDefault();
    const clean = joinInput.trim();
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
          <span className="feature-pill">
            <Shield size={14} /> 100% Encrypted P2P
          </span>
          <span className="feature-pill">
            <Radio size={14} /> Edge Signaling
          </span>
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

          {/* Quick Create Room */}
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
              Compatible with Web browsers, Android apps, and the <strong>Java Calling Client</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
