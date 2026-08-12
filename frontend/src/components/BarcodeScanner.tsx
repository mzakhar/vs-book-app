import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, Keyboard, X } from 'lucide-react';
import { isBookEan } from '../lib/isbn';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

interface Props {
  onScan: (ean: string) => void;
  onClose?: () => void;
}

// Suppress repeat emits of the same barcode while it's still in frame.
const DEDUPE_WINDOW_MS = 3000;
// ~5 decodes/sec — every frame pegs the CPU for no accuracy gain.
const DECODE_INTERVAL_MS = 200;

type ScanError = 'insecure' | 'denied' | 'no-camera' | 'other' | null;

let zxingReady: Promise<typeof import('zxing-wasm/reader')> | null = null;
function loadZxing() {
  if (!zxingReady) {
    zxingReady = import('zxing-wasm/reader').then(mod => {
      mod.prepareZXingModule({
        overrides: { locateFile: (path: string) => (path.endsWith('.wasm') ? wasmUrl : path) },
      });
      return mod;
    });
  }
  return zxingReady;
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDecodeAtRef = useRef(0);
  const seenRef = useRef<Map<string, number>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Set synchronously before the first await in start(), so a double-tap cannot open a
  // second getUserMedia and orphan the first stream (leaves the iPad camera light on).
  // `active` is state and would still read false on both taps in the same tick.
  const startingRef = useRef(false);

  const [active, setActive] = useState(false);
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<ScanError>(null);
  const [manualIsbn, setManualIsbn] = useState('');

  const stop = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  useEffect(() => stop, []);

  const beep = () => {
    const ctx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  };

  const accept = (ean: string) => {
    const now = Date.now();
    const lastSeen = seenRef.current.get(ean);
    if (lastSeen && now - lastSeen < DEDUPE_WINDOW_MS) return;
    seenRef.current.set(ean, now);
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    beep();
    onScan(ean);
  };

  const decodeLoop = async (readBarcodes: typeof import('zxing-wasm/reader').readBarcodes) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(() => decodeLoop(readBarcodes));
      return;
    }
    const now = performance.now();
    if (now - lastDecodeAtRef.current >= DECODE_INTERVAL_MS) {
      lastDecodeAtRef.current = now;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        try {
          const results = await readBarcodes(imageData, { formats: ['EAN-13', 'UPC-A'] });
          for (const r of results) {
            if (isBookEan(r.text)) {
              accept(r.text);
              break;
            }
          }
        } catch {
          // decode failure on a single frame — try again next tick
        }
      }
    }
    rafRef.current = requestAnimationFrame(() => decodeLoop(readBarcodes));
  };

  const start = async () => {
    if (startingRef.current || streamRef.current) return;
    startingRef.current = true;
    setError(null);
    if (!window.isSecureContext) {
      setError('insecure');
      startingRef.current = false;
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      const { readBarcodes } = await loadZxing();
      rafRef.current = requestAnimationFrame(() => decodeLoop(readBarcodes));
    } catch (err: any) {
      stop();
      if (err?.name === 'NotAllowedError') setError('denied');
      else if (err?.name === 'NotFoundError') setError('no-camera');
      else setError('other');
    } finally {
      startingRef.current = false;
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isbn = manualIsbn.trim();
    if (!isbn) return;
    onScan(isbn);
    setManualIsbn('');
  };

  const handleClose = () => {
    stop();
    onClose?.();
  };

  return (
    <div className="barcode-scanner">
      <div className="barcode-scanner__viewfinder">
        {active ? (
          <>
            <video ref={videoRef} playsInline muted className="barcode-scanner__video" />
            <div className={`barcode-scanner__flash${flash ? ' barcode-scanner__flash--active' : ''}`} />
            <div className="barcode-scanner__frame" />
          </>
        ) : (
          <div className="barcode-scanner__placeholder">
            <Camera size={32} />
            <button type="button" className="btn btn--primary" onClick={start}>
              Start camera
            </button>
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {onClose && (
          <button type="button" className="barcode-scanner__close" onClick={handleClose} title="Close scanner">
            <X size={16} />
          </button>
        )}
      </div>

      {error && (
        <div className="barcode-scanner__error">
          <AlertTriangle size={16} />
          {error === 'insecure' && (
            <span>
              Camera scanning needs HTTPS. The LAN address won't work — use{' '}
              <strong>https://books.zakharhome.org/books/</strong> instead.
            </span>
          )}
          {error === 'denied' && (
            <span>
              Camera permission was denied. Re-enable it in Settings → Safari → Camera on iPad.
            </span>
          )}
          {error === 'no-camera' && <span>No camera was found on this device.</span>}
          {error === 'other' && <span>Could not start the camera. Try again or enter the ISBN below.</span>}
        </div>
      )}

      <form className="barcode-scanner__manual" onSubmit={handleManualSubmit}>
        <label className="form-label">
          <Keyboard size={14} /> Enter ISBN manually
        </label>
        <div className="barcode-scanner__manual-row">
          <input
            className="form-input"
            value={manualIsbn}
            onChange={e => setManualIsbn(e.target.value)}
            placeholder="978…"
            inputMode="numeric"
          />
          <button type="submit" className="btn btn--secondary" disabled={!manualIsbn.trim()}>
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
