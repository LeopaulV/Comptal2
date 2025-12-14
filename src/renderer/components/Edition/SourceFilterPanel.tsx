import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckSquare, faSquare, faFolder, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { ConfigService } from '../../services/ConfigService';
import { EditionRow } from '../../types/Edition';

interface SourceFilterPanelProps {
  rows: EditionRow[];
  selectedSources: string[];
  onSourcesChange: (sources: string[]) => void;
}

interface SourceGroup {
  accountName: string;
  accountAbbr: string;
  sources: string[];
}

const SourceFilterPanel: React.FC<SourceFilterPanelProps> = ({
  rows,
  selectedSources,
  onSourcesChange,
}) => {
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSourceGroups();
  }, [rows]);

  const loadSourceGroups = async () => {
    try {
      const accounts = await ConfigService.loadAccounts();
      const uniqueSources = [...new Set(rows.map(row => row.Source))];
      
      // Grouper les sources par compte bancaire
      const groupsMap = new Map<string, { accountName: string; accountAbbr: string; sources: string[] }>();
      
      for (const source of uniqueSources) {
        const accountAbbr = source.split('_')[0].split('.')[0];
        const accountConfig = accounts[accountAbbr];
        const accountName = accountConfig 
          ? (typeof accountConfig === 'object' && accountConfig !== null && 'name' in accountConfig
              ? accountConfig.name
              : String(accountConfig))
          : accountAbbr;
        
        if (!groupsMap.has(accountName)) {
          groupsMap.set(accountName, {
            accountName,
            accountAbbr,
            sources: [],
          });
        }
        groupsMap.get(accountName)!.sources.push(source);
      }

      // Trier les groupes par nom de compte
      const groups = Array.from(groupsMap.values())
        .map(group => ({
          ...group,
          sources: group.sources.sort((a, b) => b.localeCompare(a)), // Plus récent en premier
        }))
        .sort((a, b) => a.accountName.localeCompare(b.accountName));

      setSourceGroups(groups);
      
      // Initialiser toutes les sources comme sélectionnées
      if (selectedSources.length === 0) {
        onSourcesChange(uniqueSources);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des groupes de sources:', error);
    }
  };

  const handleSelectAll = () => {
    const allSources = sourceGroups.flatMap(group => group.sources);
    onSourcesChange(allSources);
  };

  const handleDeselectAll = () => {
    onSourcesChange([]);
  };

  const handleGroupToggle = (group: SourceGroup) => {
    const groupSources = group.sources;
    const allSelected = groupSources.every(source => selectedSources.includes(source));
    
    if (allSelected) {
      // Désélectionner toutes les sources du groupe
      onSourcesChange(selectedSources.filter(source => !groupSources.includes(source)));
    } else {
      // Sélectionner toutes les sources du groupe
      const newSelected = [...new Set([...selectedSources, ...groupSources])];
      onSourcesChange(newSelected);
    }
  };

  const handleSourceToggle = (source: string) => {
    if (selectedSources.includes(source)) {
      onSourcesChange(selectedSources.filter(s => s !== source));
    } else {
      onSourcesChange([...selectedSources, source]);
    }
  };

  const toggleGroupExpanded = (accountName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(accountName)) {
      newExpanded.delete(accountName);
    } else {
      newExpanded.add(accountName);
    }
    setExpandedGroups(newExpanded);
  };

  const isGroupAllSelected = (group: SourceGroup): boolean => {
    return group.sources.every(source => selectedSources.includes(source));
  };

  return (
    <div className="source-filters">
      <div className="filter-actions">
        <button
          className="filter-button"
          onClick={handleSelectAll}
          title="Tout sélectionner"
        >
          <FontAwesomeIcon icon={faCheckSquare} />
          Tout sélectionner
        </button>
        <button
          className="filter-button"
          onClick={handleDeselectAll}
          title="Tout désélectionner"
        >
          <FontAwesomeIcon icon={faSquare} />
          Tout désélectionner
        </button>
      </div>

      <div className="source-checkboxes">
        {sourceGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.accountName);
          const allSelected = isGroupAllSelected(group);

          return (
            <div key={group.accountName} className={`source-group ${isExpanded ? 'expanded' : ''}`}>
              <div
                className="source-group-title"
                onClick={() => toggleGroupExpanded(group.accountName)}
              >
                <div className="d-flex align-items-center">
                  <button
                    className="btn btn-sm btn-outline-primary me-2 select-group-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGroupToggle(group);
                    }}
                    title={allSelected ? 'Désélectionner le groupe' : 'Sélectionner le groupe'}
                  >
                    <FontAwesomeIcon icon={allSelected ? faCheckSquare : faSquare} />
                  </button>
                  <div>
                    <FontAwesomeIcon icon={faFolder} />
                    <span>{group.accountName}</span>
                  </div>
                </div>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  className={`toggle-icon ${isExpanded ? 'rotated' : ''}`}
                />
              </div>

              <div className="source-group-content">
                {group.sources.map((source) => (
                  <div key={source} className="form-check source-item">
                    <input
                      type="checkbox"
                      className="form-check-input source-filter"
                      id={`source-${source}`}
                      checked={selectedSources.includes(source)}
                      onChange={() => handleSourceToggle(source)}
                    />
                    <label
                      className="form-check-label"
                      htmlFor={`source-${source}`}
                      title={source}
                    >
                      {source}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SourceFilterPanel;

