import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useSession } from "../../context/SessionContext.jsx";

export default function Layout() {
  const { session, logout } = useSession();

  if (!session) return <Navigate to="/dashboard/login" replace />;

  const navClass = ({ isActive }) =>
    [
      "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
      isActive ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80",
    ].join(" ");

  return (
    <div className="min-h-screen bg-ink-900 flex">
      <aside className="w-60 shrink-0 border-r border-white/10 flex flex-col p-4">
        <div className="flex items-center gap-2 px-2 mb-8">
          <div className="h-8 w-8 rounded-lg bg-signal flex items-center justify-center">
            <span className="font-display font-bold text-white text-sm">B</span>
          </div>
          <span className="font-display text-lg font-semibold text-white">BloodBridge</span>
        </div>

        <nav className="flex flex-col gap-1">
          <NavLink to="/dashboard" end className={navClass}>
            Incoming requests
          </NavLink>
          <NavLink to="/dashboard/inventory" className={navClass}>
            Inventory
          </NavLink>
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10">
          <div className="px-2">
            <div className="text-white text-sm font-medium">{session.source.name}</div>
            <div className="text-white/40 text-xs uppercase tracking-wide">{session.source.type.replace("_", " ")}</div>
          </div>
          <button onClick={logout} className="mt-3 w-full text-left px-2 py-2 rounded-lg text-sm text-white/40 hover:text-white/70">
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
