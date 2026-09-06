#!/usr/bin/env python3
"""Contrôle automatisé du schéma et du jeu Registre sans toucher aux profils."""

from __future__ import annotations

import importlib.util
import sqlite3
import sys
import tempfile
from pathlib import Path


SCRIPT = Path(__file__).with_name("create-dev-database.py")
sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("create_dev_database", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def main() -> None:
    with tempfile.TemporaryDirectory() as directory:
        database = Path(directory) / "register-test.db"
        connection = sqlite3.connect(database)
        try:
            counts = MODULE.seed_database(connection, "profile_test_registre")
            assert connection.execute("PRAGMA user_version").fetchone()[0] == 9
            assert connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
            assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
            assert counts["register_documents"] == 5
            assert counts["register_attachments"] == 2
            numbers = [
                row[0]
                for row in connection.execute(
                    "SELECT number FROM register_documents ORDER BY number"
                )
            ]
            assert numbers == [
                "REG-2026-0001",
                "REG-2026-0002",
                "REG-2026-0003",
                "REG-2026-0004",
                "REG-2026-0005",
            ]
            donation_totals = connection.execute(
                """SELECT COUNT(*), SUM(amount),
                          SUM(CASE WHEN anonymous = 1 THEN amount ELSE 0 END),
                          SUM(CASE WHEN nature <> 'numeraire' THEN amount ELSE 0 END)
                   FROM donations"""
            ).fetchone()
            assert donation_totals == (5, 2916.5, 186.5, 480)
            assert connection.execute(
                "SELECT COUNT(*) FROM donations WHERE transaction_id IS NOT NULL"
            ).fetchone()[0] == 2
            assert connection.execute(
                "SELECT COUNT(*) FROM clients WHERE EXISTS "
                "(SELECT 1 FROM json_each(clients.payload, '$.roles') WHERE value = 'donateur')"
            ).fetchone()[0] == 2
            snapshot = connection.execute(
                "SELECT json_extract(snapshot, '$.totals.outstanding') "
                "FROM register_documents WHERE type = 'invoice_summary'"
            ).fetchone()[0]
            assert snapshot == 0
            invoice_totals = connection.execute(
                """SELECT SUM(json_extract(payload, '$.totalTTC')),
                          SUM((SELECT SUM(json_extract(value, '$.montant'))
                               FROM json_each(payload, '$.paiements')))
                   FROM factures
                   WHERE supprime = 0
                     AND json_extract(payload, '$.dateEmission') BETWEEN ? AND ?""",
                ("2026-01-01T00:00:00.000Z", "2026-08-31T23:59:59.999Z"),
            ).fetchone()
            register_invoice_totals = connection.execute(
                """SELECT json_extract(snapshot, '$.totals.invoiced'),
                          json_extract(snapshot, '$.totals.paid')
                   FROM register_documents WHERE type = 'invoice_summary'"""
            ).fetchone()
            assert register_invoice_totals == invoice_totals == (1800, 1800)
            cashflow_totals = connection.execute(
                """SELECT ABS(SUM(CASE WHEN debit < 0 THEN debit ELSE 0 END)),
                          SUM(CASE WHEN credit > 0 THEN credit ELSE 0 END)
                   FROM transactions WHERE date BETWEEN ? AND ?""",
                ("2026-01-01", "2026-08-31"),
            ).fetchone()
            register_cashflow_totals = connection.execute(
                """SELECT json_extract(snapshot, '$.totals.expenses'),
                          json_extract(snapshot, '$.totals.credits')
                   FROM register_documents WHERE type = 'cashflow_summary'"""
            ).fetchone()
            assert register_cashflow_totals == cashflow_totals == (20203.3, 22900)
            connection.execute(
                "DELETE FROM register_documents WHERE id = 'regdoc_factures_2026'"
            )
            assert connection.execute(
                "SELECT COUNT(*) FROM register_items WHERE document_id = 'regdoc_factures_2026'"
            ).fetchone()[0] == 0
            assert connection.execute(
                "SELECT COUNT(*) FROM register_attachments "
                "WHERE document_id = 'regdoc_factures_2026'"
            ).fetchone()[0] == 0
        finally:
            connection.close()

        entreprise_db = Path(directory) / "entreprise-test.db"
        entreprise_conn = sqlite3.connect(entreprise_db)
        try:
            MODULE.seed_database(entreprise_conn, "profile_test_entreprise", kind="entreprise")
            assert entreprise_conn.execute(
                "SELECT json_extract(payload, '$.type') FROM invoice_emetteur"
            ).fetchone()[0] == "entreprise"
            assert entreprise_conn.execute(
                "SELECT COUNT(*) FROM factures WHERE statut = 'en_retard'"
            ).fetchone()[0] == 1
            assert entreprise_conn.execute(
                "SELECT COUNT(*) FROM clients WHERE id = 'cli_agence_creative'"
            ).fetchone()[0] == 1
            assert entreprise_conn.execute(
                "SELECT json_extract(payload, '$.color') FROM clients "
                "WHERE id = 'cli_agence_creative'"
            ).fetchone()[0] == "#8b5cf6"
        finally:
            entreprise_conn.close()

        association_db = Path(directory) / "association-test.db"
        association_conn = sqlite3.connect(association_db)
        try:
            MODULE.seed_database(association_conn, "profile_test_association", kind="association")
            assert association_conn.execute(
                "SELECT json_extract(payload, '$.type') FROM invoice_emetteur"
            ).fetchone()[0] == "association"
            assert association_conn.execute(
                "SELECT json_extract(payload, '$.rna') FROM invoice_emetteur"
            ).fetchone()[0] == "W691234567"
            assert association_conn.execute(
                "SELECT COUNT(*) FROM donations WHERE nature = 'mecenat_competences'"
            ).fetchone()[0] == 1
            assert association_conn.execute(
                "SELECT name FROM accounts WHERE code = 'CC'"
            ).fetchone()[0] == "Compte courant associatif"
            assert association_conn.execute(
                "SELECT json_extract(payload, '$.color') FROM clients "
                "WHERE id = 'cli_atelier_solaire'"
            ).fetchone()[0] == "#f59e0b"
        finally:
            association_conn.close()
    print("OK — schéma v9, dons, contacts donateurs, registres, JSON et cascades validés")


if __name__ == "__main__":
    main()
