import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Déterminer le chemin du preload
  let preloadPath: string;
  if (app.isPackaged) {
    // En mode packagé, app.getAppPath() retourne le chemin vers app.asar
    const appPath = app.getAppPath();
    preloadPath = path.join(appPath, 'dist-electron', 'preload.js');
    
    // Vérifier si le fichier existe, sinon essayer l'alternative
    if (!existsSync(preloadPath)) {
      const altPath = path.join(process.resourcesPath, 'app.asar', 'dist-electron', 'preload.js');
      if (existsSync(altPath)) {
        preloadPath = altPath;
      }
    }
  } else {
    // En mode développement, utiliser __dirname
    preloadPath = path.join(__dirname, 'preload.js');
  }
  
  console.log('[createWindow] Chemin preload:', preloadPath);
  console.log('[createWindow] Preload existe:', existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Comptal2 - Logiciel de Comptabilité',
    frame: true,
    autoHideMenuBar: true,
  });

  // Chargement de l'application
  if (process.env.VITE_DEV_SERVER_URL) {
    console.log('[createWindow] Mode développement - Chargement depuis:', process.env.VITE_DEV_SERVER_URL);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools(); // DevTools activé pour debug
  } else {
    // DevTools désactivés en production
    // mainWindow.webContents.openDevTools();
    // Déterminer le chemin du fichier HTML
    if (app.isPackaged) {
      // En mode packagé, app.getAppPath() retourne le chemin vers app.asar
      // loadFile() peut charger depuis l'asar en utilisant un chemin relatif depuis la racine de l'asar
      // On utilise directement le chemin relatif 'dist/index.html' depuis la racine de l'asar
      const appPath = app.getAppPath();
      console.log('[createWindow] Mode production (packagé)');
      console.log('[createWindow] app.getAppPath():', appPath);
      console.log('[createWindow] Utilisation de loadFile() avec chemin relatif depuis app.asar');
      
      // Utiliser loadFile() avec le chemin relatif depuis la racine de l'asar
      // Cela permet de résoudre correctement les chemins relatifs dans le HTML (./assets/...)
      if (mainWindow) {
        mainWindow.loadFile(path.join(appPath, 'dist', 'index.html')).catch((error: Error) => {
          console.error('[createWindow] ERREUR avec loadFile():', error.message);
          console.error('[createWindow] Stack:', error.stack);
          
          // Si loadFile() échoue, essayer avec loadURL() et le protocole file://
          // Note: loadURL() nécessite des chemins absolus avec le bon format
          if (mainWindow) {
            const fileUrl = `file:///${path.join(appPath, 'dist', 'index.html').replace(/\\/g, '/')}`;
            console.log('[createWindow] Tentative avec loadURL():', fileUrl);
            mainWindow.loadURL(fileUrl).catch((urlError: Error) => {
              console.error('[createWindow] ERREUR avec loadURL() également:', urlError);
            });
          }
        });
      }
    } else {
      // En mode développement, utiliser le chemin relatif
      const htmlPath = path.join(__dirname, '../dist/index.html');
      console.log('[createWindow] Mode production (non packagé)');
      console.log('[createWindow] __dirname:', __dirname);
      console.log('[createWindow] Chemin HTML:', htmlPath);
      
      if (!existsSync(htmlPath)) {
        console.error('[createWindow] ERREUR: Le fichier index.html n\'existe pas à:', htmlPath);
      } else {
        console.log('[createWindow] Fichier index.html trouvé avec succès');
      }
      
      if (mainWindow) {
        mainWindow.loadFile(htmlPath);
      }
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Obtenir le chemin source des fichiers par défaut (dans l'AppImage ou l'application)
const getDefaultDataPath = (): string => {
  if (app.isPackaged) {
    // En mode packagé, les fichiers décompressés (parametre/, data/) sont dans app.asar.unpacked
    const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked');
    if (existsSync(unpackedPath)) {
      return unpackedPath;
    }
    // Fallback vers resourcesPath
    return process.resourcesPath;
  }
  // En mode développement, utiliser le chemin de l'application
  return app.getAppPath();
};

// Copier récursivement un dossier
const copyDirectory = async (src: string, dest: string, forceOverwrite: boolean = false): Promise<void> => {
  try {
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    // Créer le dossier de destination s'il n'existe pas
    if (!existsSync(dest)) {
      await fs.mkdir(dest, { recursive: true });
    }
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await copyDirectory(srcPath, destPath, forceOverwrite);
      } else {
        // Copier si le fichier n'existe pas ou si forceOverwrite est true
        if (!existsSync(destPath) || forceOverwrite) {
          await fs.copyFile(srcPath, destPath);
          console.log(`[copyDirectory] Fichier ${existsSync(destPath) && forceOverwrite ? 'écrasé' : 'copié'}: ${entry.name}`);
        }
      }
    }
  } catch (error: any) {
    console.error(`[copyDirectory] Erreur lors de la copie de ${src} vers ${dest}:`, error.message);
    throw error;
  }
};

// Initialiser les fichiers utilisateur depuis les fichiers par défaut
const initializeUserData = async (userDataPath: string): Promise<void> => {
  try {
    const defaultDataPath = getDefaultDataPath();
    const parametreSrc = path.join(defaultDataPath, 'parametre');
    const dataSrc = path.join(defaultDataPath, 'data');
    const parametreDest = path.join(userDataPath, 'parametre');
    const dataDest = path.join(userDataPath, 'data');
    
    // Créer le répertoire utilisateur s'il n'existe pas
    if (!existsSync(userDataPath)) {
      await fs.mkdir(userDataPath, { recursive: true });
      console.log('[initializeUserData] Répertoire utilisateur créé:', userDataPath);
    }
    
    // Vérifier si les dossiers de destination existent déjà
    const hasParametre = existsSync(parametreDest);
    const hasData = existsSync(dataDest);
    
    // Copier les fichiers de configuration (parametre/) s'ils n'existent pas
    // On copie toujours les fichiers individuels s'ils manquent, même si le dossier existe
    if (existsSync(parametreSrc)) {
      if (!hasParametre) {
        console.log('[initializeUserData] Copie complète de parametre/ vers le répertoire utilisateur');
        await copyDirectory(parametreSrc, parametreDest);
      } else {
        // Le dossier existe, mais copier les fichiers individuels manquants
        console.log('[initializeUserData] Vérification des fichiers manquants dans parametre/');
        await copyDirectory(parametreSrc, parametreDest, false);
      }
    }
    
    // Pour data/, on copie seulement si le dossier n'existe pas
    // (pour éviter d'écraser les données utilisateur existantes)
    if (!hasData && existsSync(dataSrc)) {
      console.log('[initializeUserData] Copie de data/ vers le répertoire utilisateur');
      await copyDirectory(dataSrc, dataDest);
    }
    
    console.log('[initializeUserData] Initialisation terminée');
  } catch (error: any) {
    console.error('[initializeUserData] Erreur lors de l\'initialisation:', error.message);
    // Ne pas bloquer le démarrage de l'application en cas d'erreur
  }
};

// Gestion des chemins de fichiers
const getAppPath = (): string => {
  // Sur Linux en mode packagé (AppImage), utiliser le répertoire utilisateur
  if (app.isPackaged && process.platform === 'linux') {
    // Utiliser app.getPath('userData') qui retourne ~/.config/comptal2/
    const userDataPath = app.getPath('userData');
    console.log('[getAppPath] Mode Linux packagé (AppImage)');
    console.log('[getAppPath] Répertoire utilisateur:', userDataPath);
    
    return userDataPath;
  }
  
  // Sur Windows/Mac ou en mode développement, utiliser la logique existante
  if (app.isPackaged) {
    console.log('[getAppPath] Mode packagé détecté');
    console.log('[getAppPath] process.resourcesPath:', process.resourcesPath);
    
    // En mode packagé, les fichiers décompressés (parametre/, data/) sont dans app.asar.unpacked
    // qui se trouve dans le dossier resources
    const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked');
    console.log('[getAppPath] Chemin unpacked testé:', unpackedPath);
    
    // Vérifier que le dossier existe
    if (existsSync(unpackedPath)) {
      // Vérifier la présence des sous-dossiers
      const parametrePath = path.join(unpackedPath, 'parametre');
      const dataPath = path.join(unpackedPath, 'data');
      const hasParametre = existsSync(parametrePath);
      const hasData = existsSync(dataPath);
      
      console.log('[getAppPath] Utilisation du chemin unpacked:', unpackedPath);
      console.log('[getAppPath] - parametre/ existe:', hasParametre);
      console.log('[getAppPath] - data/ existe:', hasData);
      
      return unpackedPath;
    } else {
      console.warn('[getAppPath] Le dossier app.asar.unpacked n\'existe pas');
      console.warn('[getAppPath] Tentative avec resourcesPath:', process.resourcesPath);
      
      // Vérifier si les dossiers existent directement dans resourcesPath
      const parametrePath = path.join(process.resourcesPath, 'parametre');
      const dataPath = path.join(process.resourcesPath, 'data');
      const hasParametre = existsSync(parametrePath);
      const hasData = existsSync(dataPath);
      
      console.log('[getAppPath] - parametre/ dans resourcesPath:', hasParametre);
      console.log('[getAppPath] - data/ dans resourcesPath:', hasData);
      
      if (hasParametre || hasData) {
        console.log('[getAppPath] Fichiers trouvés directement dans resourcesPath');
        return process.resourcesPath;
      }
      console.error('[getAppPath] ERREUR: Aucun fichier trouvé dans resourcesPath ou app.asar.unpacked');
      console.error('[getAppPath] Contenu de resourcesPath:', process.resourcesPath);
      return process.resourcesPath;
    }
  }
  // En mode développement, utiliser le chemin de l'application
  const devPath = app.getAppPath();
  console.log('[getAppPath] Mode développement, chemin:', devPath);
  return devPath;
};

// IPC Handlers pour la communication avec le renderer
ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    // Si le chemin est absolu, l'utiliser tel quel, sinon le joindre avec appPath
    const fullPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(getAppPath(), filePath);
    
    // Vérifier que le fichier existe
    if (!existsSync(fullPath)) {
      const errorMsg = `Fichier non trouvé: ${fullPath}`;
      console.error('[read-file]', errorMsg);
      return { success: false, error: errorMsg };
    }
    
    const content = await fs.readFile(fullPath, 'utf-8');
    console.log('[read-file] Fichier lu avec succès:', fullPath);
    return { success: true, data: content };
  } catch (error: any) {
    const errorMsg = `Erreur lors de la lecture du fichier ${filePath}: ${error.message}`;
    console.error('[read-file]', errorMsg, error);
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
  try {
    // Si le chemin est absolu, l'utiliser tel quel, sinon le joindre avec appPath
    const fullPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(getAppPath(), filePath);
    
    // Créer le dossier parent s'il n'existe pas
    const dirPath = path.dirname(fullPath);
    if (!existsSync(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true });
      console.log('[write-file] Dossier créé:', dirPath);
    }
    
    await fs.writeFile(fullPath, content, 'utf-8');
    console.log('[write-file] Fichier écrit avec succès:', fullPath);
    return { success: true };
  } catch (error: any) {
    const errorMsg = `Erreur lors de l'écriture du fichier ${filePath}: ${error.message}`;
    console.error('[write-file]', errorMsg, error);
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('read-directory', async (_, dirPath: string) => {
  try {
    // Si le chemin est absolu, l'utiliser tel quel, sinon le joindre avec appPath
    const fullPath = path.isAbsolute(dirPath) 
      ? dirPath 
      : path.join(getAppPath(), dirPath);
    
    // Vérifier que le dossier existe
    if (!existsSync(fullPath)) {
      const errorMsg = `Dossier non trouvé: ${fullPath}`;
      console.error('[read-directory]', errorMsg);
      return { success: false, error: errorMsg };
    }
    
    const files = await fs.readdir(fullPath);
    console.log('[read-directory] Dossier lu avec succès:', fullPath, `(${files.length} fichiers)`);
    return { success: true, data: files };
  } catch (error: any) {
    const errorMsg = `Erreur lors de la lecture du dossier ${dirPath}: ${error.message}`;
    console.error('[read-directory]', errorMsg, error);
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('get-app-path', async () => {
  const appPath = getAppPath();
  console.log('[get-app-path] Chemin retourné:', appPath);
  return appPath;
});

// Handler pour sélectionner un dossier
ipcMain.handle('select-folder', async () => {
  try {
    if (!mainWindow) {
      return { success: false, error: 'Fenêtre principale non disponible' };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Sélectionner un dossier de données',
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const folderPath = result.filePaths[0];
    console.log('[select-folder] Dossier sélectionné:', folderPath);
    return { success: true, path: folderPath };
  } catch (error: any) {
    const errorMsg = `Erreur lors de la sélection du dossier: ${error.message}`;
    console.error('[select-folder]', errorMsg, error);
    return { success: false, error: errorMsg };
  }
});

// Handler pour sélectionner un fichier (pour l'import)
ipcMain.handle('select-file', async (_, options?: { filters?: { name: string; extensions: string[] }[] }) => {
  try {
    if (!mainWindow) {
      return { success: false, error: 'Fenêtre principale non disponible' };
    }

    const dialogOptions: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      title: 'Sélectionner un fichier',
    };

    if (options?.filters) {
      dialogOptions.filters = options.filters;
    }

    const result = await dialog.showOpenDialog(mainWindow, dialogOptions);

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    console.log('[select-file] Fichier sélectionné:', filePath);
    return { success: true, path: filePath };
  } catch (error: any) {
    const errorMsg = `Erreur lors de la sélection du fichier: ${error.message}`;
    console.error('[select-file]', errorMsg, error);
    return { success: false, error: errorMsg };
  }
});

// Handler pour sauvegarder un fichier (pour l'export)
ipcMain.handle('save-file', async (_, options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
  try {
    if (!mainWindow) {
      return { success: false, error: 'Fenêtre principale non disponible' };
    }

    const dialogOptions: Electron.SaveDialogOptions = {
      title: 'Sauvegarder le fichier',
    };

    if (options?.defaultPath) {
      dialogOptions.defaultPath = options.defaultPath;
    }

    if (options?.filters) {
      dialogOptions.filters = options.filters;
    }

    const result = await dialog.showSaveDialog(mainWindow, dialogOptions);

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePath;
    if (!filePath) {
      return { success: false, error: 'Aucun chemin de fichier spécifié' };
    }

    console.log('[save-file] Fichier à sauvegarder:', filePath);
    return { success: true, path: filePath };
  } catch (error: any) {
    const errorMsg = `Erreur lors de la sélection du fichier de sauvegarde: ${error.message}`;
    console.error('[save-file]', errorMsg, error);
    return { success: false, error: errorMsg };
  }
});

// Handler pour lire un fichier externe (pour l'import)
ipcMain.handle('read-external-file', async (_, filePath: string) => {
  try {
    // Vérifier que le fichier existe
    if (!existsSync(filePath)) {
      const errorMsg = `Fichier non trouvé: ${filePath}`;
      console.error('[read-external-file]', errorMsg);
      return { success: false, error: errorMsg };
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    console.log('[read-external-file] Fichier lu avec succès:', filePath);
    return { success: true, data: content };
  } catch (error: any) {
    const errorMsg = `Erreur lors de la lecture du fichier ${filePath}: ${error.message}`;
    console.error('[read-external-file]', errorMsg, error);
    return { success: false, error: errorMsg };
  }
});

// Handler pour écrire un fichier externe (pour l'export)
ipcMain.handle('write-external-file', async (_, filePath: string, content: string) => {
  try {
    // Créer le dossier parent s'il n'existe pas
    const dirPath = path.dirname(filePath);
    if (!existsSync(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true });
      console.log('[write-external-file] Dossier créé:', dirPath);
    }
    
    await fs.writeFile(filePath, content, 'utf-8');
    console.log('[write-external-file] Fichier écrit avec succès:', filePath);
    return { success: true };
  } catch (error: any) {
    const errorMsg = `Erreur lors de l'écriture du fichier ${filePath}: ${error.message}`;
    console.error('[write-external-file]', errorMsg, error);
    return { success: false, error: errorMsg };
  }
});

// Handler pour ouvrir un fichier avec l'application par défaut
ipcMain.handle('open-path', async (_, filePath: string) => {
  try {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(getAppPath(), filePath);
    if (!existsSync(fullPath)) {
      return { success: false, error: `Fichier non trouvé: ${fullPath}` };
    }
    await shell.openPath(fullPath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Handler pour écrire un fichier binaire (PDF, etc.)
ipcMain.handle('write-binary-file', async (_, filePath: string, base64Content: string) => {
  try {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(getAppPath(), filePath);
    const dirPath = path.dirname(fullPath);
    if (!existsSync(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true });
      console.log('[write-binary-file] Dossier créé:', dirPath);
    }

    const buffer = Buffer.from(base64Content, 'base64');
    await fs.writeFile(fullPath, buffer);
    console.log('[write-binary-file] Fichier écrit avec succès:', fullPath);
    return { success: true };
  } catch (error: any) {
    const errorMsg = `Erreur lors de l'écriture du fichier binaire ${filePath}: ${error.message}`;
    console.error('[write-binary-file]', errorMsg, error);
    return { success: false, error: errorMsg };
  }
});

// Protection contre les instances multiples (uniquement en production)
const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;

if (!isDev) {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    // Si une autre instance existe déjà, on quitte
    app.quit();
  } else {
    // Gestion de l'événement quand une deuxième instance tente de se lancer
    app.on('second-instance', () => {
      // Si une fenêtre existe déjà, on la met au premier plan
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  }
}

// Cycle de vie de l'application
app.whenReady().then(async () => {
  console.log('[app] Application prête');
  console.log('[app] Version:', app.getVersion());
  console.log('[app] isPackaged:', app.getAppPath(), '->', app.isPackaged);
  console.log('[app] resourcesPath:', process.resourcesPath);
  console.log('[app] __dirname:', __dirname);
  console.log('[app] Platform:', process.platform);
  
  // Sur Linux en mode packagé, initialiser les données utilisateur avant de créer la fenêtre
  if (app.isPackaged && process.platform === 'linux') {
    const userDataPath = app.getPath('userData');
    console.log('[app] Initialisation des données utilisateur pour Linux...');
    await initializeUserData(userDataPath);
  }
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

