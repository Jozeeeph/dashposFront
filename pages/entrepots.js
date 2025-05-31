import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import * as XLSX from 'xlsx';

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [expandedWarehouseId, setExpandedWarehouseId] = useState(null);
  const [editedQuantities, setEditedQuantities] = useState({});
  const [editedPercentages, setEditedPercentages] = useState({});

  useEffect(() => {
    fetchWarehouses();
    fetchProducts();
  }, []);

  const fetchWarehouses = () => {
    fetch('http://localhost:8000/pos/warehouse/')
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP error! status: ${res.status}, body: ${text}`);
        }
        return res.json();
      })
      .then(data => {
        setWarehouses(data);
        const percentages = {};
        data.forEach(w => {
          percentages[w.id] = w.percentage ?? 0;
        });
        setEditedPercentages(percentages);
      })
      .catch(error => console.error("Fetch error:", error));
  };

  const fetchProducts = () => {
    fetch('http://127.0.0.1:8000/pos/product/get')
      .then(res => res.json())
      .then(data => setAllProducts(data))
      .catch(err => console.error("Product fetch failed:", err));
  };

  const toggleWarehouse = (id) => {
    setExpandedWarehouseId(prevId => (prevId === id ? null : id));
  };

  const handleQuantityChange = (warehouseId, productId, value) => {
    setEditedQuantities(prev => ({
      ...prev,
      [`${warehouseId}_${productId}`]: value
    }));
  };

  const handlePercentageChange = (warehouseId, value) => {
    if (isNaN(value) || value < 0 || value > 100) return;
    setEditedPercentages(prev => ({
      ...prev,
      [warehouseId]: Number(value)
    }));
  };
  const exportToExcel = () => {
    warehouses.forEach(warehouse => {
      const data = [];

      warehouse.stock.forEach(stockItem => {
        const product = allProducts.find(p => p.id === stockItem.product_id);
        if (!product) return;

        const row = {
          ACTION: "CREATE",
          IMAGE: "simple_product.jpg",
          PRODUCTNAME: product.designation,
          REFERENCE: product.code || "",
          CATEGORY: product.category_name || "",
          BRAND: product.brand || "",
          DESCRIPTION: product.description || "",
          COSTPRICE: product.prix_ht?.toString().replace('.', ',') || "",
          SELLPRICETAXEXCLUDE: product.prix_ht?.toString().replace('.', ',') || "",
          VAT: product.taxe?.toString().replace('.', ',') || "",
          SELLPRICETAXINCLUDE: product.prix_ttc?.toString().replace('.', ',') || "",
          QUANTITY: stockItem.quantity,
          SELLABLE: product.sellable ? "TRUE" : "FALSE",
          SIMPLEPRODUCT: product.has_variants ? "FALSE" : "TRUE",
          VARIANTNAME: "",
          DEFAULTVARIANT: "",
          VARIANTIMAGE: "",
          IMPACTPRICE: "",
          QUANTITYVARIANT: ""
        };

        data.push(row);
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Produits");

      XLSX.writeFile(workbook, `produits_entrepot_${warehouse.name}.xlsx`);
    });
  };

  const updatePercentage = (warehouseId) => {
    const percentage = editedPercentages[warehouseId];

    fetch(`http://localhost:8000/pos/warehouse/${warehouseId}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percentage }),
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(() => fetchWarehouses())
      .catch(err => console.error('Failed to update percentage:', err));
  };

  const updateQuantity = (warehouseId, productId, exists = true) => {
    const key = `${warehouseId}_${productId}`;
    const quantity = Number(editedQuantities[key]);

    if (isNaN(quantity)) return alert("Quantité invalide");

    const url = exists
      ? `http://localhost:8000/pos/stockitem/${productId}/`
      : `http://localhost:8000/pos/stockitem/`;

    const method = exists ? 'PATCH' : 'POST';

    const body = exists
      ? { warehouse_id: warehouseId, quantity }
      : { warehouse: warehouseId, product: productId, quantity };

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(() => fetchWarehouses())
      .then(() => setEditedQuantities({}))
      .catch(err => console.error('Update failed:', err));
  };

  const distributeStock = async () => {
    for (const product of allProducts) {
      if (!product.stock || product.stock <= 0) continue;

      for (const warehouse of warehouses) {
        const quantity = Math.round(product.stock * (warehouse.percentage / 100));

        const url = `http://127.0.0.1:8000/pos/warehouse/${warehouse.id}/add-stock/`;

        const body = {
          product_id: product.id,
          quantity: quantity
        };

        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

          if (!res.ok) {
            const errorText = await res.text();
            console.error(`❌ Failed to add stock for product ${product.id} to warehouse ${warehouse.id}:`, errorText);
          }
        } catch (error) {
          console.error(`❌ Error adding stock for product ${product.id} to warehouse ${warehouse.id}:`, error);
        }
      }
    }

    await fetchWarehouses(); // Refresh warehouse stock
    alert('✅ Stock distribué avec succès.');
  };


  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        <Header />
        <main className="main" style={{ padding: '1rem' }}>
          <h2>Liste des Entrepôts</h2>
          <button
            onClick={distributeStock}
            style={{
              marginBottom: '1rem',
              padding: '8px 14px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: '#28a745',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            🚚 Répartir le stock automatiquement
          </button>
          <ul>
            {warehouses.map(warehouse => {
              const stockByProductId = {};
              warehouse.stock.forEach(item => {
                stockByProductId[item.product_id] = item;
              });

              return (
                <li key={warehouse.id} style={{ marginBottom: '1rem' }}>
                  <div
                    onClick={() => toggleWarehouse(warehouse.id)}
                    style={{ cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}
                  >
                    🏬 {warehouse.name}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editedPercentages[warehouse.id] ?? 0}
                      onClick={e => e.stopPropagation()}
                      onChange={(e) => handlePercentageChange(warehouse.id, e.target.value)}
                      style={{
                        width: '60px',
                        marginLeft: '10px',
                        padding: '2px 6px',
                        fontSize: '14px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                      }}
                    />
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        updatePercentage(warehouse.id);
                      }}
                      style={{
                        marginLeft: '6px',
                        padding: '4px 10px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                      onMouseOver={e => (e.target.style.backgroundColor = '#0056b3')}
                      onMouseOut={e => (e.target.style.backgroundColor = '#007bff')}
                    >
                      Sauvegarder
                    </button>
                    <button
                      onClick={exportToExcel}
                      style={{
                        marginBottom: '1rem',
                        marginLeft: '1rem',
                        padding: '8px 14px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '16px'
                      }}
                    >
                      📁 Exporter produits entrepôts
                    </button>
                    <span style={{ marginLeft: '10px', color: '#666', fontSize: '14px' }}>
                      {warehouse.percentage?.toFixed(2) ?? 0}%
                    </span>
                  </div>

                  {expandedWarehouseId === warehouse.id && (
                    <ul style={{ paddingLeft: '1rem', marginTop: '0.5rem' }}>
                      {allProducts.length > 0 ? (
                        allProducts.map(product => {
                          const existingItem = stockByProductId[product.id];
                          const key = `${warehouse.id}_${product.id}`;
                          const currentQty = editedQuantities[key] ?? (existingItem ? existingItem.quantity : '');

                          return (
                            <li key={product.id} style={{ marginBottom: '0.5rem' }}>
                              📦 {product.designation} —
                              <input
                                type="number"
                                value={currentQty}
                                placeholder="Quantité"
                                onChange={(e) => handleQuantityChange(warehouse.id, product.id, e.target.value)}
                                style={{
                                  width: '70px',
                                  marginLeft: '0.5rem',
                                  padding: '4px 8px',
                                  border: '1px solid #ccc',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                }}
                              />
                              <button
                                onClick={() => updateQuantity(warehouse.id, product.id, !!existingItem)}
                                style={{
                                  marginLeft: '0.5rem',
                                  padding: '4px 10px',
                                  border: 'none',
                                  borderRadius: '6px',
                                  backgroundColor: existingItem ? '#007bff' : '#28a745',
                                  color: 'white',
                                  fontSize: '14px',
                                  cursor: 'pointer',
                                }}
                                onMouseOver={(e) => (e.target.style.backgroundColor = existingItem ? '#0056b3' : '#218838')}
                                onMouseOut={(e) => (e.target.style.backgroundColor = existingItem ? '#007bff' : '#28a745')}
                              >
                                {existingItem ? "Mettre à jour" : "Ajouter"}
                              </button>


                            </li>
                          );
                        })
                      ) : (
                        <li>Aucun produit disponible</li>
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </main>
      </div>
    </div>
  );
}
