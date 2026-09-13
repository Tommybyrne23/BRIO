"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(() => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true));
  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  if (standalone) return <span className="badge live">Installed</span>;
  return <div className="card"><span className="eyebrow">Install Brio</span><h2 className="section-title">Keep the workspace on your home screen.</h2><p className="muted">On iPhone or iPad, open Share in Safari and choose Add to Home Screen. On supported desktop and Android browsers, use the install button.</p>{prompt ? <button className="button" onClick={async () => { await prompt.prompt(); const result = await prompt.userChoice; if (result.outcome === "accepted") setStandalone(true); setPrompt(null); }}>Install app</button> : <p className="form-hint">The browser install prompt is not currently available. You can still use the browser menu.</p>}</div>;
}
