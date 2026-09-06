#!/usr/bin/env python3
"""Complète le profil Démo graphiques pour tous les onglets / widgets Chart.js."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]
PROFILE_ID = "profile_demo_graphiques"
DB_PATH = APP_ROOT / "data" / "profils" / PROFILE_ID / "comptal.db"
NOW = "2026-09-05T10:00:00.000Z"


def dumps(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def iso(date: str) -> str:
    return f"{date}T12:00:00.000Z"


def document_base(
    *,
    document_id: str,
    number: str,
    client_id: str,
    issue_date: str,
    due_date: str,
    total_ht: float,
    status: str,
) -> dict[str, object]:
    vat = round(total_ht * 0.2, 2)
    ttc = round(total_ht + vat, 2)
    return {
        "id": document_id,
        "numero": number,
        "clientId": client_id,
        "dateEmission": iso(issue_date),
        "dateEcheance": iso(due_date),
        "postes": [
            {
                "id": f"poste_{document_id}",
                "type": "materiel",
                "designation": "Prestation de démonstration",
                "prixUnitaireHT": total_ht,
                "tauxTVA": 20,
                "quantite": 1,
                "unite": "forfait",
            }
        ],
        "vendeur": {
            "denominationSociale": "Comptal Développement SAS",
            "formeJuridique": "SAS",
            "adresse": {
                "rue": "10 rue des Tests",
                "codePostal": "75002",
                "ville": "Paris",
                "pays": "France",
            },
            "siren": "732829320",
            "siret": "73282932000074",
            "numeroTVA": "FR09732829320",
            "capitalSocial": 10000,
        },
        "totalHT": total_ht,
        "totalTVA": {"20": vat},
        "totalTTC": ttc,
        "conditionsPaiement": "Paiement à 30 jours",
        "statut": status,
        "createdAt": iso(issue_date),
        "updatedAt": NOW,
        "documentType": "facture",
        "devisOrigine": None,
        "paiements": [],
    }


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"Base introuvable: {DB_PATH}")

    connection = sqlite3.connect(DB_PATH)
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        cols = {row[1] for row in connection.execute("PRAGMA table_info(transactions)")}
        if "tag" not in cols:
            connection.execute("ALTER TABLE transactions ADD COLUMN tag TEXT")

        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS color_palettes (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              payload TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS label_rules (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              word TEXT NOT NULL UNIQUE,
              category_code TEXT,
              tag TEXT,
              active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS dashboard_settings (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              payload TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS app_settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
            PRAGMA user_version = 13;
            """
        )

        incomplete = {
            "id": "cli_incomplet",
            "roles": ["client"],
            "codeClient": "IN001",
            "type": "particulier",
            "color": "#94a3b8",
            "nom": "Sans",
            "prenom": "Coordonnées",
            "adresseFacturation": {"rue": "", "codePostal": "", "ville": "", "pays": "France"},
            "notes": "Fiche volontairement incomplète (graphiques Contacts).",
            "createdAt": NOW,
            "updatedAt": NOW,
        }
        nosiren = {
            "id": "cli_nosiren",
            "roles": ["client"],
            "codeClient": "NS001",
            "type": "entreprise",
            "color": "#f97316",
            "denominationSociale": "Atelier Sans SIREN",
            "formeJuridique": "SARL",
            "email": "atelier@example.test",
            "adresseFacturation": {
                "rue": "3 impasse du Marché",
                "codePostal": "31000",
                "ville": "Toulouse",
                "pays": "France",
            },
            "notes": "Entreprise sans SIREN — bucket Contacts.",
            "createdAt": NOW,
            "updatedAt": NOW,
        }
        claire = {
            "id": "cli_bernard",
            "roles": ["client", "donateur"],
            "codeClient": "BE001",
            "type": "particulier",
            "color": "#e9d5ff",
            "civilite": "Mme",
            "nom": "Bernard",
            "prenom": "Claire",
            "email": "claire.bernard@example.test",
            "telephone": "06 22 33 44 55",
            "adresseFacturation": {
                "rue": "27 quai Saint-Vincent",
                "codePostal": "69001",
                "ville": "Lyon",
                "pays": "France",
            },
            "createdAt": NOW,
            "updatedAt": NOW,
        }
        paul = {
            "id": "cli_paul",
            "roles": ["donateur"],
            "codeClient": "PA001",
            "type": "particulier",
            "color": "#99f6e4",
            "civilite": "M.",
            "nom": "Dupont",
            "prenom": "Paul",
            "email": "paul.dupont@example.test",
            "adresseFacturation": {
                "rue": "12 rue des Lilas",
                "codePostal": "33000",
                "ville": "Bordeaux",
                "pays": "France",
            },
            "createdAt": NOW,
            "updatedAt": NOW,
        }
        donor_incomplete = {
            "id": "cli_donateur_incomplet",
            "roles": ["donateur"],
            "codeClient": "DI001",
            "type": "particulier",
            "color": "#fda4af",
            "notes": "Donateur sans identité ni adresse — KPI reçus 11580.",
            "createdAt": NOW,
            "updatedAt": NOW,
        }
        for client in (incomplete, nosiren, claire, paul, donor_incomplete):
            connection.execute(
                """INSERT OR REPLACE INTO clients
                   (id, code_client, type, archived, payload, updated_at)
                   VALUES (?, ?, ?, 0, ?, ?)""",
                (client["id"], client["codeClient"], client["type"], dumps(client), NOW),
            )

        extra_invoices = [
            ("facture_aging_current", "FAC-2026-0002", "cli_techsolutions", "2026-08-20", "2026-09-20", 900, "envoyee", []),
            ("facture_aging_d30", "FAC-2026-0003", "cli_martin", "2026-07-20", "2026-08-15", 720, "en_retard", []),
            ("facture_aging_d60", "FAC-2026-0004", "cli_techsolutions", "2026-06-15", "2026-07-20", 1440, "en_retard", []),
            ("facture_aging_d90", "FAC-2026-0005", "cli_martin", "2026-05-10", "2026-06-20", 480, "en_retard", []),
            ("facture_aging_d90p", "FAC-2026-0006", "cli_techsolutions", "2026-04-01", "2026-05-01", 2160, "en_retard", []),
            (
                "facture_paid_march",
                "FAC-2026-0007",
                "cli_techsolutions",
                "2026-03-05",
                "2026-04-04",
                1500,
                "payee",
                [
                    {
                        "id": "pay_2026_0007",
                        "factureId": "facture_paid_march",
                        "montant": 1800,
                        "datePaiement": iso("2026-03-18"),
                        "modePaiement": "virement",
                    }
                ],
            ),
            (
                "facture_partial_june",
                "FAC-2026-0008",
                "cli_martin",
                "2026-06-02",
                "2026-07-02",
                2000,
                "payee_partiellement",
                [
                    {
                        "id": "pay_2026_0008",
                        "factureId": "facture_partial_june",
                        "montant": 800,
                        "datePaiement": iso("2026-06-20"),
                        "modePaiement": "virement",
                    }
                ],
            ),
        ]
        for doc_id, number, client_id, issued, due, ht, status, payments in extra_invoices:
            payload = document_base(
                document_id=doc_id,
                number=number,
                client_id=client_id,
                issue_date=issued,
                due_date=due,
                total_ht=ht,
                status=status,
            )
            payload["paiements"] = payments
            connection.execute(
                """INSERT OR REPLACE INTO factures
                   (id, client_id, numero, statut, devis_origine, supprime, payload, updated_at)
                   VALUES (?, ?, ?, ?, NULL, 0, ?, ?)""",
                (doc_id, client_id, number, status, dumps(payload), NOW),
            )

        open_quote = document_base(
            document_id="devis_ouvert",
            number="DEVIS-2026-0002",
            client_id="cli_techsolutions",
            issue_date="2026-08-12",
            due_date="2026-09-12",
            total_ht=1100,
            status="envoye",
        )
        open_quote.update({"documentType": "devis", "dateValidite": iso("2026-09-12")})
        del open_quote["paiements"]
        del open_quote["devisOrigine"]
        connection.execute(
            """INSERT OR REPLACE INTO devis
               (id, client_id, numero, statut, supprime, payload, updated_at)
               VALUES (?, ?, ?, ?, 0, ?, ?)""",
            (open_quote["id"], open_quote["clientId"], open_quote["numero"], open_quote["statut"], dumps(open_quote), NOW),
        )

        extra_donations = [
            ("don_paul_fev", "cli_paul", 420, "2026-02-14", "virement", "Don Dupont février"),
            ("don_paul_mai", "cli_paul", 380, "2026-05-11", "cheque", "Don Dupont mai"),
            ("don_paul_aou", "cli_paul", 510, "2026-08-08", "virement", "Don Dupont août"),
            ("don_claire_jan", "cli_bernard", 260, "2026-01-22", "cb", "Don Bernard janvier"),
            ("don_claire_avr", "cli_bernard", 340, "2026-04-09", "virement", "Don Bernard avril"),
            ("don_claire_jul", "cli_bernard", 290, "2026-07-21", "cheque", "Don Bernard juillet"),
            ("don_fondation_fev", "donateur_fondation", 900, "2026-02-28", "virement", "Don Fondation février"),
            ("don_alice_mar", "cli_martin", 180, "2026-03-16", "virement", "Don Alice mars"),
            ("don_incomplet_juin", "cli_donateur_incomplet", 75, "2026-06-03", "especes", "Don sans fiche complète"),
        ]
        for don_id, contact_id, amount, date, method, label in extra_donations:
            connection.execute(
                """INSERT OR REPLACE INTO donations
                  (id, contact_id, anonymous, donor_label, source, transaction_id, nature,
                   payment_method, amount, donation_date, received_date, description,
                   valuation_method, valuation_by_donor, notes, receipt_eligible, receipt_id,
                   created_at, updated_at)
                 VALUES (?, ?, 0, NULL, 'manuel', NULL, 'numeraire', ?, ?, ?, ?, ?, NULL, 0, NULL, 1, NULL, ?, ?)""",
                (don_id, contact_id, method, amount, date, date, label, NOW, NOW),
            )

        widget_layout = {
            "chartGranularity": "month",
            "splitRatio": 0.58,
            "columns": ["name", "group", "type", "amount", "periodicity", "startDate", "endDate"],
            "columnWidths": {},
            "widgets": [
                {"id": "stats", "type": "stats", "enabled": True, "order": 0},
                {"id": "balance", "type": "balance", "enabled": True, "order": 1},
                {"id": "debitCredit", "type": "debitCredit", "enabled": True, "order": 2},
                {"id": "category", "type": "category", "enabled": True, "order": 3},
                {"id": "lines", "type": "lines", "enabled": True, "order": 4},
                {"id": "cashflow", "type": "cashflow", "enabled": True, "order": 5},
                {"id": "groupBreakdown", "type": "groupBreakdown", "enabled": True, "order": 6},
            ],
        }
        connection.execute(
            """UPDATE projects
               SET widget_layout = ?, start_date = '2026-01-01', end_date = '2027-12-31', updated_at = ?
               WHERE id = 1""",
            (dumps(widget_layout), NOW),
        )
        connection.execute(
            """UPDATE project_subscriptions
               SET start_date = '2026-01-01', end_date = '2027-12-31'
               WHERE project_id = 1"""
        )
        existing_group = connection.execute(
            """SELECT id FROM project_subscriptions
               WHERE project_id = 1 AND name = 'Recettes' AND is_group = 1"""
        ).fetchone()
        if existing_group:
            recettes_id = existing_group[0]
        else:
            recettes_id = connection.execute(
                """INSERT INTO project_subscriptions
                   (project_id, name, type, amount, periodicity, start_date, end_date,
                    category_code, color, parent_id, is_group, sort_order)
                   VALUES (1, 'Recettes', 'credit', 0, 'monthly', '2026-01-01', '2027-12-31',
                           NULL, '#16a34a', NULL, 1, 5)"""
            ).lastrowid
        connection.execute(
            "UPDATE project_subscriptions SET parent_id = ?, sort_order = 6 WHERE name = 'Contrats récurrents'",
            (recettes_id,),
        )
        connection.execute(
            "UPDATE project_subscriptions SET parent_id = ?, sort_order = 7 WHERE name = 'Prime annuelle'",
            (recettes_id,),
        )

        dashboard_settings = {
            "donationsByDonorMode": "period",
            "widgets": {
                "charts": {
                    "expensesByCategory": True,
                    "incomePie": True,
                    "accountBalances": True,
                    "invoiceVsPayment": True,
                    "invoiceAging": True,
                    "donationsByDonor": True,
                },
                "summary": {
                    "treasuryKpis": True,
                    "invoicingKpis": True,
                    "associationKpis": True,
                    "contactKpis": True,
                    "legalReminders": True,
                    "miniCards": True,
                    "topCategories": True,
                },
            },
        }
        connection.execute(
            """INSERT INTO dashboard_settings (id, payload) VALUES (1, ?)
               ON CONFLICT(id) DO UPDATE SET payload = excluded.payload""",
            (dumps(dashboard_settings),),
        )
        finance_tabs = [
            {"id": "monthly", "visible": True, "order": 0},
            {"id": "balance", "visible": True, "order": 1},
            {"id": "projection", "visible": True, "order": 2},
            {"id": "bilan", "visible": True, "order": 3},
            {"id": "facturation", "visible": True, "order": 4},
            {"id": "dons", "visible": True, "order": 5},
            {"id": "contacts", "visible": True, "order": 6},
        ]
        connection.execute(
            """INSERT INTO app_settings (key, value) VALUES (?, ?)
               ON CONFLICT(key) DO UPDATE SET value = excluded.value""",
            ("finance_chart_tabs", dumps(finance_tabs)),
        )

        connection.commit()
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        counts = {
            table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in (
                "transactions",
                "factures",
                "devis",
                "clients",
                "donations",
                "project_subscriptions",
            )
        }
    finally:
        connection.close()

    settings_path = APP_ROOT / "data" / "parameter" / "settings.json"
    settings_path.parent.mkdir(parents=True, exist_ok=True)
    settings = {}
    if settings_path.exists():
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
    settings.update(
        {
            "language": "fr",
            "theme": "light",
            "zoomLevel": 100,
            "activeProfileId": PROFILE_ID,
            "menuVisibility": {
                "dashboard": True,
                "upload": True,
                "edition": True,
                "financeGlobal": True,
                "projectManagement": True,
                "invoicing": True,
                "clients": True,
                "association": True,
                "register": True,
            },
        }
    )
    settings_path.write_text(json.dumps(settings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if integrity != "ok" or version != 13:
        raise SystemExit(f"Validation échouée integrity={integrity} version={version}")
    print(json.dumps({"profileId": PROFILE_ID, "schemaVersion": version, "counts": counts}, indent=2))


if __name__ == "__main__":
    main()
