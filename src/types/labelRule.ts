export interface LabelRule {
  id: number;
  word: string;
  categoryCode: string | null;
  tag: string | null;
  active: boolean;
  createdAt: string;
}

export interface LabelRuleInput {
  word: string;
  categoryCode?: string | null;
  tag?: string | null;
}
