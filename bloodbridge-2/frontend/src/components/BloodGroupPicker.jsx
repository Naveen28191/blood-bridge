const GROUPS = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];

export default function BloodGroupPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Blood group">
      {GROUPS.map((group) => {
        const selected = value === group;
        return (
          <button
            key={group}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(group)}
            className={[
              "font-data text-lg font-medium rounded-xl py-4 transition-colors border-2",
              selected
                ? "bg-signal text-white border-signal shadow-lg shadow-signal/20"
                : "bg-white text-ink-900 border-paper-200 hover:border-signal/40",
            ].join(" ")}
          >
            {group}
          </button>
        );
      })}
    </div>
  );
}
