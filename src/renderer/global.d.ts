// Déclarations globales pour TypeScript

interface Window {
  electronAPI: {
    readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
    readDirectory: (dirPath: string) => Promise<{ success: boolean; data?: string[]; error?: string }>;
    deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    deleteDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
    copyDirectory: (srcPath: string, destPath: string) => Promise<{ success: boolean; error?: string }>;
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
    exportProfile: (profileId: string, profileName: string) =>
      Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
    importProfile: (zipPath: string, newProfileName: string) =>
      Promise<{ success: boolean; profileId?: string; error?: string }>;
  };
}

