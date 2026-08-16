import React, { useState, useEffect } from "react";
import { X, Copy, Check, QrCode, Smartphone, Wifi, ShieldCheck, Share2, Sparkles } from "lucide-react";
import QRCode from "qrcode";

export function ShareModal({ isOpen, onClose, roomId }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [customHost, setCustomHost] = useState(() => {
    // If hostname is localhost or 127.0.0.1, we allow entering LAN IP
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? ""
      : window.location.hostname;
  });

  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  // Build the invite URL dynamically
  const getInviteUrl = () => {
    const protocol = window.location.protocol;
    const port = window.location.port ? `:${window.location.port}` : "";
    const host = customHost.trim() || window.location.hostname;
    return `${protocol}//${host}${port}/?room=${encodeURIComponent(roomId)}`;
  };

  const currentInviteUrl = getInviteUrl();

  useEffect(() => {
    if (!isOpen || !roomId) return;

    QRCode.toDataURL(currentInviteUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff"
      },
      errorCorrectionLevel: "M"
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.warn("QR code generation error:", err));
  }, [isOpen, roomId, customHost]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentInviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2200);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card share-modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge" style={{ background: "linear-gradient(135deg, #6366f1, #38bdf8)" }}>
              <Share2 size={20} className="text-white" />
            </div>
            <div>
              <h3>Share Call & Join from Phone</h3>
              <p className="modal-subtitle">Scan QR code or copy invite link to connect instantly</p>
            </div>
          </div>
          <button className="btn-icon-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body share-modal-body">
          {/* QR Code Section */}
          <div className="share-qr-container">
            <div className="qr-box-wrapper">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Room QR Code" className="qr-code-image" />
              ) : (
                <div className="qr-placeholder">
                  <QrCode size={48} className="text-indigo-400 animate-pulse" />
                </div>
              )}
              <div className="qr-scan-badge">
                <Smartphone size={14} />
                <span>Scan with Phone Camera</span>
              </div>
            </div>

            {/* Room Code Badge */}
            <div className="room-code-highlight-card">
              <span className="room-code-label">ROOM CODE</span>
              <div className="room-code-display">
                <code>{roomId}</code>
                <button className="btn-copy-code" onClick={handleCopyCode} title="Copy Code">
                  {copiedCode ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Localhost LAN IP helper */}
          {isLocalhost && (
            <div className="lan-helper-box">
              <div className="lan-helper-title">
                <Wifi size={15} className="text-indigo-400" />
                <span>Connecting from Phone on Local WiFi?</span>
              </div>
              <p className="lan-helper-desc">
                Your phone cannot resolve <code>localhost</code>. Enter your PC's local Wi-Fi IP address (e.g. <code>192.168.1.5</code>) to update the QR code:
              </p>
              <div className="lan-input-group">
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.5"
                  value={customHost}
                  onChange={e => setCustomHost(e.target.value)}
                  className="styled-input lan-input"
                />
                {customHost && (
                  <button className="btn-clear-host" onClick={() => setCustomHost("")}>
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Full Link Copy Box */}
          <div className="share-link-group">
            <label>Full Invite Link</label>
            <div className="share-input-row">
              <input
                type="text"
                readOnly
                value={currentInviteUrl}
                className="styled-input share-url-input"
              />
              <button className="btn-primary copy-link-btn" onClick={handleCopyLink}>
                {copiedLink ? (
                  <>
                    <Check size={16} /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={16} /> Copy Link
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Mobile Tips */}
          <div className="share-security-tip">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            <span>
              FlareCall uses end-to-end encrypted WebRTC P2P streams. Microphone and Camera permissions are requested on join.
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary" onClick={handleCopyLink}>
            {copiedLink ? "Link Copied!" : "Copy Invite Link"}
          </button>
        </div>
      </div>
    </div>
  );
}
