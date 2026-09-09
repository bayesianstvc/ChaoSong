"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

export function ThemeToggle() {
  const [night, setNight] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("site-appearance") === "night";
    // Synchronize the visible control with the persisted device preference.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNight(saved);
    document.documentElement.dataset.theme = saved ? "night" : "paper";
  }, []);
  function toggle() {
    const next = !night;
    setNight(next);
    document.documentElement.dataset.theme = next ? "night" : "paper";
    localStorage.setItem("site-appearance", next ? "night" : "paper");
  }
  return (
    <button type="button" className="header-icon-button" onClick={toggle} aria-label={night ? "Use paper theme" : "Use night reading theme"} title={night ? "Switch to paper theme" : "Switch to night reading theme"}>
      {night ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}
