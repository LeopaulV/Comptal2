import { Category, CategoryGroup } from '../types/models';

export interface CategoryGroupSection {
  group: CategoryGroup | null;
  categories: Category[];
}

/** Range les catégories sous leurs regroupements, puis les non rattachées. */
export function organizeCategoriesByGroup(
  categories: Category[],
  groups: CategoryGroup[]
): CategoryGroupSection[] {
  const byGroup = new Map<number, Category[]>();
  const ungrouped: Category[] = [];
  for (const cat of categories) {
    if (cat.groupId == null) {
      ungrouped.push(cat);
      continue;
    }
    const list = byGroup.get(cat.groupId);
    if (list) list.push(cat);
    else byGroup.set(cat.groupId, [cat]);
  }
  const sections: CategoryGroupSection[] = groups.map((group) => ({
    group,
    categories: byGroup.get(group.id) ?? [],
  }));
  if (ungrouped.length > 0 || groups.length === 0) {
    sections.push({ group: null, categories: ungrouped });
  }
  return sections;
}
