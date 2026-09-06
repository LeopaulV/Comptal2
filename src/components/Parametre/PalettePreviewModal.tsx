import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ColorPalette, PaletteApplication } from '../../types/colorPalette';
import { applyPaletteColors, isDynamicPalette } from '../../utils/colorPalettes';
import { formatMoney } from '../../utils/invoiceFormat';
import Modal from '../Common/Modal';
import ColorPaletteSelector from './ColorPaletteSelector';

interface PalettePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Array<{ code: string; name: string; color: string }>;
  nets?: Record<string, number>;
  onApply: (applications: PaletteApplication[]) => void;
  title: string;
}

function colorMapFor(
  palette: ColorPalette,
  applications: PaletteApplication[],
  nets: Record<string, number>
): Record<string, string> {
  return applyPaletteColors(
    palette,
    applications.map((app) => app.itemCode),
    nets
  );
}

const PalettePreviewModal: React.FC<PalettePreviewModalProps> = ({
  isOpen,
  onClose,
  items,
  nets = {},
  onApply,
  title,
}) => {
  const { t } = useTranslation();
  const [selectedPalette, setSelectedPalette] = useState<ColorPalette | null>(null);
  const [applications, setApplications] = useState<PaletteApplication[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedPalette(null);
      setApplications([]);
      return;
    }
    setApplications(items.map((item) => ({
      itemCode: item.code,
      itemName: item.name,
      currentColor: item.color,
      newColor: item.color,
      selected: true,
    })));
    // Reset only when the modal opens so reorder/selection stay stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!selectedPalette || applications.length === 0) return;
    const colors = colorMapFor(selectedPalette, applications, nets);
    setApplications((current) =>
      current.map((app) => ({
        ...app,
        newColor: colors[app.itemCode] ?? app.newColor,
      }))
    );
    // applications is read once when the palette or nets change; including it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPalette, nets]);

  const redistribute = (next: PaletteApplication[]) => {
    if (!selectedPalette) return next;
    const colors = colorMapFor(selectedPalette, next, nets);
    return next.map((app) => ({
      ...app,
      newColor: colors[app.itemCode] ?? app.newColor,
    }));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= applications.length) return;
    const updated = [...applications];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setApplications(selectedPalette && isDynamicPalette(selectedPalette) ? updated : redistribute(updated));
  };

  const selectedCount = applications.filter((app) => app.selected).length;
  const dynamic = selectedPalette ? isDynamicPalette(selectedPalette) : false;

  const handleApply = () => {
    const selected = applications.filter((app) => app.selected);
    if (!selectedPalette || selected.length === 0) {
      toast.error(t('settings.palette.needSelection'));
      return;
    }
    onApply(selected);
    onClose();
  };

  const netHint = (code: string) => {
    const net = nets[code] ?? 0;
    if (Math.abs(net) < 0.005) return t('settings.palette.neutral');
    if (net < 0) return t('settings.palette.debit', { amount: formatMoney(Math.abs(net)) });
    return t('settings.palette.credit', { amount: formatMoney(net) });
  };

  return (
    <Modal
      isOpen={isOpen}
      title={t('settings.palette.applyTitle', { title })}
      onClose={onClose}
      maxWidth="1080px"
      footer={
        <>
          <button type="button" className="ct-btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button
            type="button"
            className="ct-btn-primary"
            disabled={!selectedPalette || selectedCount === 0}
            onClick={handleApply}
          >
            <Check size={16} /> {t('settings.palette.applyCount', { count: selectedCount })}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="font-semibold mb-3" style={{ color: 'var(--invoicing-gray-900)' }}>{t('settings.palette.stepChoose')}</h3>
          <ColorPaletteSelector onSelectPalette={setSelectedPalette} />
        </div>
        {selectedPalette && applications.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold" style={{ color: 'var(--invoicing-gray-900)' }}>{t('settings.palette.stepPreview')}</h3>
              <button
                type="button"
                className="text-sm"
                style={{ color: 'var(--invoicing-primary)' }}
                onClick={() => {
                  const all = applications.every((app) => app.selected);
                  setApplications(applications.map((app) => ({ ...app, selected: !all })));
                }}
              >
                {applications.every((app) => app.selected) ? t('common.deselectAll') : t('common.selectAll')}
              </button>
            </div>
            {dynamic && (
              <p className="text-sm mb-3" style={{ color: 'var(--invoicing-gray-600)' }}>
                {t('settings.palette.dynamicHint')}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {applications.map((app, index) => (
                <div key={app.itemCode} className="palette-preview-row" data-selected={app.selected ? 'true' : 'false'}>
                  <input
                    type="checkbox"
                    checked={app.selected}
                    onChange={() => setApplications(applications.map((item, i) => i === index ? { ...item, selected: !item.selected } : item))}
                  />
                  {!dynamic && (
                    <div className="flex flex-col">
                      <button type="button" className="ct-btn-icon !min-h-0 !p-0.5" disabled={index === 0} onClick={() => move(index, -1)}>
                        <ChevronUp size={14} />
                      </button>
                      <button type="button" className="ct-btn-icon !min-h-0 !p-0.5" disabled={index === applications.length - 1} onClick={() => move(index, 1)}>
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium" style={{ color: 'var(--invoicing-gray-900)' }}>{app.itemName}</p>
                    <p className="text-xs" style={{ color: 'var(--invoicing-gray-500)' }}>
                      {app.itemCode}
                      {dynamic ? ` · ${netHint(app.itemCode)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--invoicing-gray-500)' }}>{t('settings.palette.current')}</span>
                    <span className="palette-swatch" style={{ backgroundColor: app.currentColor }} title={app.currentColor} />
                    <span style={{ color: 'var(--invoicing-gray-400)' }}>→</span>
                    <span className="palette-swatch" style={{ backgroundColor: app.newColor }} title={app.newColor} />
                    <span className="text-xs font-mono" style={{ color: 'var(--invoicing-gray-500)' }}>{app.newColor}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm mt-3" style={{ color: 'var(--invoicing-gray-600)' }}>
              {t('settings.palette.selectedCount', { selected: selectedCount, total: applications.length })}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PalettePreviewModal;
