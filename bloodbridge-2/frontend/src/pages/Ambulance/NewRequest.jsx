import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BloodGroupPicker from "../../components/BloodGroupPicker.jsx";
import { api } from "../../lib/api.js";

const COMPONENTS = [
  { value: "whole_blood", label: "Whole blood" },
  { value: "rbc", label: "RBC" },
  { value: "plasma", label: "Plasma" },
  { value: "platelets", label: "Platelets" },
];

// Chennai-area quick presets, since there's no live GPS in this environment.
const LOCATION_PRESETS = [
  { label: "Marina Beach", lat: 13.0500, lng: 80.2824 },
  { label: "Anna Nagar", lat: 13.0850, lng: 80.2101 },
  { label: "T. Nagar", lat: 13.0418, lng: 80.2341 },
  { label: "GST Road", lat: 12.9915, lng: 80.2203 },
];

export default function NewRequest() {
  const navigate = useNavigate();

  const [ambulanceId, setAmbulanceId] = useState("AMB-" + Math.floor(1000 + Math.random() * 9000));
  const [bloodGroup, setBloodGroup] = useState(null);
  const [component, setComponent] = useState("rbc");
  const [unitsNeeded, setUnitsNeeded] = useState(2);
  const [patientLocation, setPatientLocation] = useState(null);
  const [destinationHospitalId, setDestinationHospitalId] = useState("");
  const [etaMinutes, setEtaMinutes] = useState(15);

  const [hospitals, setHospitals] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [geoStatus, setGeoStatus] = useState(null);

  useEffect(() => {
    api
      .listSources("hospital")
      .then((d) => {
        setHospitals(d.sources);
        if (d.sources[0]) setDestinationHospitalId(d.sources[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoStatus("Geolocation not supported by this browser — pick a preset below.");
      return;
    }
    setGeoStatus("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPatientLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("Location captured.");
      },
      () => setGeoStatus("Couldn't get your location — pick a preset below."),
      { timeout: 6000 }
    );
  }

  const canSubmit = ambulanceId && bloodGroup && component && unitsNeeded > 0 && patientLocation && destinationHospitalId && etaMinutes >= 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { request } = await api.createRequest({
        ambulanceId,
        bloodGroup,
        component,
        unitsNeeded: Number(unitsNeeded),
        patientLocation,
        destinationHospitalId,
        etaMinutes: Number(etaMinutes),
      });
      navigate(`/ambulance/status/${request.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper-50 pb-28">
      <header className="px-5 pt-6 pb-4 border-b border-paper-200">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-signal flex items-center justify-center">
            <span className="font-display font-bold text-white text-sm">B</span>
          </div>
          <span className="font-display text-lg font-semibold text-ink-900">New blood request</span>
        </div>
        <p className="text-ink-900/50 text-sm mt-1 font-data">Ambulance ID {ambulanceId}</p>
      </header>

      <form onSubmit={handleSubmit} className="px-5 py-6 flex flex-col gap-7">
        <section>
          <label className="block text-sm font-medium text-ink-900 mb-2">Blood group</label>
          <BloodGroupPicker value={bloodGroup} onChange={setBloodGroup} />
        </section>

        <section>
          <label className="block text-sm font-medium text-ink-900 mb-2">Component</label>
          <div className="grid grid-cols-2 gap-2">
            {COMPONENTS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setComponent(c.value)}
                className={[
                  "rounded-xl py-3 text-sm font-medium border-2 transition-colors",
                  component === c.value
                    ? "bg-ink-900 text-white border-ink-900"
                    : "bg-white text-ink-900 border-paper-200",
                ].join(" ")}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="block text-sm font-medium text-ink-900 mb-2">Units needed</label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setUnitsNeeded((n) => Math.max(1, n - 1))}
              className="h-12 w-12 rounded-xl border-2 border-paper-200 text-xl font-medium text-ink-900"
            >
              −
            </button>
            <span className="font-data text-2xl font-medium text-ink-900 w-10 text-center">{unitsNeeded}</span>
            <button
              type="button"
              onClick={() => setUnitsNeeded((n) => n + 1)}
              className="h-12 w-12 rounded-xl border-2 border-paper-200 text-xl font-medium text-ink-900"
            >
              +
            </button>
          </div>
        </section>

        <section>
          <label className="block text-sm font-medium text-ink-900 mb-2">Patient location</label>
          <button
            type="button"
            onClick={useMyLocation}
            className="w-full rounded-xl border-2 border-ink-900 text-ink-900 font-medium py-3 mb-2"
          >
            Use my current location
          </button>
          {geoStatus && <p className="text-xs text-ink-900/50 mb-2">{geoStatus}</p>}
          <div className="grid grid-cols-2 gap-2">
            {LOCATION_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setPatientLocation({ lat: p.lat, lng: p.lng });
                  setGeoStatus(null);
                }}
                className={[
                  "rounded-lg py-2.5 text-xs font-medium border transition-colors",
                  patientLocation?.lat === p.lat
                    ? "bg-signal-soft border-signal text-signal"
                    : "bg-white border-paper-200 text-ink-900/70",
                ].join(" ")}
              >
                {p.label}
              </button>
            ))}
          </div>
          {patientLocation && (
            <p className="font-data text-xs text-ink-900/50 mt-2">
              {patientLocation.lat.toFixed(4)}, {patientLocation.lng.toFixed(4)}
            </p>
          )}
        </section>

        <section>
          <label className="block text-sm font-medium text-ink-900 mb-2">Destination hospital</label>
          <select
            value={destinationHospitalId}
            onChange={(e) => setDestinationHospitalId(e.target.value)}
            className="w-full rounded-xl border-2 border-paper-200 px-4 py-3 text-ink-900 bg-white"
          >
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </section>

        <section>
          <label className="block text-sm font-medium text-ink-900 mb-2">ETA to hospital (minutes)</label>
          <input
            type="number"
            min={0}
            value={etaMinutes}
            onChange={(e) => setEtaMinutes(e.target.value)}
            className="w-full rounded-xl border-2 border-paper-200 px-4 py-3 text-ink-900 bg-white font-data"
          />
        </section>

        {error && <p className="text-sm text-signal">{error}</p>}
      </form>

      <div className="fixed bottom-0 left-0 right-0 bg-paper-50 border-t border-paper-200 px-5 py-4">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full rounded-xl bg-signal text-white font-semibold py-4 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Dispatching…" : "Dispatch request"}
        </button>
      </div>
    </div>
  );
}
