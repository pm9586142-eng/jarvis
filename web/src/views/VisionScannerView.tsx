import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CameraOff,
  Loader2,
  ScanEye,
  Upload,
} from 'lucide-react';
import { analyzeVisionImage } from '../services/api';
import { ConnectionState } from '../types/jarvis';

interface VisionScannerViewProps {
  connectionState: ConnectionState;
}

export const VisionScannerView: React.FC<VisionScannerViewProps> = ({ connectionState }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [capturedMimeType, setCapturedMimeType] = useState<string>('image/jpeg');
  const [prompt, setPrompt] = useState(
    'Analyze this image as JARVIS optical reconnaissance. Identify key objects, extract any visible text (OCR), and summarize notable details.'
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setVisionError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setVisionError('Camera API is not supported or requires HTTPS in this browser. Use Image Upload instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCapturedDataUrl(null);
      setCameraActive(true);
    } catch (err) {
      setVisionError(
        err instanceof Error
          ? `Unable to access camera: ${err.message}. You can upload an image file below instead.`
          : 'Camera permission denied. Upload an image file below instead.'
      );
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setVisionError('Video feed not ready yet.');
      return;
    }
    const canvas = document.createElement('canvas');
    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedDataUrl(dataUrl);
    setCapturedMimeType('image/jpeg');
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVisionError(null);
    setAnalysisResult(null);
    stopCamera();

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCapturedDataUrl(reader.result);
        setCapturedMimeType(file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
  };

  const runGeminiVision = async () => {
    if (!capturedDataUrl) {
      setVisionError('Capture a camera frame or upload an image first.');
      return;
    }
    setVisionError(null);
    setIsAnalyzing(true);
    try {
      const res = await analyzeVisionImage(capturedDataUrl, capturedMimeType, prompt.trim());
      setAnalysisResult(res.analysis);
    } catch (err) {
      setVisionError(
        err instanceof Error ? err.message : 'Failed to analyze image with Gemini Vision.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-mono-hud text-xs font-bold text-sky-300 tracking-wider">
              OPTICAL RECONNAISSANCE & GEMINI VISION
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Start your browser webcam on demand or upload any image for real Gemini multimodal object & OCR analysis.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={cameraActive ? stopCamera : startCamera}
              className={`px-3.5 py-2 rounded-xl font-mono-hud text-xs font-semibold flex items-center gap-2 cursor-pointer border ${
                cameraActive
                  ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                  : 'bg-[#0D1527] border-cyan-400/50 text-cyan-200 hover:border-cyan-300'
              }`}
            >
              {cameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              <span>{cameraActive ? 'STOP CAMERA' : 'START WEBCAM'}</span>
            </button>

            <label className="px-3.5 py-2 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-sky-400 font-mono-hud text-xs text-slate-200 flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4 text-sky-300" />
              <span>UPLOAD IMAGE</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Viewport / Preview */}
        <div className="relative rounded-2xl bg-[#040812] border border-slate-800 overflow-hidden min-h-[260px] flex items-center justify-center">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`w-full max-h-[380px] object-contain ${cameraActive ? 'block' : 'hidden'}`}
          />

          {!cameraActive && capturedDataUrl && (
            <img
              src={capturedDataUrl}
              alt="Captured visual target"
              className="w-full max-h-[380px] object-contain"
            />
          )}

          {!cameraActive && !capturedDataUrl && (
            <div className="p-8 text-center space-y-2">
              <ScanEye className="w-10 h-10 text-cyan-400/60 mx-auto" />
              <p className="text-sm text-slate-300">Optical Scanner Standby</p>
              <p className="font-mono-hud text-xs text-slate-500">
                Click START WEBCAM or UPLOAD IMAGE to acquire target frame
              </p>
            </div>
          )}

          {cameraActive && (
            <button
              type="button"
              onClick={captureFrame}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-display text-xs font-bold tracking-wider cursor-pointer shadow-lg"
            >
              CAPTURE FRAME
            </button>
          )}
        </div>

        {/* Analysis Prompt + Trigger */}
        <div className="space-y-3">
          <textarea
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            aria-label="Vision analysis prompt"
            className="w-full bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl p-3 text-sm text-slate-100 focus:outline-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono-hud text-[11px] text-slate-400">
              Backend Vision Status:{' '}
              <span className={connectionState === 'online' ? 'text-emerald-400' : 'text-amber-300'}>
                {connectionState === 'online'
                  ? 'READY'
                  : connectionState === 'key_missing'
                    ? 'GEMINI_API_KEY REQUIRED ON SERVER'
                    : 'CHECK SERVER'}
              </span>
            </span>

            <button
              type="button"
              disabled={!capturedDataUrl || isAnalyzing}
              onClick={runGeminiVision}
              className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-[#02040A] font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer"
            >
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanEye className="w-4 h-4" />}
              <span>{isAnalyzing ? 'ANALYZING...' : 'ANALYZE WITH GEMINI VISION'}</span>
            </button>
          </div>
        </div>

        {visionError && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-4 py-3 flex items-center gap-2 text-xs text-rose-200 font-mono-hud">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{visionError}</span>
          </div>
        )}

        {analysisResult && (
          <div className="rounded-xl bg-[#040812] border border-cyan-500/40 p-4 space-y-2">
            <p className="font-mono-hud text-xs font-bold text-cyan-300">
              OPTICAL RECONNAISSANCE REPORT
            </p>
            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{analysisResult}</p>
          </div>
        )}
      </div>
    </div>
  );
};
