import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2, Check, X, Palette } from 'lucide-react';
import { Account } from '../../types/models';
import { PaletteApplication } from '../../types/colorPalette';
import { ConfigService } from '../../services/ConfigService';
import { Logger } from '../../services/logger';
import ConfirmModal from '../Common/ConfirmModal';
import PalettePreviewModal from './PalettePreviewModal';

interface EditState {
  code: string;
  name: string;
  color: string;
  initialBalance: string;
}

const EMPTY: EditState = { code: '', name: '', color: '#4a90e2', initialBalance: '0' };

const AccountsTab: React.FC = () => {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState>(EMPTY);
  const [draft, setDraft] = useState<EditState>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<{ account: Account; count: number } | null>(
    null
  );
  const [showPalette, setShowPalette] = useState(false);
  const [paletteNets, setPaletteNets] = useState<Record<string, number>>({});

  const reload = useCallback(async () => {
    try {
      setAccounts(await ConfigService.listAccounts());
    } catch (err) {
      Logger.error('AccountsTab.reload', err);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!showPalette) return;
    void ConfigService.accountNets()
      .then(setPaletteNets)
      .catch((err) => Logger.error('AccountsTab.paletteNets', err));
  }, [showPalette]);

  const handleAdd = async () => {
    if (!draft.code.trim() || !draft.name.trim()) return;
    try {
      await ConfigService.createAccount({
        code: draft.code.toUpperCase(),
        name: draft.name,
        color: draft.color,
        initialBalance: parseFloat(draft.initialBalance.replace(',', '.')) || 0,
      });
      setDraft(EMPTY);
      await reload();
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('AccountsTab.handleAdd', err);
      toast.error(t('common.error'));
    }
  };

  const handleSaveEdit = async (id: number) => {
    try {
      await ConfigService.updateAccount(id, {
        code: edit.code.toUpperCase(),
        name: edit.name,
        color: edit.color,
        initialBalance: parseFloat(edit.initialBalance.replace(',', '.')) || 0,
      });
      setEditingId(null);
      await reload();
    } catch (err) {
      Logger.error('AccountsTab.handleSaveEdit', err);
      toast.error(t('common.error'));
    }
  };

  const askDelete = async (account: Account) => {
    const count = await ConfigService.countTransactionsForAccount(account.id);
    setDeleteTarget({ account, count });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await ConfigService.deleteAccount(deleteTarget.account.id);
      setDeleteTarget(null);
      await reload();
      toast.success(t('common.success'));
    } catch (err) {
      Logger.error('AccountsTab.handleDelete', err);
      toast.error(t('common.error'));
    }
  };

  const handleApplyPalette = async (applications: PaletteApplication[]) => {
    try {
      await ConfigService.applyAccountColors(
        applications.map((app) => ({ code: app.itemCode, color: app.newColor }))
      );
      await reload();
      toast.success(t('settings.accounts.paletteApplied', { count: applications.length }));
    } catch (err) {
      Logger.error('AccountsTab.applyPalette', err);
      toast.error(t('common.error'));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="ct-card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="ct-section-title">{t('settings.accounts.title')}</h3>
            <p className="ct-hint">{t('settings.accounts.hint')}</p>
          </div>
          {accounts.length > 0 && (
            <button type="button" className="ct-btn-secondary" onClick={() => setShowPalette(true)}>
              <Palette size={16} /> {t('settings.palette.apply')}
            </button>
          )}
        </div>

        {accounts.length === 0 && (
          <p className="text-sm py-4" style={{ color: 'var(--invoicing-gray-500)' }}>
            {t('settings.accounts.empty')}
          </p>
        )}

        {accounts.length > 0 && (
          <table className="ct-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>{t('common.code')}</th>
                <th>{t('common.name')}</th>
                <th style={{ width: 90 }}>{t('common.color')}</th>
                <th style={{ width: 140 }}>{t('settings.accounts.initialBalance')}</th>
                <th style={{ width: 110 }}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) =>
                editingId === account.id ? (
                  <tr key={account.id}>
                    <td>
                      <input
                        className="ct-input w-full"
                        value={edit.code}
                        onChange={(e) => setEdit({ ...edit, code: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="ct-input w-full"
                        value={edit.name}
                        onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="color"
                        className="w-10 h-8 cursor-pointer rounded"
                        value={edit.color}
                        onChange={(e) => setEdit({ ...edit, color: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="ct-input w-full"
                        value={edit.initialBalance}
                        onChange={(e) => setEdit({ ...edit, initialBalance: e.target.value })}
                      />
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="ct-btn-icon" onClick={() => void handleSaveEdit(account.id)}>
                          <Check size={16} />
                        </button>
                        <button className="ct-btn-icon" onClick={() => setEditingId(null)}>
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={account.id}>
                    <td className="font-mono font-semibold">{account.code}</td>
                    <td>{account.name}</td>
                    <td>
                      <span
                        className="inline-block w-6 h-6 rounded-full border"
                        style={{ backgroundColor: account.color, borderColor: 'var(--invoicing-gray-300)' }}
                      />
                    </td>
                    <td>{account.initialBalance.toFixed(2)} €</td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          className="ct-btn-icon"
                          title={t('common.edit')}
                          onClick={() => {
                            setEditingId(account.id);
                            setEdit({
                              code: account.code,
                              name: account.name,
                              color: account.color,
                              initialBalance: String(account.initialBalance),
                            });
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="ct-btn-icon hover:!text-red-500"
                          title={t('common.delete')}
                          onClick={() => void askDelete(account)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}

        <div className="flex gap-3 mt-5 items-end flex-wrap" data-tour="onb-account-create">
          <div>
            <label className="ct-label">{t('common.code')}</label>
            <input
              className="ct-input w-28"
              placeholder="CCAL"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="ct-label">{t('common.name')}</label>
            <input
              className="ct-input w-full"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div>
            <label className="ct-label">{t('common.color')}</label>
            <input
              type="color"
              className="w-12 h-10 cursor-pointer rounded"
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            />
          </div>
          <div>
            <label className="ct-label">{t('settings.accounts.initialBalance')}</label>
            <input
              className="ct-input w-32"
              value={draft.initialBalance}
              onChange={(e) => setDraft({ ...draft, initialBalance: e.target.value })}
            />
          </div>
          <button
            className="ct-btn-primary"
            disabled={!draft.code.trim() || !draft.name.trim()}
            onClick={() => void handleAdd()}
          >
            <Plus size={16} /> {t('settings.accounts.addAccount')}
          </button>
        </div>
      </section>

      <PalettePreviewModal
        isOpen={showPalette}
        onClose={() => setShowPalette(false)}
        items={accounts.map((account) => ({ code: account.code, name: account.name, color: account.color }))}
        nets={paletteNets}
        onApply={(apps) => void handleApplyPalette(apps)}
        title={t('settings.tabs.accounts')}
      />

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title={t('settings.accounts.deleteConfirmTitle')}
        message={`${deleteTarget?.account.name ?? ''} — ${t('settings.accounts.deleteConfirmMessage', { count: deleteTarget?.count ?? 0 })}`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default AccountsTab;
