import Link from 'next/link';

export default function Sidebar() {
    return (
        <div className="sidebar">
            <h2>Mon Dashboard</h2>
            <nav>
                <Link href="/">🏠 Accueil</Link>
                <Link href="/users">👥 Utilisateurs</Link>
                <Link href="/entrepots">🏬 Entrepôts</Link>
                <Link href="/products">📦 Produits</Link>
            </nav>
        </div>
    );
}
