"use client";

import { useEffect } from "react";
import EmblaCarousel, { type EmblaCarouselType } from "embla-carousel";

function updateStatus(gallery: HTMLElement, api?: EmblaCarouselType) {
  const status = gallery.querySelector<HTMLElement>("[data-gallery-status]");
  const track = gallery.querySelector<HTMLElement>(".content-gallery-track");
  if (!status || !track) return;
  const total = api?.scrollSnapList().length ?? track.querySelectorAll("figure").length;
  const current = api ? api.selectedScrollSnap() : 0;
  const text = `${Math.min(total, current + 1)} / ${total}`;
  if (status.textContent !== text) status.textContent = text;
}

export function ContentGalleryController() {
  useEffect(() => {
    const apis = new Map<HTMLElement, EmblaCarouselType>();
    const autoplayTimers = new Map<HTMLElement, number>();
    const signatures = new Map<HTMLElement, string>();
    let discoveryFrame = 0;

    const stopAutoplay = (gallery: HTMLElement) => {
      const timer = autoplayTimers.get(gallery);
      if (timer) window.clearInterval(timer);
      autoplayTimers.delete(gallery);
    };

    const startAutoplay = (gallery: HTMLElement) => {
      stopAutoplay(gallery);
      const api = apis.get(gallery);
      if (!api || gallery.dataset.galleryAutoplay !== "true" || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const seconds = Math.max(3, Math.min(15, Number(gallery.dataset.galleryInterval) || 5));
      autoplayTimers.set(gallery, window.setInterval(() => {
        if (!document.hidden) api.scrollNext();
      }, seconds * 1000));
    };

    const destroy = (gallery: HTMLElement) => {
      stopAutoplay(gallery);
      apis.get(gallery)?.destroy();
      apis.delete(gallery);
      signatures.delete(gallery);
      gallery.querySelector(".content-gallery-track")?.classList.remove("is-embla");
    };

    const enhance = (gallery: HTMLElement) => {
      const track = gallery.querySelector<HTMLElement>(".content-gallery-track");
      const isCarousel = gallery.dataset.galleryLayout !== "grid" && !gallery.classList.contains("content-gallery-grid");
      // ProseMirror owns NodeView children. Keep its native scroll fallback and
      // only let Embla mutate rendered preview/public HTML.
      if (!track || !isCarousel || Boolean(gallery.closest(".studio-tiptap-experiment"))) {
        destroy(gallery);
        return;
      }
      if (!track.querySelector(":scope > .content-gallery-embla-container")) {
        const container = document.createElement("div");
        container.className = "content-gallery-embla-container";
        [...track.children].filter((child) => child.matches("figure")).forEach((figure) => container.append(figure));
        track.append(container);
      }
      let existing = apis.get(gallery);
      if (existing && existing.rootNode() !== track) {
        destroy(gallery);
        existing = undefined;
      }
      const signature = `${gallery.dataset.galleryAutoplay}:${gallery.dataset.galleryInterval}:${gallery.dataset.galleryFrame}:${gallery.dataset.gallerySize}:${track.querySelectorAll("figure").length}`;
      // Ignore our own status updates and unrelated Studio mutations. Rebuilding
      // here used to reset the timer continuously and keep the editor busy.
      if (existing && signatures.get(gallery) === signature) return;
      signatures.set(gallery, signature);
      if (existing) {
        existing.reInit({ loop: true, align: "start", containScroll: "trimSnaps" });
        updateStatus(gallery, existing);
        startAutoplay(gallery);
        return;
      }
      try {
        track.classList.add("is-embla");
        const api = EmblaCarousel(track, { loop: true, align: "start", containScroll: "trimSnaps" });
        const sync = () => updateStatus(gallery, api);
        api.on("select", sync);
        api.on("reInit", sync);
        apis.set(gallery, api);
        sync();
        startAutoplay(gallery);
      } catch {
        track.classList.remove("is-embla");
        updateStatus(gallery);
      }
    };

    const discover = () => {
      document.querySelectorAll<HTMLElement>("[data-gallery]").forEach(enhance);
      [...apis.keys()].filter((gallery) => !gallery.isConnected).forEach(destroy);
    };

    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-gallery-prev],[data-gallery-next],[data-gallery-fullscreen]") : null;
      const gallery = button?.closest<HTMLElement>("[data-gallery]");
      if (!button || !gallery) return;
      if (button.hasAttribute("data-gallery-fullscreen")) {
        if (document.fullscreenElement === gallery) void document.exitFullscreen();
        else void gallery.requestFullscreen?.();
        return;
      }
      const api = apis.get(gallery);
      if (api) {
        if (button.hasAttribute("data-gallery-next")) api.scrollNext();
        else api.scrollPrev();
      }
    };

    const onVisibility = () => apis.forEach((_api, gallery) => startAutoplay(gallery));
    const observer = new MutationObserver(() => {
      if (!discoveryFrame) discoveryFrame = window.requestAnimationFrame(() => { discoveryFrame = 0; discover(); });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-gallery-layout", "data-gallery-autoplay", "data-gallery-interval", "data-gallery-frame", "data-gallery-size"] });
    document.addEventListener("click", onClick);
    document.addEventListener("visibilitychange", onVisibility);
    discover();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(discoveryFrame);
      document.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onVisibility);
      [...apis.keys()].forEach(destroy);
    };
  }, []);
  return <span data-gallery-controller="embla" hidden aria-hidden="true" />;
}
