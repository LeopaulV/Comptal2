// Service pour la gestion des fichiers via l'API Electron

export class FileService {
  static async readFile(filePath: string): Promise<string> {
    try {
      const result = await window.electronAPI.readFile(filePath);
      if (!result.success) {
        const errorMsg = result.error || 'Erreur lors de la lecture du fichier';
        console.error('[FileService.readFile]', errorMsg, 'Fichier:', filePath);
        throw new Error(errorMsg);
      }
      console.log('[FileService.readFile] Fichier lu avec succès:', filePath);
      return result.data || '';
    } catch (error: any) {
      console.error('[FileService.readFile] Erreur:', error.message, 'Fichier:', filePath);
      throw error;
    }
  }

  static async writeFile(filePath: string, content: string): Promise<void> {
    const result = await window.electronAPI.writeFile(filePath, content);
    if (!result.success) {
      console.error('[FileService.writeFile] Erreur:', filePath, result.error);
      throw new Error(result.error || 'Erreur lors de l\'écriture du fichier');
    }
  }

  static async readDirectory(dirPath: string): Promise<string[]> {
    try {
      const result = await window.electronAPI.readDirectory(dirPath);
      if (!result.success) {
        const errorMsg = result.error || 'Erreur lors de la lecture du dossier';
        console.error('[FileService.readDirectory]', errorMsg, 'Dossier:', dirPath);
        throw new Error(errorMsg);
      }
      console.log('[FileService.readDirectory] Dossier lu avec succès:', dirPath, `(${result.data?.length || 0} fichiers)`);
      return result.data || [];
    } catch (error: any) {
      console.error('[FileService.readDirectory] Erreur:', error.message, 'Dossier:', dirPath);
      throw error;
    }
  }

  static async getAppPath(): Promise<string> {
    return await window.electronAPI.getAppPath();
  }
}

