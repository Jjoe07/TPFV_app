// =========================================================================
// FICHIER : inventaire.js
// Rôle : Gestion complète de la page Inventaire (Accès restreint aux Admins)
// =========================================================================

let tousLesProduits = [];
let produitsFiltresGlobaux = [];
let pageActuelleInventaire = 1;
const produitsParPage = 20;
let roleActuel = '';

// --- 1. VÉRIFICATION DE SÉCURITÉ ET RÔLE AU CHARGEMENT ---
window.addEventListener('DOMContentLoaded', () => {
    roleActuel = localStorage.getItem('sessionCliniqueRole');

    // VERROUILLAGE SÉCURITÉ : SI PAS ADMIN, REDIRECTION IMMÉDIATE
    if (!roleActuel || roleActuel === 'agent' || roleActuel === 'support') {
        alert("⛔ Accès refusé : L'inventaire de la pharmacie est réservé à l'Administrateur.");
        window.location.href = 'index.html';
        return;
    }

    // Gestion du thème
    const themeSauvegarde = localStorage.getItem('themeClinique');
    const btnTheme = document.getElementById('btn-theme');
    if (themeSauvegarde === 'sombre') {
        document.body.classList.add('dark-theme');
        if (btnTheme) btnTheme.innerText = '☀️ Mode Clair';
    }

    // Initialisation des écouteurs de formulaires
    initialiserEcouteursInventaire();
    chargerInventaire();
});

function basculerTheme() {
    document.body.classList.toggle('dark-theme');
    const estSombre = document.body.classList.contains('dark-theme');
    localStorage.setItem('themeClinique', estSombre ? 'sombre' : 'clair');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.innerText = estSombre ? '☀️ Mode Clair' : '🌙 Mode Sombre';
}

function seDeconnecter() {
    localStorage.removeItem('sessionCliniqueRole');
    window.location.href = 'index.html';
}

function formaterAriary(montant) {
    return new Intl.NumberFormat('fr-FR').format(Math.round(montant || 0)) + ' Ar';
}

function formaterDateEtAge(dateString) {
    if (!dateString) return 'Non renseignée';
    const parties = dateString.split('-');
    if (parties.length !== 3) return dateString;
    const [annee, mois, jour] = parties;
    return `${jour.padStart(2, '0')}/${mois.padStart(2, '0')}/${annee}`;
}

function afficherAlerte(titre, message, type = 'info') {
    return new Promise((resolve) => {
        const anciennesAlertes = document.querySelectorAll('.overlay-alerte');
        anciennesAlertes.forEach(a => a.remove());

        const overlay = document.createElement('div');
        overlay.className = 'overlay-alerte';
        let icone = type === 'succes' ? '✅' : (type === 'erreur' ? '❌' : 'ℹ️');
        
        overlay.innerHTML = `
            <div class="boite-alerte">
                <span class="icone-alerte">${icone}</span>
                <h3>${titre}</h3>
                <p>${message}</p>
                <button class="btn-alerte">D'accord</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        const bouton = overlay.querySelector('.btn-alerte');
        bouton.focus();
        bouton.addEventListener('click', () => {
            overlay.remove();
            resolve();
        });
    });
}

// --- 2. CHARGEMENT ET FILTRAGE ---
async function chargerInventaire() {
    try {
        const reponse = await fetch('/api/inventaire');
        if (!reponse.ok) return;
        tousLesProduits = await reponse.json();
        filtrerInventaire();
    } catch (e) {}
}

function filtrerInventaire() {
    const terme = (document.getElementById('recherche-inventaire')?.value || '').toLowerCase().trim();
    const etat = document.getElementById('filtre-etat-stock')?.value || 'tous';
    const aujourdhui = new Date();

    produitsFiltresGlobaux = tousLesProduits.filter(p => {
        const nom = (p.nom_medicament || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const correspondNom = !terme || nom.includes(terme) || desc.includes(terme);

        if (!correspondNom) return false;

        const reste = p.quantite || 0;
        const seuil = p.seuil_alerte || 5;

        let joursAvantDP = 999;
        if (p.date_peremption) {
            const dpDate = new Date(p.date_peremption);
            joursAvantDP = Math.ceil((dpDate - aujourdhui) / (1000 * 60 * 60 * 24));
        }

        if (etat === 'alerte') return reste <= seuil;
        if (etat === 'peremption') return joursAvantDP <= 60;
        if (etat === 'normal') return reste > seuil && joursAvantDP > 60;

        return true;
    });

    pageActuelleInventaire = 1;
    afficherInventaire(produitsFiltresGlobaux);
}

function afficherInventaire(liste) {
    const corps = document.getElementById('corpsTableauInventaire');
    const paginationElement = document.getElementById('pagination-inventaire');
    if (!corps) return;
    corps.innerHTML = '';
    if (paginationElement) paginationElement.innerHTML = '';

    let totalArticles = tousLesProduits.length;
    let valeurTotaleStock = 0;
    let nbRuptures = 0;
    let nbPeremptions = 0;

    const aujourdhui = new Date();

    tousLesProduits.forEach(p => {
        const reste = p.quantite || 0;
        const pu = p.prix_unitaire || 0;
        valeurTotaleStock += (reste * pu);

        if (reste <= (p.seuil_alerte || 5)) nbRuptures++;

        if (p.date_peremption) {
            const dpDate = new Date(p.date_peremption);
            const jours = Math.ceil((dpDate - aujourdhui) / (1000 * 60 * 60 * 24));
            if (jours <= 60) nbPeremptions++;
        }
    });

    const badgeTotal = document.getElementById('total-inventaire-badge');
    if (badgeTotal) badgeTotal.innerText = liste.length;

    document.getElementById('kpi-total-articles').innerText = totalArticles;
    document.getElementById('kpi-valeur-stock').innerText = formaterAriary(valeurTotaleStock);
    document.getElementById('kpi-ruptures').innerText = nbRuptures;
    document.getElementById('kpi-peremptions').innerText = nbPeremptions;

    if (liste.length === 0) {
        corps.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--texte-clair); padding: 25px;">Aucun produit ne correspond à votre recherche.</td></tr>`;
        return;
    }

    const totalPages = Math.ceil(liste.length / produitsParPage);
    if (pageActuelleInventaire > totalPages) pageActuelleInventaire = totalPages;
    if (pageActuelleInventaire < 1) pageActuelleInventaire = 1;

    const debut = (pageActuelleInventaire - 1) * produitsParPage;
    const fin = Math.min(debut + produitsParPage, liste.length);
    const produitsDeLaPage = liste.slice(debut, fin);

    produitsDeLaPage.forEach(p => {
        const tr = document.createElement('tr');
        const reste = p.quantite || 0;
        const seuil = p.seuil_alerte || 5;
        const pu = p.prix_unitaire || 0;
        const valeurLigne = reste * pu;

        let badgeStockClass = 'badge-stock-normal';
        if (reste === 0) badgeStockClass = 'badge-stock-rupture';
        else if (reste <= seuil) badgeStockClass = 'badge-stock-alerte';

        let badgeDP = 'Non renseignée';
        let badgeDPClass = 'badge-dp-ok';
        if (p.date_peremption) {
            const dpDate = new Date(p.date_peremption);
            const jours = Math.ceil((dpDate - aujourdhui) / (1000 * 60 * 60 * 24));
            const dateStr = formaterDateEtAge(p.date_peremption);

            if (jours <= 0) {
                badgeDP = `⚠️ Expiré (${dateStr})`;
                badgeDPClass = 'badge-dp-expire';
            } else if (jours <= 60) {
                badgeDP = `⏳ Expire bientot (${dateStr})`;
                badgeDPClass = 'badge-dp-alerte';
            } else {
                badgeDP = `🟢 ${dateStr}`;
                badgeDPClass = 'badge-dp-ok';
            }
        }

        tr.innerHTML = `
            <td>
                <strong>${p.nom_medicament}</strong>
                ${p.description ? `<br><small style="color: var(--texte-clair);">${p.description}</small>` : ''}
            </td>
            <td><span class="${badgeDPClass}">${badgeDP}</span></td>
            <td><strong>${p.stock_initial || 0}</strong></td>
            <td style="color: var(--vert-soin); font-weight: bold;">+${p.entrees || 0}</td>
            <td style="color: #DC2626; font-weight: bold;">-${p.sorties || 0}</td>
            <td><span class="${badgeStockClass}">${reste}</span></td>
            <td>${formaterAriary(pu)}</td>
            <td><strong>${formaterAriary(valeurLigne)}</strong></td>
            <td style="text-align: center; white-space: nowrap;">
                <button onclick="ouvrirModalMouvement(${p.id}, 'entrée')" class="btn-mouv vert" title="Réapprovisionnement">+ Entrée</button>
                <button onclick="ouvrirModalMouvement(${p.id}, 'sortie')" class="btn-mouv rouge" title="Sortie/Vente">- Sortie</button>
                <button onclick="ouvrirModalEditionProduit(${p.id})" class="btn-inv-icon" title="Modifier la fiche">✏️</button>
                <button onclick="supprimerProduit(${p.id})" class="btn-inv-icon rouge" title="Supprimer le produit">🗑️</button>
            </td>
        `;

        corps.appendChild(tr);
    });

    if (totalPages > 1 && paginationElement) {
        paginationElement.innerHTML = `
            <button class="btn-page" onclick="changerPageInventaire(-1)" ${pageActuelleInventaire === 1 ? 'disabled' : ''}>Précédent</button>
            <span>Page ${pageActuelleInventaire} / ${totalPages}</span>
            <button class="btn-page" onclick="changerPageInventaire(1)" ${pageActuelleInventaire === totalPages ? 'disabled' : ''}>Suivant</button>
        `;
    }
}

function changerPageInventaire(dir) {
    pageActuelleInventaire += dir;
    afficherInventaire(produitsFiltresGlobaux);
}

// --- 3. GESTION DES MODALES ET FORMULAIRES ---
function initialiserEcouteursInventaire() {
    const formInv = document.getElementById('formProduitInventaire');
    if (formInv) {
        formInv.addEventListener('submit', async function(e) {
            e.preventDefault();
            const id = document.getElementById('inv_id').value;
            const produit = {
                nom_medicament: document.getElementById('inv_nom').value,
                date_peremption: document.getElementById('inv_dp').value,
                prix_unitaire: parseFloat(document.getElementById('inv_prix').value) || 0,
                stock_initial: parseInt(document.getElementById('inv_stock_init').value, 10) || 0,
                seuil_alerte: parseInt(document.getElementById('inv_seuil').value, 10) || 5,
                entrees: parseInt(document.getElementById('inv_entrees').value, 10) || 0,
                sorties: parseInt(document.getElementById('inv_sorties').value, 10) || 0,
                description: document.getElementById('inv_desc').value
            };

            const url = id ? `/api/inventaire/${id}` : '/api/inventaire';
            const methode = id ? 'PUT' : 'POST';

            try {
                const reponse = await fetch(url, {
                    method: methode,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(produit)
                });

                if (reponse.ok) {
                    await afficherAlerte("Succès", id ? "Produit mis à jour !" : "Produit ajouté !", "succes");
                    fermerModalInventaire();
                    chargerInventaire();
                }
            } catch (erreur) {
                await afficherAlerte("Erreur réseau", "Connexion interrompue.", "erreur");
            }
        });
    }

    const formMouv = document.getElementById('formMouvementStock');
    if (formMouv) {
        formMouv.addEventListener('submit', async function(e) {
            e.preventDefault();
            const id = document.getElementById('mouv_id').value;
            const type = document.getElementById('mouv_type').value;
            const qte = parseInt(document.getElementById('mouv_quantite').value, 10) || 0;

            try {
                const reponse = await fetch(`/api/inventaire/${id}/mouvement`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: type, quantite_mouvement: qte })
                });

                if (reponse.ok) {
                    await afficherAlerte("Succès", `Mouvement enregistré (${type} de ${qte}) !`, "succes");
                    fermerModalMouvement();
                    chargerInventaire();
                }
            } catch (erreur) {
                await afficherAlerte("Erreur réseau", "Connexion interrompue.", "erreur");
            }
        });
    }
}

function ouvrirModalAjoutProduit() {
    document.getElementById('formProduitInventaire').reset();
    document.getElementById('inv_id').value = '';
    document.getElementById('titre-modal-inv').innerText = "➕ Ajouter un Nouveau Produit";
    const modal = document.getElementById('modal-inventaire');
    if (modal) modal.classList.remove('section-cachee');
}

function ouvrirModalEditionProduit(id) {
    const p = tousLesProduits.find(item => item.id === id);
    if (!p) return;

    document.getElementById('inv_id').value = p.id;
    document.getElementById('inv_nom').value = p.nom_medicament || '';
    document.getElementById('inv_dp').value = p.date_peremption || '';
    document.getElementById('inv_prix').value = p.prix_unitaire || 0;
    document.getElementById('inv_stock_init').value = p.stock_initial || 0;
    document.getElementById('inv_seuil').value = p.seuil_alerte || 5;
    document.getElementById('inv_entrees').value = p.entrees || 0;
    document.getElementById('inv_sorties').value = p.sorties || 0;
    document.getElementById('inv_desc').value = p.description || '';

    document.getElementById('titre-modal-inv').innerText = "✏️ Modifier le Produit";
    const modal = document.getElementById('modal-inventaire');
    if (modal) modal.classList.remove('section-cachee');
}

function fermerModalInventaire() {
    const modal = document.getElementById('modal-inventaire');
    if (modal) modal.classList.add('section-cachee');
}

function ouvrirModalMouvement(id, type) {
    const p = tousLesProduits.find(item => item.id === id);
    if (!p) return;

    document.getElementById('mouv_id').value = p.id;
    document.getElementById('mouv_type').value = type;
    document.getElementById('mouv_quantite').value = 1;
    document.getElementById('mouv_nom_produit').innerText = `${p.nom_medicament} (Reste actuel : ${p.quantite || 0})`;

    const btnValider = document.getElementById('btn-valider-mouvement');
    if (type === 'entrée') {
        document.getElementById('titre-modal-mouvement').innerText = "📥 Réapprovisionnement (+ Entrée)";
        document.getElementById('label_quantite_mouv').innerText = "Quantité à ajouter au stock";
        btnValider.style.backgroundColor = "var(--vert-soin)";
    } else {
        document.getElementById('titre-modal-mouvement').innerText = "📤 Vente / Sortie de Stock (- Sortie)";
        document.getElementById('label_quantite_mouv').innerText = "Quantité à retirer du stock";
        btnValider.style.backgroundColor = "#DC2626";
    }

    const modal = document.getElementById('modal-mouvement-stock');
    if (modal) modal.classList.remove('section-cachee');
}

function fermerModalMouvement() {
    const modal = document.getElementById('modal-mouvement-stock');
    if (modal) modal.classList.add('section-cachee');
}

async function supprimerProduit(id) {
    if (confirm("⚠️ Êtes-vous sûr de vouloir supprimer définitivement ce produit ?")) {
        try {
            const reponse = await fetch(`/api/inventaire/${id}`, { method: 'DELETE' });
            if (reponse.ok) {
                await afficherAlerte("Supprimé", "Produit retiré du stock.", "succes");
                chargerInventaire();
            }
        } catch (e) {
            await afficherAlerte("Erreur", "Connexion interrompue.", "erreur");
        }
    }
}

// --- 4. IMPRESSION RAPPORT PDF A4 ---
function imprimerRapportInventaireA4() {
    let totalArticles = tousLesProduits.length;
    let valeurTotaleStock = 0;

    let lignesHTML = '';
    tousLesProduits.forEach((p, idx) => {
        const reste = p.quantite || 0;
        const pu = p.prix_unitaire || 0;
        const val = reste * pu;
        valeurTotaleStock += val;

        const dpStr = p.date_peremption ? formaterDateEtAge(p.date_peremption) : 'N/A';

        lignesHTML += `
            <tr style="border-bottom: 1px solid #CBD5E1; font-size: 11px;">
                <td style="padding: 6px;">${idx + 1}</td>
                <td style="padding: 6px; overflow-wrap: anywhere; word-break: break-all;"><strong>${p.nom_medicament}</strong></td>
                <td style="padding: 6px; text-align: center;">${dpStr}</td>
                <td style="padding: 6px; text-align: center;">${p.stock_initial || 0}</td>
                <td style="padding: 6px; text-align: center; color: #0D9488; font-weight: bold;">+${p.entrees || 0}</td>
                <td style="padding: 6px; text-align: center; color: #DC2626; font-weight: bold;">-${p.sorties || 0}</td>
                <td style="padding: 6px; text-align: center; font-weight: bold;">${reste}</td>
                <td style="padding: 6px; text-align: right;">${formaterAriary(pu)}</td>
                <td style="padding: 6px; text-align: right; font-weight: bold;">${formaterAriary(val)}</td>
            </tr>
        `;
    });

    const fenetre = window.open('', '_blank');
    if (!fenetre) return alert("Veuillez autoriser les fenêtres surgissantes.");

    fenetre.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Rapport_Inventaire_TPFV_${new Date().toISOString().slice(0,10)}</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { font-family: Arial, Helvetica, sans-serif; color: #0F172A; background-color: #525659; margin: 0; padding: 20px 0; display: flex; flex-direction: column; align-items: center; }
                .barre-outils-pdf { position: fixed; top: 0; left: 0; right: 0; background: #1E293B; color: white; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10000; }
                .btn-pdf { background: #0284C7; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; }
                .page-a4 { background: #FFFFFF; width: 210mm; min-height: 297mm; padding: 15mm; box-sizing: border-box; margin-top: 50px; }
                @media print { .barre-outils-pdf { display: none !important; } body { background: white; padding: 0; } .page-a4 { width: 100%; margin: 0; padding: 0; } }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                td, th { vertical-align: middle; word-break: break-word; }
            </style>
        </head>
        <body>
            <div class="barre-outils-pdf">
                <span>📊 <strong>Rapport d'Inventaire Pharmacie TPFV</strong></span>
                <div>
                    <button class="btn-pdf" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>
                    <button class="btn-pdf" style="background: #64748B; margin-left: 8px;" onclick="window.close()">❌ Fermer</button>
                </div>
            </div>
            <div class="page-a4">
                <table style="border-bottom: 2px solid #0284C7; padding-bottom: 8px; margin-bottom: 15px;">
                    <tr>
                        <td style="width: 65%;">
                            <h1 style="color: #0284C7; margin: 0; font-size: 22px; font-weight: 800;">🏥 TPFV</h1>
                            <p style="margin: 4px 0 0 0; color: #475569; font-size: 11px; font-weight: 700;">Toeram - Pitsaboana Fanantenan'ny Vononkandresy III Jaona 2</p>
                        </td>
                        <td style="width: 35%; text-align: right; font-size: 11px; color: #475569;">
                            <p style="margin: 0;"><strong>RAPPORT DE VALORISATION</strong></p>
                            <p style="margin: 4px 0 0 0;">Date : ${new Date().toLocaleDateString('fr-FR')}</p>
                        </td>
                    </tr>
                </table>
                <div style="background: #F0F9FF; border: 1px solid #BAE6FD; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 12px; display: flex; justify-content: space-between;">
                    <span>Total Références : <strong>${totalArticles}</strong></span>
                    <span>Valorisation Totale du Stock : <strong style="color: #0D9488;">${formaterAriary(valeurTotaleStock)}</strong></span>
                </div>
                <table>
                    <thead>
                        <tr style="background: #0284C7; color: #FFFFFF; font-size: 10px; text-align: left;">
                            <th style="padding: 6px; width: 5%;">#</th>
                            <th style="padding: 6px; width: 30%;">Désignation</th>
                            <th style="padding: 6px; width: 12%; text-align: center;">DP</th>
                            <th style="padding: 6px; width: 8%; text-align: center;">Init.</th>
                            <th style="padding: 6px; width: 8%; text-align: center;">Ent.</th>
                            <th style="padding: 6px; width: 8%; text-align: center;">Sor.</th>
                            <th style="padding: 6px; width: 9%; text-align: center;">Reste</th>
                            <th style="padding: 6px; width: 10%; text-align: right;">P.U</th>
                            <th style="padding: 6px; width: 10%; text-align: right;">Valeur</th>
                        </tr>
                    </thead>
                    <tbody>${lignesHTML}</tbody>
                </table>
            </div>
        </body>
        </html>
    `);
    fenetre.document.close();
}