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
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Chip,
  TextField
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
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
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
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
  const [error, setError] = useState(null);
  const [openVariantsDialog, setOpenVariantsDialog] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [importedProducts, setImportedProducts] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [showImportSummary, setShowImportSummary] = useState(false);

  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  let csrfToken = null;
  if (typeof window !== 'undefined') {
    csrfToken = getCookie('csrftoken');
  }

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('http://127.0.0.1:8000/pos/product/get', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setProducts(data.products || []);
      setFilteredProducts(data.products || []);
    } catch (err) {
      setError(err.message);
      showSnackbar(`Failed to fetch products: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [searchTerm, products]);
const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus('Analyse du fichier...');
    setErrorMessage('');
    setImportCount(0);
    setImportedVariantsCount(0);
    setProgress(0);
    setImportedProducts([]);
    setImportErrors([]);
    setShowImportSummary(false);

    try {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      const isCSV = file.name.endsWith('.csv');

      if (!isExcel && !isCSV) {
        throw new Error('Seuls les fichiers CSV (.csv) ou Excel (.xlsx, .xls) sont acceptés');
      }

      let csvText = '';
      let delimiter = ',';

      if (isExcel) {
        setImportStatus('Conversion du fichier Excel en CSV...');
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        csvText = XLSX.utils.sheet_to_csv(firstSheet);
      } else {
        csvText = await file.text();
        const firstLine = csvText.split('\n')[0];
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        delimiter = tabCount > commaCount ? '\t' : ',';
      }

      const lines = csvText.split('\n').filter(line => line.trim() !== '');
      const expectedColumns = 19; // adjust this to your file structure

      if (lines.length < 2) {
        throw new Error('Le fichier doit contenir au moins une ligne d\'en-tête et une ligne de données');
      }

      const headerColumns = lines[0].split(delimiter).length;
      if (headerColumns !== expectedColumns) {
        throw new Error(
          `L'en-tête doit contenir ${expectedColumns} colonnes. ${headerColumns} trouvées.\n` +
          `Séparateur détecté: ${delimiter === '\t' ? 'Tabulation' : 'Virgule'}\n` +
          `Assurez-vous que toutes les valeurs contenant des virgules ou tabulations sont entre guillemets ("value")`
        );
      }

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

          setImportStatus('Groupement des produits et variantes...');

          const productGroups = {};
          results.data.forEach((row, index) => {
            const productReference = (row.REFERENCE || '').toString().trim();
            const productName = (row.PRODUCTNAME || '').toString().trim();

            if (!productName) return;

            const groupKey = productReference || productName;
            if (!productGroups[groupKey]) {
              productGroups[groupKey] = [];
            }
            productGroups[groupKey].push({ ...row, rowNumber: index + 2 });
          });

          const productsToImport = [];
          const importErrors = [];

          Object.values(productGroups).forEach(productRows => {
            if (productRows.length === 0) return;

            const firstRow = productRows[0];
            const isSimpleProduct = String(firstRow.SIMPLEPRODUCT || '').trim().toLowerCase() !== 'false';

            try {
              const parseNumber = (value, fieldName, required = false, defaultValue = 0) => {
                if (value === null || value === undefined || value === '') {
                  if (required) throw new Error(`Missing required field ${fieldName}`);
                  return defaultValue;
                }
                const cleanedValue = String(value).replace(',', '.').trim();
                const parsed = parseFloat(cleanedValue);
                if (isNaN(parsed)) throw new Error(`Invalid ${fieldName}: ${value}`);
                return parsed;
              };

              const prixHT = parseNumber(firstRow.SELLPRICETAXEXCLUDE, 'SELLPRICETAXEXCLUDE', true);
              const taxe = parseNumber(firstRow.VAT, 'VAT', true);
              const prixTTC = parseFloat((prixHT + (prixHT * taxe / 100)).toFixed(2));
              const costPrice = parseNumber(firstRow.COSTPRICE, 'COSTPRICE', false);

              const product = {
                code: (firstRow.REFERENCE || '').toString().trim() || null,
                designation: (firstRow.PRODUCTNAME || '').toString().trim(),
                category_name: (firstRow.CATEGORY || 'Default').toString().trim(),
                brand: (firstRow.BRAND || '').toString().trim() || null,
                description: "",
                cost_price: costPrice,
                prix_ht: prixHT,
                taxe: taxe,
                prix_ttc: prixTTC,
                stock: isSimpleProduct ? parseInt(firstRow.QUANTITY) || 0 : 0,
                marge: parseNumber(firstRow.MARGE, 'MARGE', false, 0),
                remise_max: parseNumber(firstRow.REMISE_MAX, 'REMISE_MAX', false),
                remise_valeur_max: parseNumber(firstRow.REMISE_VALEUR_MAX, 'REMISE_VALEUR_MAX', false),
                sellable: String(firstRow.SELLABLE || '').trim().toLowerCase() === 'true',
                has_variants: !isSimpleProduct,
                status: (firstRow.STATUS || 'in_stock').toString().trim(),
                image_path: (firstRow.IMAGE || '').toString().trim() || null,
                sub_category_name: (firstRow.SUB_CATEGORY || '').toString().trim() || null,
                is_deleted: false,
                date_expiration: firstRow.DATE_EXPIRE || null,
                rowNumber: firstRow.rowNumber,
                variants: []
              };

              if (!isSimpleProduct) {
                product.variants = productRows.map(row => {
                  const variantPriceImpact = parseNumber(row.IMPACTPRICE, 'IMPACTPRICE', true);
                  const variantPriceTTC = parseFloat((prixTTC + variantPriceImpact).toFixed(2));
                  return {
                    variant_name: (row.VARIANTNAME || '').toString().trim(),
                    variant_code: (row.VARIANTCODE || '').toString().trim() || null,
                    attributes: parseAttributes(row.VARIANTNAME),
                    price: variantPriceTTC,
                    stock: parseInt(row.QUANTITYVARIANT) || 0,
                    rowNumber: row.rowNumber
                  };
                });
              }

              productsToImport.push(product);
            } catch (err) {
              importErrors.push(`Erreur à la ligne ${firstRow.rowNumber}: ${err.message}`);
            }
          });

          if (importErrors.length > 0) {
            setImportErrors(importErrors);
            setIsImporting(false);
            setImportStatus('Erreurs détectées lors de l\'importation');
            setShowImportSummary(true);
            return;
          }

          setImportCount(productsToImport.length);
          setImportedVariantsCount(productsToImport.reduce((acc, p) => acc + (p.variants ? p.variants.length : 0), 0));

          simulateProgressThenImport(productsToImport);
        },
        error: (err) => {
          setIsImporting(false);
          setImportStatus('');
          setErrorMessage('Erreur lors du parsing du fichier: ' + err.message);
        }
      });
    } catch (e) {
      setIsImporting(false);
      setImportStatus('');
      setErrorMessage(e.message);
    }
  };
  // const handleFileImport = async (event) => {
  //   const file = event.target.files[0];
  //   if (!file) return;

  //   setIsImporting(true);
  //   setImportStatus('Analyse du fichier...');
  //   setErrorMessage('');
  //   setImportCount(0);
  //   setImportedVariantsCount(0);
  //   setProgress(0);
  //   setImportedProducts([]);
  //   setImportErrors([]);
  //   setShowImportSummary(false);

  //   try {
  //     const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
  //     const isCSV = file.name.endsWith('.csv');

  //     if (!isExcel && !isCSV) {
  //       throw new Error('Seuls les fichiers CSV (.csv) ou Excel (.xlsx, .xls) sont acceptés');
  //     }

  //     let csvText = '';
  //     let delimiter = ',';

  //     if (isExcel) {
  //       setImportStatus('Conversion du fichier Excel en CSV...');
  //       const data = await file.arrayBuffer();
  //       const workbook = XLSX.read(data);
  //       const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  //       csvText = XLSX.utils.sheet_to_csv(firstSheet);
  //     } else {
  //       csvText = await file.text();
  //       const firstLine = csvText.split('\n')[0];
  //       const tabCount = (firstLine.match(/\t/g) || []).length;
  //       const commaCount = (firstLine.match(/,/g) || []).length;
  //       delimiter = tabCount > commaCount ? '\t' : ',';
  //     }

  //     const lines = csvText.split('\n').filter(line => line.trim() !== '');
  //     const expectedColumns = 19;

  //     if (lines.length < 2) {
  //       throw new Error('Le fichier doit contenir au moins une ligne d\'en-tête et une ligne de données');
  //     }

  //     const headerColumns = lines[0].split(delimiter).length;
  //     if (headerColumns !== expectedColumns) {
  //       throw new Error(
  //         `L'en-tête doit contenir ${expectedColumns} colonnes. ${headerColumns} trouvées.\n` +
  //         `Séparateur détecté: ${delimiter === '\t' ? 'Tabulation' : 'Virgule'}\n` +
  //         `Assurez-vous que toutes les valeurs contenant des virgules ou tabulations sont entre guillemets ("value")`
  //       );
  //     }

  //     setImportStatus('Analyse des données...');

  //     Papa.parse(csvText, {
  //       header: true,
  //       skipEmptyLines: true,
  //       delimiter,
  //       quoteChar: '"',
  //       escapeChar: '"',
  //       dynamicTyping: true,
  //       transform: (value) => typeof value === 'string' ? value.trim() : value,
  //       transformHeader: (header) => header.trim(),
  //       complete: (results) => {
  //         console.log('Parsing complete', results);

  //         if (results.errors.length > 0) {
  //           const criticalErrors = results.errors.filter(
  //             e => e.type === 'FieldMismatch' || e.type === 'UndetectableDelimiter'
  //           );

  //           if (criticalErrors.length > 0) {
  //             const errorDetails = criticalErrors.map(e =>
  //               `Ligne ${e.row + 1}: ${e.message} (${e.expected || expectedColumns} colonnes attendues)`
  //             ).join('\n');

  //             throw new Error(
  //               `Problème de format détecté:\n${errorDetails}\n\n` +
  //               `Conseils:\n` +
  //               `1. Vérifiez que toutes les lignes ont le même nombre de colonnes\n` +
  //               `2. Encadrez les textes contenant des virgules/tabulations avec des guillemets\n` +
  //               `3. Utilisez le modèle fourni comme référence`
  //             );
  //           }
  //         }

  //         if (!results.data || results.data.length === 0) {
  //           throw new Error('Aucune donnée valide trouvée dans le fichier');
  //         }

  //         setImportStatus('Groupement des produits et variantes...');

  //         // Group rows by product (using REFERENCE or PRODUCTNAME as key)
  //         const productGroups = {};
  //         results.data.forEach((row, index) => {
  //           const productReference = (row.REFERENCE || '').toString().trim();
  //           const productName = (row.PRODUCTNAME || '').toString().trim();

  //           if (!productName) return; // Skip rows without product name

  //           const groupKey = productReference || productName;
  //           if (!productGroups[groupKey]) {
  //             productGroups[groupKey] = [];
  //           }
  //           productGroups[groupKey].push({ ...row, rowNumber: index + 2 });
  //         });

  //         // Process each product group
  //         const productsToImport = [];
  //         Object.values(productGroups).forEach(productRows => {
  //           if (productRows.length === 0) return;

  //           const firstRow = productRows[0];
  //           const isSimpleProduct = String(firstRow.SIMPLEPRODUCT || '').trim().toLowerCase() !== 'false';

  //           try {
  //             const parseNumber = (value, fieldName, required = false, defaultValue = 0) => {
  //               if (value === null || value === undefined || value === '') {
  //                 if (required) throw new Error(`Missing required field ${fieldName}`);
  //                 return defaultValue;
  //               }
  //               const cleanedValue = String(value).replace(',', '.').trim();
  //               const parsed = parseFloat(cleanedValue);
  //               if (isNaN(parsed)) throw new Error(`Invalid ${fieldName}: ${value}`);
  //               return parsed;
  //             };

  //             const prixHT = parseNumber(firstRow.SELLPRICETAXEXCLUDE, 'SELLPRICETAXEXCLUDE', true);
  //             const taxe = parseNumber(firstRow.VAT, 'VAT', true);
  //             const prixTTC = parseFloat((prixHT + (prixHT * taxe / 100)).toFixed(2));
  //             const costPrice = parseNumber(firstRow.COSTPRICE, 'COSTPRICE', false);

  //             const product = {
  //               code: (firstRow.REFERENCE || '').toString().trim() || null,
  //               designation: (firstRow.PRODUCTNAME || '').toString().trim(),
  //               category_name: (firstRow.CATEGORY || 'Default').toString().trim(),
  //               brand: (firstRow.BRAND || '').toString().trim() || null,
  //               description: "",
  //               cost_price: costPrice,
  //               prix_ht: prixHT,
  //               taxe: taxe,
  //               prix_ttc: prixTTC,
  //               stock: isSimpleProduct ? parseInt(firstRow.QUANTITY) || 0 : 0,
  //               marge: parseNumber(firstRow.MARGE, 'MARGE', false, 0),
  //               remise_max: parseNumber(firstRow.REMISE_MAX, 'REMISE_MAX', false),
  //               remise_valeur_max: parseNumber(firstRow.REMISE_VALEUR_MAX, 'REMISE_VALEUR_MAX', false),
  //               sellable: String(firstRow.SELLABLE || '').trim().toLowerCase() === 'true',
  //               has_variants: !isSimpleProduct,
  //               status: (firstRow.STATUS || 'in_stock').toString().trim(),
  //               image_path: (firstRow.IMAGE || '').toString().trim() || null,
  //               sub_category_name: (firstRow.SUB_CATEGORY || '').toString().trim() || null,
  //               is_deleted: false,
  //               date_expiration: firstRow.DATE_EXPIRE || null,
  //               rowNumber: firstRow.rowNumber,
  //               variants: []
  //             };

  //             if (!isSimpleProduct) {
  //               product.variants = productRows.map(row => {
  //                 const variantPriceImpact = parseNumber(row.IMPACTPRICE, 'IMPACTPRICE', true);
  //                 const variantPrice = prixHT + variantPriceImpact;

  //                 return {
  //                   code: (row.VARIANTCODE || '').toString().trim() || null,
  //                   combination_name: (row.VARIANTNAME || 'Default Variant').toString().trim(),
  //                   price: variantPrice,
  //                   price_impact: variantPriceImpact,
  //                   stock: parseInt(row.QUANTITYVARIANT) || 0,
  //                   default_variant: String(row.DEFAULTVARIANT || '').trim().toLowerCase() === 'true',
  //                   attributes: parseAttributes(row.VARIANTNAME) || {},
  //                   rowNumber: row.rowNumber
  //                 };
  //               });
  //             }

  //             productsToImport.push(product);
  //           } catch (error) {
  //             console.error(`Error processing product group: ${error.message}`);
  //             importErrors.push({
  //               rowNumber: firstRow.rowNumber,
  //               productCode: firstRow.REFERENCE,
  //               message: error.message
  //             });
  //           }
  //         });

  //         console.log('Products ready for import:', productsToImport);
  //         setImportStatus(`Prêt à importer ${productsToImport.length} produits...`);
  //         setImportedProducts(productsToImport);
  //         simulateProgressThenImport(productsToImport);
  //       },
  //       error: (err) => {
  //         throw new Error(`Erreur d'analyse: ${err.message}`);
  //       }
  //     });

  //   } catch (error) {
  //     console.error('Import error:', error);
  //     setErrorMessage(error.message);
  //     setImportStatus("Échec de l'importation");
  //     setProgress(0);
  //     showSnackbar(error.message, 'error');
  //     setIsImporting(false);
  //   }
  // };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const parseAttributes = (variantName) => {
 if (!variantName) return {};
    const attrs = {};
    variantName.split(';').forEach(part => {
      const [key, val] = part.split(':').map(s => s.trim());
      if (key && val) attrs[key.toLowerCase()] = val;
    });
    return attrs;
  };

  const simulateProgressThenImport = (productsToImport) => {
      let prog = 0;
    const interval = setInterval(() => {
      prog += 10;
      setProgress(prog);
      if (prog >= 100) {
        clearInterval(interval);
        sendProductsToBackend(productsToImport);
      }
    }, 100);
  };
  const sendProductsToBackend = async (products) => {
    setImportStatus('Import en cours...');
    try {
      const response = await fetch('http://localhost:8000/pos/product/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken
        },
        body: JSON.stringify({ products })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur serveur: ${errorText}`);
      }

      setImportStatus('Import terminé avec succès');
      setImportedProducts(products);
      setShowImportSummary(true);
    } catch (err) {
      setImportStatus('Erreur lors de l\'importation');
      setErrorMessage(err.message);
    } finally {
      setIsImporting(false);
      setProgress(0);
    }
  };
  // const sendProductsToBackend = async (productsToImport) => {
  //   setImportStatus('Import en cours...');
  //   setImportCount(0);
  //   setImportedVariantsCount(0);
  //   const errors = [];
  //   const successfulImports = [];

  //   try {
  //     for (let i = 0; i < productsToImport.length; i++) {
  //       const product = productsToImport[i];

  //       try {
  //         // Skip if no reference or product name
  //         if (!product.code && !product.designation) {
  //           continue;
  //         }

  //         const productPayload = {
  //           code: product.code,
  //           designation: product.designation,
  //           category_name: product.category_name,
  //           brand: product.brand,
  //           description: product.description,
  //           cost_price: Number(product.cost_price) || 0,
  //           prix_ht: Number(product.prix_ht),
  //           taxe: Number(product.taxe),
  //           prix_ttc: Number(product.prix_ttc).toFixed(2),
  //           stock: Number(product.stock) || 0,
  //           marge: Number(product.marge) || 0,
  //           remise_max: Number(product.remise_max) || 0,
  //           remise_valeur_max: Number(product.remise_valeur_max) || 0,
  //           sellable: product.sellable,
  //           has_variants: product.has_variants,
  //           status: product.status || 'in_stock',
  //           image_path: product.image_path || null,
  //           sub_category_name: product.sub_category_name || null,
  //           is_deleted: product.is_deleted || false,
  //           date_expiration: product.date_expiration || null,
  //           variants: product.variants || []
  //         };

  //         console.log(`Sending product payload for ${product.code}:`, JSON.stringify(productPayload, null, 2));

  //         // First create the product
  //         const productRes = await fetch('http://127.0.0.1:8000/pos/product/add', {
  //           method: 'POST',
  //           headers: {
  //             'Content-Type': 'application/json',
  //             'X-CSRFToken': csrfToken,
  //           },
  //           credentials: 'include',
  //           body: JSON.stringify(productPayload),
  //         });

  //         if (!productRes.ok) {
  //           const errText = await productRes.text();
  //           throw new Error(`Erreur lors de la création du produit ${product.code}: ${errText}`);
  //         }

  //         const productCreated = await productRes.json();
  //         successfulImports.push({ ...product, backendId: productCreated.id || productCreated._id });
  //         setImportCount(prev => prev + 1);

  //         // Then create variants if this product has them
  //         if (product.has_variants && product.variants.length > 0) {
  //           let variantsCreated = 0;

  //           for (const variant of product.variants) {
  //             try {
  //               const variantPayload = {
  //                 product_id: productCreated.id || productCreated._id,
  //                 combination_name: variant.combination_name,
  //                 price_impact: variant.price_impact,
  //                 stock: variant.stock,
  //                 default_variant: variant.default_variant,
  //                 attributes: variant.attributes,
  //                 price: variant.price,
  //               };

  //               const variantRes = await fetch(`http://127.0.0.1:8000/pos/product/${productCreated.id}/variant`, {
  //                 method: 'POST',
  //                 headers: {
  //                   'Content-Type': 'application/json',
  //                   'X-CSRFToken': csrfToken,
  //                 },
  //                 credentials: 'include',
  //                 body: JSON.stringify(variantPayload),
  //               });

  //               if (!variantRes.ok) {
  //                 const errText = await variantRes.text();
  //                 throw new Error(`Erreur lors de la création d'une variante pour ${product.code}: ${errText}`);
  //               }

  //               variantsCreated++;
  //             } catch (variantError) {
  //               errors.push({
  //                 rowNumber: variant.rowNumber,
  //                 productCode: product.code,
  //                 message: `Variant error: ${variantError.message}`
  //               });
  //             }
  //           }

  //           setImportedVariantsCount(prev => prev + variantsCreated);
  //         }
  //       } catch (error) {
  //         errors.push({
  //           rowNumber: product.rowNumber,
  //           productCode: product.code,
  //           message: error.message
  //         });
  //         console.error(`Error importing row ${product.rowNumber}:`, error);
  //       }
  //     }

  //     setImportStatus('Import terminé avec succès!');
  //     setImportErrors(errors);
  //     setImportedProducts(successfulImports);
  //     setShowImportSummary(true);

  //     if (errors.length > 0) {
  //       showSnackbar(`Import completed with ${errors.length} errors`, 'warning');
  //     } else {
  //       showSnackbar('Import terminé avec succès!', 'success');
  //     }

  //     await fetchProducts();
  //   } catch (error) {
  //     console.error('Import error:', error);
  //     setErrorMessage(error.message);
  //     setImportStatus("Échec de l'importation");
  //     showSnackbar(error.message, 'error');
  //   } finally {
  //     setIsImporting(false);
  //     setProgress(0);
  //   }
  // };

  const handleViewVariants = (product) => {
    setCurrentProduct(product);
    setOpenVariantsDialog(true);
  };

  const handleExportProducts = () => {
    try {
      const headers = [
        'Reference', 'Designation', 'Category', 'Brand',
        'Description', 'Cost Price', 'Price HT', 'VAT',
        'Price TTC', 'Sellable', 'Has Variants', 'Stock'
      ];

      const csvData = [
        headers,
        ...products.map(p => [
          p.code,
          p.designation,
          p.category_name,
          p.brand,
          p.description,
          p.prix_ht,
          p.prix_ht,
          p.taxe,
          p.prix_ttc,
          p.sellable ? 'Yes' : 'No',
          p.has_variants ? 'Yes' : 'No',
          p.stock
        ])
      ];

      const csvContent = csvData.map(row =>
        row.map(field => `"${field?.toString().replace(/"/g, '""') || ''}"`).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `products_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSnackbar('Products exported successfully', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showSnackbar(`Failed to export products: ${error.message}`, 'error');
    }
  };

  const handleCloseImportSummary = () => {
    setShowImportSummary(false);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <Sidebar />
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Header />
        <Card sx={{ p: 4, maxWidth: 1200, margin: 'auto', mt: 4 }}>
          <Typography variant="h5" mb={2}>Gestion des produits</Typography>

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 100 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <label htmlFor="file-input">
                    <VisuallyHiddenInput
                      id="file-input"
                      type="file"
                      accept=".csv, .xlsx, .xls"
                      onChange={handleFileImport}
                      disabled={isImporting}
                    />
                    <Button
                      variant="contained"
                      component="span"
                      startIcon={<CloudUploadIcon />}
                      disabled={isImporting}
                      sx={{ mr: 2 }}
                    >
                      {isImporting ? 'Import en cours...' : 'Importer des produits'}
                    </Button>
                  </label>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleExportProducts}
                    sx={{ mr: 2 }}
                  >
                    Exporter
                  </Button>
                  <Tooltip title="Refresh products">
                    <IconButton onClick={fetchProducts}>
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                </Box>

                <TextField
                  variant="outlined"
                  size="small"
                  placeholder="Rechercher des produits..."
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Box>

              {isImporting && (
                <Box sx={{ width: '100%', mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    {importStatus}
                  </Typography>
                  <LinearProgress variant="determinate" value={progress} sx={{ height: 8, mb: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">
                      Produits importés: <strong>{importCount}</strong>
                    </Typography>
                    <Typography variant="body2">
                      Variantes importées: <strong>{importedVariantsCount}</strong>
                    </Typography>
                    <Typography variant="body2">
                      Progression: <strong>{progress}%</strong>
                    </Typography>
                  </Box>
                </Box>
              )}

              <Typography variant="h6" mb={2}>
                Liste des produits ({filteredProducts.length})
                {searchTerm && (
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    (Filtrés pour "{searchTerm}")
                  </Typography>
                )}
              </Typography>

              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Référence</TableCell>
                      <TableCell>Désignation</TableCell>
                      <TableCell>Catégorie</TableCell>
                      <TableCell>Marque</TableCell>
                      <TableCell>Prix HT</TableCell>
                      <TableCell>Stock</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((product) => (
                        <TableRow key={product._id || product.id}>
                          <TableCell>{product.code || '-'}</TableCell>
                          <TableCell>{product.designation || '-'}</TableCell>
                          <TableCell>
                            <Chip
                              label={product.category_name || '-'}
                              size="small"
                              sx={{
                                backgroundColor: 'primary.light',
                                color: 'primary.contrastText'
                              }}
                            />
                          </TableCell>
                          <TableCell>{product.brand || '-'}</TableCell>
                          <TableCell>{product.prix_ttc?.toFixed(2) ?? '-'} DT</TableCell>
                          <TableCell>
                            {product.has_variants ? (
                              <Button
                                size="small"
                                onClick={() => handleViewVariants(product)}
                                startIcon={<VisibilityIcon />}
                              >
                                Variantes ({product.variants?.length || 0})
                              </Button>
                            ) : (
                              product.stock ?? 0
                            )}
                          </TableCell>
                          <TableCell>
                            <IconButton size="small">
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          {searchTerm ?
                            'Aucun produit ne correspond à votre recherche' :
                            'Aucun produit trouvé'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {errorMessage && (
            <Typography color="error" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>
              {errorMessage}
            </Typography>
          )}
        </Card>

        {/* Variants Dialog */}
        <Dialog
          open={openVariantsDialog}
          onClose={() => setOpenVariantsDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Variantes pour {currentProduct?.designation || 'Produit'}
            <IconButton
              aria-label="close"
              onClick={() => setOpenVariantsDialog(false)}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
                color: (theme) => theme.palette.grey[500],
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Combinaison</TableCell>
                    <TableCell>Prix</TableCell>
                    <TableCell>Stock</TableCell>
                    <TableCell>Par défaut</TableCell>
                    <TableCell>Attributs</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentProduct?.variants?.length > 0 ? (
                    currentProduct.variants.map((variant) => (
                      <TableRow key={variant.id}>
                        <TableCell>{variant.combination_name || '-'}</TableCell>
                        <TableCell>{variant.price?.toFixed(2)} DT</TableCell>
                        <TableCell>{variant.stock}</TableCell>
                        <TableCell>
                          {variant.default_variant ?
                            <Chip label="Oui" color="success" size="small" /> :
                            <Chip label="Non" size="small" />
                          }
                        </TableCell>
                        <TableCell>
                          {variant.attributes && Object.keys(variant.attributes).length > 0 ? (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              {Object.entries(variant.attributes).map(([key, value]) => (
                                <Chip
                                  key={key}
                                  label={`${key}: ${value}`}
                                  size="small"
                                />
                              ))}
                            </Box>
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        Aucune variante trouvée
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenVariantsDialog(false)}>Fermer</Button>
          </DialogActions>
        </Dialog>

        {/* Import Summary Dialog */}
        <Dialog
          open={showImportSummary}
          onClose={handleCloseImportSummary}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Résumé de l'importation
            <IconButton
              aria-label="close"
              onClick={handleCloseImportSummary}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
                color: (theme) => theme.palette.grey[500],
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Statistiques d'importation
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, flex: 1 }}>
                  <Typography variant="body2">Produits importés</Typography>
                  <Typography variant="h4">{importCount}</Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1, flex: 1 }}>
                  <Typography variant="body2">Variantes importées</Typography>
                  <Typography variant="h4">{importedVariantsCount}</Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: importErrors.length > 0 ? 'error.light' : 'grey.200', borderRadius: 1, flex: 1 }}>
                  <Typography variant="body2">Erreurs</Typography>
                  <Typography variant="h4">{importErrors.length}</Typography>
                </Box>
              </Box>
            </Box>

            {importErrors.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Erreurs d'importation
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Ligne</TableCell>
                        <TableCell>Référence</TableCell>
                        <TableCell>Message d'erreur</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {importErrors.map((error, index) => (
                        <TableRow key={index}>
                          <TableCell>{error.rowNumber}</TableCell>
                          <TableCell>{error.productCode || '-'}</TableCell>
                          <TableCell sx={{ color: 'error.main' }}>{error.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseImportSummary}>Fermer</Button>
          </DialogActions>
        </Dialog>

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