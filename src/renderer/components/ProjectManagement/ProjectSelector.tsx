import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { ConfigService } from '../../services/ConfigService';
import { ProjectsConfig, Project } from '../../types/ProjectManagement';
import { toast } from 'react-toastify';

interface ProjectSelectorProps {
  selectedProjectCode: string | null;
  onProjectChange: (projectCode: string) => void;
  onProjectLoaded?: (project: Project) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  selectedProjectCode,
  onProjectChange,
  onProjectLoaded,
}) => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectsConfig>({});
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const projectsConfig = await ConfigService.loadProjects();
      setProjects(projectsConfig);
      
      // Si aucun projet n'est sélectionné et qu'il y a des projets, sélectionner le premier
      if (!selectedProjectCode && Object.keys(projectsConfig).length > 0) {
        const firstProjectCode = Object.keys(projectsConfig)[0];
        onProjectChange(firstProjectCode);
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des projets:', error);
      toast.error(t('projectManagement.projectSelector.loadError', 'Erreur lors du chargement des projets'));
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error(t('projectManagement.projectSelector.nameRequired', 'Le nom du projet est requis'));
      return;
    }

    try {
      const code = await ConfigService.generateProjectCode(newProjectName.trim());
      const now = new Date();
      
      const newProject: Project = {
        code,
        name: newProjectName.trim(),
        subscriptions: [],
        projectionConfig: {
          startDate: new Date(),
          endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
          initialBalance: 0,
        },
        createdAt: now,
        updatedAt: now,
      };

      await ConfigService.saveProject(newProject);
      await loadProjects();
      setNewProjectName('');
      setIsCreating(false);
      onProjectChange(code);
      
      if (onProjectLoaded) {
        onProjectLoaded(newProject);
      }
      
      toast.success(t('projectManagement.projectSelector.created', 'Projet créé avec succès'));
    } catch (error: any) {
      console.error('Erreur lors de la création du projet:', error);
      toast.error(t('projectManagement.projectSelector.createError', 'Erreur lors de la création du projet'));
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProjectCode) return;

    const project = projects[selectedProjectCode];
    const confirmMessage = t(
      'projectManagement.projectSelector.deleteConfirm',
      `Êtes-vous sûr de vouloir supprimer le projet "${project?.name || selectedProjectCode}" ?`
    );

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await ConfigService.deleteProject(selectedProjectCode);
      await loadProjects();
      
      // Sélectionner un autre projet si disponible
      const remainingProjects = Object.keys(projects).filter(code => code !== selectedProjectCode);
      if (remainingProjects.length > 0) {
        onProjectChange(remainingProjects[0]);
      } else {
        onProjectChange('');
      }
      
      toast.success(t('projectManagement.projectSelector.deleted', 'Projet supprimé avec succès'));
    } catch (error: any) {
      console.error('Erreur lors de la suppression du projet:', error);
      toast.error(t('projectManagement.projectSelector.deleteError', 'Erreur lors de la suppression du projet'));
    }
  };

  const handleProjectSelect = async (projectCode: string) => {
    onProjectChange(projectCode);
    
    // Charger le projet complet et le passer au callback
    if (onProjectLoaded) {
      const project = await ConfigService.loadProject(projectCode);
      if (project) {
        onProjectLoaded(project);
      }
    }
  };

  const projectOptions = Object.values(projects).map(project => ({
    code: project.code,
    name: project.name,
  }));

  return (
    <div className="project-selector flex items-center gap-3 mb-4">
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('projectManagement.projectSelector.selectProject', 'Projet')}
        </label>
        <div className="flex gap-2">
          <select
            value={selectedProjectCode || ''}
            onChange={(e) => handleProjectSelect(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={projectOptions.length === 0}
          >
            {projectOptions.length === 0 ? (
              <option value="">{t('projectManagement.projectSelector.noProjects', 'Aucun projet')}</option>
            ) : (
              projectOptions.map(project => (
                <option key={project.code} value={project.code}>
                  {project.name} ({project.code})
                </option>
              ))
            )}
          </select>
          
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-2"
            title={t('projectManagement.projectSelector.newProject', 'Nouveau projet')}
          >
            <FontAwesomeIcon icon={faPlus} />
            <span className="hidden sm:inline">{t('projectManagement.projectSelector.new', 'Nouveau')}</span>
          </button>
          
          {selectedProjectCode && (
            <button
              onClick={handleDeleteProject}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
              title={t('projectManagement.projectSelector.deleteProject', 'Supprimer le projet')}
            >
              <FontAwesomeIcon icon={faTrash} />
              <span className="hidden sm:inline">{t('common.delete', 'Supprimer')}</span>
            </button>
          )}
        </div>
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('projectManagement.projectSelector.createProject', 'Créer un nouveau projet')}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('projectManagement.projectSelector.projectName', 'Nom du projet')}
              </label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateProject();
                  } else if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewProjectName('');
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={t('projectManagement.projectSelector.namePlaceholder', 'Ex: Projet Maison')}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewProjectName('');
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {t('common.cancel', 'Annuler')}
              </button>
              <button
                onClick={handleCreateProject}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                {t('common.save', 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectSelector;
