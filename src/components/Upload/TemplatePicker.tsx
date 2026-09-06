import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { ImportTemplate } from '../../types/import';

interface TemplatePickerProps {
  templates: ImportTemplate[];
  selectedId: number | '';
  onSelect: (id: number | '') => void;
  onDelete?: (id: number) => void;
  compact?: boolean;
}

const TemplatePicker: React.FC<TemplatePickerProps> = ({
  templates,
  selectedId,
  onSelect,
  onDelete,
  compact = false,
}) => {
  const { t } = useTranslation();
  if (templates.length === 0 && compact) return null;

  return (
    <div className={compact ? 'flex items-center gap-2' : 'ct-card'}>
      {!compact && <h3 className="ct-section-title">{t('upload.templates.title')}</h3>}
      {!compact && <p className="ct-hint">{t('upload.templates.hint')}</p>}
      <div className="flex gap-2 items-center flex-wrap">
        <select
          className="ct-select"
          style={{ minWidth: 220 }}
          value={selectedId}
          onChange={(e) => onSelect(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">{t('upload.templates.none')}</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>
        {onDelete && selectedId !== '' && (
          <button
            type="button"
            className="ct-btn-icon"
            title={t('common.delete')}
            onClick={() => onDelete(selectedId)}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default TemplatePicker;
