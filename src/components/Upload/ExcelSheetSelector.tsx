import React from 'react';
import { useTranslation } from 'react-i18next';
import { Account } from '../../types/models';
import { ExcelSheetInfo } from '../../types/import';

interface ExcelSheetSelectorProps {
  sheets: ExcelSheetInfo[];
  accounts: Account[];
  assignment: Record<string, number>;
  onAssign: (sheetName: string, accountId: number) => void;
}

const ExcelSheetSelector: React.FC<ExcelSheetSelectorProps> = ({
  sheets,
  accounts,
  assignment,
  onAssign,
}) => {
  const { t } = useTranslation();
  return (
    <div className="ct-card">
      <h2 className="ct-section-title">{t('upload.excelSheets')}</h2>
      <p className="ct-hint">{t('upload.excelSheetsHint')}</p>
      <table className="ct-table">
        <thead>
          <tr>
            <th>{t('upload.sheet')}</th>
            <th>{t('upload.rows')}</th>
            <th>{t('upload.period')}</th>
            <th>{t('upload.account')}</th>
          </tr>
        </thead>
        <tbody>
          {sheets.map((sheet) => (
            <tr key={sheet.name}>
              <td>{sheet.name}</td>
              <td>{sheet.rowCount}</td>
              <td>
                {sheet.startDate && sheet.endDate
                  ? `${sheet.startDate} → ${sheet.endDate}`
                  : '—'}
              </td>
              <td>
                <select
                  className="ct-select"
                  value={assignment[sheet.name] ?? ''}
                  onChange={(e) => onAssign(sheet.name, Number(e.target.value))}
                >
                  <option value="">{t('upload.chooseAccount')}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ExcelSheetSelector;
