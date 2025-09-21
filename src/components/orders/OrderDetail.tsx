import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useOrder } from '../../contexts/OrderContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft, Printer, Download, Edit, Package, DollarSign,
  Building2, Phone, Mail, MapPin, User
} from 'lucide-react';
import html2pdf from 'html2pdf.js';

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

  const getClientName = () => {
    if (order.clientType === 'personne_physique') return order.clientName || 'Client particulier';
    return order.client?.name || 'Client société';
  };

  const handlePrintDeliveryNote = () => {
    const html = generateDeliveryNoteHTML();
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    }
  };

  const handleDownloadPDF = () => {
    // why: on mesure/scale dans le DOM pour garantir 1 page A4
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';  // hors écran (visible pour html2canvas)
    container.style.top = '0';
    container.style.width = '210mm';
    container.style.background = '#fff';
    container.innerHTML = generateDeliveryNoteHTML(); // injecte le markup
    document.body.appendChild(container);

    // calcule l'échelle pour tenir en 297mm
    const sheet = container.querySelector('.sheet') as HTMLElement | null;
    if (sheet) {
      // A4 visible hauteur en px (html2canvas ≈ 96dpi → px/mm fiable)
      const a4HeightPx = sheet.clientHeight;            // 297mm (fixe via CSS)
      const renderedHeightPx = sheet.scrollHeight;      // contenu réel
      const scale = Math.min(1, a4HeightPx / Math.max(1, renderedHeightPx));
      sheet.style.setProperty('--scale', String(scale));
    }

    const options = {
      margin: 0,                         // pas de marge côté PDF (on gère en CSS)
      filename: `Bon_Livraison_${order.number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        imageTimeout: 15000,
        backgroundColor: '#ffffff',
        logging: false
      },
      pagebreak: { mode: ['avoid-all'] },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    } as const;

    html2pdf()
      .set(options)
      .from(container)
      .save()
      .catch((err: unknown) => {
        console.error('Erreur PDF:', err);
        alert('Erreur lors de la génération du PDF');
      })
      .finally(() => {
        if (document.body.contains(container)) document.body.removeChild(container);
      });
  };

  const generateDeliveryNoteHTML = () => {
    const logoUrl = (user as any)?.company?.logo|| '';
    const companyName = user?.company?.name || '';
    const companyAddress = user?.company?.address || '';
    const companyPhone = user?.company?.phone || '';
    const companyEmail = user?.company?.email || '';
    const companyIce = (user as any)?.company?.ice || '';
    const companyIf = (user as any)?.company?.if || '';
    const companyRc = (user as any)?.company?.rc || '';
    const companyPatente = (user as any)?.company?.patente || '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Bon de Livraison ${order.number}</title>
<style>
  :root {
    --primary:#1f52d1; --primary-600:#173e9d;
    --ink:#0f172a; --muted:#64748b;
    --border:#e5e7eb; --bg:#ffffff; --muted-bg:#f7fafc;
    --scale:1; /* auto ajustée par JS */
  }

  @page { size: A4; margin: 0; }
  html, body { margin:0; padding:0; background:#fff; }
  body { font: calc(12px * var(--scale)) / 1.45 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:var(--ink); }

  /* Feuille A4 fixe */
  .sheet {
    width: 210mm; height: 297mm; background: #fff; box-sizing: border-box;
    display: flex; flex-direction: column;
  }
  .wrap { flex: 1 1 auto; padding: calc(10mm * var(--scale)); display:flex; flex-direction:column; gap: calc(6mm * var(--scale)); }

  /* Header */
  .topbar { display:flex; align-items:center; gap: calc(8px * var(--scale)); }
  .logo { width: calc(22mm * var(--scale)); height: calc(22mm * var(--scale)); object-fit: contain; }
  .brand { display:flex; flex-direction:column; line-height:1.2; }
  .brand-name { font-weight:800; font-size: calc(16px * var(--scale)); letter-spacing:.2px; }
  .brand-meta { color:var(--muted); font-size: calc(11px * var(--scale)); }

  .title { text-align:center; color:var(--primary); font-weight:800; letter-spacing:.6px;
    font-size: calc(16px * var(--scale)); padding: calc(3mm * var(--scale)) 0; border-top:1px solid var(--border); border-bottom:2px solid var(--primary);
  }

  /* Cards */
  .grid-2 { display:grid; grid-template-columns: 1fr 1fr; gap: calc(4mm * var(--scale)); }
  .card { border:1px solid var(--border); border-radius: calc(6px * var(--scale)); background:var(--muted-bg); padding: calc(4mm * var(--scale)); }
  .card.order { background:#eaf3ff; border-color:#c8ddff; }
  .card h3 { margin:0 0 calc(2mm * var(--scale)) 0; font-size: calc(12px * var(--scale)); letter-spacing:.2px; }
  .kv { margin: calc(1mm * var(--scale)) 0; }
  .muted { color:var(--muted); font-style: italic; }

  /* Table */
  table { width:100%; border-collapse:collapse; }
  th, td { border:1px solid var(--border); padding: calc(2.6mm * var(--scale)) calc(2mm * var(--scale)); }
  thead th { background:#f3f4f6; font-weight:700; font-size: calc(12px * var(--scale)); }
  td.num, th.num { text-align:right; white-space:nowrap; }
  td.center, th.center { text-align:center; }
  tbody tr:nth-child(even){ background:#fbfdff; }

  /* Totaux */
  .totals { display:flex; justify-content:flex-end; }
  .totals .box { width: 60%; max-width: calc(60mm * var(--scale)); }
  .row { display:flex; justify-content:space-between; padding: calc(1.2mm * var(--scale)) 0; }
  .grand { color:var(--primary); font-weight:800; border-top:1px dashed var(--border); margin-top: calc(1mm * var(--scale)); }

  /* Signatures */
  .signatures { display:grid; grid-template-columns:1fr 1fr; gap: calc(4mm * var(--scale)); }
  .sign { border:2px solid #d1d5db; border-radius: calc(6px * var(--scale)); text-align:center; padding: calc(5mm * var(--scale)) 0; }
  .sign .t { font-weight:700; }
  .sign .s { margin-top: calc(1mm * var(--scale)); font-size: calc(11px * var(--scale)); color:var(--muted); }

  /* Footer */
  .footer { margin: 0 calc(10mm * var(--scale)) calc(6mm * var(--scale)) calc(10mm * var(--scale));
    padding-top: calc(2mm * var(--scale)); border-top:1px solid var(--border);
    text-align:center; font-size: calc(10px * var(--scale)); color:#334155;
  }

  /* Badge statut */
  .status { display:inline-block; padding: 2px 8px; border-radius:999px; font-size: calc(11px * var(--scale));
    background:#dcfce7; color:#166534; font-weight:600;
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="wrap">
      <div class="topbar">
        ${
          logoUrl
            ? `<img src="${logoUrl}" alt="Logo" class="logo" crossorigin="anonymous" referrerpolicy="no-referrer" />`
            : `<div class="logo" style="display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:8px;color:var(--primary);font-weight:800;">
                 ${(companyName || 'SOCIETE').slice(0,2).toUpperCase()}
               </div>`
        }
        <div class="brand">
          <div class="brand-name">${companyName}</div>
          <div class="brand-meta">${companyAddress || ''}</div>
        </div>
      </div>

      <div class="title">BON DE LIVRAISON</div>

      <div class="grid-2">
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
        <div class="card order">
          <h3>COMMANDE</h3>
          <div class="kv"><b>N°:</b> ${order.number}</div>
          <div class="kv"><b>Date:</b> ${new Date(order.orderDate).toLocaleString('fr-FR')}</div>
          ${order.deliveryDate ? `<div class="kv"><b>Livraison:</b> ${new Date(order.deliveryDate).toLocaleString('fr-FR')}</div>` : ''}
          <div class="kv"><b>Statut:</b> <span class="status">${
            order.status === 'livre' ? 'Livré' : (order.status === 'en_cours_livraison' ? 'En cours' : 'Annulé')
          }</span></div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>PRODUIT</th>
            <th class="center">QUANTITÉ</th>
            <th class="num">PRIX UNIT. HT</th>
            <th class="num">TOTAL HT</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map((item: any) => `
            <tr>
              <td>${item.productName}</td>
              <td class="center">${Number(item.quantity).toFixed(3)} ${item.unit || 'unité'}</td>
              <td class="num">${Number(item.unitPrice).toFixed(2)} MAD</td>
              <td class="num"><b>${Number(item.total).toFixed(2)} MAD</b></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="box">
          <div class="row"><span><b>Sous-total HT</b></span><span>${Number(order.subtotal).toFixed(2)} MAD</span></div>
          ${order.totalVat > 0 ? `<div class="row"><span><b>TVA</b></span><span>${Number(order.totalVat).toFixed(2)} MAD</span></div>` : ''}
          <div class="row grand"><span>TOTAL TTC</span><span>${Number(order.totalTTC).toFixed(2)} MAD</span></div>
        </div>
      </div>

      <div class="signatures">
        <div class="sign"><div class="t">Signature Client</div><div class="s">Bon pour accord</div></div>
        <div class="sign"><div class="t">Signature Livreur</div><div class="s">Date et heure</div></div>
      </div>
    </div>

    <div class="footer">
      <b>${companyName}</b>
      ${companyAddress ? ` | ${companyAddress}` : ''}
      ${companyPhone ? ` | Tél: ${companyPhone}` : ''}
      ${companyEmail ? ` | Email: ${companyEmail}` : ''}
      ${companyIce ? ` | ICE: ${companyIce}` : ''}
      ${companyIf ? ` | IF: ${companyIf}` : ''}
      ${companyRc ? ` | RC: ${companyRc}` : ''}
      ${companyPatente ? ` | Patente: ${companyPatente}` : ''}
    </div>
  </div>
</body>
</html>`;
  };

  const getTotalQuantity = () =>
    order.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Commande {order.number}</h1>
            <p className="text-gray-600 dark:text-gray-300">Détails et bon de livraison</p>
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
            onClick={handlePrintDeliveryNote}
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

      {/* Infos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Commande */}
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
              <div className="mt-1">{getStatusBadge(order.status)}</div>
            </div>
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Stock débité:</span>
              <p className={`font-medium ${order.stockDebited ? 'text-red-600' : 'text-green-600'}`}>
                {order.stockDebited ? 'Oui' : 'Non'}
              </p>
            </div>
          </div>
        </div>

        {/* Client */}
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
                    {Number(item.quantity).toFixed(3)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {Number(item.unitPrice).toFixed(2)} MAD
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {item.vatRate}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {Number(item.total).toFixed(2)} MAD
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
