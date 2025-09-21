// src/components/orders/OrderDetail.tsx
import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useOrder } from '../../contexts/OrderContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft,
  Printer,
  Download,
  Edit,
  Package,
  DollarSign,
  Building2,
  Phone,
  Mail,
  MapPin,
  User
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
    if (order.clientType === 'personne_physique') {
      return order.clientName || 'Client particulier';
    } else {
      return order.client?.name || 'Client société';
    }
  };

  const handlePrintDeliveryNote = () => {
    const deliveryNoteContent = generateDeliveryNoteHTML();
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(deliveryNoteContent);
      w.document.close();
      w.focus();
      w.print();
    }
  };

  const handleDownloadPDF = () => {
    const deliveryNoteContent = generateDeliveryNoteHTML();

    const options = {
      margin: [10, 10, 10, 10],
      filename: `Bon_Livraison_${order.number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true, // pour charger logo/images externes sans “taint”
        imageTimeout: 15000,
        backgroundColor: '#ffffff',
        logging: false
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      }
    } as const;

    // Important: capture depuis la chaîne HTML (pas un nœud caché)
    html2pdf()
      .set(options)
      .from(deliveryNoteContent)
      .save()
      .catch((err: unknown) => {
        console.error('Erreur lors de la génération du PDF:', err);
        alert('Erreur lors de la génération du PDF');
      });
  };

  const generateDeliveryNoteHTML = () => {
    // why: éviter CORS cassé → utiliser logo via URL avec header CORS ; sinon fallback texte
    const logoUrl = (user as any)?.company?.logoUrl || '';
    const companyName = user?.company?.name || '';
    const companyAddress = user?.company?.address || '';
    const companyPhone = user?.company?.phone || '';
    const companyEmail = user?.company?.email || '';
    const companyIce = (user as any)?.company?.ice || '';
    const companyIf = (user as any)?.company?.if || '';
    const companyRc = (user as any)?.company?.rc || '';
    const companyPatente = (user as any)?.company?.patente || '';

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Bon de Livraison ${order.number}</title>
  <style>
    :root{
      --primary:#2563eb;        /* bleu */
      --primary-600:#1e40af;
      --ink:#0f172a;
      --muted:#64748b;
      --border:#e5e7eb;
      --bg:#ffffff;
      --muted-bg:#f8fafc;
      --accent:#eef2ff;
      --success:#16a34a;
    }

    @page { size: A4; margin: 12mm; }
    html,body { background: var(--bg); padding:0; margin:0; }
    body {
      font: 12px/1.5 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
      color: var(--ink);
    }

    /* A4 wrapper */
    .sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      box-sizing: border-box;
      position: relative;
      background: #fff;
    }
    .content {
      padding: 12mm;
    }

    /* header */
    .header{
      display:flex;
      align-items:center;
      gap:16px;
      border-bottom: 2px solid var(--primary);
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .logo{
      width: 48px; height: 48px; object-fit: contain;
    }
    .brand{
      display:flex; flex-direction:column; gap:2px;
    }
    .brand-name{
      font-weight:700; font-size:18px; letter-spacing:.3px;
    }
    .brand-meta{
      color:var(--muted); font-size:11px;
    }

    .title{
      text-align:center;
      font-weight:800;
      color: var(--primary);
      font-size:22px;
      letter-spacing:.6px;
      margin: 4px 0 10px 0;
    }

    /* cards */
    .grid-2{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
    .card{
      border: 1px solid var(--border);
      border-radius:8px;
      background: var(--muted-bg);
      padding:10px 12px;
    }
    .card.order{ background:#f0f7ff; border-color:#bfdbfe; }
    .card h3{
      margin:0 0 6px 0; font-size:12px; letter-spacing:.3px; color:#111827;
    }
    .kv{ margin:2px 0; font-size:12px; }
    .kv b{ color:#111827; }
    .muted{ color:var(--muted); font-style:italic; }

    /* table */
    table{ width:100%; border-collapse: collapse; margin-top:10px; }
    th, td { border: 1px solid var(--border); padding:8px; }
    thead th {
      background: #f3f4f6; font-weight:700; font-size:12px;
    }
    td.num, th.num { text-align:right; white-space:nowrap; }
    td.center, th.center { text-align:center; }
    tbody tr:nth-child(even){ background:#fafafa; }

    /* totals */
    .totals{
      margin-top:12px; display:flex; justify-content:flex-end;
    }
    .totals .box{
      width: 60%; max-width: 280px;
    }
    .totals .row{
      display:flex; justify-content:space-between; padding:4px 0; font-size:12px;
    }
    .totals .grand{
      color: var(--primary); font-weight:800; font-size:14px; padding-top:6px; border-top:1px dashed var(--border);
    }

    /* signatures */
    .signatures{
      margin-top:18px; display:grid; grid-template-columns: 1fr 1fr; gap:16px;
    }
    .sign-box{
      height: 90px; border:2px solid #d1d5db; border-radius:6px; text-align:center; padding:10px;
    }
    .sign-title{ font-weight:700; margin:0; }
    .sign-sub{ margin:6px 0 0 0; font-size:11px; color:var(--muted); }

    /* footer */
    .footer{
      position:absolute; left:12mm; right:12mm; bottom:12mm;
      border-top:1px solid var(--border);
      padding-top:8px; text-align:center; color:#334155; font-size:10px;
    }

    /* helpers */
    .status{
      display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600;
      background:#dcfce7; color:#166534;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="content">
      <div class="header">
        ${
          logoUrl
            ? `<img src="${logoUrl}" alt="Logo" class="logo" crossorigin="anonymous" referrerpolicy="no-referrer" />`
            : `<div style="width:48px;height:48px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--primary)">${
                (companyName || 'SOCIETE').trim().slice(0,2).toUpperCase()
              }</div>`
        }
        <div class="brand">
          <div class="brand-name">${companyName || ''}</div>
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
            order.status === 'livre' ? 'Livré' : order.status === 'en_cours_livraison' ? 'En cours' : 'Annulé'
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
        <div class="sign-box">
          <p class="sign-title">Signature Client</p>
          <p class="sign-sub">Bon pour accord</p>
        </div>
        <div class="sign-box">
          <p class="sign-title">Signature Livreur</p>
          <p class="sign-sub">Date et heure</p>
        </div>
      </div>

      <div class="footer">
        <b>${companyName || ''}</b>
        ${companyAddress ? ` | ${companyAddress}` : ''}
        ${companyPhone ? ` | Tél: ${companyPhone}` : ''}
        ${companyEmail ? ` | Email: ${companyEmail}` : ''}
        ${companyIce ? ` | ICE: ${companyIce}` : ''}
        ${companyIf ? ` | IF: ${companyIf}` : ''}
        ${companyRc ? ` | RC: ${companyRc}` : ''}
        ${companyPatente ? ` | Patente: ${companyPatente}` : ''}
      </div>
    </div>
  </div>
</body>
</html>
    `;
  };

  const getTotalQuantity = () => {
    return order.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
  };

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
