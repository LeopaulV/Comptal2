import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Client, Devis, Facture } from '../../../types/Invoice';
import { DevisRow } from './DevisRow';
import { FactureRow } from './FactureRow';
import { ChevronToggle } from './ChevronToggle';
import { Transaction } from '../../../types/Transaction';

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
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const clientLabel = client.denominationSociale || `${client.prenom || ''} ${client.nom || ''}`.trim();

  // Calculer les statistiques du client
  const clientStats = useMemo(() => {
    // Nombre de devis
    const devisCount = devisList.length;

    // Nombre de factures (celles liées aux devis + celles sans devis)
    let factureCount = facturesSansDevis.length;
    facturesByDevis.forEach((factures) => {
      factureCount += factures.length;
    });

    // Calculer le montant total et payé
    let totalAmount = 0;
    let paidAmount = 0;

    // Factures liées aux devis
    facturesByDevis.forEach((factures) => {
      factures.forEach((facture) => {
        totalAmount += facture.totalTTC;
        // Calculer le montant payé via les paiements
        const factPaidAmount = facture.paiements.reduce((sum, p) => sum + p.montant, 0);
        paidAmount += factPaidAmount;
      });
    });

    // Factures sans devis
    facturesSansDevis.forEach((facture) => {
      totalAmount += facture.totalTTC;
      const factPaidAmount = facture.paiements.reduce((sum, p) => sum + p.montant, 0);
      paidAmount += factPaidAmount;
    });

    // Taux de recouvrement
    const recoveryRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

    return {
      devisCount,
      factureCount,
      totalAmount,
      paidAmount,
      recoveryRate,
    };
  }, [devisList, facturesByDevis, facturesSansDevis]);

  return (
    <div className="invoicing-nested">
      <div className="invoicing-list-item">
        <ChevronToggle isOpen={isOpen} onClick={() => setIsOpen((prev) => !prev)} />
        
        <div className="invoicing-row-content invoicing-client-info">
          <div className="invoicing-client-name">
            {clientLabel || t('invoicing.gestion.unknownClient')}
            {client.codeClient && <span className="meta"> • {client.codeClient}</span>}
          </div>
          
          <div className="invoicing-client-badges">
            <span className="invoicing-client-badge devis">
              {clientStats.devisCount} {t('invoicing.gestion.devis', 'Devis')}
            </span>
            <span className="invoicing-client-badge factures">
              {clientStats.factureCount} {t('invoicing.gestion.factures', 'Factures')}
            </span>
          </div>
          
          {clientStats.factureCount > 0 && (
            <div className="invoicing-recovery-container">
              <div className="invoicing-recovery-bar-wrapper">
                <div className="invoicing-recovery-bar">
                  <div 
                    className="invoicing-recovery-progress" 
                    style={{ width: `${Math.min(clientStats.recoveryRate, 100)}%` }}
                  />
                </div>
                <span className="invoicing-recovery-label">
                  {clientStats.paidAmount.toFixed(2)} € / {clientStats.totalAmount.toFixed(2)} €
                </span>
              </div>
              <span className="invoicing-recovery-percent">
                {clientStats.recoveryRate.toFixed(1)}%
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
