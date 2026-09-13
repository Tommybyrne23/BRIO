"use client";

import { useState } from "react";
import type { EcpId } from "@/lib/demo/ecp-fixtures";

type ProfileOption = {
  id: EcpId;
  name: string;
  summary: string;
  defaultAction: string;
};

type ResetResult = {
  fixture: {
    fixtureVersion: string;
    ecp: ProfileOption;
    anchorDate: string;
    counts: {
      days: number;
      namedFoods: number;
      healthSamples: number;
      trainingSessions: number;
      additionalWorkouts: number;
      checkIns: number;
    };
    reviewPrompt: string;
  };
};

export function DemoProfileControl({ profiles }: { profiles: ProfileOption[] }) {
  const [selected, setSelected] = useState<EcpId>(profiles[0].id);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState<ResetResult["fixture"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ecpId: selected,
          anchorDate: new Date().toISOString().slice(0, 10),
        }),
      });
      const body = await response.json() as ResetResult | { error?: string };
      if (!response.ok || !("fixture" in body)) {
        throw new Error("error" in body && body.error ? body.error : `Profile load failed (${response.status})`);
      }
      setLoaded(body.fixture);
      window.dispatchEvent(new CustomEvent("brio-demo-review-prompt", { detail: body.fixture.reviewPrompt }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Profile load failed");
    } finally {
      setLoading(false);
    }
  }

  const current = profiles.find((profile) => profile.id === selected)!;

  return <section className="card mist stack" aria-labelledby="demo-profile-title">
    <div className="split">
      <div>
        <span className="eyebrow">Live agent · synthetic inputs</span>
        <h2 id="demo-profile-title" className="section-title">Prepare a 14-day ECP review</h2>
      </div>
      <span className="badge synthetic">Demo account only</span>
    </div>
    <p className="muted">Loading a profile replaces only this configured demo account’s product records. Every food, workout, sleep, activity and check-in record is labelled synthetic. It also enables the eight demo-account consent controls, including live AI processing.</p>
    <div className="form-field">
      <label htmlFor="ecp-profile">Early customer profile</label>
      <select id="ecp-profile" className="select" value={selected} onChange={(event) => { setSelected(event.target.value as EcpId); setLoaded(null); }}>
        {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.defaultAction}</option>)}
      </select>
      <p className="form-hint">{current.summary}</p>
    </div>
    <button className="button" type="button" onClick={loadProfile} disabled={loading}>{loading ? "Loading synthetic history…" : "Load synthetic profile"}</button>
    {error && <div className="error-box" role="alert"><strong>Profile not loaded.</strong><p>{error}</p><button className="button button-secondary button-small" type="button" onClick={loadProfile}>Retry</button></div>}
    {loaded && <div className="success-box" role="status">
      <strong>{loaded.ecp.name} is ready for a live review.</strong>
      <p>{loaded.counts.days} nutrition/check-in days · {loaded.counts.namedFoods} labelled demo-food entries · {loaded.counts.healthSamples} synthetic health samples · {loaded.counts.trainingSessions + loaded.counts.additionalWorkouts} training records.</p>
      <p>The review prompt has been placed in the chat field. No model call starts until you press Send.</p>
    </div>}
  </section>;
}
