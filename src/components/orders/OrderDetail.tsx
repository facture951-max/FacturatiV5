// src/components/orders/OrderDetail.tsx
import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useOrder } from '../../contexts/OrderContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft, Printer, Download, Edit, Package, DollarSign,
  Building2, Phone, Mail, MapPin, User
} from 'lucide-react';

// npm i jspdf html2canvas
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type OrderItem = {
  productName: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  vatRate?: number;
  total: number;
};

// A4 en px @96dpi (stable pour html2canvas)
const A4W = 794;   // 210mm
const A4H = 1123;  // 297mm

// ----- Formatage FR -----
const UNITS_3DP = new Set([
  'kg','kilogramme','kilogrammes',
  'l','litre','litres',
  't','tonne','tonnes','ton'
]);
const formatQtyFR = (value: number, unit?: string) => {
  const u = (unit || '').toLowerCase().trim();
  const is3 = UNITS_3DP.has(u);
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: is3 ? 3 : 0,
    maximumFractionDigits: is3 ? 3 : 3
  }).format(Number(value || 0));
};
const formatMoneyFR = (value: number) =>
  `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value||0))} MAD`;

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'livre':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
            ✅ Livré
          </span>
        );
      case 'en_cours_livraison':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
            🚚 En cours de livraison
          </span>
        );
      case 'annule':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
            ❌ Annulé
          </span>
        );
      default:
        return null;
    }
  };

  const getClientName = () =>
    order.clientType === 'personne_physique'
      ? (order.clientName || 'Client particulier')
      : (order.client?.name || 'Client société');

  // ----------------- Actions PDF -----------------

  const handleDownloadPDF = async () => {
    const pdf = await buildPdf();
    pdf.save(`Bon_Livraison_${order.number}.pdf`);
  };

  const handlePrintInNewTab = async () => {
    // why: ouvrir le viewer natif avec autoPrint → pas d’about:blank vide
    const pdf = await buildPdf();
    pdf.autoPrint();
    const url = pdf.output('bloburl');
    window.open(url, '_blank');
  };

  const buildPdf = async () => {
    const { container, root, cleanup } = buildPdfDom();
    document.body.appendChild(container);

    try {
      await waitForImages(root, 12000); // why: éviter canvas blanc si logo CORS lent
      const sections = Array.from(root.querySelectorAll<HTMLElement>('section.page'));

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

      for (let i = 0; i < sections.length; i++) {
        const el = sections[i];

        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          imageTimeout: 15000,
          logging: false,
          allowTaint: false
        });

        const img = canvas.toDataURL('image/jpeg', 0.98);
        pdf.addImage(img, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        if (i < sections.length - 1) pdf.addPage();
      }

      return pdf;
    } finally {
      cleanup();
    }
  };

  // ----------------- Génération DOM A4 -----------------

  const splitItems = (items: OrderItem[]) => {
    const FIRST = 12, MIDDLE = 18, LAST = 10;
    const pages: { rows: OrderItem[]; first: boolean; last: boolean }[] = [];
    if (items.length <= FIRST + LAST) return [{ rows: items, first: true, last: true }];
    pages.push({ rows: items.slice(0, FIRST), first: true, last: false });
    let i = FIRST;
    while (items.length - i > LAST) {
      pages.push({ rows: items.slice(i, i + MIDDLE), first: false, last: false });
      i += MIDDLE;
    }
    pages.push({ rows: items.slice(i), first: false, last: true });
    return pages;
  };

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
    container.style.left = '-10000px'; // visible hors-viewport (pas opacity:0)
    container.style.top = '0';
    container.style.width = `${A4W}px`;
    container.style.background = '#fff';
    container.style.zIndex = '9999';

    const style = document.createElement('style');
    style.textContent = getPdfCss();
    container.appendChild(style);

    const root = document.createElement('div');
    root.id = 'pdf-root';
    container.appendChild(root);

    const pages = splitItems(items);

    const headerHtml = `
      <div class="page-header">
        <div class="brand">
          ${
            (logoUrl && `<img data-logo src="${logoUrl}" alt="Logo" class="logo" crossorigin="anonymous" referrerpolicy="no-referrer" />`)
            || `<div class="logo logo-fallback">${(companyName || 'SOCIETE').slice(0,2).toUpperCase()}</div>`
          }
          <div class="brand-info">
            <div class="brand-name">${companyName}</div>
          </div>
        </div>
        <div class="doc-title">BON DE LIVRAISON</div>
        <div class="doc-meta">
          <div><b>N°:</b> ${order.number}</div>
          <div><b>Date:</b> ${new Date(order.orderDate).toLocaleString('fr-FR')}</div>
          ${order.deliveryDate ? `<div><b>Livraison:</b> ${new Date(order.deliveryDate).toLocaleString('fr-FR')}</div>` : ''}
          <div><b>Statut:</b> ${order.status === 'livre' ? 'Livré' : (order.status === 'en_cours_livraison' ? 'En cours' : 'Annulé')}</div>
        </div>
      </div>
    `;

    const footerHtml = `
      <div class="page-footer">
        <span><b>${companyName}</b></span>
        ${companyAddress ? `<span> | ${companyAddress}</span>` : ''}
        ${companyPhone ? `<span> | Tél: ${companyPhone}</span>` : ''}
        ${companyEmail ? `<span> | Email: ${companyEmail}</span>` : ''}
        ${companyIce ? `<span> | ICE: ${companyIce}</span>` : ''}
        ${companyIf ? `<span> | IF: ${companyIf}</span>` : ''}
        ${companyRc ? `<span> | RC: ${companyRc}</span>` : ''}
        ${companyPatente ? `<span> | Patente: ${companyPatente}</span>` : ''}
      </div>
    `;

    pages.forEach((p, idx) => {
      const page = document.createElement('section');
      page.className = `page${idx > 0 ? ' break-before' : ''}`;
      page.style.width = `${A4W}px`;
      page.style.height = `${A4H}px`;

      // Header
      const headerWrap = document.createElement('div');
      headerWrap.innerHTML = headerHtml;
      page.appendChild(headerWrap.firstElementChild!);

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
            <div class="kv"><span>Quantité totale:</span> <b>${formatQtyFR(getTotalQuantity(), '')}</b></div>
            <div class="kv"><span>TVA appliquée:</span> <b>${order.applyVat ? 'Oui' : 'Non'}</b></div>
          </div>
        `;
        body.appendChild(extras);
      }

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
                <td class="center">${formatQtyFR(it.quantity, it.unit)} ${it.unit || ''}</td>
                <td class="num">${formatMoneyFR(it.unitPrice)}</td>
                <td class="num"><b>${formatMoneyFR(it.total)}</b></td>
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
            <div class="row"><span><b>Sous-total HT</b></span><span>${formatMoneyFR(order.subtotal)}</span></div>
            ${order.totalVat > 0 ? `<div class="row"><span><b>TVA</b></span><span>${formatMoneyFR(order.totalVat)}</span></div>` : ''}
            <div class="row grand"><span>TOTAL TTC</span><span>${formatMoneyFR(order.totalTTC)}</span></div>
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
      const footerWrap = document.createElement('div');
      footerWrap.innerHTML = footerHtml;
      page.appendChild(footerWrap.firstElementChild!);

      root.appendChild(page);
    });

    // Si le logo échoue (CORS), on le masque pour éviter un canvas blanc
    root.querySelectorAll('img[data-logo]').forEach(img => {
      img.addEventListener('error', () => { (img as HTMLImageElement).style.display = 'none'; }, { once: true });
    });

    const cleanup = () => { if (document.body.contains(container)) document.body.removeChild(container); };
    return { container, root, cleanup };
  };

  const getPdfCss = () => `
    :root{ --primary:#1f52d1; --ink:#0f172a; --muted:#64748b; --border:#e5e7eb; --muted-bg:#f7fafc; --accent:#eaf3ff; }
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

  const waitForImages = (root: HTMLElement, timeoutMs = 10000) => {
    const imgs = Array.from(root.querySelectorAll('img'));
    if (imgs.length === 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let done = 0;
      const tick = () => (++done === imgs.length) && resolve();
      setTimeout(() => resolve(), timeoutMs);
      imgs.forEach((img) => {
        const el = img as HTMLImageElement;
        if (el.complete && el.naturalWidth > 0) return tick();
        el.addEventListener('load', tick, { once: true });
        el.addEventListener('error', () => { el.style.display = 'none'; tick(); }, { once: true });
      });
    });
  };

  const getTotalQuantity = () =>
    (order.items as OrderItem[]).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  // ----------------- UI écran (quantités FR) -----------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/commandes')}
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Commande {order.number}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Détails et bon de livraison
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>PDF</span>
          </button>
          <button
            onClick={handlePrintInNewTab}
            className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer</span>
          </button>
          <Link
            to={`/commandes/${order.id}/modifier`}
            className="inline-flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Edit className="w-4 h-4" />
            <span>Modifier</span>
          </Link>
        </div>
      </div>
    {/* Informations principales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations commande */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Package className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Informations Commande</h3>
          </div>
          
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Numéro:</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">{order.number}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Date de commande:</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {new Date(order.orderDate).toLocaleString('fr-FR')}
              </p>
            </div>
            {order.deliveryDate && (
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Date de livraison:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {new Date(order.deliveryDate).toLocaleString('fr-FR')}
                </p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Statut:</span>
              <div className="mt-1">
                {getStatusBadge(order.status)}
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Stock débité:</span>
              <p className={`font-medium ${order.stockDebited ? 'text-red-600' : 'text-green-600'}`}>
                {order.stockDebited ? 'Oui' : 'Non'}
              </p>
            </div>
          </div>
        </div>

        {/* Informations client */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            {order.clientType === 'personne_physique' ? (
              <User className="w-6 h-6 text-green-600" />
            ) : (
              <Building2 className="w-6 h-6 text-blue-600" />
            )}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {order.clientType === 'personne_physique' ? 'Client Particulier' : 'Client Société'}
            </h3>
          </div>
          
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Nom:</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">{getClientName()}</p>
            </div>
            
            {order.clientType === 'societe' && order.client && (
              <>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">ICE:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{order.client.ice}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <p className="text-sm text-gray-700 dark:text-gray-300">{order.client.address}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <p className="text-sm text-gray-700 dark:text-gray-300">{order.client.phone}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <p className="text-sm text-gray-700 dark:text-gray-300">{order.client.email}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Totaux */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <DollarSign className="w-6 h-6 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Totaux</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Sous-total HT:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{order.subtotal.toFixed(2)} MAD</span>
            </div>
            
            {order.totalVat > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">TVA:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{order.totalVat.toFixed(2)} MAD</span>
              </div>
            )}
            
            <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
              <div className="flex justify-between">
                <span className="font-medium text-gray-900 dark:text-gray-100">Total TTC:</span>
                <span className="text-xl font-bold text-blue-600">{order.totalTTC.toFixed(2)} MAD</span>
              </div>
            </div>
            
            <div className="mt-4 text-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Quantité totale:</span>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {getTotalQuantity().toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Articles détaillés */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Articles Commandés</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Produit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Quantité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Prix Unitaire HT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  TVA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total HT
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {order.items.map((item: any, index: number) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.productName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Unité: {item.unit || 'unité'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {item.quantity.toFixed(3)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {item.unitPrice.toFixed(2)} MAD
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {item.vatRate}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {item.total.toFixed(2)} MAD
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Informations supplémentaires */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">📋 Informations de Livraison</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800 dark:text-blue-200">
          <div>
            <p><strong>Type de client:</strong> {order.clientType === 'personne_physique' ? 'Particulier' : 'Société'}</p>
            <p><strong>TVA appliquée:</strong> {order.applyVat ? 'Oui' : 'Non'}</p>
          </div>
          <div>
            <p><strong>Articles:</strong> {order.items.length}</p>
            <p><strong>Quantité totale:</strong> {getTotalQuantity().toFixed(1)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

