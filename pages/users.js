import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function Users() {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        <Header />
        <div className="main">
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
            Liste des utilisateurs
          </h2>

          {/* Exemple de tableau statique */}
          <table style={{ width: '100%', backgroundColor: 'var(--white)', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: 'var(--deep-blue)', color: 'white' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left' }}>Nom</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Rôle</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--light-gray)' }}>
                <td style={{ padding: '12px' }}>Jean Dupont</td>
                <td style={{ padding: '12px' }}>jean@example.com</td>
                <td style={{ padding: '12px' }}>Admin</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--light-gray)' }}>
                <td style={{ padding: '12px' }}>Sarah Ali</td>
                <td style={{ padding: '12px' }}>sarah@example.com</td>
                <td style={{ padding: '12px' }}>Utilisateur</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
