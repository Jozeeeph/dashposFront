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
import FileDownload from 'js-file-download';

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [editedQuantities, setEditedQuantities] = useState({});
  const [editedPercentages, setEditedPercentages] = useState({});
  const [expandedWarehouseId, setExpandedWarehouseId] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

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

        const productsArray = productsResponse.products || productsResponse;
        await ensureProductsInWarehouses(productsArray, warehousesResponse);

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
    const data = await res.json();
    return data;
  };

  const ensureProductsInWarehouses = async (products, warehouses) => {
    const promises = [];
    for (const warehouse of warehouses) {
      const stockByProductId = {};
      warehouse.stock?.forEach(item => {
        stockByProductId[item.product_id] = item;
      });
      for (const product of products) {
        if (!stockByProductId[product.id]) {
          promises.push(
            fetch(`http://127.0.0.1:8000/pos/warehouse/${warehouse.id}/add-stock/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken(),
              },
              credentials: 'include',
              body: JSON.stringify({ product_id: product.id, quantity: 0 }),
            })
          );
        }
      }
    }
    await Promise.all(promises);
    await fetchWarehouses();
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
      setEditedQuantities(prev => { const newQ = { ...prev }; delete newQ[key]; return newQ; });
    } catch (error) {
      setError(`Error updating quantity: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const distributeStock = async () => {
    const productsToDistribute = allProducts.products || allProducts;

    if (!productsToDistribute || !productsToDistribute.length) {
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
            body: JSON.stringify({ product_id: product.id, quantity }),
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
            CATEGORY: product.category?.name || '',
            BRAND: product.brand || '',
            DESCRIPTION: product.description || '',
            COSTPRICE: product.prix_ht || 0,
            SELLPRICETAXEXCLUDE: product.prix_ht || 0,
            VAT: product.taxe || 0,
            SELLPRICETAXINCLUDE: product.prix_ttc * (1 + (product.taxe || 0) / 100),
            QUANTITY: variant.stock || 0,
            SELLABLE: product.sellable ? 'Oui' : 'Non',
            SIMPLEPRODUCT: 'Non',
            VARIANTNAME: variant.name || '',
            DEFAULTVARIANT: variant.is_default ? 'Oui' : 'Non',
            VARIANTIMAGE: '',
            IMPACTPRICE: variant.impact_price || '',
            QUANTITYVARIANT: variant.stock || '',
          }));
        }

        return [{
          ACTION: '',
          IMAGE: '',
          PRODUCTNAME: product.designation || '',
          REFERENCE: product.code || '',
          CATEGORY: product.category?.name || '',
          BRAND: product.brand || '',
          DESCRIPTION: product.description || '',
          COSTPRICE: product.prix_ht || 0,
          SELLPRICETAXEXCLUDE: product.prix_ht || 0,
          VAT: product.taxe || 0,
          SELLPRICETAXINCLUDE: product.prix_ttc * (1 + (product.taxe || 0) / 100),
          QUANTITY: stockItem.quantity || 0,
          SELLABLE: product.sellable ? 'Oui' : 'Non',
          SIMPLEPRODUCT: 'Oui',
          VARIANTNAME: '',
          DEFAULTVARIANT: '',
          VARIANTIMAGE: '',
          IMPACTPRICE: '',
          QUANTITYVARIANT: '',
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
      <Box sx={{ flex: 1 }}>
        <Header />
        <Box component="main" sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>
            Warehouse Management
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Button
                  variant="contained"
                  onClick={distributeStock}
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Distributing...' : 'Distribute Stock'}
                </Button>
              </Box>

              {warehouses.map(warehouse => (
                <Paper key={warehouse.id} sx={{ mt: 2, p: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">{warehouse.name}</Typography>
                    <Box display="flex" alignItems="center">
                      <TextField
                        label="Percentage"
                        type="number"
                        value={editedPercentages[warehouse.id] ?? warehouse.percentage ?? 0}
                        onChange={(e) => handlePercentageChange(warehouse.id, e.target.value)}
                        sx={{ width: 100, mr: 1 }}
                        inputProps={{ min: 0, max: 100 }}
                      />
                      <Button
                        onClick={() => updatePercentage(warehouse.id)}
                        disabled={isUpdating}
                        sx={{ mr: 1 }}
                      >
                        Update
                      </Button>
                      <Button
                        variant="contained"
                        color="secondary"
                        onClick={() => exportWarehouseToExcel(warehouse)}
                        disabled={isUpdating}
                        sx={{ mr: 1 }}
                      >
                        Export Stock
                      </Button>
                      <IconButton onClick={() => toggleWarehouse(warehouse.id)}>
                        {expandedWarehouseId === warehouse.id ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </Box>
                  </Box>

                  <Collapse in={expandedWarehouseId === warehouse.id}>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Product Name</TableCell>
                            <TableCell>Quantity</TableCell>
                            <TableCell>New Quantity</TableCell>
                            <TableCell>Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {warehouse.stock?.map(stockItem => {
                            const product = (allProducts.products || allProducts).find(p => p.id === stockItem.product_id);
                            if (!product) return null;
                            const key = `${warehouse.id}_${product.id}`;
                            return (
                              <TableRow key={key}>
                                <TableCell>{product.designation}</TableCell>
                                <TableCell>{stockItem.quantity}</TableCell>
                                <TableCell>
                                  <TextField
                                    type="number"
                                    value={editedQuantities[key] ?? ''}
                                    onChange={(e) => handleQuantityChange(warehouse.id, product.id, e.target.value)}
                                    inputProps={{ min: 0 }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    onClick={() => updateQuantity(warehouse.id, product.id)}
                                    disabled={isUpdating || editedQuantities[key] === undefined}
                                  >
                                    Update
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Collapse>
                </Paper>
              ))}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}