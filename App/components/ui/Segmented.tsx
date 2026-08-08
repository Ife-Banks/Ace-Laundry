"use client";

interface SegmentedProps<T extends string> {
  name: string;
  options: readonly { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export default function Segmented<T extends string>({
  name,
  options,
  value,
  onChange,
  disabled,
}: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`flex min-h-11 flex-col items-start justify-center rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-50 ${
              selected
                ? "border-primary bg-[#fef0e3] text-ink"
                : "border-line bg-white text-ink hover:border-primary-dark/40"
            }`}
          >
            <span className="text-sm font-semibold leading-tight">{option.label}</span>
            {option.hint ? (
              <span className="text-xs text-ink-muted">{option.hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
