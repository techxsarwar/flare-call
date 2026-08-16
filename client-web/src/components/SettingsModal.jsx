import React, { useState, useEffect } from "react";
import { X, Mic, Video, Volume2, ShieldCheck, Zap } from "lucide-react";

export function SettingsModal({ isOpen, onClose, currentSettings, onSaveSettings }) {
  const [audioInputs, setAudioInputs] = useState([]);
  const [videoInputs, setVideoInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);

  const [selectedAudioInput, setSelectedAudioInput] = useState(currentSettings.audioDeviceId || "");
  const [selectedVideoInput, setSelectedVideoInput] = useState(currentSettings.videoDeviceId || "");
  const [selectedAudioOutput, setSelectedAudioOutput] = useState(currentSettings.audioOutputDeviceId || "");
  const [resolution, setResolution] = useState(currentSettings.resolution || "720p");
  const [noiseSuppression, setNoiseSuppression] = useState(currentSettings.noiseSuppression ?? true);

  useEffect(() => {
    if (!isOpen) return;

    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter(d => d.kind === "audioinput"));
        setVideoInputs(devices.filter(d => d.kind === "videoinput"));
        setAudioOutputs(devices.filter(d => d.kind === "audiooutput"));
      } catch (err) {
        console.warn("Could not enumerate media devices:", err);
      }
    }

    getDevices();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings({
      audioDeviceId: selectedAudioInput,
      videoDeviceId: selectedVideoInput,
      audioOutputDeviceId: selectedAudioOutput,
      resolution,
      noiseSuppression
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Zap size={20} className="text-indigo-400" />
            </div>
            <h3>Device & Audio/Video Settings</h3>
          </div>
          <button className="btn-icon-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Microphone Selector */}
          <div className="form-group">
            <label>
              <Mic size={16} /> Microphone
            </label>
            <select
              value={selectedAudioInput}
              onChange={e => setSelectedAudioInput(e.target.value)}
              className="styled-select"
            >
              {audioInputs.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.substring(0, 5)}`}
                </option>
              ))}
            </select>
          </div>

          {/* Camera Selector */}
          <div className="form-group">
            <label>
              <Video size={16} /> Camera
            </label>
            <select
              value={selectedVideoInput}
              onChange={e => setSelectedVideoInput(e.target.value)}
              className="styled-select"
            >
              {videoInputs.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.substring(0, 5)}`}
                </option>
              ))}
            </select>
          </div>

          {/* Speaker Selector */}
          {audioOutputs.length > 0 && (
            <div className="form-group">
              <label>
                <Volume2 size={16} /> Speaker Output
              </label>
              <select
                value={selectedAudioOutput}
                onChange={e => setSelectedAudioOutput(e.target.value)}
                className="styled-select"
              >
                {audioOutputs.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Speaker ${device.deviceId.substring(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Resolution Selector */}
          <div className="form-group">
            <label>
              <ShieldCheck size={16} /> Video Quality / Resolution
            </label>
            <div className="radio-pill-group">
              {["360p", "720p (HD)", "1080p (FHD)"].map(opt => (
                <button
                  key={opt}
                  type="button"
                  className={`radio-pill ${resolution === opt ? "active" : ""}`}
                  onClick={() => setResolution(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
