// src/components/orders/OrdersList.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrder } from '../../contexts/OrderContext';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import OrderStatusModal from './OrderStatusModal';
import OrderActionsGuide from './OrderActionsGuide';
import {
  Plus, Search, Filter, Edit, Trash2, Printer, Download,
  Package, Calendar, User, DollarSign, FileText, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion } from 'framer-motion';

// === PDF deps (assurez-vous: `npm i jspdf html2canvas`) ===
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ---------- Types & Consts ----------
type OrderItem = {
  productName: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  vatRate?: number;
  total: number;
};
const A4W = 794;  // px @96dpi
const A4H = 1123;

const UNITS_3DP = new Set([
  'kg','kilogramme','kilogrammes',
  'l','litre','litres',
  't','tonne','tonnes','ton'
]);

// ---------- Helpers format ----------
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
    setTimeout(() => resolve(), timeoutMs); // ne pas bloquer
    imgs.forEach((img) => {
      const el = img as HTMLImageElement;
      if (el.complete && el.naturalWidth > 0) return tick();
      el.addEventListener('load', tick, { once: true });
      el.addEventListener('error', () => { el.style.display = 'none'; tick(); }, { once: true });
    });
  });
};

// Construit le DOM du BL pour UNE commande (hors-écran)
const buildPdfDomForOrder = (order: any, user: any) => {
  const logoUrl = user?.company?.logoUrl || '';
  const companyName = user?.company?.name || '';
  const companyAddress = user?.company?.address || '';
  const companyPhone = user?.company?.phone || '';
  const companyEmail = user?.company?.email || '';
  const companyIce = user?.company?.ice || '';
  const companyIf = user?.company?.if || '';
  const companyRc = user?.company?.rc || '';
  const companyPatente = user?.company?.patente || '';

  const items = (order.items as OrderItem[]).map(i => ({
    ...i,
    quantity: Number(i.quantity || 0),
    unitPrice: Number(i.unitPrice || 0),
    total: Number(i.total || 0),
  }));

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px'; // why: visible pour html2canvas
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

  const headerHtml = `
    <div class="page-header">
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

  const pages = splitItems(items);
  const getClientName = () =>
    order.clientType === 'personne_physique'
      ? (order.clientName || 'Client particulier')
      : (order.client?.name || 'Client société');

  pages.forEach((p: any, idx: number) => {
    const page = document.createElement('section');
    page.className = `page${idx > 0 ? ' break-before' : ''}`;
    page.style.width = `${A4W}px`;
    page.style.height = `${A4H}px`;

    const headerWrap = document.createElement('div');
    headerWrap.innerHTML = headerHtml;
    page.appendChild(headerWrap.firstElementChild!);

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
          <div class="kv"><span>Quantité totale:</span> <b>${new Intl.NumberFormat('fr-FR').format(items.reduce((s, it) => s + (Number(it.quantity)||0), 0))}</b></div>
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
          p.rows.map((it: OrderItem) => `
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

    const footerWrap = document.createElement('div');
    footerWrap.innerHTML = footerHtml;
    page.appendChild(footerWrap.firstElementChild!);

    root.appendChild(page);
  });

  // why: si logo CORS échoue → masquer pour ne pas casser html2canvas
  root.querySelectorAll('img[data-logo]').forEach(img => {
    img.addEventListener('error', () => { (img as HTMLImageElement).style.display = 'none'; }, { once: true });
  });

  const cleanup = () => { if (document.body.contains(container)) document.body.removeChild(container); };
  return { container, root, cleanup };
};

const buildPdfForOrder = async (order: any, user: any) => {
  const { container, root, cleanup } = buildPdfDomForOrder(order, user);
  document.body.appendChild(container);
  try {
    await waitForImages(root, 12000);
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

export default function OrdersList() {
  const { orders, deleteOrder, updateOrder } = useOrder();
  const { clients } = useData();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [statusModalOrder, setStatusModalOrder] = useState<string | null>(null);

  const updateOrderStatus = (orderId: string, newStatus: 'en_attente' | 'livre' | 'annule') => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    updateOrder(orderId, { status: newStatus });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'livre':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
            Livré
          </span>
        );
      case 'en_cours_livraison':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
            En cours de livraison
          </span>
        );
      case 'annule':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
            Annulé
          </span>
        );
      default:
        return null;
    }
  };

  const getClientName = (order: any) => {
    if (order.clientType === 'personne_physique') {
      return order.clientName || 'Client particulier';
    } else {
      return order.client?.name || 'Client société';
    }
  };

  const getProductsDisplay = (items: any[]) => {
    if (items.length === 1) return items[0].productName;
    return `${items.length} articles`;
  };

  const getTotalQuantity = (items: any[]) =>
    items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  // Filtrage
  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getClientName(order).toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.items.some((item: any) => (item.productName || '').toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    let matchesDate = true;
    if (dateFilter !== 'all') {
      const orderDate = new Date(order.orderDate);
      const now = new Date();
      switch (dateFilter) {
        case 'today':
          matchesDate = orderDate.toDateString() === now.toDateString();
          break;
        case 'week':
          matchesDate = orderDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          matchesDate = orderDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
    }
    return matchesSearch && matchesStatus && matchesDate;
  });

  // Tri
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let aValue: any, bValue: any;
    switch (sortBy) {
      case 'date': aValue = new Date(a.orderDate); bValue = new Date(b.orderDate); break;
      case 'client': aValue = getClientName(a); bValue = getClientName(b); break;
      case 'total': aValue = a.totalTTC; bValue = b.totalTTC; break;
      case 'status': aValue = a.status; bValue = b.status; break;
      default: aValue = a.number; bValue = b.number;
    }
    return sortOrder === 'asc' ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1);
  });

  // Pagination
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = sortedOrders.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: string) => {
    if (sortBy === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('desc'); }
  };

  const handleDeleteOrder = (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette commande ?')) {
      deleteOrder(id);
    }
  };

  // ----------- NEW: Impression façon OrderDetail.tsx -----------
  const handlePrintOrder = async (ord: any) => {
    // why: ouvrir la fenêtre tout de suite pour éviter le blocage popup
    const win = window.open('', '_blank');
    if (!win) { alert('Autorisez les pop-ups pour l’impression.'); return; }
    win.document.write('<!doctype html><title>Préparation…</title><body style="font:14px system-ui; padding:16px">Préparation du bon de livraison…</body>');
    win.document.close();

    const pdf = await buildPdfForOrder(ord, user);
    pdf.autoPrint();
    const blobUrl = pdf.output('bloburl');

    // remplace le contenu par le viewer PDF + impression auto
    win.location.href = blobUrl;
  };

  const exportToCSV = () => {
    const csvContent = [
      ['N° Commande', 'Date', 'Client', 'Produits', 'Quantité Total', 'Total TTC', 'Statut'].join(','),
      ...filteredOrders.map(order => [
        order.number,
        new Date(order.orderDate).toLocaleDateString('fr-FR'),
        getClientName(order),
        getProductsDisplay(order.items),
        getTotalQuantity(order.items),
        Number(order.totalTTC).toFixed(2),
        order.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `commandes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
            <Package className="w-8 h-8 text-blue-600" />
            <span>Commandes</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Gestion des commandes et bons de livraison
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <Link
            to="/commandes/nouveau"
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Commande</span>
          </Link>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{orders.length}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">Total Commandes</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {orders.filter(o => o.status === 'livre').length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">Livrées</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {orders.filter(o => o.status === 'en_cours_livraison').length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">En cours</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {orders.reduce((sum, o) => sum + Number(o.totalTTC || 0), 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">MAD Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Rechercher..."
              />
            </div>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">Tous les statuts</option>
              <option value="en_cours_livraison">En cours de livraison</option>
              <option value="livre">Livré</option>
              <option value="annule">Annulé</option>
            </select>
          </div>

          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">Toutes les dates</option>
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
            </select>
          </div>

          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="date">Trier par date</option>
              <option value="client">Trier par client</option>
              <option value="total">Trier par montant</option>
              <option value="status">Trier par statut</option>
            </select>
          </div>

          <div>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="w-full inline-flex items-center justify-center space-x-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span>{sortOrder === 'asc' ? 'Croissant' : 'Décroissant'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table des commandes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleSort('number')}>N° Commande</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleSort('date')}>Date Commande</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleSort('client')}>Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Produits</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Quantité</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleSort('total')}>Prix Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleSort('status')}>Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedOrders.map((order) => (
                <motion.tr
                  key={order.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{order.number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {new Date(order.orderDate).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(order.orderDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {order.deliveryDate && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Livraison: {new Date(order.deliveryDate).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{getClientName(order)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{order.clientType === 'personne_physique' ? 'Particulier' : 'Société'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">{getProductsDisplay(order.items)}</div>
                    {order.items.length > 1 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {order.items.map((item: any) => item.productName).join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {new Intl.NumberFormat('fr-FR').format(getTotalQuantity(order.items))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(order.totalTTC || 0))} MAD
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      HT: {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(order.subtotal || 0))} MAD
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(order.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setStatusModalOrder(order.id)}
                        className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                        title="Changer le statut"
                      >
                        <Filter className="w-4 h-4" />
                      </button>
                      <Link
                        to={`/commandes/${order.id}`}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        title="Voir détails"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                      {/* === NOUVEAU: impression PDF dans un onglet + print auto === */}
                      <button
                        onClick={() => handlePrintOrder(order)}
                        className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                        title="Bon de livraison (imprimer)"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <Link
                        to={`/commandes/${order.id}/modifier`}
                        className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDeleteOrder(order.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {paginatedOrders.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {orders.length === 0 ? 'Aucune commande créée' : 'Aucune commande trouvée'}
            </p>
            {orders.length === 0 && (
              <Link
                to="/commandes/nouveau"
                className="mt-4 inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>Créer votre première commande</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Affichage de {startIndex + 1} à {Math.min(startIndex + itemsPerPage, sortedOrders.length)} sur {sortedOrders.length} commandes
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Précédent
            </button>
            <span className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage} sur {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* Modal de changement de statut */}
      {statusModalOrder && (
        <OrderStatusModal
          isOpen={!!statusModalOrder}
          onClose={() => setStatusModalOrder(null)}
          order={orders.find(o => o.id === statusModalOrder)!}
          onUpdateStatus={updateOrderStatus}
        />
      )}

      {/* Guide des actions */}
      <OrderActionsGuide />
    </div>
  );
}
