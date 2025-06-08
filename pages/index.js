import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function Home() {
  const [stats, setStats] = useState([]);

  useEffect(() => {
    fetch('http://localhost:8000/pos/warehouse/stats/') // Replace with your actual backend URL
      .then(response => response.json())
      .then(data => setStats(data))
      .catch(error => console.error('Error fetching warehouse stats:', error));
  }, []);

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        <Header />
        <main className="main" style={{ padding: '1rem' }}>
          <h1>Tableau de bord</h1>
          <div className="card" style={{ marginTop: '2rem' }}>
            <h3>Statistiques des entrepôts</h3>
            <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Nom</th>
                  <th style={thStyle}>Stock %</th>
                  <th style={thStyle}>Quantité Totale</th>
                  <th style={thStyle}>Produits Uniques</th>
                  <th style={thStyle}>Variantes</th>
                </tr>
              </thead>
              <tbody>
                {stats.length > 0 ? (
                  stats.map((w, index) => (
                    <tr key={index}>
                      <td style={tdStyle}>{w.name}</td>
                      <td style={tdStyle}>
                        {w.percentage}%
                        <div style={barContainerStyle}>
                          <div style={{ ...barFillStyle, width: `${w.percentage}%` }}></div>
                        </div>
                      </td>
                      <td style={tdStyle}>{w.total_quantity}</td>
                      <td style={tdStyle}>{w.unique_products}</td>
                      <td style={tdStyle}>{w.num_variants}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '1rem' }}>
                      Chargement des données...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

// Simple inline styles
const thStyle = {
  borderBottom: '2px solid #ccc',
  padding: '0.5rem',
  textAlign: 'left',
  background: '#f2f2f2',
};

const tdStyle = {
  padding: '0.75rem',
  borderBottom: '1px solid #eee',
};

const barContainerStyle = {
  width: '100%',
  height: '8px',
  backgroundColor: '#ddd',
  borderRadius: '4px',
  marginTop: '4px',
};

const barFillStyle = {
  height: '100%',
  backgroundColor: '#28a745',
  borderRadius: '4px',
};
