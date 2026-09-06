import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, ChevronRight, FileText, Plus, ReceiptText, Search, WalletCards } from 'lucide-react';
import { Client, Devis, Facture } from '../../types/invoice';
import { ClientService } from '../../services/ClientService';
import { InvoiceService } from '../../services/InvoiceService';
import { EmetteurService } from '../../services/EmetteurService';
import { PDFService } from '../../services/PDFService';
import { AttachmentService } from '../../services/AttachmentService';
import { StatsService, TransactionListRow } from '../../services/StatsService';
import { PaymentTrackingService } from '../../services/PaymentTrackingService';
import { clientDisplayName, formatMoney } from '../../utils/invoiceFormat';
import { Logger } from '../../services/logger';
import DevisModal from './DevisModal';
import FactureModal from './FactureModal';
import GestionDevisRow from './GestionDevisRow';
import GestionFactureRow, { RecoveryBar } from './GestionFactureRow';

const DocumentsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [clients, setClients] = useState<Client[]>([]);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [transactions, setTransactions] = useState<TransactionListRow[]>([]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [devisOpen, setDevisOpen] = useState(false);
  const [factureOpen, setFactureOpen] = useState(false);
  const [editDevis, setEditDevis] = useState<Devis | null>(null);
  const [sourceDevis, setSourceDevis] = useState<Devis | null>(null);
  const [preselectedClientId, setPreselectedClientId] = useState<string | undefined>(undefined);

  const reload = useCallback(async () => {
    const [loadedClients, loadedDevis, loadedFactures, loadedTx] = await Promise.all([
      ClientService.loadBillingClients(),
      InvoiceService.loadDevis(),
      InvoiceService.loadFactures(),
      StatsService.listAllTransactions({}),
    ]);
    setClients(loadedClients.filter((c) => !c.archived));
    setDevis(loadedDevis.filter((d) => !d.supprime));
    setFactures(loadedFactures.filter((f) => !f.supprime));
    setTransactions(loadedTx);
  }, []);

  useEffect(() => {
    void reload().catch((err) => Logger.error('DocumentsPanel.load', err));
  }, [reload]);

  const transactionsById = useMemo(() => {
    const map = new Map<number, TransactionListRow>();
    transactions.forEach((tx) => map.set(tx.id, tx));
    return map;
  }, [transactions]);

  const devisByClient = useMemo(() => {
    const map = new Map<string, Devis[]>();
    devis.forEach((item) => {
      const list = map.get(item.clientId) ?? [];
      list.push(item);
      map.set(item.clientId, list);
    });
    return map;
  }, [devis]);

  const facturesByDevis = useMemo(() => {
    const map = new Map<string, Facture[]>();
    factures.forEach((facture) => {
      if (!facture.devisOrigine) return;
      const list = map.get(facture.devisOrigine) ?? [];
      list.push(facture);
      map.set(facture.devisOrigine, list);
    });
    return map;
  }, [factures]);

  const facturesSansDevisByClient = useMemo(() => {
    const map = new Map<string, Facture[]>();
    factures
      .filter((f) => !f.devisOrigine)
      .forEach((facture) => {
        const list = map.get(facture.clientId) ?? [];
        list.push(facture);
        map.set(facture.clientId, list);
      });
    return map;
  }, [factures]);

  const outstandingTotal = useMemo(
    () =>
      factures.reduce(
        (total, facture) =>
          total + Math.max(0, facture.totalTTC - PaymentTrackingService.getPaymentStatus(facture).paidAmount),
        0
      ),
    [factures]
  );

  const visibleClients = useMemo(() => {
    const q = query.toLowerCase().trim();
    return clients.filter((client) => {
      if (!q) return true;
      const name = clientDisplayName(client).toLowerCase();
      if (name.includes(q) || (client.codeClient || '').toLowerCase().includes(q)) return true;
      const docs = [
        ...(devisByClient.get(client.id) ?? []),
        ...(facturesSansDevisByClient.get(client.id) ?? []),
        ...(devisByClient.get(client.id) ?? []).flatMap((d) => facturesByDevis.get(d.id) ?? []),
      ];
      return docs.some((d) => d.numero.toLowerCase().includes(q));
    });
  }, [clients, query, devisByClient, facturesByDevis, facturesSansDevisByClient]);

  const openPdf = async (kind: 'devis' | 'facture', id: string) => {
    try {
      const emetteur = await EmetteurService.loadEmetteurExtended();
      if (!emetteur) return;
      if (kind === 'devis') {
        const d = devis.find((x) => x.id === id);
        if (!d) return;
        if (d.attachment?.path) await AttachmentService.openRel(d.attachment.path);
        else await PDFService.generateDevisPDF(d, emetteur);
      } else {
        const f = factures.find((x) => x.id === id);
        if (!f) return;
        if (f.attachment?.path) await AttachmentService.openRel(f.attachment.path);
        else await PDFService.generateFacturePDF(f, emetteur);
      }
    } catch (err) {
      Logger.error('DocumentsPanel.pdf', err);
    }
  };

  return (
    <div className="invoice-documents-workspace">
      <div className="inv-summary-grid inv-summary-grid-three">
        <div className="inv-summary-card">
          <span><FileText size={18} /></span>
          <div><small>{t('facturation.devis')}</small><strong>{devis.length}</strong></div>
        </div>
        <div className="inv-summary-card">
          <span><ReceiptText size={18} /></span>
          <div><small>{t('facturation.factures')}</small><strong>{factures.length}</strong></div>
        </div>
        <div className="inv-summary-card is-accent">
          <span><WalletCards size={18} /></span>
          <div><small>{t('clients.outstanding')}</small><strong>{formatMoney(outstandingTotal)}</strong></div>
        </div>
      </div>

      <div className="inv-toolbar-card">
        <label className="inv-search-wrap">
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('facturation.searchPlaceholder')}
          />
        </label>
        <button
          type="button"
          className="ct-btn-primary"
          onClick={() => {
            setEditDevis(null);
            setPreselectedClientId(undefined);
            setDevisOpen(true);
          }}
        >
          <Plus size={16} /> {t('facturation.newDevis')}
        </button>
      </div>

      <div className="inv-tree invoicing-list">
        {visibleClients.length === 0 && <div className="inv-empty">{t('facturation.emptyClients')}</div>}
        {visibleClients.map((client) => {
          const open = expanded[client.id];
          const clientDevis = devisByClient.get(client.id) ?? [];
          const sansDevis = facturesSansDevisByClient.get(client.id) ?? [];
          const name = clientDisplayName(client);
          let paidAmount = 0;
          let hasOverdue = false;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const checkOverdue = (facture: Facture) => {
            const paid = PaymentTrackingService.getPaymentStatus(facture).paidAmount;
            if (facture.dateEcheance && paid < facture.totalTTC) {
              const echeance = new Date(facture.dateEcheance);
              echeance.setHours(0, 0, 0, 0);
              return echeance < today;
            }
            return false;
          };
          clientDevis.forEach((d) => {
            (facturesByDevis.get(d.id) ?? []).forEach((f) => {
              paidAmount += PaymentTrackingService.getPaymentStatus(f).paidAmount;
              if (checkOverdue(f)) hasOverdue = true;
            });
          });
          sansDevis.forEach((f) => {
            paidAmount += PaymentTrackingService.getPaymentStatus(f).paidAmount;
            if (checkOverdue(f)) hasOverdue = true;
          });
          const totalDevisTTC = clientDevis.reduce((s, d) => s + d.totalTTC, 0);

          return (
            <div key={client.id} className="invoicing-nested inv-row">
              <div
                className="invoicing-list-item inv-row-head"
                onClick={() => setExpanded((e) => ({ ...e, [client.id]: !open }))}
              >
                <span className="inv-expand-icon">
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <span className="inv-client-avatar">{name.slice(0, 2).toUpperCase()}</span>
                <div className="invoicing-client-info">
                  <div className="invoicing-client-name">
                    {hasOverdue && (
                      <span className="invoicing-client-warning" title={t('facturation.overdue')}>
                        <AlertTriangle size={16} />
                      </span>
                    )}
                    {name}
                    {client.codeClient && <span className="meta"> • {client.codeClient}</span>}
                  </div>
                </div>
                <div className="invoicing-client-badges">
                  <span className="invoicing-client-badge devis">
                    {clientDevis.length} {t('facturation.devis')}
                  </span>
                  <span className="invoicing-client-badge factures">
                    {clientDevis.reduce((n, d) => n + (facturesByDevis.get(d.id)?.length ?? 0), 0) + sansDevis.length}{' '}
                    {t('facturation.factures')}
                  </span>
                </div>
                {clientDevis.length > 0 && (
                  <RecoveryBar paidAmount={paidAmount} totalAmount={totalDevisTTC} />
                )}
                <div className="invoicing-list-item-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="ct-btn-primary inv-compact-button"
                    onClick={() => {
                      setEditDevis(null);
                      setPreselectedClientId(client.id);
                      setDevisOpen(true);
                    }}
                  >
                    {t('facturation.newDevis')}
                  </button>
                </div>
              </div>
              {open && (
                <div className="invoicing-nested-content">
                  {clientDevis.length === 0 && sansDevis.length === 0 && (
                    <div className="invoicing-empty">{t('facturation.emptyDevis')}</div>
                  )}
                  {clientDevis.map((d) => (
                    <GestionDevisRow
                      key={d.id}
                      devis={d}
                      factures={facturesByDevis.get(d.id) ?? []}
                      transactionsById={transactionsById}
                      clientName={name}
                      onAddFacture={() => {
                        setSourceDevis(d);
                        setFactureOpen(true);
                      }}
                      onEditDevis={() => {
                        setEditDevis(d);
                        setPreselectedClientId(client.id);
                        setDevisOpen(true);
                      }}
                      onRefresh={reload}
                      onPdf={() => void openPdf('devis', d.id)}
                      onPdfFacture={(f) => void openPdf('facture', f.id)}
                    />
                  ))}
                  {sansDevis.length > 0 && (
                    <div className="invoicing-subsection">
                      <div className="invoicing-subsection-title">{t('facturation.facturesSansDevis')}</div>
                      {sansDevis.map((f) => (
                        <GestionFactureRow
                          key={f.id}
                          facture={f}
                          transactionsById={transactionsById}
                          clientName={name}
                          onRefresh={reload}
                          onPdf={() => void openPdf('facture', f.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <DevisModal
        isOpen={devisOpen}
        clientId={editDevis?.clientId || preselectedClientId}
        devisToEdit={editDevis}
        onClose={() => {
          setDevisOpen(false);
          setEditDevis(null);
          setPreselectedClientId(undefined);
          void reload();
        }}
      />
      <FactureModal
        isOpen={factureOpen}
        devis={sourceDevis}
        onClose={() => {
          setFactureOpen(false);
          setSourceDevis(null);
          void reload();
        }}
      />
    </div>
  );
};

export default DocumentsPanel;
