import { Facture, Paiement } from '../types/Invoice';
import { Transaction } from '../types/Transaction';
import { ClientService } from './ClientService';
import { DataService } from './DataService';
import { InvoiceService } from './InvoiceService';
import { RegistreRecettesEntrepriseService } from './RegistreRecettesEntrepriseService';

export class PaymentTrackingService {
  static async linkTransactionToInvoice(transactionId: string, factureId: string): Promise<Facture> {
    const factures = await InvoiceService.loadFactures();
    const facture = factures.find((item) => item.id === factureId);
    if (!facture) {
      throw new Error('Facture introuvable');
    }

    const transactions = await DataService.getTransactions();
    const transaction = transactions.find((item) => item.id === transactionId);
    if (!transaction) {
      throw new Error('Transaction introuvable');
    }

    const alreadyLinked = facture.paiements.some((p) => p.transactionId === transactionId);
    if (alreadyLinked) {
      return facture;
    }

    const paiement: Paiement = {
      id: `pay-${Date.now()}`,
      factureId,
      montant: Math.abs(transaction.amount),
      datePaiement: new Date(transaction.date),
      modePaiement: 'virement',
      transactionId: transaction.id,
      reference: transaction.description,
    };

    facture.paiements.push(paiement);
    facture.updatedAt = new Date();
    facture.statut = this.computeFactureStatus(facture);
    await InvoiceService.saveFactures(factures);
    await this.addEntryToRegistre(facture, paiement);
    return facture;
  }

  static async addManualPaiement(
    factureId: string,
    params: { montant: number; datePaiement: Date; modePaiement: 'especes' | 'cheque'; reference?: string }
  ): Promise<Facture> {
    const factures = await InvoiceService.loadFactures();
    const facture = factures.find((item) => item.id === factureId);
    if (!facture) {
      throw new Error('Facture introuvable');
    }

    const paiement: Paiement = {
      id: `pay-${Date.now()}`,
      factureId,
      montant: params.montant,
      datePaiement: new Date(params.datePaiement),
      modePaiement: params.modePaiement,
      reference: params.reference,
    };

    facture.paiements.push(paiement);
    facture.updatedAt = new Date();
    facture.statut = this.computeFactureStatus(facture);
    await InvoiceService.saveFactures(factures);
    await this.addEntryToRegistre(facture, paiement);
    return facture;
  }

  static async unlinkTransactionFromInvoice(paiementId: string, factureId: string): Promise<Facture> {
    const factures = await InvoiceService.loadFactures();
    const facture = factures.find((item) => item.id === factureId);
    if (!facture) {
      throw new Error('Facture introuvable');
    }

    const paiementIndex = facture.paiements.findIndex((p) => p.id === paiementId);
    if (paiementIndex === -1) {
      throw new Error('Paiement introuvable');
    }

    facture.paiements.splice(paiementIndex, 1);
    facture.updatedAt = new Date();
    facture.statut = this.computeFactureStatus(facture);
    await InvoiceService.saveFactures(factures);
    return facture;
  }

  static async searchMatchingTransactions(facture: Facture): Promise<Transaction[]> {
    const transactions = await DataService.getTransactions();
    const targetAmount = facture.totalTTC;
    const remaining = this.getRemainingAmount(facture);

    return transactions.filter((t) => {
      if (t.amount <= 0) return false;
      const amount = Math.abs(t.amount);
      const matchesTotal = this.isAmountClose(amount, targetAmount);
      const matchesRemaining = this.isAmountClose(amount, remaining);
      return matchesTotal || matchesRemaining;
    });
  }

  static getPaymentStatus(facture: Facture): { paidAmount: number; totalTTC: number; percent: number } {
    const paidAmount = facture.paiements.reduce((sum, paiement) => sum + paiement.montant, 0);
    const totalTTC = facture.totalTTC;
    const percent = totalTTC > 0 ? Math.min(100, (paidAmount / totalTTC) * 100) : 0;
    return { paidAmount, totalTTC, percent };
  }

  private static async addEntryToRegistre(facture: Facture, paiement: Paiement): Promise<void> {
    const clients = await ClientService.loadClients();
    const client = clients.find((c) => c.id === facture.clientId);
    const clientName = client
      ? (client.denominationSociale || [client.prenom, client.nom].filter(Boolean).join(' ') || 'Inconnu')
      : 'Inconnu';

    const tvaTotal = Object.values(facture.totalTVA).reduce((s, v) => s + v, 0);
    const tvaRatio = facture.totalTTC > 0 ? paiement.montant / facture.totalTTC : 0;
    const montantHT = paiement.montant - tvaTotal * tvaRatio;
    const tva = tvaTotal * tvaRatio;

    await RegistreRecettesEntrepriseService.addEntry({
      factureId: facture.id,
      paiementId: paiement.id,
      date: new Date(paiement.datePaiement).toISOString(),
      clientName,
      factureNumero: facture.numero,
      nature: facture.intituleSecondaire || facture.numero,
      montantHT,
      tva,
      montantTTC: paiement.montant,
      modePaiement: paiement.modePaiement,
      reference: paiement.reference || facture.numero,
      transactionId: paiement.transactionId,
    });
  }

  private static getRemainingAmount(facture: Facture): number {
    const paidAmount = facture.paiements.reduce((sum, paiement) => sum + paiement.montant, 0);
    return Math.max(0, facture.totalTTC - paidAmount);
  }

  private static isAmountClose(value: number, target: number): boolean {
    const tolerance = 0.01;
    return Math.abs(value - target) <= tolerance;
  }

  private static computeFactureStatus(facture: Facture): Facture['statut'] {
    const { percent } = this.getPaymentStatus(facture);
    if (percent >= 100) {
      return 'payee';
    }
    if (percent > 0) {
      return 'payee_partiellement';
    }
    return facture.statut === 'envoyee' ? 'envoyee' : 'brouillon';
  }
}
