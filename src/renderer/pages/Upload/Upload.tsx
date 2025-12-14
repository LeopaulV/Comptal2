import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, Button, Loading } from '../../components/Common';
import FileDropzone from '../../components/Upload/FileDropzone';
import ColumnMappingInterface from '../../components/Upload/ColumnMappingInterface';
import ExcelSheetSelector from '../../components/Upload/ExcelSheetSelector';
import ImportPreviewTable from '../../components/Upload/ImportPreviewTable';
import { FileDetectionService } from '../../services/FileDetectionService';
import { ColumnMappingService } from '../../services/ColumnMappingService';
import { CSVTransformService } from '../../services/CSVTransformService';
import { ExcelSheetService } from '../../services/ExcelSheetService';
import { BalanceService } from '../../services/BalanceService';
import { ConfigService } from '../../services/ConfigService';
import { FileService } from '../../services/FileService';
import { DataService } from '../../services/DataService';
import { FileAnalysisResult } from '../../types/FileAnalysis';
import { ColumnMappingConfig, TransformedRow, ImportConfig } from '../../types/ColumnMapping';
import { ExcelSheetInfo, SheetImportConfig } from '../../types/ExcelImport';
import { AccountsConfig } from '../../types/Account';
import { format, parse } from 'date-fns';

type UploadStep = 'select' | 'sheet-selection' | 'analyzing' | 'analysis' | 'mapping' | 'config' | 'preview' | 'uploading' | 'success' | 'error';

const Upload: React.FC = () => {
  const { t } = useTranslation();
  // État général
  const [step, setStep] = useState<UploadStep>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExcel, setIsExcel] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // État pour CSV (workflow simple)
  const [analysisResult, setAnalysisResult] = useState<FileAnalysisResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMappingConfig | null>(null);
  const [transformedRows, setTransformedRows] = useState<TransformedRow[]>([]);
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>('');
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [balanceFromFile, setBalanceFromFile] = useState<number | null>(null);

  // État pour Excel (workflow multi-feuilles)
  const [excelSheets, setExcelSheets] = useState<ExcelSheetInfo[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Map<string, string>>(new Map()); // sheetName -> accountCode
  const [sheetConfigs, setSheetConfigs] = useState<Map<string, SheetImportConfig>>(new Map());
  const [sheetAnalysisResults, setSheetAnalysisResults] = useState<Map<string, FileAnalysisResult>>(new Map());
  const [sheetMappings, setSheetMappings] = useState<Map<string, ColumnMappingConfig>>(new Map());
  const [sheetTransformedData, setSheetTransformedData] = useState<Map<string, TransformedRow[]>>(new Map());
  const [currentSheetIndex, setCurrentSheetIndex] = useState<number>(0);
  const [currentSheetName, setCurrentSheetName] = useState<string>('');

  const [accounts, setAccounts] = useState<AccountsConfig>({});

  // Charger les comptes au montage
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const accountsData = await ConfigService.loadAccounts();
        setAccounts(accountsData);
      } catch (error: any) {
        console.error('Erreur lors du chargement des comptes:', error);
      }
    };
    loadAccounts();
  }, []);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    
    const file = files[0];
    setSelectedFile(file);
    setErrors([]);

    console.log('[Import] Fichier sélectionné:', {
      nom: file.name,
      taille: `${(file.size / 1024).toFixed(2)} KB`,
      type: file.type || 'non spécifié'
    });

5    // Détecter si c'est un fichier Excel
    const fileType = FileDetectionService.detectFileType(file.name);
    const isExcelFile = fileType === 'excel';
    setIsExcel(isExcelFile);

    if (isExcelFile) {
      // Workflow Excel : lister les feuilles
      console.log('[Import] Fichier Excel détecté, analyse des feuilles...');
      setStep('sheet-selection');
      setIsAnalyzing(true);
      
      try {
        const sheets = await ExcelSheetService.listSheets(file);
        console.log('[Import] Feuilles Excel détectées:', sheets.length, 'feuille(s)');
        setExcelSheets(sheets);
        setIsAnalyzing(false);
      } catch (error: any) {
        console.error('[Import] Erreur lors de la lecture du fichier Excel:', error.message);
        setErrors([`Erreur lors de la lecture du fichier Excel: ${error.message}`]);
        setStep('error');
        setIsAnalyzing(false);
      }
    } else {
      // Workflow CSV : demander d'abord le compte
      console.log('[Import] Fichier CSV détecté');
      setStep('config');
    }
  };

  // Handler pour la sélection des feuilles Excel
  const handleExcelSheetsConfirm = async (sheetAccountMap: Map<string, string>) => {
    setSelectedSheets(sheetAccountMap);
    
    // Commencer l'analyse de la première feuille
    const sheetNames = Array.from(sheetAccountMap.keys());
    if (sheetNames.length === 0) {
      setErrors(['Aucune feuille sélectionnée']);
      return;
    }

    console.log('[Import] Feuilles Excel sélectionnées:', {
      nombre: sheetNames.length,
      feuilles: Array.from(sheetAccountMap.entries()).map(([sheet, account]) => `${sheet} → ${account}`)
    });

    setCurrentSheetIndex(0);
    setCurrentSheetName(sheetNames[0]);
    setStep('analyzing');
    setIsAnalyzing(true);

    // Analyser la première feuille
    await analyzeSheet(sheetNames[0], sheetAccountMap.get(sheetNames[0])!);
  };

  // Analyser une feuille Excel
  const analyzeSheet = async (sheetName: string, accountCode: string) => {
    if (!selectedFile) return;

    console.log('[Import] Début analyse feuille:', {
      feuille: sheetName,
      compte: accountCode,
      index: currentSheetIndex + 1,
      total: selectedSheets.size
    });

    try {
      const structure = await FileDetectionService.analyzeFile(selectedFile, sheetName);
      const result = ColumnMappingService.analyzeFile(structure);

      const validation = ColumnMappingService.validateDetection(result);
      if (!validation.valid) {
        console.error('[Import] Validation échouée pour la feuille', sheetName, ':', validation.errors);
        // Passer à la feuille suivante si cette feuille échoue
        const sheetNames = Array.from(selectedSheets.keys());
        const currentIndex = sheetNames.indexOf(sheetName);
        const newErrors = [...errors, `Feuille "${sheetName}": ${validation.errors.join(', ')}`];
        setErrors(newErrors);
        
        if (currentIndex < sheetNames.length - 1) {
          const nextSheet = sheetNames[currentIndex + 1];
          setCurrentSheetName(nextSheet);
          setCurrentSheetIndex(currentIndex + 1);
          await analyzeSheet(nextSheet, selectedSheets.get(nextSheet)!);
          return;
        } else {
          // Dernière feuille, vérifier s'il y a eu des succès
          if (sheetTransformedData.size > 0) {
            // Au moins une feuille a réussi, continuer
            console.log('[Import] Analyse terminée:', sheetTransformedData.size, 'feuille(s) réussie(s)');
            setStep('preview');
            setIsAnalyzing(false);
          } else {
            // Aucune feuille n'a réussi
            console.error('[Import] Aucune feuille n\'a pu être analysée avec succès');
            setStep('error');
            setIsAnalyzing(false);
          }
          return;
        }
      }

      console.log('[Import] Analyse feuille terminée:', {
        feuille: sheetName,
        mappingManuelRequis: result.requiresManualMapping
      });

      // Stocker le résultat d'analyse
      const newResults = new Map(sheetAnalysisResults);
      newResults.set(sheetName, result);
      setSheetAnalysisResults(newResults);

      setIsAnalyzing(false);

      // TOUJOURS afficher l'interface de mapping pour permettre à l'utilisateur de valider/modifier
      setStep('mapping');
    } catch (error: any) {
      console.error('[Import] Erreur lors de l\'analyse de la feuille', sheetName, ':', error.message);
      setErrors([...errors, `Erreur lors de l'analyse de la feuille "${sheetName}": ${error.message}`]);
      setIsAnalyzing(false);
    }
  };


  // Transformer les données d'une feuille
  const transformSheetData = async (
    sheetName: string,
    config: SheetImportConfig,
    mapping: ColumnMappingConfig,
    analysisResult: FileAnalysisResult
  ) => {
    if (!selectedFile) {
      console.error('[Import] Aucun fichier sélectionné pour la transformation');
      return;
    }

    console.log('[Import] Début transformation feuille:', {
      feuille: sheetName,
      compte: config.accountCode,
      soldeInitial: config.initialBalance,
      fichier: selectedFile.name,
      tailleFichier: `${(selectedFile.size / 1024).toFixed(2)} KB`
    });

    try {
      console.log('[Import] Résultat d\'analyse fourni:', {
        feuille: sheetName,
        structure: analysisResult.structure.fileType,
        dataStartRow: analysisResult.structure.dataStartRowIndex,
        colonnesDetectees: Object.keys(analysisResult.detectedColumns).length,
        donneesCachees: analysisResult.structure.rawData ? analysisResult.structure.rawData.length : 0
      });

      // Transformer avec dates temporaires (sera mis à jour après)
      const tempConfig: ImportConfig = {
        accountCode: config.accountCode,
        accountName: config.accountName,
        initialBalance: config.initialBalance,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        columnMapping: mapping,
      };

      console.log('[Import] Appel CSVTransformService.transformData (première passe)...');
      const rows = await CSVTransformService.transformData(
        selectedFile,
        analysisResult.structure,
        analysisResult.detectedColumns,
        mapping,
        tempConfig,
        sheetName // Passer le nom de la feuille pour Excel
      );
      console.log('[Import] Première transformation terminée, lignes transformées:', rows.length);

      // Extraire les dates réelles
      console.log('[Import] Extraction de la plage de dates...');
      const dates = CSVTransformService.extractDateRange(rows);
      console.log('[Import] Dates extraites:', dates);
      config.startDate = dates.startDate;
      config.endDate = dates.endDate;

      // Utiliser le solde initial fourni par l'utilisateur
      // Ne récupérer depuis le service QUE si aucun solde n'a été fourni (valeur 0)
      let initialBalance = config.initialBalance;
      
      console.log('[Import] Solde initial dans config:', initialBalance);
      
      // Si le solde initial est 0 (non fourni par l'utilisateur), essayer de le récupérer depuis le service
      if (initialBalance === 0) {
        console.log('[Import] Solde initial à 0, tentative de récupération depuis le service...');
        try {
          const balanceFromService = await BalanceService.getBalanceBeforeDate(
            config.accountCode,
            dates.startDate
          );
          if (balanceFromService !== null) {
            initialBalance = balanceFromService;
            console.log('[Import] Solde récupéré depuis le service:', initialBalance);
          } else {
            console.log('[Import] Aucun solde trouvé dans le service, utilisation de 0');
          }
        } catch (error: any) {
          console.warn('[Import] Erreur lors de la récupération du solde:', error.message);
          // Utiliser 0 par défaut
        }
      } else {
        console.log('[Import] Utilisation du solde initial fourni par l\'utilisateur:', initialBalance);
      }

      // Mettre à jour le solde initial dans la config
      config.initialBalance = initialBalance;

      // Retransformer avec les bonnes dates et le bon solde initial
      const finalConfig: ImportConfig = {
        ...tempConfig,
        startDate: dates.startDate,
        endDate: dates.endDate,
        initialBalance: initialBalance,
      };

      console.log('[Import] Appel CSVTransformService.transformData (deuxième passe avec dates finales)...');
      const finalRows = await CSVTransformService.transformData(
        selectedFile,
        analysisResult.structure,
        analysisResult.detectedColumns,
        mapping,
        finalConfig,
        sheetName // Passer le nom de la feuille pour Excel
      );
      console.log('[Import] Transformation finale terminée, lignes:', finalRows.length);

      console.log('[Import] Transformation feuille terminée:', {
        feuille: sheetName,
        transactions: finalRows.length,
        periode: `${dates.startDate} → ${dates.endDate}`
      });

      const newData = new Map(sheetTransformedData);
      newData.set(sheetName, finalRows);
      setSheetTransformedData(newData);

      // Mettre à jour la config avec les dates
      const updatedConfigs = new Map(sheetConfigs);
      updatedConfigs.set(sheetName, { ...config, startDate: dates.startDate, endDate: dates.endDate });
      setSheetConfigs(updatedConfigs);

      // Passer à la feuille suivante ou à la prévisualisation
      const sheetNames = Array.from(selectedSheets.keys());
      const currentIndex = sheetNames.indexOf(sheetName);
      
      if (currentIndex < sheetNames.length - 1) {
        // Analyser la feuille suivante
        const nextSheet = sheetNames[currentIndex + 1];
        setCurrentSheetName(nextSheet);
        setCurrentSheetIndex(currentIndex + 1);
        setStep('analyzing');
        setIsAnalyzing(true);
        await analyzeSheet(nextSheet, selectedSheets.get(nextSheet)!);
      } else {
        // Toutes les feuilles sont traitées, afficher la prévisualisation
        console.log('[Import] Toutes les feuilles traitées, passage à la prévisualisation');
        setStep('preview');
      }
    } catch (error: any) {
      console.error('[Import] Erreur lors de la transformation de la feuille', sheetName, ':', error.message);
      setErrors([...errors, `Erreur lors de la transformation de la feuille "${sheetName}": ${error.message}`]);
      setStep('error');
    }
  };


  // Handler pour la nouvelle interface de mapping (ColumnMappingInterface)
  const handleColumnMappingConfirm = async (
    mapping: ColumnMappingConfig,
    initialBalance: number
  ) => {
    console.log('[Import] handleColumnMappingConfirm appelé:', {
      isExcel,
      mapping,
      initialBalance,
      currentSheetName,
      hasAnalysisResult: !!analysisResult
    });

    if (isExcel) {
      // Workflow Excel
      const accountCode = selectedSheets.get(currentSheetName);
      const sheetResult = sheetAnalysisResults.get(currentSheetName);
      
      console.log('[Import] Workflow Excel:', {
        accountCode,
        hasSheetResult: !!sheetResult,
        currentSheetName
      });
      
      if (!accountCode || !sheetResult) {
        console.error('[Import] Données de feuille manquantes');
        setErrors(['Données de feuille manquantes']);
        return;
      }

      // Stocker le mapping et le solde initial
      const newMappings = new Map(sheetMappings);
      newMappings.set(currentSheetName, mapping);
      setSheetMappings(newMappings);

      console.log('[Import] Passage à processSheetConfigWithBalance');
      // Passer directement à la transformation avec le solde initial fourni
      await processSheetConfigWithBalance(currentSheetName, accountCode, mapping, sheetResult, initialBalance);
    } else {
      // Workflow CSV
      if (!analysisResult) {
        console.error('[Import] Résultat d\'analyse manquant pour CSV');
        setErrors(['Résultat d\'analyse manquant']);
        return;
      }

      console.log('[Import] Workflow CSV, passage à transformCSVData');
      setColumnMapping(mapping);
      setInitialBalance(initialBalance);
      setBalanceFromFile(null); // Utiliser le solde fourni par l'utilisateur

      // Passer directement à la prévisualisation
      await transformCSVData(mapping, initialBalance);
    }
  };

  // Nouvelle fonction pour traiter une feuille Excel avec solde initial
  const processSheetConfigWithBalance = async (
    sheetName: string,
    accountCode: string,
    mapping: ColumnMappingConfig,
    analysisResult: FileAnalysisResult,
    initialBalance: number
  ) => {
    const account = accounts[accountCode];
    if (!account) {
      setErrors([...errors, `Compte invalide pour la feuille "${sheetName}"`]);
      return;
    }

    // Créer la config pour cette feuille avec le solde initial fourni
    const config: SheetImportConfig = {
      sheetName,
      accountCode,
      accountName: account.name,
      initialBalance: initialBalance, // Utiliser le solde fourni
      columnMapping: mapping,
    };

    const newConfigs = new Map(sheetConfigs);
    newConfigs.set(sheetName, config);
    setSheetConfigs(newConfigs);

    // Transformer les données de cette feuille
    await transformSheetData(sheetName, config, mapping, analysisResult);
  };

  // Nouvelle fonction pour transformer les données CSV
  const transformCSVData = async (mapping: ColumnMappingConfig, balance: number) => {
    if (!selectedFile || !analysisResult || !selectedAccountCode) {
      setErrors(['Données manquantes pour la transformation']);
      return;
    }

    const account = accounts[selectedAccountCode];
    if (!account) {
      setErrors(['Compte invalide']);
      return;
    }

    setStep('preview');

    try {
      // Transformer avec dates temporaires (sera mis à jour après)
      const tempConfig: ImportConfig = {
        accountCode: selectedAccountCode,
        accountName: account.name,
        initialBalance: balance,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        columnMapping: mapping,
      };

      if (!analysisResult) {
        setErrors(['Résultat d\'analyse manquant']);
        return;
      }

      const rows = await CSVTransformService.transformData(
        selectedFile,
        analysisResult.structure,
        analysisResult.detectedColumns,
        mapping,
        tempConfig
      );

      // Extraire les dates réelles
      const dates = CSVTransformService.extractDateRange(rows);
      
      // Retransformer avec les bonnes dates
      const finalConfig: ImportConfig = {
        ...tempConfig,
        startDate: dates.startDate,
        endDate: dates.endDate,
        initialBalance: balance, // Utiliser le solde fourni par l'utilisateur
      };

      const finalRows = await CSVTransformService.transformData(
        selectedFile,
        analysisResult.structure,
        analysisResult.detectedColumns,
        mapping,
        finalConfig
      );

      console.log('[Import] Transformation CSV terminée:', {
        transactions: finalRows.length,
        periode: `${dates.startDate} → ${dates.endDate}`
      });

      setTransformedRows(finalRows);
    } catch (error: any) {
      console.error('[Import] Erreur lors de la transformation CSV:', error.message);
      setErrors([`Erreur lors de la transformation: ${error.message}`]);
      setStep('error');
    }
  };

  const handleConfigContinue = async () => {
    // Pour CSV, cette fonction est maintenant utilisée pour lancer l'analyse après sélection du compte
    if (!selectedFile || !selectedAccountCode) {
      setErrors(['Veuillez sélectionner un compte']);
      return;
    }

    const account = accounts[selectedAccountCode];
    if (!account) {
      setErrors(['Compte invalide']);
      return;
    }

    // Lancer l'analyse du fichier CSV
    console.log('[Import] Début analyse CSV pour compte:', selectedAccountCode);
    setStep('analyzing');
    setIsAnalyzing(true);

    try {
      const structure = await FileDetectionService.analyzeFile(selectedFile);
      const result = ColumnMappingService.analyzeFile(structure);

      const validation = ColumnMappingService.validateDetection(result);
      if (!validation.valid) {
        console.error('[Import] Validation échouée:', validation.errors);
        setErrors(validation.errors);
        setStep('error');
        setIsAnalyzing(false);
        return;
      }

      console.log('[Import] Analyse CSV terminée avec succès');
      setAnalysisResult(result);
      setIsAnalyzing(false);
      // Afficher l'interface de mapping
      setStep('mapping');
    } catch (error: any) {
      console.error('[Import] Erreur lors de l\'analyse CSV:', error.message);
      setErrors([`Erreur lors de l'analyse: ${error.message}`]);
      setStep('error');
      setIsAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (isExcel) {
      // Import Excel : un CSV par feuille
      console.log('[Import] Début import Excel:', {
        nombreFeuilles: sheetTransformedData.size,
        totalTransactions: totalExcelTransactions
      });
      setStep('uploading');

      try {
        let successCount = 0;
        const importErrors: string[] = [];

        for (const [sheetName, rows] of sheetTransformedData.entries()) {
          try {
            const config = sheetConfigs.get(sheetName);
            if (!config) continue;

            console.log('[Import] Import feuille:', {
              feuille: sheetName,
              compte: config.accountCode,
              transactions: rows.length
            });

            const csvContent = CSVTransformService.generateCSV(rows);
            const startDateObj = parse(config.startDate || '', 'yyyy-MM-dd', new Date());
            const endDateObj = parse(config.endDate || '', 'yyyy-MM-dd', new Date());
            const fileName = `${config.accountCode}_${format(startDateObj, 'dd.MM.yyyy')}_${format(endDateObj, 'dd.MM.yyyy')}.csv`;

            await FileService.writeFile(`data/${fileName}`, csvContent);

            // Sauvegarder le solde initial
            if (config.startDate) {
              await BalanceService.setInitialBalance(
                config.accountCode,
                config.startDate,
                config.initialBalance
              );
            }

            successCount++;
            console.log('[Import] Feuille importée avec succès:', sheetName);
          } catch (error: any) {
            console.error('[Import] Erreur import feuille', sheetName, ':', error.message);
            importErrors.push(`Feuille "${sheetName}": ${error.message}`);
          }
        }

        if (importErrors.length > 0) {
          setErrors(importErrors);
        }

        console.log('[Import] Import Excel terminé:', {
          reussies: successCount,
          echecs: importErrors.length
        });

        await DataService.reload();
        setStep('success');

        setTimeout(() => {
          handleReset();
        }, 3000);
      } catch (error: any) {
        console.error('[Import] Erreur lors de l\'import Excel:', error.message);
        setErrors([`Erreur lors de l'import: ${error.message}`]);
        setStep('error');
      }
    } else {
      // Import CSV : workflow existant
      if (!selectedFile || !columnMapping || !selectedAccountCode || transformedRows.length === 0) {
        return;
      }

      console.log('[Import] Début import CSV:', {
        compte: selectedAccountCode,
        transactions: transformedRows.length
      });
      setStep('uploading');

      try {
        const csvContent = CSVTransformService.generateCSV(transformedRows);
        const dateRange = CSVTransformService.extractDateRange(transformedRows);
        const startDateObj = parse(dateRange.startDate, 'yyyy-MM-dd', new Date());
        const endDateObj = parse(dateRange.endDate, 'yyyy-MM-dd', new Date());
        const fileName = `${selectedAccountCode}_${format(startDateObj, 'dd.MM.yyyy')}_${format(endDateObj, 'dd.MM.yyyy')}.csv`;

        await FileService.writeFile(`data/${fileName}`, csvContent);

        if (initialBalance !== 0 || balanceFromFile !== null) {
          const balanceToSave = balanceFromFile !== null ? balanceFromFile : initialBalance;
          await BalanceService.setInitialBalance(
            selectedAccountCode,
            dateRange.startDate,
            balanceToSave
          );
        }

        console.log('[Import] Import CSV terminé avec succès:', {
          fichier: fileName,
          transactions: transformedRows.length
        });

        await DataService.reload();
        setStep('success');

        setTimeout(() => {
          handleReset();
        }, 3000);
      } catch (error: any) {
        console.error('[Import] Erreur lors de l\'import CSV:', error.message);
        setErrors([`Erreur lors de l'import: ${error.message}`]);
        setStep('error');
      }
    }
  };

  const handleReset = () => {
    setStep('select');
    setSelectedFile(null);
    setIsExcel(false);
    setAnalysisResult(null);
    setColumnMapping(null);
    setTransformedRows([]);
    setSelectedAccountCode('');
    setInitialBalance(0);
    setBalanceFromFile(null);
    setExcelSheets([]);
    setSelectedSheets(new Map());
    setSheetConfigs(new Map());
    setSheetAnalysisResults(new Map());
    setSheetMappings(new Map());
    setSheetTransformedData(new Map());
    setCurrentSheetIndex(0);
    setCurrentSheetName('');
    setErrors([]);
    setIsAnalyzing(false);
  };

  // Charger le solde initial pour CSV
  useEffect(() => {
    const loadInitialBalance = async () => {
      if (!selectedAccountCode || !columnMapping || !analysisResult || step !== 'config') return;

      try {
        const balance = await BalanceService.getInitialBalance(
          selectedAccountCode,
          new Date().toISOString().split('T')[0]
        );
        
        if (balance !== null) {
          setBalanceFromFile(balance);
          setInitialBalance(balance);
        }
      } catch (error) {
        // Ignorer
      }
    };

    loadInitialBalance();
  }, [selectedAccountCode, step, columnMapping, analysisResult]);

  // Calculer le total des transactions pour Excel
  const totalExcelTransactions = Array.from(sheetTransformedData.values())
    .reduce((sum, rows) => sum + rows.length, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('upload.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('upload.subtitle')}
        </p>
      </div>

      {/* Étapes */}
      <div className="flex items-center justify-center gap-4 flex-wrap">
        {[
          { key: 'select', label: t('upload.step1') },
          { key: 'sheet-selection', label: t('upload.step2') },
          { key: 'analysis', label: t('upload.step3') },
          { key: 'config', label: t('upload.step4') },
          { key: 'preview', label: t('upload.step5') },
          { key: 'uploading', label: t('upload.step6') },
        ].map((s, index) => {
          const stepIndex = ['select', 'sheet-selection', 'analyzing', 'analysis', 'mapping', 'config', 'preview', 'uploading', 'success'].indexOf(step);
          const isActive = stepIndex >= index;
          
          return (
            <React.Fragment key={s.key}>
              <div className="flex items-center gap-2">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm
                    ${isActive
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }
                  `}
                >
                  {index + 1}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:inline">
                  {s.label}
                </span>
              </div>
              {index < 5 && (
                <div className="w-8 h-0.5 bg-gray-200 dark:bg-gray-700 hidden sm:block" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Contenu */}
      {step === 'select' && (
        <Card>
          <FileDropzone onFilesSelected={handleFilesSelected} />
        </Card>
      )}

      {step === 'sheet-selection' && (
        <>
          {isAnalyzing ? (
            <Card>
              <div className="text-center py-12">
                <Loader2 className="animate-spin mx-auto mb-4 text-primary-600 dark:text-primary-400" size={48} />
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('upload.analyzingSheets')}
                </p>
              </div>
            </Card>
          ) : (
            <ExcelSheetSelector
              isOpen={true}
              onClose={handleReset}
              sheets={excelSheets}
              accounts={accounts}
              onConfirm={handleExcelSheetsConfirm}
            />
          )}
        </>
      )}

      {step === 'analyzing' && (
        <Card>
          <div className="text-center py-12">
            <Loader2 className="animate-spin mx-auto mb-4 text-primary-600 dark:text-primary-400" size={48} />
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {isExcel 
                ? t('upload.analyzingSheet', { sheetName: currentSheetName, current: currentSheetIndex + 1, total: selectedSheets.size })
                : t('upload.analyzingFile')
              }
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {t('upload.detectingStructure')}
            </p>
          </div>
        </Card>
      )}

      {step === 'mapping' && (
        <>
          {isExcel && sheetAnalysisResults.has(currentSheetName) ? (
            <ColumnMappingInterface
              isOpen={true}
              onClose={() => {
                // Retourner à l'analyse ou annuler selon le contexte
                const sheetNames = Array.from(selectedSheets.keys());
                const currentIndex = sheetNames.indexOf(currentSheetName);
                if (currentIndex > 0) {
                  // Retourner à la feuille précédente
                  const prevSheet = sheetNames[currentIndex - 1];
                  setCurrentSheetName(prevSheet);
                  setCurrentSheetIndex(currentIndex - 1);
                  setStep('analyzing');
                  setIsAnalyzing(true);
                  analyzeSheet(prevSheet, selectedSheets.get(prevSheet)!);
                } else {
                  handleReset();
                }
              }}
              structure={sheetAnalysisResults.get(currentSheetName)!.structure}
              detectedColumns={sheetAnalysisResults.get(currentSheetName)!.detectedColumns}
              accountCode={selectedSheets.get(currentSheetName)}
              initialBalance={0}
              onConfirm={handleColumnMappingConfirm}
            />
          ) : analysisResult ? (
            <ColumnMappingInterface
              isOpen={true}
              onClose={() => {
                // Retourner à la sélection du compte
                setStep('config');
              }}
              structure={analysisResult.structure}
              detectedColumns={analysisResult.detectedColumns}
              accountCode={selectedAccountCode || undefined}
              initialBalance={initialBalance}
              onConfirm={handleColumnMappingConfirm}
            />
          ) : null}
        </>
      )}

      {step === 'config' && !isExcel && (
        <Card>
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('upload.selectAccount')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('upload.selectAccountDescription')}
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                {t('upload.accountRequired')}
              </label>
              <select
                value={selectedAccountCode}
                onChange={(e) => setSelectedAccountCode(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">{t('upload.selectAccountPlaceholder')}</option>
                {Object.entries(accounts).map(([code, account]) => (
                  <option key={code} value={code}>
                    {code} - {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-4 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="secondary" onClick={handleReset}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleConfigContinue}
                disabled={!selectedAccountCode}
              >
                {t('upload.analyzeFile')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 'preview' && (
        <>
          {isExcel ? (
            <Card>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {t('upload.previewTitle')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('upload.previewDescription', { count: selectedSheets.size, total: totalExcelTransactions })}
                  </p>
                </div>

                {Array.from(sheetTransformedData.entries()).map(([sheetName, rows]) => {
                  const config = sheetConfigs.get(sheetName);
                  return (
                    <div key={sheetName} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                        {t('upload.sheetPreview', { sheetName, accountCode: config?.accountCode, count: rows.length })}
                      </h4>
                      <div className="overflow-x-auto max-h-64 border border-gray-200 dark:border-gray-700 rounded">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-gray-900 dark:text-white">Date</th>
                              <th className="px-3 py-2 text-left text-gray-900 dark:text-white">Libellé</th>
                              <th className="px-3 py-2 text-right text-gray-900 dark:text-white">Débit</th>
                              <th className="px-3 py-2 text-right text-gray-900 dark:text-white">Crédit</th>
                              <th className="px-3 py-2 text-right text-gray-900 dark:text-white">Solde</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.slice(0, 10).map((row, idx) => (
                              <tr key={idx} className="border-b border-gray-200 dark:border-gray-700">
                                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.Date}</td>
                                <td className="px-3 py-2 text-gray-700 dark:text-gray-300 truncate max-w-xs">{row.Libellé}</td>
                                <td className={`px-3 py-2 text-right ${row.Débit !== 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
                                  {row.Débit !== 0 ? row.Débit.toFixed(2) : '-'}
                                </td>
                                <td className={`px-3 py-2 text-right ${row.Crédit !== 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                                  {row.Crédit !== 0 ? row.Crédit.toFixed(2) : '-'}
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">
                                  {row.Solde.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {rows.length > 10 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                          {t('upload.moreTransactions', { count: rows.length - 10 })}
                        </p>
                      )}
                    </div>
                  );
                })}

                <div className="flex gap-4 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button variant="secondary" onClick={handleReset}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" onClick={handleImport}>
                    {t('upload.importTransactions', { count: totalExcelTransactions })}
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <ImportPreviewTable
              rows={transformedRows}
              onConfirm={handleImport}
              onCancel={() => setStep('config')}
            />
          )}
        </>
      )}

      {step === 'uploading' && (
        <Card>
          <Loading message={t('upload.importing')} size="lg" />
        </Card>
      )}

      {step === 'success' && (
        <Card>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('upload.importSuccess')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {isExcel 
                ? t('upload.importSuccessDescription', { count: totalExcelTransactions, sheets: selectedSheets.size })
                : t('upload.importSuccessCSV', { count: transformedRows.length })
              }
            </p>
          </div>
        </Card>
      )}

      {step === 'error' && (
        <Card>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('upload.importError')}
            </h3>
            <div className="text-left max-w-md mx-auto mb-6">
              {errors.map((error, index) => (
                <p key={index} className="text-sm text-red-600 dark:text-red-400">
                  • {error}
                </p>
              ))}
            </div>
            <Button variant="primary" onClick={handleReset}>
              {t('upload.retry')}
            </Button>
          </div>
        </Card>
      )}

      {/* Info */}
      {step === 'select' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            {t('upload.supportedFormats')}
          </h4>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
            {t('upload.supportedFormatsDescription')}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            {t('upload.acceptedFormats')}
            {isExcel && t('upload.excelMultiSheet')}
          </p>
        </div>
      )}
    </div>
  );
};

export default Upload;
