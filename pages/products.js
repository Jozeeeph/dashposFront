import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Papa from 'papaparse';
import {
  Box,
  Button,
  Card,
  CircularProgress,
  LinearProgress,
  Typography,
  Snackbar,
  Alert
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import { styled } from '@mui/material/styles';
import * as XLSX from 'xlsx';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

export default function Products() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [importedVariantsCount, setImportedVariantsCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [importStatus, setImportStatus] = useState('Prêt à importer');
  const [progress, setProgress] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const showSnackbar = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Reset state
    setIsImporting(true);
    setImportStatus('Analyse du fichier...');
    setErrorMessage('');
    setImportCount(0);
    setImportedVariantsCount(0);
    setProgress(0);

    try {
      // Validate file type
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      const isCSV = file.name.endsWith('.csv');

      if (!isExcel && !isCSV) {
        throw new Error('Seuls les fichiers CSV (.csv) ou Excel (.xlsx, .xls) sont acceptés');
      }

      let csvText = '';
      let delimiter = ',';

      if (isExcel) {
        // Process Excel file
        setImportStatus('Conversion du fichier Excel en CSV...');
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        csvText = XLSX.utils.sheet_to_csv(firstSheet);
      } else {
        // Process CSV file
        csvText = await file.text();

        // Detect delimiter
        const firstLine = csvText.split('\n')[0];
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        delimiter = tabCount > commaCount ? '\t' : ',';
      }

      // Basic validation
      const lines = csvText.split('\n').filter(line => line.trim() !== '');
      const expectedColumns = 19;

      if (lines.length < 2) {
        throw new Error('Le fichier doit contenir au moins une ligne d\'en-tête et une ligne de données');
      }

      // Verify header column count
      const headerColumns = lines[0].split(delimiter).length;
      if (headerColumns !== expectedColumns) {
        throw new Error(
          `L'en-tête doit contenir ${expectedColumns} colonnes. ${headerColumns} trouvées.\n` +
          `Séparateur détecté: ${delimiter === '\t' ? 'Tabulation' : 'Virgule'}\n` +
          `Assurez-vous que toutes les valeurs contenant des virgules ou tabulations sont entre guillemets ("value")`
        );
      }

      // Parse with PapaParse
      setImportStatus('Analyse des données...');

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        delimiter,
        quoteChar: '"',
        escapeChar: '"',
        dynamicTyping: true,
        transform: (value) => typeof value === 'string' ? value.trim() : value,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          console.log('Parsing complete', results);

          // Enhanced error handling
          if (results.errors.length > 0) {
            const criticalErrors = results.errors.filter(
              e => e.type === 'FieldMismatch' || e.type === 'UndetectableDelimiter'
            );

            if (criticalErrors.length > 0) {
              const errorDetails = criticalErrors.map(e =>
                `Ligne ${e.row + 1}: ${e.message} (${e.expected || expectedColumns} colonnes attendues)`
              ).join('\n');

              throw new Error(
                `Problème de format détecté:\n${errorDetails}\n\n` +
                `Conseils:\n` +
                `1. Vérifiez que toutes les lignes ont le même nombre de colonnes\n` +
                `2. Encadrez les textes contenant des virgules/tabulations avec des guillemets\n` +
                `3. Utilisez le modèle fourni comme référence`
              );
            }
          }

          if (!results.data || results.data.length === 0) {
            throw new Error('Aucune donnée valide trouvée dans le fichier');
          }

          // Process data
          setImportStatus('Traitement des produits...');
          const productGroups = {};
          const missingRefs = [];

          results.data.forEach((row, index) => {
            const productReference = (row.REFERENCE || '').toString().trim();
            const productName = (row.PRODUCTNAME || '').toString().trim();
            const groupKey = productReference || productName;

            if (!groupKey) {
              missingRefs.push(`Ligne ${index + 2}: Reference et ProductName manquants`);
              return;
            }

            if (!productGroups[groupKey]) {
              productGroups[groupKey] = [];
            }
            productGroups[groupKey].push(row);
          });

          if (missingRefs.length > 0) {
            console.warn('Lignes ignorées:', missingRefs);
          }

          // Transform to import format
          const productsToImport = Object.values(productGroups).map(group => {
            const firstRow = group[0];
            const hasVariants = group.length > 1 ||
              (firstRow.SIMPLEPRODUCT &&
                firstRow.SIMPLEPRODUCT.toString().toUpperCase() === 'FALSE');

            // Base product
            const productData = {
              code: (firstRow.REFERENCE || '').toString().trim(),
              designation: (firstRow.PRODUCTNAME || '').toString().trim(),
              category_name: (firstRow.CATEGORY || 'Default').toString().trim(),
              brand: (firstRow.BRAND || '').toString().trim(),
              description: (firstRow.DESCRIPTION || '').toString(),
              cost_price: parseFloat(firstRow.COSTPRICE) || 0,
              prixHT: parseFloat(firstRow.SELLPRICETAXEXCLUDE) || 0,
              taxe: parseFloat(firstRow.VAT) || 0,
              prixTTC: parseFloat(firstRow.SELLPRICETAXINCLUDE) || 0,
              sellable: firstRow.SELLABLE &&
                firstRow.SELLABLE.toString().toUpperCase() === 'TRUE',
              has_variants: hasVariants,
              variants: []
            };

            // Handle variants
            if (hasVariants) {
              productData.variants = group.map(variantRow => ({
                combination_name: (variantRow.VARIANTNAME || '').toString().trim(),
                price_impact: parseFloat(variantRow.IMPACTPRICE) || 0,
                stock: parseInt(variantRow.QUANTITYVARIANT) || 0,
                default_variant: variantRow.DEFAULTVARIANT &&
                  variantRow.DEFAULTVARIANT.toString().toUpperCase() === 'TRUE',
                attributes: parseAttributes(variantRow.VARIANTNAME)
              }));
            } else {
              // Simple product
              productData.stock = parseInt(firstRow.QUANTITY) || 0;
            }

            return productData;
          });

          console.log('Products ready for import:', productsToImport);
          setImportStatus(`Prêt à importer ${productsToImport.length} produits...`);
          simulateProgressThenImport(productsToImport);
        },
        error: (err) => {
          throw new Error(`Erreur d'analyse: ${err.message}`);
        }
      });

    } catch (error) {
      console.error('Import error:', error);
      setErrorMessage(error.message);
      setImportStatus("Échec de l'importation");
      setProgress(0);
      showSnackbar(error.message, 'error');
      setIsImporting(false);
    }
  };

  const parseAttributes = (variantName) => {
    if (!variantName) return {};

    const attributes = {};
    const pairs = variantName.toString().split('-');

    pairs.forEach(pair => {
      const [key, value] = pair.split(':').map(s => s.trim());
      if (key && value) {
        attributes[key] = value;
      }
    });

    return attributes;
  };

  const simulateProgressThenImport = (productsToImport) => {
    let progressValue = 0;
    setProgress(progressValue);
    setImportStatus('Importation en cours...');

    const interval = setInterval(() => {
      progressValue += 10;
      if (progressValue >= 90) {
        clearInterval(interval);
        setProgress(90);
        importProducts(productsToImport);
      } else {
        setProgress(progressValue);
      }
    }, 300);
  };

  const importProducts = async (productsToImport) => {
    try {
      setImportStatus('Envoi au serveur...');
      const response = await fetch('http://localhost:8000/pos/product/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: productsToImport }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('Import result:', result);

      setImportCount(result.importedCount || productsToImport.length);
      setImportedVariantsCount(result.importedVariantsCount || 0);
      setImportStatus('Importation réussie!');
      setProgress(100);

      showSnackbar(
        `Importation réussie: ${result.importedCount || productsToImport.length} produits et ${result.importedVariantsCount || 0} variantes`
      );

      fetchProducts();
    } catch (error) {
      console.error('Import error:', error);
      setErrorMessage(`Erreur lors de l'import: ${error.message}`);
      setImportStatus("Échec de l'importation");
      setProgress(0);
      showSnackbar(`Erreur lors de l'import: ${error.message}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/pos/product/get');
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
      setErrorMessage(`Erreur lors du chargement des produits: ${error.message}`);
      showSnackbar(`Erreur lors du chargement des produits: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "ACTION", "IMAGE", "PRODUCTNAME", "REFERENCE", "CATEGORY", "BRAND",
      "DESCRIPTION", "COSTPRICE", "SELLPRICETAXEXCLUDE", "VAT", "SELLPRICETAXINCLUDE",
      "QUANTITY", "SELLABLE", "SIMPLEPRODUCT", "VARIANTNAME", "DEFAULTVARIANT",
      "VARIANTIMAGE", "IMPACTPRICE", "QUANTITYVARIANT"
    ].join(',');

    const exampleSimpleProduct = [
      "CREATE", "product_image.jpg", "Produit Simple Exemple", "PROD001",
      "Catégorie Exemple", "Marque Exemple", "Description du produit", "10.0", "15.0",
      "20.0", "18.0", "100", "TRUE", "TRUE", "", "", "", "", ""
    ].join(',');

    const exampleVariant1 = [
      "CREATE", "product_with_variants.jpg", "Produit avec Variantes", "PROD002",
      "Catégorie Exemple", "Marque Exemple", "Description du produit avec variantes", "10.0",
      "15.0", "20.0", "18.0", "0", "TRUE", "FALSE", "Couleur:Rouge-Taille:M", "TRUE",
      "variant_image1.jpg", "0", "50"
    ].join(',');

    const exampleVariant2 = [
      "CREATE", "product_with_variants.jpg", "Produit avec Variantes", "PROD002",
      "Catégorie Exemple", "Marque Exemple", "Description du produit avec variantes", "10.0",
      "15.0", "20.0", "18.0", "0", "TRUE", "FALSE", "Couleur:Bleu-Taille:L", "FALSE",
      "variant_image2.jpg", "1", "30"
    ].join(',');

    const csvContent = [headers, exampleSimpleProduct, exampleVariant1, exampleVariant2].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modele_produits.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return (
    <Box display="flex" height="100vh" width="100vw" overflow="hidden">
      <Sidebar />
      <Box
        component="main"
        sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3, overflow: 'auto' }}
      >
        <Header />
        <Typography variant="h4" gutterBottom>
          Produits
        </Typography>
        <Card sx={{ p: 2, mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <label htmlFor="csv-file-input">
              <VisuallyHiddenInput
                id="csv-file-input"
                type="file"
                accept=".csv"
                disabled={isImporting}
                onChange={handleFileImport}
              />
              <Button
                variant="contained"
                component="span"
                startIcon={<CloudUploadIcon />}
                disabled={isImporting}
              >
                Importer produits CSV
              </Button>
            </label>

            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={downloadTemplate}
              disabled={isImporting}
            >
              Télécharger modèle CSV
            </Button>

            {isImporting && (
              <Button
                variant="text"
                color="error"
                onClick={() => {
                  setIsImporting(false);
                  setProgress(0);
                  setImportStatus('Import annulé');
                  showSnackbar('Import annulé par l\'utilisateur', 'info');
                }}
              >
                Annuler import
              </Button>
            )}
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="body1" gutterBottom>
              Statut: {importStatus}
            </Typography>
            <LinearProgress variant="determinate" value={progress} />
          </Box>

          {errorMessage && (
            <Typography variant="body2" color="error" sx={{ mt: 2 }}>
              {errorMessage}
            </Typography>
          )}

          {(importCount > 0 || importedVariantsCount > 0) && (
            <Typography variant="body2" color="success.main" sx={{ mt: 2 }}>
              {importCount} produits importés, {importedVariantsCount} variantes importées.
            </Typography>
          )}
        </Card>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : products.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', p: 2 }}>
            Aucun produit disponible
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 500, overflowY: 'auto' }}>
            {products.map((product) => (
              <Card key={product.code} sx={{ mb: 2, p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {product.designation} ({product.code})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Catégorie: {product.category_name} - Marque: {product.brand}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Prix HT: {product.prix_ht} € - Prix TTC: {product.prix_ttc} €
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Stock: {product.stock ?? 'N/A'}
                </Typography>

                {product.has_variants && product.variants?.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2">Variantes :</Typography>
                    {product.variants.map((variant, i) => (
                      <Box key={i} sx={{ pl: 2, mb: 1 }}>
                        <Typography variant="body2">
                          {variant.combination_name} - Stock: {variant.stock} - Impact Prix: {variant.price_impact} €
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Card>
            ))}
          </Box>
        )}

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbarSeverity}
            sx={{ width: '100%' }}
            variant="filled"
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
}