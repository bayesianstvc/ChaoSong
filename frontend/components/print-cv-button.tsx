"use client";

export function PrintCvButton() {
  return <button className="print-cv-button" type="button" onClick={() => window.print()}>Print / Save CV as PDF</button>;
}
