import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useSession } from "../../context/SessionContext.jsx";

// MVP note (spec section 5): real auth is "API key per source" with no
// login UI of its own — a source would be issued a key out-of-band. For
// this demo there's no email/SMS channel to deliver keys through, so we
// surface the seeded demo keys directly. In a real deployment this panel
// wouldn't exist; keys would be provisioned to each hospital/blood bank
// separately.
const DEMO_KEYS = {
  "hosp-marina-general": "key_marina_general",
  "hosp-anna-nagar-multi": "key_anna_nagar",
  "hosp-t-nagar-community": "key_tnagar_community",
  "bank-chennai-metro": "key_chennai_metro_bank",
  "bank-southline": "key_southline",
};

export default function Login() {
  const navigate = useNavigate();
  const { login } = useSession();

  const [sources, setSources] = useState([]);
  const [sourceId, setSourceId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listSources().then((d) => {
      setSources(d.sources);
      if (d.sources[0]) {
        setSourceId(d.sources[0].id);
        setApiKey(DEMO_KEYS[d.sources[0].id] ?? "");
      }
    });
  }, []);

  function selectSource(id) {
    setSourceId(id);
    setApiKey(DEMO_KEYS[id] ?? "");
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const source = sources.find((s) => s.id === sourceId);
      const { inventory } = await api.getInventory(sourceId);
      if (inventory.length > 0) {
        // No-op write against the source's own first item — doubles as an
        // API-key validation check without a dedicated auth endpoint.
        const first = inventory[0];
        await api.updateInventory(
          sourceId,
          { bloodGroup: first.bloodGroup, component: first.component, unitsAvailable: first.unitsAvailable },
          apiKey
        );
      }
      login(source, apiKey);
      navigate("/dashboard");
    } catch (err) {
      setError("That API key doesn't match this source.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="h-9 w-9 rounded-lg bg-signal flex items-center justify-center">
            <span className="font-display font-bold text-white text-lg">B</span>
          </div>
          <span className="font-display text-2xl font-semibold text-white">BloodBridge</span>
        </div>

        <label className="block text-sm text-white/60 mb-2">Your hospital / blood bank</label>
        <div className="flex flex-col gap-2 mb-5">
          {sources.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => selectSource(s.id)}
              className={[
                "text-left rounded-xl border px-4 py-3 transition-colors",
                sourceId === s.id ? "border-slate bg-slate-soft/10" : "border-white/10 hover:border-white/25",
              ].join(" ")}
            >
              <div className="text-white font-medium">{s.name}</div>
              <div className="text-white/40 text-xs uppercase tracking-wide">{s.type.replace("_", " ")}</div>
            </button>
          ))}
        </div>

        <label className="block text-sm text-white/60 mb-2">API key</label>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full rounded-xl border border-white/15 bg-ink-800 px-4 py-3 text-white font-data mb-1"
          placeholder="key_..."
        />
        <p className="text-white/30 text-xs mb-6">Demo key prefilled — provisioned per source in a real deployment.</p>

        {error && <p className="text-signal text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={busy || !sourceId || !apiKey}
          className="w-full rounded-xl bg-signal text-white font-semibold py-3.5 disabled:opacity-40"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
