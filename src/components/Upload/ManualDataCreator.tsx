import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PreviewRow } from '../../types/import';
import { parseDateWithMultipleFormats, toIsoDate } from '../../utils/dateFormats';
import { parseAmount, roundMoney } from '../../utils/amounts';

interface ManualDataCreatorProps {
  onReady: (rows: PreviewRow[]) => void;
}

const emptyLine = { date: '', label: '', debit: '', credit: '' };

const ManualDataCreator: React.FC<ManualDataCreatorProps> = ({ onReady }) => {
  const { t } = useTranslation();
  const [lines, setLines] = useState([{ ...emptyLine }]);

  const update = (index: number, field: keyof typeof emptyLine, value: string) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  };

  const build = () => {
    const rows: PreviewRow[] = [];
    for (const line of lines) {
      const date = parseDateWithMultipleFormats(line.date);
      if (!date) continue;
      let debit = parseAmount(line.debit);
      let credit = parseAmount(line.credit);
      if (debit > 0) debit = -debit;
      if (credit < 0) credit = Math.abs(credit);
      rows.push({
        date: toIsoDate(date),
        valueDate: toIsoDate(date),
        debit: roundMoney(debit),
        credit: roundMoney(credit),
        label: line.label.trim(),
      });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    onReady(rows);
  };

  return (
    <div className="ct-card">
      <h2 className="ct-section-title">{t('upload.manual')}</h2>
      <div className="flex flex-col gap-2">
        {lines.map((line, i) => (
          <div key={i} className="grid gap-2" style={{ gridTemplateColumns: '140px 1fr 120px 120px' }}>
            <input
              className="ct-input"
              placeholder="jj/mm/aaaa"
              value={line.date}
              onChange={(e) => update(i, 'date', e.target.value)}
            />
            <input
              className="ct-input"
              placeholder={t('upload.colLabel')}
              value={line.label}
              onChange={(e) => update(i, 'label', e.target.value)}
            />
            <input
              className="ct-input"
              placeholder={t('upload.colDebit')}
              value={line.debit}
              onChange={(e) => update(i, 'debit', e.target.value)}
            />
            <input
              className="ct-input"
              placeholder={t('upload.colCredit')}
              value={line.credit}
              onChange={(e) => update(i, 'credit', e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-4">
        <button className="ct-btn-secondary" onClick={() => setLines((prev) => [...prev, { ...emptyLine }])}>
          {t('upload.addLine')}
        </button>
        <button className="ct-btn-primary" onClick={build}>
          {t('upload.toPreview')}
        </button>
      </div>
    </div>
  );
};

export default ManualDataCreator;
