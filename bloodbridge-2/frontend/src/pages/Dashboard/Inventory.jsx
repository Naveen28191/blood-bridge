import { useEffect, useState } from "react";
import { useSession } from "../../context/SessionContext.jsx";
import { api } from "../../lib/api.js";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const COMPONENTS = ["whole_blood", "rbc", "plasma", "platelets"];

function toDateInputValue(iso) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export default function Inventory() {
  const { session } = useSession();
  const [inventory, setInventory] = useState([]);
  const [drafts, setDrafts] = useState({}); // key -> { unitsAvailable, expiryDate }
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState({ bloodGroup: "O+", component: "rbc", unitsAvailable: 0, expiryDate: "" });

  const key = (i) => `${i.bloodGroup}::${i.component}`;

  async function load() {
    try {
      const { inventory } = await api.getInventory(session.source.id);
      setInventory(inventory);
      setDrafts(
        Object.fromEntries(
          inventory.map((i) => [key(i), { unitsAvailable: i.unitsAvailable, expiryDate: toDateInputValue(i.expiryDate) }])
        )
      );
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setDraft(k, patch) {
    setDrafts((d) => ({ ...d, [k]: { ...d[k], ...patch } }));
  }

  function isDirty(item) {
    const d = drafts[key(item)];
    if (!d) return false;
    return Number(d.unitsAvailable) !== item.unitsAvailable || d.expiryDate !== toDateInputValue(item.expiryDate);
  }

  async function save(item) {
    const k = key(item);
    const d = drafts[k];
    setSavingKey(k);
    setError(null);
    try {
      await api.updateInventory(
        session.source.id,
        {
          bloodGroup: item.bloodGroup,
          component: item.component,
          unitsAvailable: Number(d.unitsAvailable),
          expiryDate: d.expiryDate ? new Date(d.expiryDate).toISOString() : item.expiryDate,
        },
        session.apiKey
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey(null);
    }
  }

  async function addRow(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.updateInventory(
        session.source.id,
        {
          bloodGroup: newRow.bloodGroup,
          component: newRow.component,
          unitsAvailable: Number(newRow.unitsAvailable),
          expiryDate: newRow.expiryDate ? new Date(newRow.expiryDate).toISOString() : null,
        },
        session.apiKey
      );
      setShowAdd(false);
      setNewRow({ bloodGroup: "O+", component: "rbc", unitsAvailable: 0, expiryDate: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold text-white">Inventory</h1>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="text-sm font-medium text-white/70 hover:text-white border border-white/15 rounded-lg px-3 py-2"
        >
          {showAdd ? "Cancel" : "+ Add line"}
        </button>
      </div>

      {error && <p className="text-signal text-sm mb-4">{error}</p>}

      {showAdd && (
        <form onSubmit={addRow} className="rounded-xl border border-white/10 bg-ink-800 p-4 mb-6 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-1">Blood group</label>
            <select
              value={newRow.bloodGroup}
              onChange={(e) => setNewRow((r) => ({ ...r, bloodGroup: e.target.value }))}
              className="rounded-lg bg-ink-900 border border-white/15 text-white px-3 py-2 font-data"
            >
              {BLOOD_GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Component</label>
            <select
              value={newRow.component}
              onChange={(e) => setNewRow((r) => ({ ...r, component: e.target.value }))}
              className="rounded-lg bg-ink-900 border border-white/15 text-white px-3 py-2"
            >
              {COMPONENTS.map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Units</label>
            <input
              type="number"
              min={0}
              value={newRow.unitsAvailable}
              onChange={(e) => setNewRow((r) => ({ ...r, unitsAvailable: e.target.value }))}
              className="w-20 rounded-lg bg-ink-900 border border-white/15 text-white px-3 py-2 font-data"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Expiry</label>
            <input
              type="date"
              value={newRow.expiryDate}
              onChange={(e) => setNewRow((r) => ({ ...r, expiryDate: e.target.value }))}
              className="rounded-lg bg-ink-900 border border-white/15 text-white px-3 py-2 font-data"
            />
          </div>
          <button type="submit" className="rounded-lg bg-teal text-ink-900 font-medium px-4 py-2">
            Save
          </button>
        </form>
      )}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Group</th>
              <th className="text-left px-4 py-3 font-medium">Component</th>
              <th className="text-left px-4 py-3 font-medium">Units</th>
              <th className="text-left px-4 py-3 font-medium">Expiry</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => {
              const k = key(item);
              const d = drafts[k] ?? {};
              const dirty = isDirty(item);
              const daysLeft = daysUntil(item.expiryDate);
              const expiring = daysLeft !== null && daysLeft <= 3;
              return (
                <tr key={k} className="border-t border-white/5">
                  <td className="px-4 py-3 font-data text-white">{item.bloodGroup}</td>
                  <td className="px-4 py-3 text-white/70 capitalize">{item.component.replace("_", " ")}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      value={d.unitsAvailable ?? 0}
                      onChange={(e) => setDraft(k, { unitsAvailable: e.target.value })}
                      className="w-20 rounded-lg bg-ink-900 border border-white/15 text-white px-2 py-1.5 font-data"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      value={d.expiryDate ?? ""}
                      onChange={(e) => setDraft(k, { expiryDate: e.target.value })}
                      className={`rounded-lg bg-ink-900 border px-2 py-1.5 font-data text-white ${
                        expiring ? "border-signal/50" : "border-white/15"
                      }`}
                    />
                    {expiring && <span className="ml-2 text-xs text-signal">expiring</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => save(item)}
                      disabled={!dirty || savingKey === k}
                      className="text-xs font-medium rounded-lg bg-slate/20 text-slate px-3 py-1.5 disabled:opacity-30"
                    >
                      {savingKey === k ? "Saving…" : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {inventory.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-white/30">
                  No inventory yet — add a line above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
