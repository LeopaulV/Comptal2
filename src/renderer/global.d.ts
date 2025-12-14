// Déclarations globales pour TypeScript

interface Window {
  electronAPI: {
    readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
    readDirectory: (dirPath: string) => Promise<{ success: boolean; data?: string[]; error?: string }>;
    getAppPath: () => Promise<string>;
  };
}

