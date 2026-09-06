import React from 'react';

interface DateRangeSliderProps {
  min: string;
  max: string;
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}

function toDay(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 86400000);
}
function fromDay(day: number): string {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}

const DateRangeSlider: React.FC<DateRangeSliderProps> = React.memo(
  ({ min, max, start, end, onChange }) => {
    if (!min || !max) return null;
    const minD = toDay(min);
    const maxD = toDay(max);
    const startD = Math.max(minD, toDay(start || min));
    const endD = Math.min(maxD, toDay(end || max));

    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs" style={{ color: 'var(--invoicing-gray-500)' }}>
          <span>{start || min}</span>
          <span>{end || max}</span>
        </div>
        <input
          type="range"
          min={minD}
          max={maxD}
          value={startD}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(fromDay(Math.min(v, endD)), fromDay(endD));
          }}
        />
        <input
          type="range"
          min={minD}
          max={maxD}
          value={endD}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(fromDay(startD), fromDay(Math.max(v, startD)));
          }}
        />
      </div>
    );
  }
);

DateRangeSlider.displayName = 'DateRangeSlider';
export default DateRangeSlider;
