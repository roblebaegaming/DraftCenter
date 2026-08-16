"use client";

import { useState } from "react";
import { useInstallableWebApp } from "../platform/useInstallableWebApp";

export default function TeamLabInstallPanel() {
  const [message, setMessage] = useState("");
  const { promptInstall } = useInstallableWebApp({ serviceWorkerUrl: "/team-lab/sw.js", scope: "/team-lab/" });

  async function install() {
    const { outcome } = await promptInstall();
    if (outcome === "accepted") setMessage("Team Lab was added to this device.");
    else if (outcome === "dismissed") setMessage("Installation was dismissed. You can install Team Lab later from this section.");
    else setMessage("Open your browser’s share or menu button, then choose “Add to Home Screen” or “Install app.”");
  }

  return <section className="team-lab-install" id="install-team-lab" aria-labelledby="team-lab-install-title">
    <div><span className="eyebrow">INSTALLABLE WEB APP</span><h2 id="team-lab-install-title">Keep Team Lab beside the battle.</h2><p>Open the builder, private teams, and Battle Room from a focused launcher. Account saves still require an internet connection; matchup-local crash recovery remains in this browser.</p></div>
    <div><button type="button" className="secondary-button" onClick={install}>Install Team Lab</button>{message && <small role="status">{message}</small>}</div>
  </section>;
}
