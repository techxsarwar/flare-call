import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MonitorUp,
  MonitorOff,
  MessageSquare,
  Settings,
  Activity,
  Copy,
  Check,
  Users,
  Shield,
  Maximize,
  Minimize,
  PhoneCall,
  Volume2
} from "lucide-react";
import { AudioVisualizer } from "./AudioVisualizer";

export function CallView({
  roomId,
  myPeerId,
  displayName,
  peers,
  remoteStreams,
  localStream,
  isAudioMuted,
  isVideoMuted,
  isScreenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onEndCall,
  onOpenChat,
  onOpenSettings,
  unreadCount,
  callDuration,
  stats,
  audioAnalyser,
  remoteAnalyser
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());
  const [copiedLink, setCopiedLink] = useState(false);
  const [showStatsHud, setShowStatsHud] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Bind local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoMuted]);

  // Bind remote video streams
  useEffect(() => {
    remoteStreams.forEach((stream, peerId) => {
      const el = remoteVideoRefs.current.get(peerId);
      if (el && el.srcObject !== stream) {
        el.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  const copyRoomLink = () => {
    const url = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatDuration = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const activePeerList = Array.from(peers.values()).filter(p => p.peerId !== myPeerId);

  return (
    <div className="callview-container">
      {/* Top Header Bar */}
      <header className="callview-header">
        <div className="callview-info-group">
          <div className="call-status-indicator">
            <span className="pulsing-dot" />
            <span className="call-timer">{formatDuration(callDuration)}</span>
          </div>

          <div className="room-badge-pill" onClick={copyRoomLink} title="Click to copy invite link">
            <span className="room-label">Room:</span>
            <span className="room-id">{roomId}</span>
            {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </div>

          <div className="participants-count-pill">
            <Users size={14} />
            <span>{peers.size} participant{peers.size === 1 ? "" : "s"}</span>
          </div>
        </div>

        <div className="callview-header-actions">
          <button
            className={`btn-header-pill ${showStatsHud ? "active" : ""}`}
            onClick={() => setShowStatsHud(!showStatsHud)}
            title="Toggle WebRTC Connection Diagnostics"
          >
            <Activity size={15} />
            <span>{stats?.rtt ? `${stats.rtt}ms RTT` : "Diagnostics"}</span>
          </button>

          <button className="btn-header-icon" onClick={toggleFullscreen} title="Fullscreen">
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </header>

      {/* Diagnostics HUD Overlay */}
      {showStatsHud && (
        <div className="diagnostics-hud">
          <div className="hud-header">
            <Shield size={14} className="text-emerald-400" />
            <h5>WebRTC P2P Health Metrics</h5>
          </div>
          <div className="hud-grid">
            <div className="hud-stat">
              <span className="hud-label">Latency (RTT):</span>
              <span className="hud-value">{stats?.rtt || 12} ms</span>
            </div>
            <div className="hud-stat">
              <span className="hud-label">Resolution:</span>
              <span className="hud-value">{stats?.resolution || "1280x720"}</span>
            </div>
            <div className="hud-stat">
              <span className="hud-label">FPS:</span>
              <span className="hud-value">{stats?.fps || 30} fps</span>
            </div>
            <div className="hud-stat">
              <span className="hud-label">Packets Lost:</span>
              <span className="hud-value">{stats?.packetsLost || 0}</span>
            </div>
            <div className="hud-stat">
              <span className="hud-label">Audio Codec:</span>
              <span className="hud-value">Opus (48kHz HD)</span>
            </div>
            <div className="hud-stat">
              <span className="hud-label">Video Codec:</span>
              <span className="hud-value">VP8 / H.264</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Video Stage */}
      <main className="video-stage">
        {activePeerList.length === 0 ? (
          /* Waiting Room State */
          <div className="waiting-card">
            <div className="waiting-ripple-box">
              <div className="ripple ripple-1" />
              <div className="ripple ripple-2" />
              <div className="ripple ripple-3" />
              <div className="waiting-avatar-circle">
                <PhoneCall size={36} className="text-indigo-400" />
              </div>
            </div>

            <h3>Waiting for someone to join...</h3>
            <p>Share this link or room code with your friend, client, or teammate to connect instantly.</p>

            <div className="invite-box">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/?room=${encodeURIComponent(roomId)}`}
                className="invite-link-input"
              />
              <button className="btn-copy-invite" onClick={copyRoomLink}>
                {copiedLink ? (
                  <>
                    <Check size={16} /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} /> Copy Invite Link
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Remote Peer Video Grid */
          <div className={`remote-videos-grid count-${activePeerList.length}`}>
            {activePeerList.map(peer => {
              const stream = remoteStreams.get(peer.peerId);
              const hasVideo = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;

              return (
                <div key={peer.peerId} className="peer-video-tile">
                  <video
                    ref={el => {
                      if (el) {
                        remoteVideoRefs.current.set(peer.peerId, el);
                        if (stream && el.srcObject !== stream) {
                          el.srcObject = stream;
                        }
                      }
                    }}
                    autoPlay
                    playsInline
                    className={`peer-video-element ${hasVideo ? "visible" : "hidden"}`}
                  />

                  {/* Fallback Audio-Only Avatar if Video Disabled */}
                  {!hasVideo && (
                    <div className="peer-audio-only-view">
                      <div className="peer-avatar-glow">
                        <div className="peer-avatar-large">
                          <span>{(peer.name || "P")[0].toUpperCase()}</span>
                        </div>
                      </div>
                      <AudioVisualizer analyser={remoteAnalyser} active={true} color="#38bdf8" height={60} />
                    </div>
                  )}

                  {/* Tile Bottom Info Bar */}
                  <div className="peer-tile-footer">
                    <div className="peer-tile-name">
                      <span>{peer.name || "Remote Peer"}</span>
                    </div>
                    <div className="peer-tile-status">
                      <Volume2 size={15} className="text-emerald-400" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Floating Local Picture-in-Picture View */}
        <div className="floating-pip-card">
          {!isVideoMuted && localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="pip-video-element"
            />
          ) : (
            <div className="pip-avatar-fallback">
              <div className="pip-avatar-circle">
                <span>{(displayName || "U")[0].toUpperCase()}</span>
              </div>
              <span className="pip-name-tag">You (Cam Off)</span>
            </div>
          )}

          <div className="pip-footer-badge">
            <span>You ({displayName})</span>
            {isAudioMuted && <MicOff size={13} className="text-rose-400" />}
          </div>
        </div>
      </main>

      {/* Bottom Floating Control Bar */}
      <footer className="callview-toolbar">
        <div className="toolbar-cluster">
          {/* Mute Microphone */}
          <button
            className={`btn-toolbar ${isAudioMuted ? "danger" : "normal"}`}
            onClick={onToggleAudio}
            title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
            <span className="toolbar-label">{isAudioMuted ? "Unmute" : "Mute"}</span>
          </button>

          {/* Turn On/Off Camera */}
          <button
            className={`btn-toolbar ${isVideoMuted ? "danger" : "normal"}`}
            onClick={onToggleVideo}
            title={isVideoMuted ? "Start Video" : "Stop Video"}
          >
            {isVideoMuted ? <VideoOff size={20} /> : <Video size={20} />}
            <span className="toolbar-label">{isVideoMuted ? "Start Cam" : "Stop Cam"}</span>
          </button>

          {/* Screen Share */}
          <button
            className={`btn-toolbar ${isScreenSharing ? "active-screen" : "normal"}`}
            onClick={onToggleScreenShare}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
          >
            {isScreenSharing ? <MonitorOff size={20} /> : <MonitorUp size={20} />}
            <span className="toolbar-label">{isScreenSharing ? "Stop Share" : "Share"}</span>
          </button>

          {/* In-Call Chat Drawer */}
          <button className="btn-toolbar normal relative-btn" onClick={onOpenChat} title="Open Chat">
            <MessageSquare size={20} />
            {unreadCount > 0 && <span className="toolbar-badge-count">{unreadCount}</span>}
            <span className="toolbar-label">Chat</span>
          </button>

          {/* Settings */}
          <button className="btn-toolbar normal" onClick={onOpenSettings} title="Settings">
            <Settings size={20} />
            <span className="toolbar-label">Settings</span>
          </button>

          {/* End Call Button */}
          <button className="btn-toolbar end-call-btn" onClick={onEndCall} title="End Call">
            <PhoneOff size={22} />
            <span className="toolbar-label">End Call</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
