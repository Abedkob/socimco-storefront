"use client";

import { Camera, CameraOff, ScanLine, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { btn, Spinner } from "@/core/ui";
import { codeFromScan, QR_PATHS, type QrPath } from "./qr-link";

/**
 * The phone's in-app scanner for QR sign-in (Account → Approve a computer).
 * Uses the browser's built-in BarcodeDetector where it exists (Chrome on Android) and the small jsQR decoder
 * elsewhere (Safari on iPhone). The camera needs HTTPS (or localhost) and the user's permission.
 */

type State = "idle" | "starting" | "scanning" | "denied" | "unavailable";

type Detect = (video: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<string | null>;

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorCtor = (new (opts: { formats: string[] }) => BarcodeDetectorLike) & { getSupportedFormats?: () => Promise<string[]> };

async function createDetector(): Promise<Detect> {
  const Native = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (Native) {
    try {
      const formats = (await Native.getSupportedFormats?.()) ?? ["qr_code"];
      if (formats.includes("qr_code")) {
        const detector = new Native({ formats: ["qr_code"] });
        return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
      }
    } catch {
      // Fall through to jsQR.
    }
  }
  const { default: jsQR } = await import("jsqr");
  return async (video, canvas) => {
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

export function QrScanner({
  onCode,
  accept = QR_PATHS.approveComputer,
  title = "Scan the code on your computer",
  intro = "On the computer, open the SOCIMCO sign-in page. Then scan the code next to the password form with this phone.",
  wrongCode = "That isn't a SOCIMCO sign-in code. Point at the code on the sign-in page.",
}: {
  onCode: (code: string) => void;
  /** Which kind of SOCIMCO link this scanner is for; anything else shows `wrongCode`. */
  accept?: QrPath;
  title?: string;
  intro?: string;
  wrongCode?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [sawWrongCode, setSawWrongCode] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  const stop = () => {
    runningRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // Always release the camera when leaving the screen.
  useEffect(() => stop, []);

  const start = async () => {
    setSawWrongCode(false);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }
    setState("starting");
    try {
      const [stream, detect] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }),
        createDetector(),
      ]);
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return stop();
      video.srcObject = stream;
      await video.play();
      setState("scanning");
      runningRef.current = true;
      canvasRef.current ??= document.createElement("canvas");

      const tick = async () => {
        if (!runningRef.current) return;
        const text = video.readyState >= 2 ? await detect(video, canvasRef.current!).catch(() => null) : null;
        if (!runningRef.current) return;
        if (text) {
          const code = codeFromScan(text, window.location.origin, accept);
          if (code) {
            stop();
            navigator.vibrate?.(60);
            onCode(code);
            return;
          }
          setSawWrongCode(true);
        }
        timerRef.current = setTimeout(tick, 200);
      };
      void tick();
    } catch (e) {
      stop();
      const name = e instanceof DOMException ? e.name : "";
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
    }
  };

  const cancel = () => {
    stop();
    setSawWrongCode(false);
    setState("idle");
  };

  const live = state === "starting" || state === "scanning";

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="display mt-8 text-[34px] leading-[1.05]">{title}</h1>
      <p className="mt-2 text-ink-3">{intro}</p>

      <div className="relative mt-6 aspect-square w-full overflow-hidden rounded-[28px] bg-dark text-on-dark">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-hidden
          className={`absolute inset-0 size-full object-cover ${state === "scanning" ? "opacity-100" : "opacity-0"}`}
        />

        {live && (
          <div className="pointer-events-none absolute inset-[14%]" aria-hidden>
            {["left-0 top-0 border-l-4 border-t-4 rounded-tl-[18px]", "right-0 top-0 border-r-4 border-t-4 rounded-tr-[18px]", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-[18px]", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-[18px]"].map((c) => (
              <span key={c} className={`absolute size-10 border-accent ${c}`} />
            ))}
            {state === "scanning" && <span className="scan-line absolute inset-x-3 h-0.5 rounded-full bg-accent shadow-[0_0_12px_2px] shadow-accent/60" />}
          </div>
        )}

        {!live && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-white/10">
              {state === "denied" || state === "unavailable" ? <CameraOff size={28} aria-hidden /> : <ScanLine size={28} aria-hidden />}
            </span>
            <p className="max-w-[260px] text-sm text-on-dark-2">
              {state === "denied"
                ? "Camera access is blocked. Allow the camera for this site in your browser settings, then try again."
                : state === "unavailable"
                  ? "This browser can't open the camera here. Use your phone's camera app instead (below)."
                  : "Your camera opens here. Nothing is recorded or uploaded."}
            </p>
          </div>
        )}

        {state === "starting" && (
          <div className="absolute inset-0 grid place-items-center" aria-busy="true">
            <Spinner />
            <span className="sr-only">Opening the camera…</span>
          </div>
        )}
      </div>

      <p className="mt-3 min-h-6 text-center text-sm" aria-live="polite">
        {state === "scanning" && (sawWrongCode ? <span className="font-medium text-danger">{wrongCode}</span> : <span className="text-ink-3">Point the camera at the code. It scans by itself.</span>)}
      </p>

      <div className="mt-auto space-y-2.5 pt-6">
        {live ? (
          <button type="button" onClick={cancel} className={btn("outline", "lg", "w-full")}>
            <X size={18} aria-hidden /> Stop camera
          </button>
        ) : (
          <button type="button" onClick={() => void start()} className={btn("primary", "lg", "w-full")}>
            <Camera size={18} aria-hidden /> {state === "idle" ? "Open camera" : "Try again"}
          </button>
        )}
        <p className="text-center text-xs leading-relaxed text-ink-3">No camera here? Point your phone&apos;s camera app at the code and open the link it shows.</p>
      </div>
    </div>
  );
}
