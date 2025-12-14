import { app, BrowserWindow, ipcMain } from 'electron';
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
    // mainWindow.webContents.openDevTools(); // DevTools désactivé
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

// Gestion des chemins de fichiers
const getAppPath = (): string => {
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
    const appPath = getAppPath();
    const fullPath = path.join(appPath, filePath);
    
    // Vérifier que le fichier existe
    if (!existsSync(fullPath)) {
      const errorMsg = `Fichier non trouvé: ${fullPath} (chemin de base: ${appPath})`;
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
    const appPath = getAppPath();
    const fullPath = path.join(appPath, filePath);
    
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
    const appPath = getAppPath();
    const fullPath = path.join(appPath, dirPath);
    
    // Vérifier que le dossier existe
    if (!existsSync(fullPath)) {
      const errorMsg = `Dossier non trouvé: ${fullPath} (chemin de base: ${appPath})`;
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
app.whenReady().then(() => {
  console.log('[app] Application prête');
  console.log('[app] Version:', app.getVersion());
  console.log('[app] isPackaged:', app.getAppPath(), '->', app.isPackaged);
  console.log('[app] resourcesPath:', process.resourcesPath);
  console.log('[app] __dirname:', __dirname);
  
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

