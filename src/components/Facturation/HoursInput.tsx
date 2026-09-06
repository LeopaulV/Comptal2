import React, { useEffect, useState } from 'react';
import { hhMmToHours, hoursToHhMm } from '../../utils/invoiceFormat';

interface HoursInputProps {
  value: number;
  onChange: (hours: number) => void;
}

/** Saisie d’une durée en hh:mm (sélecteur natif si < 24 h). */
const HoursInput: React.FC<HoursInputProps> = ({ value, onChange }) => {
  const [text, setText] = useState(hoursToHhMm(value));
  const useTimePicker = value < 24;

  useEffect(() => {
    setText(hoursToHhMm(value));
  }, [value]);

  const commit = (raw: string) => {
    const hours = hhMmToHours(raw);
    onChange(hours);
    setText(hoursToHhMm(hours));
  };

  if (useTimePicker) {
  return (
    <input
      type="time"
      step={60}
      title="hh:mm"
      value={hoursToHhMm(value)}
      onChange={(e) => onChange(hhMmToHours(e.target.value || '00:00'))}
    />
  );
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="hh:mm"
      value={text}
      onChange={(e) => setText(e.target.value.replace(/[^\d:]/g, ''))}
      onBlur={() => commit(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit(text);
        }
      }}
    />
  );
};

export default HoursInput;
