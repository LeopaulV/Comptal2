import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Scale,
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  AlertCircle,
} from 'lucide-react';
import { MentionLegale, MentionLegaleCategory, MentionPlaceholderValues } from '../../../types/Invoice';
import { LegalMentionsService } from '../../../services/LegalMentionsService';

interface LegalMentionsConfigProps {
  selectedMentions: string[];
  customMentions: MentionLegale[];
  onSelectedChange: (mentionIds: string[]) => void;
  onCustomMentionsChange: (mentions: MentionLegale[]) => void;
  mentionPlaceholderValues?: MentionPlaceholderValues;
  onPlaceholderValuesChange?: (values: MentionPlaceholderValues) => void;
}

export const LegalMentionsConfig: React.FC<LegalMentionsConfigProps> = ({
  selectedMentions,
  customMentions,
  onSelectedChange,
  onCustomMentionsChange,
  mentionPlaceholderValues = {},
  onPlaceholderValuesChange,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaceholdersExpanded, setIsPlaceholdersExpanded] = useState(false);
  const [allMentions, setAllMentions] = useState<MentionLegale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<MentionLegaleCategory | 'all'>('all');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [editingMention, setEditingMention] = useState<string | null>(null);
  const [newMention, setNewMention] = useState<Partial<MentionLegale>>({
    label: '',
    content: '',
    category: 'autre',
  });

  const categories = LegalMentionsService.getCategories();

  useEffect(() => {
    const loadMentions = async () => {
      try {
        const loaded = await LegalMentionsService.loadMentions();
        setAllMentions(loaded);
      } catch (error) {
        console.error('Erreur lors du chargement des mentions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadMentions();
  }, []);

  const getCategoryLabel = (category: MentionLegaleCategory) => {
    const found = categories.find((c) => c.value === category);
    return found?.label || category;
  };

  const getFilteredMentions = () => {
    const combined = [...allMentions, ...customMentions.filter((cm) => !allMentions.some((m) => m.id === cm.id))];
    if (activeCategory === 'all') {
      return combined;
    }
    return combined.filter((m) => m.category === activeCategory);
  };

  const handleToggleMention = (mentionId: string) => {
    if (selectedMentions.includes(mentionId)) {
      onSelectedChange(selectedMentions.filter((id) => id !== mentionId));
    } else {
      onSelectedChange([...selectedMentions, mentionId]);
    }
  };

  const handleAddCustomMention = () => {
    if (!newMention.label || !newMention.content) return;

    const mention: MentionLegale = {
      id: `custom-mention-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'custom',
      label: newMention.label,
      content: newMention.content,
      category: newMention.category as MentionLegaleCategory,
      required: false,
      enabled: true,
    };

    onCustomMentionsChange([...customMentions, mention]);
    onSelectedChange([...selectedMentions, mention.id]);
    setNewMention({ label: '', content: '', category: 'autre' });
    setIsAddingCustom(false);
  };

  const handleDeleteCustomMention = (mentionId: string) => {
    onCustomMentionsChange(customMentions.filter((m) => m.id !== mentionId));
    onSelectedChange(selectedMentions.filter((id) => id !== mentionId));
  };

  const handleEditMention = (mention: MentionLegale) => {
    setEditingMention(mention.id);
    setNewMention({
      label: mention.label,
      content: mention.content,
      category: mention.category,
    });
  };

  const handleSaveEdit = (mentionId: string) => {
    const updated = customMentions.map((m) => {
      if (m.id === mentionId) {
        return {
          ...m,
          label: newMention.label || m.label,
          content: newMention.content || m.content,
          category: (newMention.category as MentionLegaleCategory) || m.category,
        };
      }
      return m;
    });
    onCustomMentionsChange(updated);
    setEditingMention(null);
    setNewMention({ label: '', content: '', category: 'autre' });
  };

  const combinedMentions = [...allMentions, ...customMentions.filter((cm) => !allMentions.some((m) => m.id === cm.id))];
  const selectedMentionsWithPlaceholders = combinedMentions.filter(
    (m) => selectedMentions.includes(m.id) && LegalMentionsService.extractPlaceholders(m.content).length > 0
  );

  const handlePlaceholderChange = (mentionId: string, placeholderKey: string, value: string) => {
    if (!onPlaceholderValuesChange) return;
    const current = mentionPlaceholderValues[mentionId] || {};
    const next = { ...mentionPlaceholderValues, [mentionId]: { ...current, [placeholderKey]: value } };
    onPlaceholderValuesChange(next);
  };

  const filteredMentions = getFilteredMentions();

  return (
    <div className={`collapsible-section ${isExpanded ? 'expanded' : ''}`}>
      <button
        type="button"
        className="collapsible-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="collapsible-title">
          <Scale size={20} />
          <span>{t('invoicing.emetteur.mentions.title')}</span>
          <span className="collapsible-badge">{selectedMentions.length}</span>
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      <div className={`collapsible-content ${isExpanded ? 'expanded' : ''}`}>
        {isLoading ? (
          <div className="mentions-loading">{t('common.loading')}</div>
        ) : (
          <>
            {/* Filtres par catégorie */}
            <div className="mentions-categories">
              <button
                type="button"
                className={`mentions-category-btn ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >
                {t('invoicing.emetteur.mentions.all')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  className={`mentions-category-btn ${activeCategory === cat.value ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.value)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Liste des mentions */}
            <div className="mentions-list">
              {filteredMentions.map((mention) => {
                const isSelected = selectedMentions.includes(mention.id);
                const isCustom = mention.type === 'custom';
                const isEditing = editingMention === mention.id;

                return (
                  <div
                    key={mention.id}
                    className={`mentions-item ${isSelected ? 'selected' : ''} ${mention.required ? 'required' : ''}`}
                  >
                    {isEditing ? (
                      <div className="mentions-item-edit">
                        <input
                          type="text"
                          value={newMention.label}
                          onChange={(e) => setNewMention({ ...newMention, label: e.target.value })}
                          placeholder={t('invoicing.emetteur.mentions.labelPlaceholder')}
                          className="mentions-input"
                        />
                        <textarea
                          value={newMention.content}
                          onChange={(e) => setNewMention({ ...newMention, content: e.target.value })}
                          placeholder={t('invoicing.emetteur.mentions.contentPlaceholder')}
                          className="mentions-textarea"
                          rows={3}
                        />
                        <div className="mentions-edit-actions">
                          <button
                            type="button"
                            className="mentions-btn save"
                            onClick={() => handleSaveEdit(mention.id)}
                          >
                            <Save size={14} />
                            {t('common.save')}
                          </button>
                          <button
                            type="button"
                            className="mentions-btn cancel"
                            onClick={() => {
                              setEditingMention(null);
                              setNewMention({ label: '', content: '', category: 'autre' });
                            }}
                          >
                            <X size={14} />
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className="mentions-item-checkbox"
                          onClick={() => handleToggleMention(mention.id)}
                        >
                          <div className={`mentions-checkbox ${isSelected ? 'checked' : ''}`}>
                            {isSelected && <Check size={12} />}
                          </div>
                        </div>
                        <div className="mentions-item-content">
                          <div className="mentions-item-header">
                            <span className="mentions-item-label">{mention.label}</span>
                            <span className={`mentions-item-category ${mention.category}`}>
                              {getCategoryLabel(mention.category)}
                            </span>
                            {mention.required && (
                              <span className="mentions-item-required">
                                <AlertCircle size={12} />
                                {t('invoicing.emetteur.mentions.required')}
                              </span>
                            )}
                            {isCustom && (
                              <span className="mentions-item-custom">
                                {t('invoicing.emetteur.mentions.custom')}
                              </span>
                            )}
                          </div>
                          <p className="mentions-item-text">{mention.content}</p>
                        </div>
                        {isCustom && (
                          <div className="mentions-item-actions">
                            <button
                              type="button"
                              className="mentions-action-btn edit"
                              onClick={() => handleEditMention(mention)}
                              title={t('common.edit')}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="mentions-action-btn delete"
                              onClick={() => handleDeleteCustomMention(mention.id)}
                              title={t('common.delete')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Éléments à compléter (placeholders [xxx]) pour les mentions sélectionnées */}
            {onPlaceholderValuesChange && selectedMentionsWithPlaceholders.length > 0 && (
              <div className="mentions-placeholders-section">
                <button
                  type="button"
                  className={`collapsible-header mentions-placeholders-toggle ${isPlaceholdersExpanded ? 'expanded' : ''}`}
                  onClick={() => setIsPlaceholdersExpanded(!isPlaceholdersExpanded)}
                >
                  <span>{t('invoicing.emetteur.mentions.fillPlaceholders')}</span>
                  <span className="mentions-placeholders-badge">{selectedMentionsWithPlaceholders.length}</span>
                  {isPlaceholdersExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                <div className={`mentions-placeholders-content ${isPlaceholdersExpanded ? 'expanded' : ''}`}>
                  {selectedMentionsWithPlaceholders.map((mention) => {
                    const placeholders = LegalMentionsService.extractPlaceholders(mention.content);
                    const values = mentionPlaceholderValues[mention.id] || {};
                    return (
                      <div key={mention.id} className="mentions-placeholder-block">
                        <div className="mentions-placeholder-block-title">{mention.label}</div>
                        <div className="mentions-placeholder-fields">
                          {placeholders.map((key) => (
                            <div key={key} className="mentions-placeholder-field">
                              <label htmlFor={`placeholder-${mention.id}-${key}`}>[{key}]</label>
                              <input
                                id={`placeholder-${mention.id}-${key}`}
                                type="text"
                                value={values[key] ?? ''}
                                onChange={(e) => handlePlaceholderChange(mention.id, key, e.target.value)}
                                placeholder={key}
                                className="mentions-input"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ajout d'une mention personnalisée */}
            {isAddingCustom ? (
              <div className="mentions-add-form">
                <h4>{t('invoicing.emetteur.mentions.addCustom')}</h4>
                <div className="mentions-add-row">
                  <input
                    type="text"
                    value={newMention.label}
                    onChange={(e) => setNewMention({ ...newMention, label: e.target.value })}
                    placeholder={t('invoicing.emetteur.mentions.labelPlaceholder')}
                    className="mentions-input"
                  />
                  <select
                    value={newMention.category}
                    onChange={(e) =>
                      setNewMention({ ...newMention, category: e.target.value as MentionLegaleCategory })
                    }
                    className="mentions-select"
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={newMention.content}
                  onChange={(e) => setNewMention({ ...newMention, content: e.target.value })}
                  placeholder={t('invoicing.emetteur.mentions.contentPlaceholder')}
                  className="mentions-textarea"
                  rows={4}
                />
                <div className="mentions-add-actions">
                  <button
                    type="button"
                    className="mentions-btn save"
                    onClick={handleAddCustomMention}
                    disabled={!newMention.label || !newMention.content}
                  >
                    <Save size={14} />
                    {t('common.save')}
                  </button>
                  <button
                    type="button"
                    className="mentions-btn cancel"
                    onClick={() => {
                      setIsAddingCustom(false);
                      setNewMention({ label: '', content: '', category: 'autre' });
                    }}
                  >
                    <X size={14} />
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="mentions-add-btn"
                onClick={() => setIsAddingCustom(true)}
              >
                <Plus size={16} />
                {t('invoicing.emetteur.mentions.addCustom')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
