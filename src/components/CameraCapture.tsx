import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const ERRORS: Record<string, string> = {
  NotAllowedError: "Accès refusé : autorisez la caméra via le cadenas de la barre d'adresse (HTTPS requis).",
  NotFoundError: "Aucune caméra détectée.",
  NotReadableError: "Caméra déjà utilisée par une autre application ou bloquée par le système.",
};

export function CameraCapture({ onCapture }: { onCapture: (f: File) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);
  useEffect(() => {
    if (video.current && stream) video.current.srcObject = stream;
  }, [stream]);

  async function start() {
    setError(null);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Caméra indisponible : ouvrez l'application en HTTPS. Utilisez l'import de fichier en secours.");
      return;
    }
    try {
      setStream(await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } }, audio: false }));
    } catch (e) {
      const n = e instanceof DOMException ? e.name : "";
      setError(ERRORS[n] ?? "Impossible d'activer la caméra. Utilisez l'import de fichier.");
    }
  }

  function stop() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }

  function snap() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => {
      if (!b) return;
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      onCapture(new File([b], `camera-${ts}.jpg`, { type: "image/jpeg" }));
      stop();
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="space-y-2">
      {!stream ? (
        <Button type="button" variant="secondary" className="w-full" onClick={start}>Activer la caméra</Button>
      ) : (
        <>
          <video ref={video} autoPlay playsInline muted className="w-full rounded-sm border border-border" />
          <div className="grid grid-cols-2 gap-1">
            <Button type="button" size="sm" onClick={snap}>Prendre la photo</Button>
            <Button type="button" size="sm" variant="secondary" onClick={stop}>Arrêter</Button>
          </div>
        </>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">Photo webcam/smartphone : éclairage et distance non contrôlés.</p>
    </div>
  );
}
