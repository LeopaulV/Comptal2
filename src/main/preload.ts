import { contextBridge, ipcRenderer } from 'electron';

// API exposée au renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string) => 
    ipcRenderer.invoke('write-file', filePath, content),
  readDirectory: (dirPath: string) => ipcRenderer.invoke('read-directory', dirPath),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile: (options?: { filters?: { name: string; extensions: string[] }[] }) => 
    ipcRenderer.invoke('select-file', options),
  saveFile: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => 
    ipcRenderer.invoke('save-file', options),
  readExternalFile: (filePath: string) => ipcRenderer.invoke('read-external-file', filePath),
  writeExternalFile: (filePath: string, content: string) => 
    ipcRenderer.invoke('write-external-file', filePath, content),
  writeBinaryFile: (filePath: string, base64Content: string) =>
    ipcRenderer.invoke('write-binary-file', filePath, base64Content),
  openPath: (filePath: string) => ipcRenderer.invoke('open-path', filePath),
});

// Types pour TypeScript
export interface ElectronAPI {
  readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  readDirectory: (dirPath: string) => Promise<{ success: boolean; data?: string[]; error?: string }>;
  getAppPath: () => Promise<string>;
  selectFolder: () => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
  selectFile: (options?: { filters?: { name: string; extensions: string[] }[] }) => 
    Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
  saveFile: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => 
    Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
  readExternalFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  writeExternalFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  writeBinaryFile: (filePath: string, base64Content: string) => Promise<{ success: boolean; error?: string }>;
  openPath: (filePath: string) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

