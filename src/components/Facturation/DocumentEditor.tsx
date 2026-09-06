import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus, Trash2 } from 'lucide-react';
import { Client, Devis, Facture, PosteFacture } from '../../types/invoice';
import { ClientService } from '../../services/ClientService';
import { EmetteurService } from '../../services/EmetteurService';
import { InvoiceService } from '../../services/InvoiceService';
import { PDFService } from '../../services/PDFService';
import { PosteService } from '../../services/PosteService';
import { formatMoney, isDevisCaduc, newEntityId, toIsoDateInput } from '../../utils/invoiceFormat';
import { Logger } from '../../services/logger';
import HoursInput from './HoursInput';
import {
  isInvoiceIssued,
  mandatoryInvoiceMentions,
  snapshotVendeur,
} from '../../services/InvoiceLegalService';
import { LegalMentionsService } from '../../services/LegalMentionsService';

interface DocumentEditorProps {
  documentType: 'devis' | 'facture';
  clientId?: string;
  initialDevis?: Devis;
  devisForFacture?: Devis;
  initialFacture?: Facture;
  onSaved?: () => void;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({
  documentType,
  clientId,
  initialDevis,
  devisForFacture,
  initialFacture,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [clients, setClients] = useState<Client[]>([]);
  const [catalogue, setCatalogue] = useState<PosteFacture[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(clientId || '');
  const [numero, setNumero] = useState('');
  const [intitule, setIntitule] = useState('');
  const [postes, setPostes] = useState<PosteFacture[]>([]);
  const [dateEmission, setDateEmission] = useState(toIsoDateInput(new Date()));
  const [dateEcheance, setDateEcheance] = useState('');
  const [dateValidite, setDateValidite] = useState('');
  const [saving, setSaving] = useState(false);
  const isNewDocument = !initialDevis && !initialFacture;
  const clientLocked = Boolean(initialDevis || initialFacture || devisForFacture);
  const invoiceLocked = Boolean(initialFacture && isInvoiceIssued(initialFacture));

  useEffect(() => {
    void (async () => {
      setClients(await ClientService.loadBillingClients());
      setCatalogue(devisForFacture ? devisForFacture.postes : await PosteService.loadPostes());
    })();
  }, [devisForFacture]);

  useEffect(() => {
    if (initialDevis) {
      setNumero(initialDevis.numero);
      setSelectedClientId(initialDevis.clientId);
      setPostes(initialDevis.postes);
      setIntitule(initialDevis.intituleSecondaire ?? '');
      setDateEmission(toIsoDateInput(initialDevis.dateEmission));
      setDateValidite(toIsoDateInput(initialDevis.dateValidite));
      setDateEcheance(toIsoDateInput(initialDevis.dateEcheance));
    } else if (initialFacture) {
      setNumero(initialFacture.numero);
      setSelectedClientId(initialFacture.clientId);
      setPostes(initialFacture.postes);
      setIntitule(initialFacture.intituleSecondaire ?? '');
      setDateEmission(toIsoDateInput(initialFacture.dateEmission));
      setDateEcheance(toIsoDateInput(initialFacture.dateEcheance));
    } else if (devisForFacture) {
      setSelectedClientId(devisForFacture.clientId);
      setPostes(devisForFacture.postes.map((p) => ({ ...p, id: newEntityId('poste') })));
      setIntitule(devisForFacture.intituleSecondaire ?? '');
    }
  }, [initialDevis, initialFacture, devisForFacture]);

  const totals = useMemo(() => InvoiceService.calculateTotals(postes), [postes]);
  const devisCap = devisForFacture?.totalTTC;
  const overCap = Boolean(devisCap && totals.totalTTC > devisCap + 0.009);

  useEffect(() => {
    if (clientId) setSelectedClientId(clientId);
  }, [clientId]);

  useEffect(() => {
    if (!isNewDocument) return;
    let cancelled = false;
    const client = clients.find((c) => c.id === selectedClientId);
    if (documentType === 'devis') {
      if (!selectedClientId || clients.length === 0) {
        setNumero('');
        return;
      }
      void InvoiceService.peekNextNumero('devis', { codeClient: client?.codeClient })
        .then((value) => {
          if (!cancelled) setNumero(value);
        })
        .catch((err) => Logger.error('DocumentEditor.peekNumero', err));
      return () => {
        cancelled = true;
      };
    }
    if (documentType === 'facture') {
      void InvoiceService.peekNextNumero('facture')
        .then((value) => {
          if (!cancelled) setNumero(value);
        })
        .catch((err) => Logger.error('DocumentEditor.peekNumero', err));
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [isNewDocument, documentType, selectedClientId, clients, devisForFacture]);

  const addFromCatalogue = (poste: PosteFacture) => {
    setPostes((prev) => [...prev, { ...poste, id: newEntityId('poste') }]);
  };

  const patchPoste = (idx: number, partial: Record<string, unknown>) => {
    setPostes((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...partial } as PosteFacture;
      return next;
    });
  };

  const addMaterielLine = () => {
    setPostes((prev) => [
      ...prev,
      {
        id: newEntityId('poste'),
        type: 'materiel',
        designation: '',
        prixUnitaireHT: 0,
        tauxTVA: 20,
        quantite: 1,
        unite: 'unite',
      },
    ]);
  };

  const addTravailLine = () => {
    setPostes((prev) => [
      ...prev,
      {
        id: newEntityId('poste'),
        type: 'travail',
        designation: '',
        tauxHoraire: 0,
        heuresEstimees: 1,
        nombreIntervenants: 1,
        tauxTVA: 20,
      },
    ]);
  };

  const save = async () => {
    if (invoiceLocked) return;
    if (!selectedClientId) {
      toast.error(t('facturation.chooseClient'));
      return;
    }
    if (devisForFacture && isDevisCaduc(devisForFacture)) {
      toast.error(t('facturation.caduc.cannotInvoice'));
      return;
    }
    if (overCap) {
      toast.error(t('facturation.overCap'));
      return;
    }
    setSaving(true);
    try {
      const emetteur = await EmetteurService.loadEmetteurExtended();
      if (!emetteur) throw new Error(t('facturation.emetteurRequired'));
      const vendeur = snapshotVendeur(emetteur);
      const extraMentions = await LegalMentionsService.generateMentionsText(
        emetteur.selectedMentionsLegales ?? [],
        emetteur.customMentionsLegales ?? [],
        emetteur.mentionPlaceholderValues ?? {}
      );
      const mentionsLegales = mandatoryInvoiceMentions(emetteur, extraMentions);
      const now = new Date();
      if (documentType === 'devis') {
        const allocated =
          initialDevis?.numero ||
          (await InvoiceService.generateNumero('devis', {
            codeClient: clients.find((c) => c.id === selectedClientId)?.codeClient,
          }));
        const devis: Devis = {
          id: initialDevis?.id || newEntityId('devis'),
          documentType: 'devis',
          numero: allocated,
          intituleSecondaire: intitule,
          clientId: selectedClientId,
          dateEmission: new Date(dateEmission),
          dateEcheance: dateEcheance ? new Date(dateEcheance) : undefined,
          dateValidite: dateValidite ? new Date(dateValidite) : new Date(Date.now() + 30 * 86400000),
          postes,
          vendeur,
          mentionsLegales,
          ...totals,
          conditionsPaiement: (await EmetteurService.loadInvoiceSettingsSafe(emetteur)).conditionsPaiementDefaut,
          statut: initialDevis?.statut && isDevisCaduc(initialDevis) ? 'caduc' : 'brouillon',
          caduc: initialDevis?.caduc,
          caducite: initialDevis?.caducite,
          clientAttachments: initialDevis?.clientAttachments,
          createdAt: initialDevis?.createdAt || now,
          updatedAt: now,
        };
        await InvoiceService.upsertDevis(devis);
        try {
          const attachment = await PDFService.generateDevisPDFToFile(devis, emetteur);
          devis.attachment = {
            mode: 'copy',
            path: attachment.path,
            name: attachment.name,
            mimeType: 'application/pdf',
          };
          await InvoiceService.upsertDevis(devis);
        } catch (pdfErr) {
          Logger.error('DocumentEditor.savePdf', pdfErr);
          toast.warn(t('facturation.pdfSaveWarn'));
        }
      } else {
        const allocated =
          initialFacture?.numero ||
          (await InvoiceService.generateNumero('facture'));
        const facture: Facture = {
          id: initialFacture?.id || newEntityId('fac'),
          documentType: 'facture',
          numero: allocated,
          intituleSecondaire: intitule,
          clientId: selectedClientId,
          dateEmission: new Date(dateEmission),
          dateEcheance: dateEcheance ? new Date(dateEcheance) : undefined,
          postes,
          vendeur,
          mentionsLegales,
          ...totals,
          paiements: initialFacture?.paiements ?? [],
          devisOrigine: devisForFacture?.id || initialFacture?.devisOrigine,
          statut: 'envoyee',
          createdAt: initialFacture?.createdAt || now,
          updatedAt: now,
        };
        await InvoiceService.upsertFacture(facture);
        try {
          const attachment = await PDFService.generateFacturePDFToFile(facture, emetteur);
          facture.attachment = {
            mode: 'copy',
            path: attachment.path,
            name: attachment.name,
            mimeType: 'application/pdf',
          };
          await InvoiceService.upsertFacture(facture);
        } catch (pdfErr) {
          Logger.error('DocumentEditor.savePdf', pdfErr);
          toast.warn(t('facturation.pdfSaveWarn'));
        }
        if (devisForFacture) {
          await InvoiceService.upsertDevis({
            ...devisForFacture,
            factureGeneree: facture.id,
            updatedAt: now,
          });
        }
      }
      toast.success(t('common.success'));
      onSaved?.();
    } catch (err) {
      Logger.error('DocumentEditor.save', err);
      toast.error(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {invoiceLocked && (
        <p className="ct-hint" style={{ color: 'var(--invoicing-warning)' }}>
          {t('facturation.issuedLocked')}
        </p>
      )}
      <div className="org-grid">
        <label className="org-field">
          <span>{t('facturation.client')}</span>
          <select
            value={selectedClientId}
            disabled={clientLocked || invoiceLocked}
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">{t('facturation.chooseClient')}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codeClient} — {c.denominationSociale || `${c.prenom ?? ''} ${c.nom ?? ''}`}
              </option>
            ))}
          </select>
        </label>
        <label className="org-field">
          <span>{t('facturation.numero')}</span>
          <input
            value={numero}
            readOnly
            placeholder={t('facturation.numeroAuto')}
            title={t('facturation.numeroAutoHint')}
          />
        </label>
        <label className="org-field">
          <span>{t('facturation.dateEmission')}</span>
          <input type="date" value={dateEmission} disabled={invoiceLocked} onChange={(e) => setDateEmission(e.target.value)} />
        </label>
        {documentType === 'devis' ? (
          <label className="org-field">
            <span>{t('facturation.dateValidite')}</span>
            <input type="date" value={dateValidite} onChange={(e) => setDateValidite(e.target.value)} />
          </label>
        ) : (
          <label className="org-field">
            <span>{t('facturation.dateEcheance')}</span>
            <input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} />
          </label>
        )}
        <label className="org-field full">
          <span>{t('facturation.intitule')}</span>
          <input value={intitule} onChange={(e) => setIntitule(e.target.value)} />
        </label>
      </div>

      <div>
        <h3 className="org-section-title">{t('facturation.lignes')}</h3>
        {catalogue.length > 0 && !invoiceLocked && (
          <select
            className="inv-search mb-2"
            defaultValue=""
            onChange={(e) => {
              const found = catalogue.find((p) => p.id === e.target.value);
              if (found) addFromCatalogue(found);
              e.target.value = '';
            }}
          >
            <option value="">{t('facturation.addFromCatalogue')}</option>
            {catalogue.map((p) => (
              <option key={p.id} value={p.id}>
                {p.designation}
              </option>
            ))}
          </select>
        )}
        {!invoiceLocked && (
        <div className="flex flex-wrap gap-2 mb-2">
          <button type="button" className="ct-btn-secondary" onClick={addMaterielLine}>
            <Plus size={14} /> {t('facturation.addLine')}
          </button>
          <button type="button" className="ct-btn-secondary" onClick={addTravailLine}>
            <Plus size={14} /> {t('facturation.addTravailLine')}
          </button>
        </div>
        )}
        {postes.map((poste, idx) => (
          <div key={poste.id} className="org-grid inv-poste-card mb-2">
            <label className="org-field full">
              <span>
                {poste.type === 'travail' ? t('facturation.posteTravail') : t('facturation.posteMateriel')} —{' '}
                {t('facturation.designation')}
              </span>
              <input
                value={poste.designation}
                onChange={(e) => patchPoste(idx, { designation: e.target.value })}
              />
            </label>
            {poste.type === 'materiel' && (
              <>
                <label className="org-field">
                  <span>{t('facturation.qty')}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={poste.quantite}
                    onChange={(e) => patchPoste(idx, { quantite: Number(e.target.value) })}
                  />
                </label>
                <label className="org-field">
                  <span>{t('facturation.prixHT')}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={poste.prixUnitaireHT}
                    onChange={(e) => patchPoste(idx, { prixUnitaireHT: Number(e.target.value) })}
                  />
                </label>
              </>
            )}
            {poste.type === 'travail' && (
              <>
                <label className="org-field">
                  <span>{t('facturation.heures')}</span>
                  <HoursInput
                    value={poste.heuresEstimees}
                    onChange={(heuresEstimees) => patchPoste(idx, { heuresEstimees })}
                  />
                </label>
                <label className="org-field">
                  <span>{t('facturation.tauxHoraire')}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={poste.tauxHoraire}
                    onChange={(e) => patchPoste(idx, { tauxHoraire: Number(e.target.value) })}
                  />
                </label>
                <label className="org-field">
                  <span>{t('facturation.intervenants')}</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={poste.nombreIntervenants}
                    onChange={(e) =>
                      patchPoste(idx, { nombreIntervenants: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                </label>
              </>
            )}
            <label className="org-field">
              <span>TVA %</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={poste.tauxTVA}
                onChange={(e) => patchPoste(idx, { tauxTVA: Number(e.target.value) })}
              />
            </label>
            <div className="org-field">
              <span>{t('facturation.lineHT')}</span>
              <strong>{formatMoney(InvoiceService.calculateLineHT(poste))}</strong>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="ct-btn-danger"
                onClick={() => setPostes(postes.filter((p) => p.id !== poste.id))}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="text-right">
        <div>HT {formatMoney(totals.totalHT)}</div>
        <div>TVA {formatMoney(Object.values(totals.totalTVA).reduce((a, b) => a + b, 0))}</div>
        <strong>TTC {formatMoney(totals.totalTTC)}</strong>
        {overCap && <div style={{ color: 'var(--invoicing-danger)' }}>{t('facturation.overCap')}</div>}
      </div>

      <button
        type="button"
        className="ct-btn-primary"
        disabled={saving || invoiceLocked || Boolean(initialDevis && isDevisCaduc(initialDevis))}
        onClick={() => void save()}
      >
        {t('common.save')}
      </button>
    </div>
  );
};

export default DocumentEditor;
