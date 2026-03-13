// Service pour la gestion des fichiers via l'API Electron

const FILE_NOT_FOUND_PATTERN = /fichier non trouvé|not found/i;
const DIRECTORY_NOT_FOUND_PATTERN = /dossier non trouvé|not found|does not exist|n'existe pas/i;

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

  /**
   * Lit un fichier sans lever d'erreur ni logger si le fichier n'existe pas.
   * Utile pour les fichiers optionnels (ex. secteurs_activite.json à la première utilisation).
   */
  static async readFileOptional(filePath: string): Promise<string | null> {
    const result = await window.electronAPI.readFile(filePath);
    if (result.success) {
      return result.data ?? '';
    }
    const err = result.error || '';
    if (FILE_NOT_FOUND_PATTERN.test(err)) {
      return null;
    }
    console.error('[FileService.readFileOptional]', err, 'Fichier:', filePath);
    throw new Error(err);
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

  /**
   * Lit un dossier sans lever d'erreur ni logger si le dossier n'existe pas.
   * Utile pour les dossiers optionnels (ex. data/ d'un profil neuf).
   */
  static async readDirectoryOptional(dirPath: string): Promise<string[] | null> {
    const result = await window.electronAPI.readDirectory(dirPath);
    if (result.success) {
      return result.data ?? [];
    }
    const err = result.error || '';
    if (DIRECTORY_NOT_FOUND_PATTERN.test(err)) {
      return null;
    }
    console.error('[FileService.readDirectoryOptional]', err, 'Dossier:', dirPath);
    throw new Error(err);
  }

  static async deleteFile(filePath: string): Promise<void> {
    const result = await window.electronAPI.deleteFile(filePath);
    if (!result.success) {
      console.error('[FileService.deleteFile] Erreur:', filePath, result.error);
      throw new Error(result.error || 'Erreur lors de la suppression du fichier');
    }
  }

  static async deleteDirectory(dirPath: string): Promise<void> {
    const result = await window.electronAPI.deleteDirectory(dirPath);
    if (!result.success) {
      console.error('[FileService.deleteDirectory] Erreur:', dirPath, result.error);
      throw new Error(result.error || 'Erreur lors de la suppression du dossier');
    }
  }

  static async copyDirectory(srcPath: string, destPath: string): Promise<void> {
    const result = await window.electronAPI.copyDirectory(srcPath, destPath);
    if (!result.success) {
      console.error('[FileService.copyDirectory] Erreur:', srcPath, '->', destPath, result.error);
      throw new Error(result.error || 'Erreur lors de la copie du dossier');
    }
  }

  static async getAppPath(): Promise<string> {
    return await window.electronAPI.getAppPath();
  }
}

