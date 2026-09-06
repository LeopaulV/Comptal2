import React from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, FolderPlus, Plus, Trash2 } from 'lucide-react';
import { Project } from '../../types/projection';

interface PrevisionnelToolbarProps {
  projects: Project[];
  projectId: number | '';
  name: string;
  startDate: string;
  endDate: string;
  initialBalance: string;
  onSelectProject: (id: number | '') => void;
  onNameChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onBalanceChange: (value: string) => void;
  onCreate: () => void;
  onDelete: () => void;
  onAddLine: () => void;
  onAddGroup: () => void;
  onDuplicate: () => void;
  onDeleteRow: () => void;
}

const PrevisionnelToolbar: React.FC<PrevisionnelToolbarProps> = ({
  projects,
  projectId,
  name,
  startDate,
  endDate,
  initialBalance,
  onSelectProject,
  onNameChange,
  onStartDateChange,
  onEndDateChange,
  onBalanceChange,
  onCreate,
  onDelete,
  onAddLine,
  onAddGroup,
  onDuplicate,
  onDeleteRow,
}) => {
  const { t } = useTranslation();

  return (
    <div className="previsionnel-toolbar">
      <div className="previsionnel-toolbar-row">
        <label className="previsionnel-field">
          <span>{t('previsionnel.forecast')}</span>
          <select
            className="ct-select"
            value={projectId}
            onChange={(e) => onSelectProject(e.target.value ? Number(e.target.value) : '')}
          >
            {projects.length === 0 && <option value="">{t('previsionnel.noForecast')}</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="previsionnel-field">
          <span>{t('common.name')}</span>
          <input className="ct-input" value={name} onChange={(e) => onNameChange(e.target.value)} />
        </label>
        <label className="previsionnel-field">
          <span>{t('previsionnel.startDate')}</span>
          <input className="ct-input" type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
        </label>
        <label className="previsionnel-field">
          <span>{t('previsionnel.endDate')}</span>
          <input className="ct-input" type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} />
        </label>
        <label className="previsionnel-field">
          <span>{t('previsionnel.initialBalance')}</span>
          <input
            className="ct-input"
            type="number"
            step="0.01"
            value={initialBalance}
            onChange={(e) => onBalanceChange(e.target.value)}
          />
        </label>
        <div className="previsionnel-toolbar-actions">
          <button type="button" className="ct-btn-primary previsionnel-sm-btn" onClick={onCreate}>
            <Plus size={14} /> {t('previsionnel.newForecast')}
          </button>
          <button
            type="button"
            className="ct-btn-danger previsionnel-sm-btn"
            onClick={onDelete}
            disabled={projectId === ''}
          >
            <Trash2 size={14} /> {t('common.delete')}
          </button>
        </div>
      </div>
      <div className="previsionnel-toolbar-row">
        <button type="button" className="ct-btn-secondary previsionnel-sm-btn" onClick={onAddLine} disabled={projectId === ''}>
          <Plus size={14} /> {t('previsionnel.addLine')}
        </button>
        <button type="button" className="ct-btn-secondary previsionnel-sm-btn" onClick={onAddGroup} disabled={projectId === ''}>
          <FolderPlus size={14} /> {t('previsionnel.addGroup')}
        </button>
        <button type="button" className="ct-btn-secondary previsionnel-sm-btn" onClick={onDuplicate} disabled={projectId === ''}>
          <Copy size={14} /> {t('previsionnel.duplicate')}
        </button>
        <button type="button" className="ct-btn-secondary previsionnel-sm-btn" onClick={onDeleteRow} disabled={projectId === ''}>
          <Trash2 size={14} /> {t('previsionnel.deleteRow')}
        </button>
      </div>
    </div>
  );
};

export default PrevisionnelToolbar;
