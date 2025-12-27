"use client";

export default function ProgressBar({
  value,
  label,
}: {
  value: number; // 0..100
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));

  return (
    <div className="w-full">
      {label ? <div className="text-xs text-gray-600 mb-1">{label}</div> : null}
      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-3 rounded-full bg-blue-600 transition-all"
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}
