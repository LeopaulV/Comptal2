import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus } from 'lucide-react';
import { Donateur, Don, NatureDon, ModeVersement } from '../../types/association';
import { EMPTY_ADRESSE } from '../../types/invoice';
import { DonateurService } from '../../services/DonateurService';
import { DonsService } from '../../services/DonsService';
import { AssociationPDFService } from '../../services/AssociationPDFService';
import { ConfigService } from '../../services/ConfigService';
import { donateurDisplayName, formatMoney, newEntityId, toIsoDateInput } from '../../utils/invoiceFormat';
import { Logger } from '../../services/logger';
import WideModal from '../Common/WideModal';
import ConfirmModal from '../Common/ConfirmModal';
import { Category } from '../../types/models';

const DonateursPanel: React.FC = () => {
  const { t } = useTranslation();
  const [donateurs, setDonateurs] = useState<Donateur[]>([]);
  const [dons, setDons] = useState<Don[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Donateur | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [donFor, setDonFor] = useState<Donateur | null>(null);
  const [donForm, setDonForm] = useState({
    montant: 0,
    date: toIsoDateInput(new Date()),
    natureDon: 'numeraire' as NatureDon,
    modeVersement: 'virement' as ModeVersement,
  });

  const reload = useCallback(async () => {
    setDonateurs(await DonateurService.loadDonateurs());
    setDons(await DonsService.loadDons());
    setCategories(await ConfigService.listCategories());
  }, []);

  useEffect(() => {
    void reload().catch((err) => Logger.error('DonateursPanel.load', err));
  }, [reload]);

  const empty = (): Donateur => ({
    id: newEntityId('donateur'),
    type: 'particulier',
    adresse: { ...EMPTY_ADRESSE },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const don of dons) {
      map.set(don.donateurId, (map.get(don.donateurId) ?? 0) + don.montant);
    }
    return map;
  }, [dons]);

  return (
    <div className="flex flex-col gap-3">
      <div className="inv-toolbar">
        <button type="button" className="ct-btn-primary" onClick={() => setEditing(empty())}>
          <Plus size={16} /> {t('association.newDonateur')}
        </button>
      </div>
      {donateurs.length === 0 && <div className="inv-empty">{t('association.noDonateurs')}</div>}
      {donateurs.map((d) => (
        <div key={d.id} className="inv-row">
          <div className="inv-row-head" style={{ cursor: 'default' }}>
            <span className="inv-row-title">{donateurDisplayName(d)}</span>
            <span className="inv-row-meta">{formatMoney(totals.get(d.id) ?? 0)}</span>
            <button type="button" className="ct-btn-secondary" onClick={() => setEditing(d)}>
              {t('common.edit')}
            </button>
            <button type="button" className="ct-btn-primary" onClick={() => setDonFor(d)}>
              {t('association.addDon')}
            </button>
            <button
              type="button"
              className="ct-btn-danger"
              onClick={() => setDeleteId(d.id)}
            >
              {t('common.delete')}
            </button>
          </div>
        </div>
      ))}

      <WideModal isOpen={Boolean(editing)} title={t('association.donateurForm')} onClose={() => setEditing(null)}>
        {editing && (
          <div className="org-grid">
            <label className="org-field">
              <span>{t('org.type')}</span>
              <select
                value={editing.type}
                onChange={(e) => setEditing({ ...editing, type: e.target.value as Donateur['type'] })}
              >
                <option value="particulier">{t('org.typePart')}</option>
                <option value="entreprise">{t('org.typeEntreprise')}</option>
              </select>
            </label>
            <label className="org-field">
              <span>{t('clients.nom')}</span>
              <input value={editing.nom ?? ''} onChange={(e) => setEditing({ ...editing, nom: e.target.value })} />
            </label>
            <label className="org-field">
              <span>{t('clients.prenom')}</span>
              <input value={editing.prenom ?? ''} onChange={(e) => setEditing({ ...editing, prenom: e.target.value })} />
            </label>
            <label className="org-field">
              <span>{t('org.denomination')}</span>
              <input
                value={editing.denominationSociale ?? ''}
                onChange={(e) => setEditing({ ...editing, denominationSociale: e.target.value })}
              />
            </label>
            <label className="org-field">
              <span>{t('org.email')}</span>
              <input value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </label>
            <label className="org-field">
              <span>{t('association.category')}</span>
              <select
                value={editing.categoryCode ?? ''}
                onChange={(e) => setEditing({ ...editing, categoryCode: e.target.value || undefined })}
              >
                <option value="">{t('common.or')}</option>
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="full flex justify-end gap-2" style={{ gridColumn: '1 / -1' }}>
              <button type="button" className="ct-btn-secondary" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="ct-btn-primary"
                onClick={() =>
                  void DonateurService.upsertDonateur(editing).then(() => {
                    setEditing(null);
                    toast.success(t('common.success'));
                    return reload();
                  })
                }
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        )}
      </WideModal>

      <WideModal isOpen={Boolean(donFor)} title={t('association.addDon')} onClose={() => setDonFor(null)}>
        {donFor && (
          <div className="org-grid">
            <label className="org-field">
              <span>{t('association.montant')}</span>
              <input
                type="number"
                value={donForm.montant}
                onChange={(e) => setDonForm({ ...donForm, montant: Number(e.target.value) })}
              />
            </label>
            <label className="org-field">
              <span>{t('facturation.dateEmission')}</span>
              <input
                type="date"
                value={donForm.date}
                onChange={(e) => setDonForm({ ...donForm, date: e.target.value })}
              />
            </label>
            <label className="org-field">
              <span>{t('association.nature')}</span>
              <select
                value={donForm.natureDon}
                onChange={(e) => setDonForm({ ...donForm, natureDon: e.target.value as NatureDon })}
              >
                <option value="numeraire">{t('association.numeraire')}</option>
                <option value="nature">{t('association.natureDon')}</option>
                <option value="mecenat_competences">{t('association.mecenat')}</option>
              </select>
            </label>
            <div className="flex gap-2" style={{ gridColumn: '1 / -1' }}>
              <button
                type="button"
                className="ct-btn-primary"
                onClick={() =>
                  void DonsService.upsertDon({
                    id: newEntityId('don'),
                    donateurId: donFor.id,
                    montant: donForm.montant,
                    date: new Date(donForm.date),
                    natureDon: donForm.natureDon,
                    modeVersement: donForm.modeVersement,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  }).then(() => {
                    setDonFor(null);
                    return reload();
                  })
                }
              >
                {t('common.save')}
              </button>
              <button
                type="button"
                className="ct-btn-secondary"
                onClick={() =>
                  void AssociationPDFService.generateRecuFiscal({
                    donateur: donFor,
                    montant: donForm.montant,
                    date: donForm.date,
                    natureDon: donForm.natureDon,
                    modeVersement: donForm.modeVersement,
                  }).then(() => toast.success(t('association.recuOk')))
                }
              >
                {t('association.emitRecu')}
              </button>
            </div>
          </div>
        )}
      </WideModal>

      <ConfirmModal
        isOpen={Boolean(deleteId)}
        title={t('common.delete')}
        message={t('association.deleteDonateur')}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          void DonateurService.deleteDonateur(deleteId).then(() => {
            setDeleteId(null);
            return reload();
          });
        }}
      />
    </div>
  );
};

export default DonateursPanel;
