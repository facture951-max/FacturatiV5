// src/components/orders/OrderDetail.tsx
import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useOrder } from '../../contexts/OrderContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft, Printer, Download, Edit, Package, DollarSign,
  Building2, Phone, Mail, MapPin, User
} from 'lucide-react';
import html2pdf from 'html2pdf.js';

type OrderItem = {
  productName: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  vatRate?: number;
  total: number;
};

const A4W = 794;  // 8.27in * 96dpi
const A4H = 1123; // 11.69in * 96dpi

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getOrderById } = useOrder();
  const { user } = useAuth();

  const order = id ? getOrderById(id) : null;

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Commande non trouvée
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            La commande demandée n'existe pas ou a été supprimée.
          </p>
          <Link
            to="/commandes"
            className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour aux commandes</span>
          </Link>
        </div>
      </div>
    );
  }

  const getClientName = () =>
    order.clientType === 'personne_physique'
      ? (order.clientName || 'Client particulier')
      : (order.client?.name || 'Client société');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'livre':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">✅ Livré</span>;
      case 'en_cours_livraison':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">🚚 En cours de livraison</span>;
      case 'annule':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">❌ Annulé</span>;
      default:
        return null;
    }
  };

  const handlePrintDeliveryNote = () => {
    // why: utiliser le même DOM que PDF pour cohérence
    const { container, root, cleanup } = buildPdfDom();
    document.body.appendChild(container);
    window.print(); // l’aperçu imprimera l’ensemble
    cleanup();
  };

  const handleDownloadPDF = async () => {
    const { container, root, cleanup } = buildPdfDom();
    document.body.appendChild(container);

    try {
      // attendre les images (logo) pour éviter canvas blanc
      await waitForImages(root, 12000);

      const options = {
        margin: 0,
        filename: `Bon_Livraison_${order.number}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,              // indispensable pour logo CDN
          imageTimeout: 15000,
          backgroundColor: '#ffffff',
          logging: false
        },
        pagebreak: { mode: ['css', 'legacy'] },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      } as const;

      await html2pdf().set(options).from(root).save();
    } catch (err) {
      console.error('Erreur PDF:', err);
      alert('Erreur lors de la génération du PDF');
    } finally {
      cleanup();
    }
  };

  /** découpe les items en pages */
  const splitItems = (items: OrderItem[]) => {
    const FIRST = 12;
    const MIDDLE = 18;
    const LAST = 10;

    const pages: { rows: OrderItem[]; first: boolean; last: boolean }[] = [];
    if (items.length <= FIRST + LAST) {
      pages.push({ rows: items, first: true, last: true });
      return pages;
    }
    pages.push({ rows: items.slice(0, FIRST), first: true, last: false });
    let i = FIRST;
    while (items.length - i > LAST) {
      pages.push({ rows: items.slice(i, i + MIDDLE), first: false, last: false });
      i += MIDDLE;
    }
    pages.push({ rows: items.slice(i), first: false, last: true });
    return pages;
  };

  /** construit le DOM A4 multi-page hors-écran (pas de <html> string) */
  const buildPdfDom = () => {
    const logoUrl = (user as any)?.company?.logo || '';
    const companyName = user?.company?.name || '';
    const companyAddress = user?.company?.address || '';
    const companyPhone = user?.company?.phone || '';
    const companyEmail = user?.company?.email || '';
    const companyIce = (user as any)?.company?.ice || '';
    const companyIf = (user as any)?.company?.if || '';
    const companyRc = (user as any)?.company?.rc || '';
    const companyPatente = (user as any)?.company?.patente || '';

    const items = (order.items as OrderItem[]).map(i => ({
      ...i,
      quantity: Number(i.quantity || 0),
      unitPrice: Number(i.unitPrice || 0),
      total: Number(i.total || 0),
    }));

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px'; // hors écran mais visible
    container.style.top = '0';
    container.style.width = `${A4W}px`;
    container.style.zIndex = '9999';
    container.style.background = '#fff';

    const style = document.createElement('style');
    style.textContent = getPdfCss();
    container.appendChild(style);

    const root = document.createElement('div');
    root.id = 'pdf-root';
    container.appendChild(root);

    const pages = splitItems(items);

    pages.forEach((p, idx) => {
      const page = document.createElement('section');
      page.className = `page${idx > 0 ? ' break-before' : ''}`;
      page.style.width = `${A4W}px`;
      page.style.height = `${A4H}px`;

      // Header
      const header = document.createElement('div');
      header.className = 'page-header';
      header.innerHTML = `
        <div class="brand">
          ${
            (logoUrl && `<img data-logo src="${logoUrl}" alt="Logo" class="logo" crossorigin="anonymous" referrerpolicy="no-referrer" />`)
            || `<div class="logo logo-fallback">${(companyName || 'SOCIETE').slice(0,2).toUpperCase()}</div>`
          }
          <div class="brand-info">
            <div class="brand-name">${companyName}</div>
            <div class="brand-meta">${companyAddress || ''}</div>
          </div>
        </div>
        <div class="doc-title">BON DE LIVRAISON</div>
        <div class="doc-meta">
          <div><b>N°:</b> ${order.number}</div>
          <div><b>Date:</b> ${new Date(order.orderDate).toLocaleString('fr-FR')}</div>
          ${order.deliveryDate ? `<div><b>Livraison:</b> ${new Date(order.deliveryDate).toLocaleString('fr-FR')}</div>` : ''}
          <div><b>Statut:</b> ${order.status === 'livre' ? 'Livré' : (order.status === 'en_cours_livraison' ? 'En cours' : 'Annulé')}</div>
        </div>
      `;
      page.appendChild(header);

      // Body
      const body = document.createElement('div');
      body.className = 'page-body';

      if (p.first) {
        const extras = document.createElement('div');
        extras.className = 'grid-2';
        extras.innerHTML = `
          <div class="card">
            <h3>CLIENT</h3>
            <div class="kv"><b>${getClientName()}</b></div>
            ${
              order.clientType === 'societe' && order.client ? `
                <div class="kv">ICE: ${order.client.ice || ''}</div>
                <div class="kv">Adresse: ${order.client.address || ''}</div>
                <div class="kv">Tél: ${order.client.phone || ''}</div>
                <div class="kv">Email: ${order.client.email || ''}</div>
              ` : `<div class="kv muted">Client particulier</div>`
            }
          </div>
          <div class="card card--hint">
            <h3>INFORMATIONS</h3>
            <div class="kv"><span>Articles:</span> <b>${items.length}</b></div>
            <div class="kv"><span>Quantité totale:</span> <b>${getTotalQuantity().toFixed(1)}</b></div>
            <div class="kv"><span>TVA appliquée:</span> <b>${order.applyVat ? 'Oui' : 'Non'}</b></div>
          </div>
        `;
        body.appendChild(extras);
      }

      // Table
      const table = document.createElement('table');
      table.className = 'items';
      table.innerHTML = `
        <thead>
          <tr>
            <th>PRODUIT</th>
            <th class="center">QUANTITÉ</th>
            <th class="num">PRIX UNIT. HT</th>
            <th class="num">TOTAL HT</th>
          </tr>
        </thead>
        <tbody>
          ${
            p.rows.map((it) => `
              <tr>
                <td>${it.productName}</td>
                <td class="center">${it.quantity.toFixed(3)} ${it.unit || 'unité'}</td>
                <td class="num">${it.unitPrice.toFixed(2)} MAD</td>
                <td class="num"><b>${it.total.toFixed(2)} MAD</b></td>
              </tr>
            `).join('')
          }
        </tbody>
      `;
      body.appendChild(table);

      if (p.last) {
        const totals = document.createElement('div');
        totals.className = 'totals';
        totals.innerHTML = `
          <div class="box">
            <div class="row"><span><b>Sous-total HT</b></span><span>${Number(order.subtotal).toFixed(2)} MAD</span></div>
            ${order.totalVat > 0 ? `<div class="row"><span><b>TVA</b></span><span>${Number(order.totalVat).toFixed(2)} MAD</span></div>` : ''}
            <div class="row grand"><span>TOTAL TTC</span><span>${Number(order.totalTTC).toFixed(2)} MAD</span></div>
          </div>
        `;
        body.appendChild(totals);

        const sig = document.createElement('div');
        sig.className = 'signatures';
        sig.innerHTML = `
          <div class="sign"><div class="t">Signature Client</div><div class="s">Bon pour accord</div></div>
          <div class="sign"><div class="t">Signature Livreur</div><div class="s">Date et heure</div></div>
        `;
        body.appendChild(sig);
      }

      page.appendChild(body);

      // Footer
      const footer = document.createElement('div');
      footer.className = 'page-footer';
      footer.innerHTML = `
        <span><b>${companyName}</b></span>
        ${companyAddress ? `<span> | ${companyAddress}</span>` : ''}
        ${companyPhone ? `<span> | Tél: ${companyPhone}</span>` : ''}
        ${companyEmail ? `<span> | Email: ${companyEmail}</span>` : ''}
        ${companyIce ? `<span> | ICE: ${companyIce}</span>` : ''}
        ${companyIf ? `<span> | IF: ${companyIf}</span>` : ''}
        ${companyRc ? `<span> | RC: ${companyRc}</span>` : ''}
        ${companyPatente ? `<span> | Patente: ${companyPatente}</span>` : ''}
      `;
      page.appendChild(footer);

      root.appendChild(page);
    });

    // fallback si le logo casse le canvas (CORS)
    root.querySelectorAll('img[data-logo]').forEach(img => {
      img.addEventListener('error', () => {
        (img as HTMLImageElement).style.display = 'none';
      }, { once: true });
    });

    const cleanup = () => {
      if (document.body.contains(container)) document.body.removeChild(container);
    };

    return { container, root, cleanup };
  };

  /** CSS A4 en pixels (fiable pour html2canvas) */
  const getPdfCss = () => `
    :root{
      --primary:#1f52d1; --ink:#0f172a; --muted:#64748b;
      --border:#e5e7eb; --muted-bg:#f7fafc; --accent:#eaf3ff;
    }
    *{ box-sizing:border-box; }
    #pdf-root{ width:${A4W}px; }
    .page{ width:${A4W}px; height:${A4H}px; background:#fff; color:var(--ink); font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; padding:48px 48px 56px 48px; position:relative; display:flex; flex-direction:column; }
    .break-before{ page-break-before: always; }
    .page-header{ display:grid; grid-template-columns:1fr auto 1fr; align-items:center; border-bottom:2px solid var(--primary); padding-bottom:24px; }
    .brand{ display:flex; align-items:center; gap:12px; }
    .logo{ width:88px; height:88px; object-fit:contain; }
    .logo-fallback{ display:flex; align-items:center; justify-content:center; border:1px solid var(--border); border-radius:8px; color:var(--primary); font-weight:800; }
    .brand-info{ display:flex; flex-direction:column; }
    .brand-name{ font-weight:800; font-size:18px; }
    .brand-meta{ color:var(--muted); font-size:12px; }
    .doc-title{ text-align:center; color:var(--primary); font-weight:800; letter-spacing:.6px; font-size:18px; }
    .doc-meta{ justify-self:end; text-align:right; font-size:12px; color:#111827; }
    .doc-meta > div{ margin:2px 0; }
    .page-body{ flex:1 1 auto; display:flex; flex-direction:column; gap:24px; padding-top:24px; }
    .grid-2{ display:grid; grid-template-columns:1fr 1fr; gap:24px; }
    .card{ border:1px solid var(--border); border-radius:8px; background:var(--muted-bg); padding:16px; }
    .card--hint{ background:var(--accent); border-color:#c8ddff; }
    .card h3{ margin:0 0 12px 0; font-size:12px; }
    .kv{ font-size:12px; margin:4px 0; }
    .muted{ color:var(--muted); font-style:italic; }
    table.items{ width:100%; border-collapse:collapse; }
    table.items th, table.items td{ border:1px solid var(--border); padding:12px 8px; }
    table.items thead th{ background:#f3f4f6; font-weight:700; font-size:12px; }
    .num{ text-align:right; white-space:nowrap; }
    .center{ text-align:center; }
    tbody tr:nth-child(even){ background:#fbfdff; }
    .totals{ display:flex; justify-content:flex-end; }
    .totals .box{ width:60%; max-width:280px; }
    .row{ display:flex; justify-content:space-between; padding:6px 0; font-size:12px; }
    .grand{ color:var(--primary); font-weight:800; border-top:1px dashed var(--border); margin-top:4px; }
    .signatures{ display:grid; grid-template-columns:1fr 1fr; gap:24px; }
    .sign{ border:2px solid #d1d5db; border-radius:8px; text-align:center; padding:24px 0; }
    .sign .t{ font-weight:700; }
    .sign .s{ margin-top:8px; font-size:11px; color:var(--muted); }
    .page-footer{ position:absolute; left:48px; right:48px; bottom:24px; border-top:1px solid var(--border); padding-top:8px; text-align:center; font-size:10px; color:#334155; }
  `;

  /** attend le chargement des images du root (évite canvas blanc) */
  const waitForImages = (root: HTMLElement, timeoutMs = 10000) => {
    const imgs = Array.from(root.querySelectorAll('img'));
    if (imgs.length === 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let done = 0;
      const check = () => (++done === imgs.length) && resolve();
      const timer = setTimeout(() => resolve(), timeoutMs); // why: ne pas bloquer indéfiniment
      imgs.forEach((img) => {
        const el = img as HTMLImageElement;
        if (el.complete && el.naturalWidth > 0) return check();
        el.addEventListener('load', () => check(), { once: true });
        el.addEventListener('error', () => { el.style.display = 'none'; check(); }, { once: true });
      });
    });
  };

  const getTotalQuantity = () =>
    (order.items as OrderItem[]).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header app */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/commandes')}
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Commande {order.number}</h1>
            <p className="text-gray-600 dark:text-gray-300">Détails et bon de livraison</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={handleDownloadPDF} className="inline-flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Download className="w-4 h-4" /><span>PDF</span>
          </button>
          <button onClick={handlePrintDeliveryNote} className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Printer className="w-4 h-4" /><span>Imprimer</span>
          </button>
          <Link to={`/commandes/${order.id}/modifier`} className="inline-flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Edit className="w-4 h-4" /><span>Modifier</span>
          </Link>
        </div>
      </div>

      {/* --- votre UI à l’écran (inchangée) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Package className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Informations Commande</h3>
          </div>
          <div className="space-y-3">
            <div><span className="text-sm text-gray-600 dark:text-gray-400">Numéro:</span><p className="font-medium text-gray-900 dark:text-gray-100">{order.number}</p></div>
            <div><span className="text-sm text-gray-600 dark:text-gray-400">Date de commande:</span><p className="font-medium text-gray-900 dark:text-gray-100">{new Date(order.orderDate).toLocaleString('fr-FR')}</p></div>
            {order.deliveryDate && (<div><span className="text-sm text-gray-600 dark:text-gray-400">Date de livraison:</span><p className="font-medium text-gray-900 dark:text-gray-100">{new Date(order.deliveryDate).toLocaleString('fr-FR')}</p></div>)}
            <div><span className="text-sm text-gray-600 dark:text-gray-400">Statut:</span><div className="mt-1">{getStatusBadge(order.status)}</div></div>
            <div><span className="text-sm text-gray-600 dark:text-gray-400">Stock débité:</span><p className={`font-medium ${order.stockDebited ? 'text-red-600' : 'text-green-600'}`}>{order.stockDebited ? 'Oui' : 'Non'}</p></div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            {order.clientType === 'personne_physique' ? <User className="w-6 h-6 text-green-600" /> : <Building2 className="w-6 h-6 text-blue-600" />}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {order.clientType === 'personne_physique' ? 'Client Particulier' : 'Client Société'}
            </h3>
          </div>
          <div className="space-y-3">
            <div><span className="text-sm text-gray-600 dark:text-gray-400">Nom:</span><p className="font-medium text-gray-900 dark:text-gray-100">{getClientName()}</p></div>
            {order.clientType === 'societe' && order.client && (
              <>
                <div><span className="text-sm text-gray-600 dark:text-gray-400">ICE:</span><p className="font-medium text-gray-900 dark:text-gray-100">{order.client.ice}</p></div>
                <div className="flex items-center space-x-2"><MapPin className="w-4 h-4 text-gray-400" /><p className="text-sm text-gray-700 dark:text-gray-300">{order.client.address}</p></div>
                <div className="flex items-center space-x-2"><Phone className="w-4 h-4 text-gray-400" /><p className="text-sm text-gray-700 dark:text-gray-300">{order.client.phone}</p></div>
                <div className="flex items-center space-x-2"><Mail className="w-4 h-4 text-gray-400" /><p className="text-sm text-gray-700 dark:text-gray-300">{order.client.email}</p></div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <DollarSign className="w-6 h-6 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Totaux</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-sm text-gray-600 dark:text-gray-400">Sous-total HT:</span><span className="font-medium text-gray-900 dark:text-gray-100">{Number(order.subtotal).toFixed(2)} MAD</span></div>
            {order.totalVat > 0 && <div className="flex justify-between"><span className="text-sm text-gray-600 dark:text-gray-400">TVA:</span><span className="font-medium text-gray-900 dark:text-gray-100">{Number(order.totalVat).toFixed(2)} MAD</span></div>}
            <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
              <div className="flex justify-between"><span className="font-medium text-gray-900 dark:text-gray-100">Total TTC:</span><span className="text-xl font-bold text-blue-600">{Number(order.totalTTC).toFixed(2)} MAD</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
