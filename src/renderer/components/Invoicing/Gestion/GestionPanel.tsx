import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Client, Devis, Facture } from '../../../types/Invoice';
import { ClientService } from '../../../services/ClientService';
import { InvoiceService } from '../../../services/InvoiceService';
import { DataService } from '../../../services/DataService';
import { Transaction } from '../../../types/Transaction';
import { ClientRow } from './ClientRow';
import { ClientModal } from './ClientModal';
import { DevisModal } from './DevisModal';
import { FactureModal } from './FactureModal';

interface GestionPanelProps {
  onDataChange?: () => void | Promise<void>;
}

export const GestionPanel: React.FC<GestionPanelProps> = ({ onDataChange }) => {
  const { t } = useTranslation();
  const [clients, setClients] = useState<Client[]>([]);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [activeDevis, setActiveDevis] = useState<Devis | null>(null);
  const [activeDevisToEdit, setActiveDevisToEdit] = useState<Devis | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isDevisModalOpen, setIsDevisModalOpen] = useState(false);
  const [isDevisEditModalOpen, setIsDevisEditModalOpen] = useState(false);
  const [isFactureModalOpen, setIsFactureModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [loadedClients, loadedDevis, loadedFactures, loadedTransactions] = await Promise.all([
        ClientService.loadClients(),
        InvoiceService.loadDevis(),
        InvoiceService.loadFactures(),
        DataService.getTransactions(),
      ]);
      setClients(loadedClients);
      setDevis(loadedDevis);
      setFactures(loadedFactures);
      setTransactions(loadedTransactions);
      await onDataChange?.();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const devisByClient = useMemo(() => {
    const map = new Map<string, Devis[]>();
    devis
      .filter((item) => !item.supprime)
      .forEach((item) => {
        if (!map.has(item.clientId)) {
          map.set(item.clientId, []);
        }
        map.get(item.clientId)!.push(item);
      });
    return map;
  }, [devis]);

  const facturesByDevis = useMemo(() => {
    const map = new Map<string, Facture[]>();
    factures
      .filter((facture) => !facture.supprime && facture.devisOrigine)
      .forEach((facture) => {
        if (!map.has(facture.devisOrigine!)) {
          map.set(facture.devisOrigine!, []);
        }
        map.get(facture.devisOrigine!)!.push(facture);
      });
    return map;
  }, [factures]);

  const facturesSansDevisByClient = useMemo(() => {
    const map = new Map<string, Facture[]>();
    factures
      .filter((facture) => !facture.supprime && !facture.devisOrigine)
      .forEach((facture) => {
        if (!map.has(facture.clientId)) {
          map.set(facture.clientId, []);
        }
        map.get(facture.clientId)!.push(facture);
      });
    return map;
  }, [factures]);

  const transactionsById = useMemo(() => {
    const map = new Map<string, Transaction>();
    transactions.forEach((transaction) => map.set(transaction.id, transaction));
    return map;
  }, [transactions]);

  const handleAddClient = () => {
    setIsClientModalOpen(true);
  };

  const handleAddDevis = (clientId: string) => {
    setActiveClientId(clientId);
    setIsDevisModalOpen(true);
  };

  const handleAddFacture = (devisItem: Devis) => {
    setActiveDevis(devisItem);
    setIsFactureModalOpen(true);
  };

  const handleEditDevis = (devisItem: Devis) => {
    setActiveDevisToEdit(devisItem);
    setIsDevisEditModalOpen(true);
  };

  const handleDeleteFacture = async (facture: Facture) => {
    await InvoiceService.softDeleteFacture(facture.id);
    await loadData();
  };

  const closeClientModal = async () => {
    setIsClientModalOpen(false);
    await loadData();
  };

  const closeDevisModal = async () => {
    setIsDevisModalOpen(false);
    setActiveClientId(null);
    await loadData();
  };

  const closeDevisEditModal = async () => {
    setIsDevisEditModalOpen(false);
    setActiveDevisToEdit(null);
    await loadData();
  };

  const closeFactureModal = async () => {
    setIsFactureModalOpen(false);
    setActiveDevis(null);
    await loadData();
  };

  return (
    <div className="invoicing-panel">
      <div className="invoicing-card">
        <div className="invoicing-header-row">
          <h2>{t('invoicing.gestion.title', 'Gestion Clients')}</h2>
          <button type="button" className="primary" onClick={handleAddClient}>
            + {t('invoicing.gestion.addClient', 'Nouveau Client')}
          </button>
        </div>
        {isLoading ? (
          <div className="invoicing-empty" style={{ padding: '40px', textAlign: 'center' }}>
            {t('invoicing.gestion.loading', 'Chargement...')}
          </div>
        ) : (
          <div className="invoicing-list">
            {clients.map((client) => (
              <ClientRow
                key={client.id}
                client={client}
                devisList={devisByClient.get(client.id) || []}
                facturesByDevis={facturesByDevis}
                facturesSansDevis={facturesSansDevisByClient.get(client.id) || []}
                transactionsById={transactionsById}
                onAddDevis={() => handleAddDevis(client.id)}
                onEditDevis={handleEditDevis}
                onAddFacture={handleAddFacture}
                onDeleteFacture={handleDeleteFacture}
                onRefresh={loadData}
              />
            ))}
            {clients.length === 0 && (
              <div className="invoicing-empty" style={{ padding: '40px', textAlign: 'center' }}>
                {t('invoicing.gestion.empty', 'Aucun client. Cliquez sur "Nouveau Client" pour commencer.')}
              </div>
            )}
          </div>
        )}
      </div>

      <ClientModal isOpen={isClientModalOpen} onClose={closeClientModal} />
      <DevisModal isOpen={isDevisModalOpen} clientId={activeClientId} onClose={closeDevisModal} />
      <DevisModal isOpen={isDevisEditModalOpen} devisToEdit={activeDevisToEdit} onClose={closeDevisEditModal} />
      <FactureModal isOpen={isFactureModalOpen} devis={activeDevis} onClose={closeFactureModal} />
    </div>
  );
};
