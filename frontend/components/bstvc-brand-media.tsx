"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Autoplay the original logo; keep the poster visible while it loads. */
export function BstvcBrandMedia() {
  const [playing, setPlaying] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [slow, setSlow] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  const checkLoadedFrame = useCallback(() => {
    try {
      const currentFrame = frame.current;
      if (!currentFrame) return;
      const document = currentFrame.contentDocument;
      if (!document) {
        setPlaying(false);
        setFailed(true);
        return;
      }
      if (document.readyState !== "complete" || document.URL === "about:blank") return;
      if (document.getElementById("bstvc-logo")) {
        setReady(true);
      } else {
        setPlaying(false);
        setFailed(true);
      }
    } catch {
      setPlaying(false);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    const onReady = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "bstvc-motion-ready") setReady(true);
    };
    window.addEventListener("message", onReady);
    // A cached SSR iframe can finish before React installs the message listener.
    checkLoadedFrame();
    return () => window.removeEventListener("message", onReady);
  }, [playing, checkLoadedFrame]);

  useEffect(() => {
    if (!playing || ready) return;
    const timeout = window.setTimeout(() => {
      // Slow connections must keep downloading the original animation.
      setSlow(true);
    }, 30000);
    return () => window.clearTimeout(timeout);
  }, [playing, ready]);

  function togglePlayback() {
    setReady(false);
    setFailed(false);
    setSlow(false);
    setPlaying((current) => !current);
  }

  return (
    <div className="bstvc-brand-media">
      <div className="bstvc-brand-stage">
        <img
          className="bstvc-brand-poster"
          src="/design/bstvc-logo-poster.webp"
          width={860}
          height={860}
          alt="BSTVC logo: a multicolored beta ribbon around a blue sphere"
          decoding="async"
          fetchPriority="high"
          hidden={playing && ready}
        />
        {playing ? <iframe
          ref={frame}
          className="bstvc-motion-logo"
          src="/bstvc-logo-motion.html?motion=force&v=52"
          title="Animated BSTVC logo"
          loading="eager"
          tabIndex={-1}
          style={{ visibility: ready ? "visible" : "hidden" }}
          onLoad={checkLoadedFrame}
          onError={() => { setPlaying(false); setFailed(true); }}
        /> : null}
      </div>
      <button className="bstvc-brand-toggle" type="button" aria-pressed={playing} onClick={togglePlayback}>
        {playing ? "Stop logo animation" : "Play logo animation"}
      </button>
      <span className="bstvc-brand-status" role="status">
        {failed ? "Animation unavailable. The static logo is shown." : playing && !ready ? slow ? "Animation is taking longer to load…" : "Loading animation…" : ""}
      </span>
    </div>
  );
}
