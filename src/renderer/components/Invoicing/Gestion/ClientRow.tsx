import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Client, Devis, Facture } from '../../../types/Invoice';
import { DevisRow } from './DevisRow';
import { FactureRow } from './FactureRow';
import { ChevronToggle } from './ChevronToggle';
import { Transaction } from '../../../types/Transaction';

function formatAdresse(adresse: { rue: string; codePostal: string; ville: string; pays: string }): string {
  const parts = [adresse.rue, `${adresse.codePostal} ${adresse.ville}`.trim(), adresse.pays].filter(Boolean);
  return parts.join(', ');
}

interface ClientRowProps {
  client: Client;
  devisList: Devis[];
  facturesByDevis: Map<string, Facture[]>;
  facturesSansDevis: Facture[];
  transactionsById: Map<string, Transaction>;
  onAddDevis: () => void;
  onEditDevis: (devis: Devis) => void;
  onAddFacture: (devis: Devis) => void;
  onDeleteFacture: (facture: Facture) => void;
  onRefresh: () => Promise<void>;
  defaultExpanded?: boolean;
  onExpanded?: () => void;
}

export const ClientRow: React.FC<ClientRowProps> = ({
  client,
  devisList,
  facturesByDevis,
  facturesSansDevis,
  transactionsById,
  onAddDevis,
  onEditDevis,
  onAddFacture,
  onDeleteFacture,
  onRefresh,
  defaultExpanded = false,
  onExpanded,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (defaultExpanded) {
      setIsOpen(true);
      onExpanded?.();
    }
  }, [defaultExpanded, onExpanded]);

  const clientLabel = client.denominationSociale || `${client.prenom || ''} ${client.nom || ''}`.trim();
  const formattedAdresse = client.adresseFacturation ? formatAdresse(client.adresseFacturation) : '';

  // Calculer les statistiques du client
  const clientStats = useMemo(() => {
    const devisCount = devisList.length;

    let factureCount = facturesSansDevis.length;
    devisList.forEach((devis) => {
      const factures = facturesByDevis.get(devis.id) || [];
      factureCount += factures.length;
    });

    const totalDevisTTC = devisList.reduce((sum, d) => sum + d.totalTTC, 0);
    let paidAmount = 0;
    let hasOverduePayment = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkOverdue = (facture: Facture) => {
      const factPaidAmount = facture.paiements.reduce((sum, p) => sum + p.montant, 0);
      if (facture.dateEcheance && factPaidAmount < facture.totalTTC) {
        const echeance = new Date(facture.dateEcheance);
        echeance.setHours(0, 0, 0, 0);
        if (echeance < today) return true;
      }
      return false;
    };

    devisList.forEach((devis) => {
      const factures = facturesByDevis.get(devis.id) || [];
      factures.forEach((facture) => {
        paidAmount += facture.paiements.reduce((sum, p) => sum + p.montant, 0);
        if (checkOverdue(facture)) hasOverduePayment = true;
      });
    });

    facturesSansDevis.forEach((facture) => {
      paidAmount += facture.paiements.reduce((sum, p) => sum + p.montant, 0);
      if (checkOverdue(facture)) hasOverduePayment = true;
    });

    const completionRate = totalDevisTTC > 0 ? (paidAmount / totalDevisTTC) * 100 : 0;

    return {
      devisCount,
      factureCount,
      totalDevisTTC,
      paidAmount,
      completionRate,
      hasOverduePayment,
    };
  }, [devisList, facturesByDevis, facturesSansDevis]);

  return (
    <div className="invoicing-nested">
      <div className="invoicing-list-item">
        <ChevronToggle isOpen={isOpen} onClick={() => setIsOpen((prev) => !prev)} />
        
        <div className="invoicing-row-content invoicing-client-info">
          <div className="invoicing-client-main">
            <div className="invoicing-client-name">
              {clientStats.hasOverduePayment && (
                <span
                  className="invoicing-client-warning"
                  title={t('invoicing.gestion.overduePayments', 'Paiements en retard')}
                >
                  <AlertTriangle size={18} />
                </span>
              )}
              {clientLabel || t('invoicing.gestion.unknownClient')}
              {client.codeClient && <span className="meta"> • {client.codeClient}</span>}
            </div>
            {(client.telephone || client.email || formattedAdresse) && (
              <div className="invoicing-client-details">
                {client.telephone && <span>{client.telephone}</span>}
                {client.email && <span>{client.email}</span>}
                {formattedAdresse && <span>{formattedAdresse}</span>}
              </div>
            )}
          </div>

          <div className="invoicing-client-badges">
            <span className="invoicing-client-badge devis">
              {clientStats.devisCount} {t('invoicing.gestion.devis', 'Devis')}
            </span>
            <span className="invoicing-client-badge factures">
              {clientStats.factureCount} {t('invoicing.gestion.factures', 'Factures')}
            </span>
          </div>

          {clientStats.devisCount > 0 && (
            <div className="invoicing-recovery-container">
              <div className="invoicing-recovery-bar-wrapper">
                <div className="invoicing-recovery-bar">
                  <div
                    className="invoicing-recovery-progress"
                    style={{ width: `${Math.min(clientStats.completionRate, 100)}%` }}
                  />
                </div>
                <span className="invoicing-recovery-label">
                  {clientStats.paidAmount.toFixed(2)} € / {clientStats.totalDevisTTC.toFixed(2)} €
                </span>
              </div>
              <span className="invoicing-recovery-percent">
                {clientStats.completionRate.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        <div className="invoicing-list-item-actions">
          <button type="button" className="secondary" onClick={onAddDevis}>
            {t('invoicing.gestion.addDevis')}
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="invoicing-nested-content">
          {devisList.length === 0 && facturesSansDevis.length === 0 && (
            <div className="invoicing-empty">{t('invoicing.gestion.emptyDevis')}</div>
          )}
          {devisList.map((devis) => (
            <DevisRow
              key={devis.id}
              devis={devis}
              factures={facturesByDevis.get(devis.id) || []}
              transactionsById={transactionsById}
              clientName={clientLabel || t('invoicing.gestion.unknownClient')}
              onAddFacture={() => onAddFacture(devis)}
              onEditDevis={() => onEditDevis(devis)}
              onDeleteFacture={onDeleteFacture}
              onRefresh={onRefresh}
            />
          ))}
          {facturesSansDevis.length > 0 && (
            <div className="invoicing-subsection">
              <div className="invoicing-subsection-title">{t('invoicing.gestion.facturesSansDevis')}</div>
              {facturesSansDevis.map((facture) => (
                <FactureRow
                  key={facture.id}
                  facture={facture}
                  transactionsById={transactionsById}
                  clientName={clientLabel || t('invoicing.gestion.unknownClient')}
                  onDeleteFacture={() => onDeleteFacture(facture)}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
