"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

interface Project {
  id: string;
  projectId: string;
  name: string;
  methodology: string;
  country: string;
  status: string;
  methodologyScore: number;
  createdAt: string;
}

export default function VerifierDashboardPage() {
  const [publicKey, setPublicKey] = useState("");
  const [token, setToken] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!publicKey || !token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/verifiers/${publicKey}/pending-projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setProjects(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function reviewProject(projectId: string, decision: "verify" | "reject") {
    const endpoint = `${API}/projects/${projectId}/${decision}`;
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ verifierPublicKey: publicKey }),
    });
    load();
  }

  return (
    <main style={{ maxWidth: 800, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Verifier Dashboard</h1>
      <p>Review projects pending your accreditation. Each approved project earns an attestation fee.</p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <input
          placeholder="Your Stellar public key (G...)"
          value={publicKey}
          onChange={e => setPublicKey(e.target.value)}
          style={{ flex: 1, padding: "0.5rem" }}
        />
        <input
          placeholder="JWT token"
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          style={{ flex: 1, padding: "0.5rem" }}
        />
        <button onClick={load} style={btnStyle}>Load</button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading && <p>Loading...</p>}

      {projects.length === 0 && !loading && (
        <p style={{ color: "#666" }}>No projects pending your review.</p>
      )}

      {projects.map(p => (
        <div key={p.id} style={cardStyle}>
          <div>
            <strong>{p.name}</strong> <span style={{ color: "#666" }}>({p.projectId})</span>
            <br />
            <small>{p.methodology} (Score: {p.methodologyScore}) · {p.country} · submitted {new Date(p.createdAt).toLocaleDateString()}</small>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={() => reviewProject(p.id, "verify")} style={approveBtn}>Approve</button>
            <button onClick={() => reviewProject(p.id, "reject")} style={rejectBtn}>Reject</button>
          </div>
        </div>
      ))}

      <hr style={{ margin: "2rem 0" }} />
      <p style={{ fontSize: "0.875rem", color: "#666" }}>
        <strong>Attestation fee:</strong> verifiers earn a fee per approved project as documented in{" "}
        <a href="/docs/verifier-onboarding.md">docs/verifier-onboarding.md</a>.
      </p>
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "0.5rem 1rem", background: "#7C3AED", color: "#fff",
  border: "none", borderRadius: 4, cursor: "pointer",
};
const approveBtn: React.CSSProperties = { ...btnStyle, background: "#16a34a" };
const rejectBtn: React.CSSProperties  = { ...btnStyle, background: "#dc2626" };
const cardStyle: React.CSSProperties  = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "1rem", border: "1px solid #e5e7eb", borderRadius: 6, marginBottom: "0.75rem",
};
