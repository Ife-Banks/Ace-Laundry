"use client";

interface StepperProps {
  value: number;
  min?: number;
  onChange: (value: number) => void;
}

export default function Stepper({ value, min = 1, onChange }: StepperProps) {
  const atMin = value <= min;
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        aria-label="Decrease item count"
        disabled={atMin}
        onClick={() => onChange(value - 1)}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-white text-2xl font-medium text-ink transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        −
      </button>
      <span
        aria-live="polite"
        className="w-12 text-center text-2xl font-bold tabular-nums"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase item count"
        onClick={() => onChange(value + 1)}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-white text-2xl font-medium text-ink transition-colors hover:border-primary hover:text-primary"
      >
        +
      </button>
    </div>
  );
}
