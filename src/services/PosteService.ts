import { PosteFacture, PosteGroupe } from '../types/invoice';
import { newEntityId, parseDateOrNow } from '../utils/invoiceFormat';
import { Db } from './db';
import { withLog } from './logger';

type PosteKind = 'facturation' | 'association';

function reviveGroupe(raw: Partial<PosteGroupe>): PosteGroupe {
  return {
    id: raw.id || newEntityId('grp'),
    type: 'groupe',
    nom: raw.nom ?? '',
    description: raw.description,
    postes: raw.postes ?? [],
    createdAt: parseDateOrNow(raw.createdAt),
    updatedAt: parseDateOrNow(raw.updatedAt),
  };
}

async function loadPostes(kind: PosteKind): Promise<PosteFacture[]> {
  const rows = await Db.select<{ payload: string }>(
    'SELECT payload FROM postes_catalogue WHERE kind = ?',
    [kind]
  );
  return rows.map((r) => JSON.parse(r.payload) as PosteFacture);
}

async function saveAllPostes(kind: PosteKind, postes: PosteFacture[]): Promise<void> {
  await Db.execute('DELETE FROM postes_catalogue WHERE kind = ?', [kind]);
  for (const poste of postes) {
    await Db.execute('INSERT INTO postes_catalogue (id, kind, payload) VALUES (?, ?, ?)', [
      poste.id,
      kind,
      JSON.stringify(poste),
    ]);
  }
}

async function loadGroupes(kind: PosteKind): Promise<PosteGroupe[]> {
  const rows = await Db.select<{ payload: string }>(
    'SELECT payload FROM postes_groupes WHERE kind = ?',
    [kind]
  );
  return rows.map((r) => reviveGroupe(JSON.parse(r.payload)));
}

async function saveAllGroupes(kind: PosteKind, groupes: PosteGroupe[]): Promise<void> {
  await Db.execute('DELETE FROM postes_groupes WHERE kind = ?', [kind]);
  for (const groupe of groupes) {
    await Db.execute('INSERT INTO postes_groupes (id, kind, payload) VALUES (?, ?, ?)', [
      groupe.id,
      kind,
      JSON.stringify({
        ...groupe,
        createdAt: groupe.createdAt.toISOString(),
        updatedAt: groupe.updatedAt.toISOString(),
      }),
    ]);
  }
}

function createPosteStore(kind: PosteKind, fn: string) {
  return {
    async loadPostes(): Promise<PosteFacture[]> {
      return withLog(`${fn}.loadPostes`, () => loadPostes(kind));
    },
    async savePostes(postes: PosteFacture[]): Promise<void> {
      return withLog(`${fn}.savePostes`, () => saveAllPostes(kind, postes));
    },
    async addPoste(poste: PosteFacture): Promise<void> {
      const postes = await loadPostes(kind);
      postes.push(poste);
      await saveAllPostes(kind, postes);
    },
    async updatePoste(id: string, updated: PosteFacture): Promise<void> {
      const postes = await loadPostes(kind);
      const index = postes.findIndex((p) => p.id === id);
      if (index >= 0) {
        postes[index] = updated;
        await saveAllPostes(kind, postes);
      }
    },
    async deletePoste(id: string): Promise<void> {
      const postes = (await loadPostes(kind)).filter((p) => p.id !== id);
      await saveAllPostes(kind, postes);
    },
    async loadPostesGroupes(): Promise<PosteGroupe[]> {
      return withLog(`${fn}.loadPostesGroupes`, () => loadGroupes(kind));
    },
    async savePosteGroupe(groupe: PosteGroupe): Promise<void> {
      const groupes = await loadGroupes(kind);
      const now = new Date();
      const normalized: PosteGroupe = {
        ...groupe,
        id: groupe.id || newEntityId('grp'),
        createdAt: groupe.createdAt || now,
        updatedAt: now,
      };
      const index = groupes.findIndex((item) => item.id === normalized.id);
      if (index >= 0) groupes[index] = normalized;
      else groupes.push(normalized);
      await saveAllGroupes(kind, groupes);
    },
    async deletePosteGroupe(id: string): Promise<void> {
      await saveAllGroupes(
        kind,
        (await loadGroupes(kind)).filter((g) => g.id !== id)
      );
    },
    async importRaw(postes: unknown[], groupes: unknown[]): Promise<void> {
      if (Array.isArray(postes)) {
        await saveAllPostes(kind, postes as PosteFacture[]);
      }
      if (Array.isArray(groupes)) {
        await saveAllGroupes(
          kind,
          groupes.map((g) => reviveGroupe(g as Partial<PosteGroupe>))
        );
      }
    },
  };
}

export const PosteService = createPosteStore('facturation', 'PosteService');
export const PosteAssociationService = createPosteStore('association', 'PosteAssociationService');
