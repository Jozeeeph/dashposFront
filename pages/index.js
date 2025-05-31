import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function Home() {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        <Header />
        <main className="main">
          <h2>Statistiques</h2>
          <div className="card">
            <p>Utilisateurs : 1023</p>
          </div>
          <div className="card" style={{ borderLeftColor: 'var(--soft-orange)' }}>
            <p>Ventes : €547</p>
          </div>
        </main>
      </div>
    </div>
  );
}
