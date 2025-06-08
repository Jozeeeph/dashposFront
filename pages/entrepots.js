import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Collapse,
  IconButton,
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import * as XLSX from 'xlsx';

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [editedQuantities, setEditedQuantities] = useState({});
  const [editedPercentages, setEditedPercentages] = useState({});
  const [expandedWarehouseId, setExpandedWarehouseId] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState('');

  const getCsrfToken = () => {
    return document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1] || '';
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [productsResponse, warehousesResponse] = await Promise.all([
          fetchProducts(),
          fetchWarehouses(),
        ]);

        const updatedProducts = await fetchProducts();
        setAllProducts(updatedProducts.products || updatedProducts);
      } catch (error) {
        setError(`Error loading data: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);


  const createWarehouse = async () => {
    if (!newWarehouseName.trim()) return setError("Le nom de l'entrepôt est requis.");
    setIsUpdating(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/pos/warehouse/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify({ name: newWarehouseName }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchWarehouses();
      setNewWarehouseName('');
      setError(null);
    } catch (error) {
      setError(`Erreur lors de l'ajout : ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const fetchWarehouses = async () => {
    const res = await fetch('http://127.0.0.1:8000/pos/warehouse/', {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setWarehouses(data);
    const percentages = {};
    data.forEach(w => { percentages[w.id] = w.percentage ?? 0; });
    setEditedPercentages(percentages);
    return data;
  };

  const fetchProducts = async () => {
    const res = await fetch('http://127.0.0.1:8000/pos/product/get', {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const toggleWarehouse = (id) => {
    setExpandedWarehouseId(prevId => (prevId === id ? null : id));
  };

  const handleQuantityChange = (warehouseId, productId, value) => {
    const parsedValue = value === '' ? '' : Number(value);
    if (value !== '' && (isNaN(parsedValue) || parsedValue < 0)) return;
    setEditedQuantities(prev => ({ ...prev, [`${warehouseId}_${productId}`]: value }));
  };

  const handlePercentageChange = (warehouseId, value) => {
    const parsedValue = Number(value);
    if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 100) return;
    setEditedPercentages(prev => ({ ...prev, [warehouseId]: parsedValue }));
  };

  const updatePercentage = async (warehouseId) => {
    const percentage = editedPercentages[warehouseId];
    if (isNaN(percentage)) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`http://localhost:8000/pos/warehouse/${warehouseId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify({ percentage }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchWarehouses();
    } catch (error) {
      setError(`Error updating percentage: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteWarehouse = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet entrepôt ?")) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`http://localhost:8000/pos/warehouse/deletewarehouse/${id}/`, {
        method: 'DELETE',
        headers: {
          'X-CSRFToken': getCsrfToken(),
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchWarehouses();
      setError(null);
    } catch (error) {
      setError(`Erreur lors de la suppression : ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const updateQuantity = async (warehouseId, productId, exists = true) => {
    const key = `${warehouseId}_${productId}`;
    const quantity = Number(editedQuantities[key]);
    if (isNaN(quantity) || quantity < 0) return setError('Invalid quantity');
    setIsUpdating(true);
    try {
      const url = exists
        ? `http://localhost:8000/pos/stockitem/${productId}/`
        : `http://127.0.0.1:8000/pos/warehouse/${warehouseId}/add-stock/`;
      const method = exists ? 'PATCH' : 'POST';
      const body = exists ? { warehouse_id: warehouseId, quantity } : { product_id: productId, quantity };
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchWarehouses();
      setEditedQuantities(prev => {
        const newQ = { ...prev };
        delete newQ[key];
        return newQ;
      });
    } catch (error) {
      setError(`Error updating quantity: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const distributeStock = async () => {
    const productsToDistribute = allProducts.products || allProducts;
    if (!productsToDistribute?.length) {
      return setError('No products available for distribution');
    }
    setIsUpdating(true);
    try {
      for (const product of productsToDistribute) {
        if (!product.stock || product.stock <= 0) continue;
        for (const warehouse of warehouses) {
          const quantity = Math.round(product.stock * (warehouse.percentage / 100));
          await fetch(`http://127.0.0.1:8000/pos/warehouse/${warehouse.id}/add-stock/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'include',
            body: JSON.stringify({ product_id: product.id, quantity, variant_id: product.variants?.[0]?.id || null }),
          });
        }
      }
      await fetchWarehouses();
      setError(null);
    } catch (error) {
      setError(`Error distributing stock: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const exportWarehouseToExcel = (warehouse) => {
    const productsToExport = allProducts.products || allProducts;
    if (!productsToExport || !productsToExport.length) {
      return setError('No products available for export');
    }
    try {
      const data = warehouse.stock?.flatMap(stockItem => {
        const product = productsToExport.find(p => p.id === stockItem.product_id);
        if (!product) return [];

        if (product.has_variants && product.variants?.length) {
          return product.variants.map(variant => ({
            ACTION: '',
            IMAGE: '',
            PRODUCTNAME: product.designation || '',
            REFERENCE: product.code || '',
            CATEGORY: product.category_name,
            BRAND: product.brand || '',
            DESCRIPTION: product.description || '',
            COSTPRICE: product.prix_ht || 0,
            SELLPRICETAXEXCLUDE: product.prix_ht || 0,
            VAT: product.taxe || 0,
            SELLPRICETAXINCLUDE: product.prix_ttc || 0,
            QUANTITY: Math.round(variant.stock * (warehouse.percentage / 100)) || 0,
            SELLABLE: product.sellable || false,
            SIMPLEPRODUCT: !product.has_variants,
            VARIANTNAME: variant.combination_name || '',
            DEFAULTVARIANT: variant.default_variant || false,
            VARIANTIMAGE: variant.image || '',
            IMPACTPRICE: variant.price_impact || 0,
            QUANTITYVARIANT: Math.round(variant.stock * (warehouse.percentage / 100)) || 0,
          }));
        }

        return [{
          ACTION: '',
            IMAGE: '',
            PRODUCTNAME: product.designation || '',
            REFERENCE: product.code || '',
            CATEGORY: product.category_name,
            BRAND: product.brand || '',
            DESCRIPTION: product.description || '',
            COSTPRICE: product.prix_ht || 0,
            SELLPRICETAXEXCLUDE: product.prix_ht || 0,
            VAT: product.taxe || 0,
            SELLPRICETAXINCLUDE: product.prix_ttc || 0,
            QUANTITY: Math.round(product.stock * (warehouse.percentage / 100)) || 0,
            SELLABLE: product.sellable || false,
            SIMPLEPRODUCT: !product.has_variants,
        }];
      }) || [];

      if (!data.length) {
        return setError(`No stock data available to export for ${warehouse.name}`);
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `${warehouse.name}_Stock`);
      XLSX.writeFile(workbook, `${warehouse.name}_Stock.xlsx`);
    } catch (error) {
      setError(`Error exporting Excel file for ${warehouse.name}: ${error.message}`);
    }
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <Sidebar />
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Header />
        <Typography variant="h4" gutterBottom>Entrepôts</Typography>

        <Button
          variant="contained"
          color="primary"
          onClick={distributeStock}
          disabled={isUpdating || isLoading}
          sx={{ mb: 2 }}
        >
          Distribuer le stock
        </Button>
        <Box display="flex" gap={2} mb={3}>
          <TextField
            label="Nouveau entrepôt"
            value={newWarehouseName}
            onChange={(e) => setNewWarehouseName(e.target.value)}
          />
          <Button
            variant="contained"
            color="success"
            onClick={createWarehouse}
            disabled={isUpdating}
          >
            Ajouter
          </Button>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {isLoading ? (
          <CircularProgress />
        ) : (
          warehouses.map((warehouse) => (
            <Box key={warehouse.id} mb={4}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="h6">{warehouse.name}</Typography>
                <IconButton onClick={() => toggleWarehouse(warehouse.id)}>
                  {expandedWarehouseId === warehouse.id ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>
              <Collapse in={expandedWarehouseId === warehouse.id}>
                <Box mb={2}>
                  <TextField
                    label="Pourcentage"
                    value={editedPercentages[warehouse.id]}
                    onChange={(e) => handlePercentageChange(warehouse.id, e.target.value)}
                    sx={{ mt: 1, mr: 1, width: '120px' }}
                  />
                  <Button onClick={() => updatePercentage(warehouse.id)}>Enregistrer %</Button>
                  <Button
                    onClick={() => exportWarehouseToExcel(warehouse)}
                    sx={{ ml: 2 }}
                  >
                    Exporter vers Excel
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => deleteWarehouse(warehouse.id)}
                    sx={{ ml: 2 }}
                  >
                    Supprimer
                  </Button>
                </Box>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Produit</TableCell>
                        <TableCell>Quantité</TableCell>
                        <TableCell>Nouvelle Quantité</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {warehouse.stock?.flatMap((item) => {
                        const product = allProducts.find(p => p.id === item.product_id);
                        if (!product) {
                          // Produit non trouvé, afficher une ligne simple
                          const key = `${warehouse.id}_${item.product_id}_unknown`;
                          return (
                            <TableRow key={key}>
                              <TableCell>Produit inconnu</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell></TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          );
                        }

                        if (product.has_variants && product.variants?.length) {
                          // Produit avec variantes : une ligne par variante
                          return product.variants.map((variant) => {
                            const variantStock = Math.round(variant.stock * (warehouse.percentage / 100));
                            const key = `${warehouse.id}_${product.id}_${variant.id}`;
                            const quantityKey = `${warehouse.id}_${product.id}_${variant.id}`;

                            return (
                              <TableRow key={key}>
                                <TableCell>{`${product.designation} - ${variant.combination_name}`}</TableCell>
                                <TableCell>{variantStock}</TableCell>
                                <TableCell>
                                  <TextField
                                    value={editedQuantities[quantityKey] ?? ''}
                                    onChange={(e) =>
                                      handleQuantityChange(warehouse.id, product.id, e.target.value, variant.id)
                                    }
                                    size="small"
                                    type="number"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="contained"
                                    onClick={() => updateQuantity(warehouse.id, product.id, variant.id)}
                                  >
                                    Mettre à jour
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          });
                        }

                        // Produit sans variantes : afficher une ligne simple
                        const key = `${warehouse.id}_${product.id}_noVariant`;
                        return (
                          <TableRow key={key}>
                            <TableCell>{product.designation}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>
                              <TextField
                                value={editedQuantities[key] ?? ''}
                                onChange={(e) =>
                                  handleQuantityChange(warehouse.id, product.id, e.target.value, null)
                                }
                                size="small"
                                type="number"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="contained"
                                onClick={() => updateQuantity(warehouse.id, product.id, null)}
                              >
                                Mettre à jour
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>

                  </Table>
                </TableContainer>
              </Collapse>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
