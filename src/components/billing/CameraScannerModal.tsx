import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Product } from '../../types';
import { playScannerBeep } from '../../lib/barcodeUtils';
import { Camera, X, CheckCircle, AlertCircle, Zap, Volume2, VolumeX, FlipHorizontal, Sparkles } from 'lucide-react';

interface CameraScannerModalProps {
  products?: Product[];
  onBarcodeDetected: (barcode: string) => { success: boolean; message: string; product?: Product };
  onClose: () => void;
  title?: string;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  products = [],
  onBarcodeDetected,
  onClose,
  title = 'Camera Barcode Scanner',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [recentScan, setRecentScan] = useState<{ text: string; success: boolean; productName?: string } | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [scanFlash, setScanFlash] = useState<boolean>(false);
  const [usingNativeDetector, setUsingNativeDetector] = useState<boolean>(false);

  // Throttling refs to prevent stale closure bugs
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedBarcodeRef = useRef<string>('');
  const isMutedRef = useRef<boolean>(isMuted);
  isMutedRef.current = isMuted;

  // Process detected barcode with sound and feedback
  const handleDetect = useCallback((rawBarcode: string) => {
    const code = rawBarcode.trim();
    if (!code) return;

    const now = Date.now();
    const timeSinceLast = now - lastScannedTimeRef.current;
    const isSameBarcode = lastScannedBarcodeRef.current === code;

    // Throttle identical barcode scans by 1.5s, different barcode by 600ms
    if (isSameBarcode && timeSinceLast < 1500) {
      return;
    }
    if (!isSameBarcode && timeSinceLast < 600) {
      return;
    }

    lastScannedTimeRef.current = now;
    lastScannedBarcodeRef.current = code;

    // Trigger visual green laser flash
    setScanFlash(true);
    setTimeout(() => setScanFlash(false), 500);

    const outcome = onBarcodeDetected(code);

    if (!isMutedRef.current) {
      playScannerBeep(outcome.success ? 'success' : 'error');
    }

    setRecentScan({
      text: code,
      success: outcome.success,
      productName: outcome.product?.name,
    });
  }, [onBarcodeDetected]);

  // Toggle Camera Flashlight (Torch)
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        const nextState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      }
    } catch {
      // Torch not supported on this device
    }
  };

  // Main Camera Initialization
  useEffect(() => {
    let active = true;

    const stopActiveStreams = () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    const startScanner = async () => {
      try {
        setErrorMessage(null);
        stopActiveStreams();

        // 1. Enumerate available video input devices
        const devices = await BrowserMultiFormatReader.listVideoInputDevices().catch(() => []);
        if (!active) return;
        setVideoDevices(devices);

        // Prefer rear/environment facing camera
        let deviceId = selectedDeviceId;
        if (!deviceId && devices.length > 0) {
          const rearCam = devices.find((d) => {
            const label = d.label.toLowerCase();
            return label.includes('back') || label.includes('rear') || label.includes('environment');
          });
          deviceId = rearCam ? rearCam.deviceId : devices[0].deviceId;
          setSelectedDeviceId(deviceId);
        }

        // 2. Try High-Resolution Stream
        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            facingMode: deviceId ? undefined : { ideal: 'environment' },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // Check torch support
        const track = stream.getVideoTracks()[0];
        if (track && (track as any).getCapabilities) {
          const caps = (track as any).getCapabilities();
          setHasTorch(Boolean(caps?.torch));
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // 3. Try Native Hardware-Accelerated BarcodeDetector (Chrome / Edge / Android)
        const hasNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
        if (hasNativeDetector) {
          try {
            const BarcodeDetectorClass = (window as any).BarcodeDetector;
            const formats = [
              'ean_13',
              'ean_8',
              'upc_a',
              'upc_e',
              'code_128',
              'code_39',
              'code_93',
              'itf',
              'qr_code',
              'data_matrix',
            ];
            const detector = new BarcodeDetectorClass({ formats });
            setUsingNativeDetector(true);
            setHasPermission(true);

            // High-FPS Native scan loop
            const scanLoop = async () => {
              if (!active || !videoRef.current) return;
              if (videoRef.current.readyState >= 2) {
                try {
                  const barcodes = await detector.detect(videoRef.current);
                  if (barcodes && barcodes.length > 0 && active) {
                    const rawVal = barcodes[0].rawValue;
                    if (rawVal) {
                      handleDetect(rawVal);
                    }
                  }
                } catch {
                  // Frame decode failed, continue loop smoothly
                }
              }
              animFrameRef.current = requestAnimationFrame(scanLoop);
            };

            animFrameRef.current = requestAnimationFrame(scanLoop);
            return;
          } catch {
            // Fall back to ZXing if native detector fails
          }
        }

        // 4. Fallback: ZXing MultiFormatReader with optimized hints
        setUsingNativeDetector(false);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const codeReader = new BrowserMultiFormatReader(hints);

        if (videoRef.current) {
          const controls = await codeReader.decodeFromVideoDevice(
            deviceId || undefined,
            videoRef.current,
            (result, error) => {
              if (result && active) {
                handleDetect(result.getText());
              }
              // Ignore non-fatal frame NotFoundException silently
            }
          );

          if (active) {
            controlsRef.current = controls;
            setHasPermission(true);
          } else {
            controls.stop();
          }
        }
      } catch (err: any) {
        if (!active) return;
        setHasPermission(false);
        setErrorMessage(
          err.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access in browser permissions.'
            : err.message || 'Unable to access camera. Please check your camera settings.'
        );
      }
    };

    startScanner();

    return () => {
      active = false;
      stopActiveStreams();
    };
  }, [selectedDeviceId, handleDetect]);

  // Simulation test click handler
  const handleSimulateScan = (barcode: string) => {
    handleDetect(barcode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-xl border border-neutral-200 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3 bg-neutral-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Camera className="w-4 h-4 text-emerald-400" />
              {usingNativeDetector && (
                <Sparkles className="w-2.5 h-2.5 text-amber-300 absolute -top-1 -right-1" />
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold leading-none">{title}</h3>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                {usingNativeDetector ? '⚡ Ultra-fast Hardware Scanner' : 'Point camera at product barcode'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`p-1.5 rounded transition-colors ${
                  torchOn ? 'bg-amber-400 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
                }`}
                title={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
              >
                <Zap className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 text-neutral-400 hover:text-white rounded transition-colors"
              title={isMuted ? 'Unmute scanner beep' : 'Mute scanner beep'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded transition-colors"
              title="Close scanner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewfinder Video Area */}
        <div className="relative bg-neutral-950 aspect-4/3 sm:aspect-16/10 flex items-center justify-center overflow-hidden select-none">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />

          {/* Scanner Target Box with Corner Reticles */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
            <div
              className={`relative w-64 h-36 border-2 rounded-lg transition-all duration-200 ${
                scanFlash
                  ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_24px_rgba(16,185,129,0.7)]'
                  : 'border-emerald-500/80 shadow-lg'
              }`}
            >
              {/* Corner Indicators */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-emerald-400" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-emerald-400" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-emerald-400" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-emerald-400" />

              {/* Animated Laser Scanning Line */}
              <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse" />
            </div>
          </div>

          {/* Flash Feedback Banner */}
          {scanFlash && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-full shadow-lg flex items-center gap-1.5 animate-in fade-in zoom-in-90 duration-100">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Barcode Scanned!</span>
            </div>
          )}

          {/* Camera Access Unavailable State */}
          {hasPermission === false && (
            <div className="absolute inset-0 bg-neutral-900/90 p-6 flex flex-col items-center justify-center text-center text-white space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <div>
                <p className="text-xs font-semibold">Camera Access Unavailable</p>
                <p className="text-[11px] text-neutral-400 mt-1 max-w-xs">{errorMessage}</p>
              </div>
              <p className="text-[10px] text-neutral-500">
                You can use a USB barcode scanner, or type into the barcode field.
              </p>
            </div>
          )}
        </div>

        {/* Live Feedback Bar */}
        <div className="p-3 bg-neutral-50 border-t border-neutral-200 shrink-0">
          {recentScan ? (
            <div
              className={`p-2 rounded text-xs flex items-center justify-between ${
                recentScan.success
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {recentScan.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <div className="truncate">
                  {recentScan.success ? (
                    <span>
                      Added: <strong className="font-semibold">{recentScan.productName}</strong>
                    </span>
                  ) : (
                    <span>
                      Scanned: <strong className="font-mono">{recentScan.text}</strong> (No match)
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-mono text-neutral-500 shrink-0 ml-2">Just now</span>
            </div>
          ) : (
            <div className="text-xs text-neutral-500 flex items-center justify-between">
              <span>Align barcode within the target box</span>
              <span className="text-[10px] font-mono text-emerald-700 font-medium">Ready</span>
            </div>
          )}
        </div>

        {/* Controls Bar & Quick Simulator */}
        <div className="p-3 bg-white border-t border-neutral-100 space-y-2.5">
          {videoDevices.length > 1 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 text-[11px] flex items-center gap-1">
                <FlipHorizontal className="w-3.5 h-3.5" />
                Switch Camera:
              </span>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="px-2 py-1 bg-neutral-50 border border-neutral-200 rounded text-xs text-neutral-800 focus:outline-none"
              >
                {videoDevices.map((d, idx) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {products.length > 0 && (
            <div>
              <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-1">
                Quick Barcode Tester (Click to test):
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {products.slice(0, 5).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSimulateScan(p.barcode)}
                    className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 rounded text-[11px] font-medium text-neutral-800 whitespace-nowrap transition-colors border border-neutral-200"
                    title={`Simulate scan for ${p.name}`}
                  >
                    {p.name.split(' ')[0]} ({p.barcode.slice(-4)})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
            <span className="text-[11px] text-neutral-500">
              Scanned items automatically add to your active cart
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded hover:bg-neutral-800 transition-colors shadow-xs"
            >
              Done Scanning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
