import { Link } from "react-router-dom";

export default function RoleSelect() {
  return (
    <div className="min-h-screen bg-ink-900 flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <div className="inline-flex items-center gap-2 mb-8">
          <div className="h-9 w-9 rounded-lg bg-signal flex items-center justify-center">
            <span className="font-display font-bold text-white text-lg">B</span>
          </div>
          <span className="font-display text-2xl font-semibold text-white">BloodBridge</span>
        </div>
        <p className="text-white/50 text-sm mb-10">
          Real-time blood coordination between ambulances, hospitals, and blood banks.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            to="/ambulance/new"
            className="rounded-xl bg-signal text-white font-medium py-4 hover:bg-signal/90 transition-colors"
          >
            I'm in an ambulance
          </Link>
          <Link
            to="/dashboard/login"
            className="rounded-xl border border-white/15 text-white font-medium py-4 hover:bg-white/5 transition-colors"
          >
            Hospital / blood bank dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
