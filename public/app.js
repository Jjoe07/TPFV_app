// =========================================================================
// FICHIER : public/app.js (Lecture directe du code_personnel persistant)
// =========================================================================
let tousLesPatients = [];
let patientsFiltresGlobaux = [];
let pageActuelle = 1;
let roleActuel = '';
const patientsParPage = 5;

let tousLesArticles = [];
let articlesFiltresGlobaux = [];
let pageActuelleInventaire = 1;
const articlesParPage = 10;
let articleEnEdition = null;

let tousLesEmployes = [];
let personnelFiltreGlobal = [];
let pageActuellePersonnel = 1;
const personnelParPage = 10;
let employeEnEdition = null;
let employePaiementActuel = null;

// --- 1. UTILITIES ---
function basculerTheme() { 
    document.body.classList.toggle('dark-theme'); 
    localStorage.setItem('themeClinique', document.body.classList.contains('dark-theme') ? 'sombre' : 'clair'); 
}

function afficherAlerte(titre, message, type = 'info') {
    return new Promise(resolve => {
        document.querySelectorAll('.overlay-alerte').forEach(a => a.remove());
        const overlay = document.createElement('div'); 
        overlay.className = 'overlay-alerte';
        let icone = type === 'succes' ? '✅' : (type === 'erreur' ? '❌' : 'ℹ️');
        overlay.innerHTML = `<div class="boite-alerte"><span style="font-size:30px;display:block;margin-bottom:8px;">${icone}</span><h3>${titre}</h3><p>${message}</p><button class="btn-alerte">D'accord</button></div>`;
        document.body.appendChild(overlay); 
        const btn = overlay.querySelector('.btn-alerte'); 
        btn.focus(); 
        btn.addEventListener('click', () => { overlay.remove(); resolve(); });
    });
}

function formaterDateEnLettres(dateString) {
    if (!dateString || dateString.trim() === '') return 'Non renseignée';
    let year, month, day;
    if (dateString.includes('-')) {
        const parties = dateString.split('-');
        if (parties.length === 3) [year, month, day] = parties;
    } else if (dateString.includes('/')) {
        const parties = dateString.split('/');
        if (parties.length === 3) [day, month, year] = parties;
    }
    if (!year || !month || !day) return dateString;

    const moisComplets = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    const indexMois = parseInt(month, 10) - 1;
    if (indexMois >= 0 && indexMois < 12) {
        return `${parseInt(day, 10).toString().padStart(2, '0')} ${moisComplets[indexMois]} ${year}`;
    }
    return dateString;
}

// --- 2. FILTRAGE DYNAMIQUE DES SERVICES ---
function filtrerServicesParType(selectId, nomChamp) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    const val = (selectEl.value || '').toLowerCase();
    
    let categorieCible = '1';
    if (val.includes('2') || val.includes('spécialisée')) {
        categorieCible = '2';
    } else if (val.includes('3') || val.includes('spécialiste')) {
        categorieCible = '3';
    } else if (val.includes('4') || val.includes('autres')) {
        categorieCible = '4';
    }

    document.querySelectorAll(`input[name="${nomChamp}"]`).forEach(cb => {
        const labelCard = cb.closest('.service-checkbox-card');
        const cat = cb.dataset.category;
        
        if (cat === categorieCible) {
            if (labelCard) labelCard.style.display = 'flex';
        } else {
            if (labelCard) labelCard.style.display = 'none';
        }
    });
}

function gererChangementTypeConsultation(selectId, blocRdvId, nomChampServices) {
    gererAffichageRdvSpecialiste(selectId, blocRdvId);
    filtrerServicesParType(selectId, nomChampServices);
}

function gererAffichageRdvSpecialiste(selectId, blocId) {
    const selectEl = document.getElementById(selectId);
    const blocEl = document.getElementById(blocId);
    if (selectEl && blocEl) {
        const val = (selectEl.value || '').toLowerCase();
        if (val.includes('rendez-vous') || val.includes('spécialiste') || val.includes('3')) {
            blocEl.style.display = 'grid';
            const inputDateId = selectId === 'type_consultation' ? 'date_rdv_specialiste' : 'edit_date_rdv_specialiste';
            const inputHeureId = selectId === 'type_consultation' ? 'heure_rdv_specialiste' : 'edit_heure_rdv_specialiste';
            const inputDate = document.getElementById(inputDateId);
            const inputHeure = document.getElementById(inputHeureId);
            if (inputDate && !inputDate.value) inputDate.value = new Date().toISOString().slice(0, 10);
            if (inputHeure && !inputHeure.value) inputHeure.value = "09:00";
        } else {
            blocEl.style.display = 'none';
        }
    }
}

function obtenirServicesCoches(nomChamp) {
    const checkboxes = document.querySelectorAll(`input[name="${nomChamp}"]:checked`);
    return Array.from(checkboxes).map(cb => cb.value).join(', ');
}

function cocherServicesSpecifiques(nomChamp, valeursChaine) {
    const listeValeurs = (valeursChaine || '').split(', ').map(s => s.trim());
    document.querySelectorAll(`input[name="${nomChamp}"]`).forEach(cb => {
        cb.checked = listeValeurs.includes(cb.value);
    });
}

function afficherCategorieAnalyse(selectId, conteneurId) {
    const select = document.getElementById(selectId);
    const conteneur = document.getElementById(conteneurId);
    if (!select || !conteneur) return;

    const categories = conteneur.querySelectorAll('.categorie-analyses');
    categories.forEach(cat => cat.classList.remove('active'));

    const valeurChoisie = select.value;
    if (valeurChoisie) {
        const suffixe = selectId.includes('creation') ? '_creation' : '_edition';
        const blocId = valeurChoisie + suffixe;
        const blocAAfficher = document.getElementById(blocId);
        if (blocAAfficher) {
            blocAAfficher.classList.add('active');
        }
    }
}

function obtenirAnalysesCochees(nomChamp) {
    const checkboxes = document.querySelectorAll(`input[name="${nomChamp}"]:checked`);
    return Array.from(checkboxes).map(cb => cb.value);
}

function cocherAnalyses(nomChamp, tableauValeurs) {
    document.querySelectorAll(`input[name="${nomChamp}"]`).forEach(cb => {
        cb.checked = tableauValeurs.includes(cb.value);
    });
}

function gererCocheUniqueHospit(nomGroupe, elementCoche) {
    if (elementCoche.checked) {
        document.querySelectorAll(`input[name="${nomGroupe}"]`).forEach(cb => {
            if (cb !== elementCoche) cb.checked = false;
        });
    }
}

function obtenirStatutHospitCoche(nomGroupe) {
    const cb = document.querySelector(`input[name="${nomGroupe}"]:checked`);
    return cb ? cb.value : '02 - Non';
}

function cocherHospitStatut(nomGroupe, valeur) {
    const val = (valeur || '02 - Non').trim();
    document.querySelectorAll(`input[name="${nomGroupe}"]`).forEach(cb => {
        cb.checked = (cb.value === val);
    });
}

// --- 3. GESTION DU PAIEMENT PATIENT ---
function gererCocheUniqueStatut(nomGroupe, elementCoche) {
    if (elementCoche.checked) {
        document.querySelectorAll(`input[name="${nomGroupe}"]`).forEach(cb => {
            if (cb !== elementCoche) cb.checked = false;
        });
    }
}

function obtenirStatutPaiementCoche(nomGroupe) {
    const cb = document.querySelector(`input[name="${nomGroupe}"]:checked`);
    return cb ? cb.value : 'Non payé';
}

function cocherStatutPaiement(nomGroupe, valeur) {
    const val = (valeur || 'Non payé').trim();
    document.querySelectorAll(`input[name="${nomGroupe}"]`).forEach(cb => {
        cb.checked = (cb.value === val);
    });
}

// --- 4. FACTURATION MÉDICAMENTS ---
function ajouterLigneMedicament(conteneurId, nom = '', quantite = 1, prix = 0) {
    const conteneur = document.getElementById(conteneurId);
    if (!conteneur) return;

    const divLigne = document.createElement('div');
    divLigne.className = 'ligne-medicament-item';
    divLigne.style.display = 'grid';
    divLigne.style.gridTemplateColumns = '2.2fr 0.8fr 1.1fr 1.1fr auto';
    divLigne.style.gap = '6px';
    divLigne.style.alignItems = 'center';
    divLigne.style.width = '100%';
    divLigne.style.boxSizing = 'border-box';

    const totalLigneInitial = (parseFloat(quantite) || 0) * (parseFloat(prix) || 0);

    divLigne.innerHTML = `
        <input type="text" class="input-med-nom" list="suggestions-medicaments" placeholder="Nom du médicament" value="${nom}" style="width:100%; min-width:0; padding:6px; border:1px solid #CBD5E1; border-radius:6px; font-size:12px; box-sizing:border-box;" required>
        <input type="number" class="input-med-qte" placeholder="Qté" value="${quantite}" min="1" style="width:100%; min-width:0; padding:6px; border:1px solid #CBD5E1; border-radius:6px; font-size:12px; box-sizing:border-box;" required>
        <input type="number" class="input-med-prix" placeholder="Prix (Ar)" value="${prix}" min="0" readonly style="width:100%; min-width:0; padding:6px; border:1px solid #E2E8F0; background:#F1F5F9; color:#64748B; border-radius:6px; font-size:12px; box-sizing:border-box; cursor:not-allowed;" required>
        <input type="text" class="input-med-total" value="${totalLigneInitial.toLocaleString('fr-FR')} Ar" readonly style="width:100%; min-width:0; padding:6px; border:1px solid #E2E8F0; background:#F1F5F9; border-radius:6px; font-size:12px; font-weight:bold; color:#0F172A; text-align:right; box-sizing:border-box;">
        <button type="button" onclick="supprimerLigneMedicament(this, '${conteneurId}')" style="background:#EF4444; color:white; border:none; padding:6px 8px; border-radius:6px; cursor:pointer; font-weight:bold; flex-shrink:0;">🗑️</button>
    `;

    conteneur.appendChild(divLigne);

    const inputNom = divLigne.querySelector('.input-med-nom');
    const inputQte = divLigne.querySelector('.input-med-qte');
    const inputPrix = divLigne.querySelector('.input-med-prix');

    const recalculer = () => {
        const qte = parseFloat(inputQte.value) || 0;
        const p = parseFloat(inputPrix.value) || 0;
        const tot = qte * p;
        divLigne.querySelector('.input-med-total').value = `${tot.toLocaleString('fr-FR')} Ar`;
        calculerTotalGeneralFacture(conteneurId);
    };

    inputNom.addEventListener('input', () => {
        const nomTape = inputNom.value.trim().toLowerCase();
        const articleTrouve = tousLesArticles.find(a => (a.designation || '').toLowerCase() === nomTape);
        
        if (articleTrouve) {
            const catLower = (articleTrouve.categorie || '').toLowerCase();
            const estService = catLower.includes('autres') || catLower.includes('analyses');
            const stockRestant = (articleTrouve.stock_initial || 0) + (articleTrouve.entrees || 0) - (articleTrouve.sorties || 0);
            
            if (!estService && stockRestant < 5) {
                afficherAlerte("Stock Insuffisant (Alerte < 5)", `Attention ! L'article '${articleTrouve.designation}' a un stock de ${stockRestant}. Il ne peut pas être validé.`, "erreur");
                inputPrix.value = articleTrouve.prix_unitaire || 0;
                inputNom.style.border = "2px solid #EF4444";
            } else {
                inputPrix.value = articleTrouve.prix_unitaire || 0;
                inputNom.style.border = "1px solid #CBD5E1";
            }
            recalculer(); 
        } else {
            inputPrix.value = 0;
            recalculer();
        }
    });

    inputQte.addEventListener('input', recalculer);

    calculerTotalGeneralFacture(conteneurId);
}

function supprimerLigneMedicament(bouton, conteneurId) {
    bouton.closest('.ligne-medicament-item').remove();
    calculerTotalGeneralFacture(conteneurId);
}

function calculerTotalGeneralFacture(conteneurId) {
    const conteneur = document.getElementById(conteneurId);
    if (!conteneur) return;

    let totalGeneral = 0;
    const lignes = conteneur.querySelectorAll('.ligne-medicament-item');

    lignes.forEach(ligne => {
        const qte = parseFloat(ligne.querySelector('.input-med-qte')?.value) || 0;
        const prix = parseFloat(ligne.querySelector('.input-med-prix')?.value) || 0;
        totalGeneral += (qte * prix);
    });

    const badgeTotalId = conteneurId === 'conteneur-meds-creation' ? 'total-facture-creation' : 'total-facture-edition';
    const badgeTotal = document.getElementById(badgeTotalId);
    if (badgeTotal) {
        badgeTotal.innerText = totalGeneral.toLocaleString('fr-FR');
    }
}

function obtenirListeMedicamentsJSON(conteneurId) {
    const conteneur = document.getElementById(conteneurId);
    if (!conteneur) return '[]';

    const liste = [];
    const lignes = conteneur.querySelectorAll('.ligne-medicament-item');

    lignes.forEach(ligne => {
        const nom = ligne.querySelector('.input-med-nom')?.value?.trim() || '';
        const quantite = parseFloat(ligne.querySelector('.input-med-qte')?.value) || 0;
        const prix = parseFloat(ligne.querySelector('.input-med-prix')?.value) || 0;
        const total = quantite * prix;

        if (nom) {
            liste.push({ nom, quantite, prix, total });
        }
    });

    return JSON.stringify(liste);
}

function chargerFactureEdition(jsonChaine, conteneurId) {
    const conteneur = document.getElementById(conteneurId);
    if (!conteneur) return;
    conteneur.innerHTML = '';

    let liste = [];
    try { if (jsonChaine && jsonChaine !== '[]') liste = JSON.parse(jsonChaine); } catch(e){}

    if (liste.length === 0) {
        ajouterLigneMedicament(conteneurId);
    } else {
        liste.forEach(m => ajouterLigneMedicament(conteneurId, m.nom, m.quantite, m.prix));
    }
}

function verifierStockAlerteAvantSoumission(conteneurId) {
    const conteneur = document.getElementById(conteneurId);
    if (!conteneur) return true;

    const lignes = conteneur.querySelectorAll('.ligne-medicament-item');
    for (let ligne of lignes) {
        const nom = (ligne.querySelector('.input-med-nom')?.value || '').trim().toLowerCase();
        if (!nom) continue;

        const article = tousLesArticles.find(a => (a.designation || '').toLowerCase() === nom);
        if (article) {
            const catLower = (article.categorie || '').toLowerCase();
            const estService = catLower.includes('autres') || catLower.includes('analyses');
            const stockRestant = (article.stock_initial || 0) + (article.entrees || 0) - (article.sorties || 0);
            
            if (!estService && stockRestant < 5) {
                afficherAlerte("Validation Bloquée", `Impossible de valider : l'article '${article.designation}' a un stock restant de ${stockRestant} (< 5).`, "erreur");
                return false; 
            }
        }
    }
    return true; 
}

// --- 5. RÔLES ET SÉCURITÉ ---
function appliquerDroitsRole(role) {
    roleActuel = role;
    const ecranConnexion = document.getElementById('ecran-connexion');
    const appPrincipale = document.getElementById('application-principale');

    if (ecranConnexion) ecranConnexion.classList.replace('section-visible', 'section-cachee');
    if (appPrincipale) appPrincipale.classList.replace('section-cachee', 'section-visible');
    
    const els = { 
        inv: document.getElementById('btn-inventaire'), 
        pers: document.getElementById('btn-personnel'),
        par: document.getElementById('btn-parametres'), 
        ctp: document.getElementById('btn-compte') 
    };
    
    const adminTools = {
        valeurBlock: document.getElementById('bloc-valeur-stock'),
        btnNew: document.getElementById('btn-nouvel-article'),
        thValeur: document.getElementById('th-valeur-stock'),
        thActions: document.getElementById('th-actions-stock')
    };
    
    if (role === 'admin') {
        if(els.inv) els.inv.style.display='block';
        if(els.pers) els.pers.style.display='block';
        if(els.par) els.par.style.display='block'; 
        if(els.ctp) els.ctp.style.display='block'; 
        
        if(adminTools.valeurBlock) adminTools.valeurBlock.style.display='block';
        if(adminTools.btnNew) adminTools.btnNew.style.display='block';
        if(adminTools.thValeur) adminTools.thValeur.style.display='table-cell';
        if(adminTools.thActions) adminTools.thActions.style.display='table-cell';
    } else if (role === 'accueil_pharmacie' || role === 'agent') {
        if(els.inv) els.inv.style.display='block'; 
        if(els.pers) els.pers.style.display='none';
        if(els.par) els.par.style.display='none'; 
        if(els.ctp) els.ctp.style.display='none'; 
        
        if(adminTools.valeurBlock) adminTools.valeurBlock.style.display='none';
        if(adminTools.btnNew) adminTools.btnNew.style.display='none';
        if(adminTools.thValeur) adminTools.thValeur.style.display='none';
        if(adminTools.thActions) adminTools.thActions.style.display='none';
    } else if (role === 'medecin_paramed') {
        // PERMET AU MÉDECIN DE VOIR L'INVENTAIRE EN MODE LECTURE SEULE
        if(els.inv) els.inv.style.display='block'; 
        if(els.pers) els.pers.style.display='none';
        if(els.par) els.par.style.display='none'; 
        if(els.ctp) els.ctp.style.display='none'; 
        
        if(adminTools.valeurBlock) adminTools.valeurBlock.style.display='none';
        if(adminTools.btnNew) adminTools.btnNew.style.display='none';
        if(adminTools.thValeur) adminTools.thValeur.style.display='none';
        if(adminTools.thActions) adminTools.thActions.style.display='none';
    } else {
        if(els.inv) els.inv.style.display='none';
        if(els.pers) els.pers.style.display='none';
        if(els.par) els.par.style.display='none'; 
        if(els.ctp) els.ctp.style.display='none'; 
    }

    const champsMed = document.getElementById('champs-medicaux');
    const editChampsMed = document.getElementById('edit_champs-medicaux');
    
    const hospitBlock = document.getElementById('bloc-hospitalisation');
    const editHospitBlock = document.getElementById('edit_bloc-hospitalisation');
    if (hospitBlock) hospitBlock.style.display = 'block';
    if (editHospitBlock) editHospitBlock.style.display = 'block';

    if (role === 'accueil_pharmacie' || role === 'agent') {
        if (champsMed) champsMed.style.display = 'none';
        if (editChampsMed) editChampsMed.style.display = 'none';
    } else {
        if (champsMed) champsMed.style.display = 'block';
        if (editChampsMed) editChampsMed.style.display = 'block';
    }

    chargerPatients();
    chargerInventaire(true); 
    if (role === 'admin') chargerPersonnel();

    const ongletSauvegarde = localStorage.getItem('ongletActif') || 'patients';
    let ongletCible = 'patients';

    if (role === 'admin') {
        ongletCible = ongletSauvegarde;
    } else if (role === 'accueil_pharmacie' || role === 'agent' || role === 'medecin_paramed') {
        ongletCible = ['patients', 'inventaire'].includes(ongletSauvegarde) ? ongletSauvegarde : 'patients';
    } else {
        ongletCible = 'patients';
    }

    changerOnglet(ongletCible);
}

async function seConnecter() {
    const role = document.getElementById('choix-role')?.value;
    const mdp = document.getElementById('mot-de-passe')?.value;
    if (!mdp) return afficherAlerte("Champ requis", "Veuillez entrer votre mot de passe.", "info");
    try {
        const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ role, mot_de_passe: mdp }) });
        const data = await res.json();
        if (!res.ok) return afficherAlerte("Accès refusé", data.erreur || "Identifiants incorrects.", "erreur");
        localStorage.setItem('sessionCliniqueRole', role); 
        appliquerDroitsRole(role); 
        document.getElementById('mot-de-passe').value = '';
    } catch(e) {}
}

function seDeconnecter() { 
    roleActuel = ''; 
    localStorage.removeItem('sessionCliniqueRole'); 
    localStorage.removeItem('ongletActif'); 
    document.getElementById('application-principale').classList.replace('section-visible','section-cachee'); 
    document.getElementById('ecran-connexion').classList.replace('section-cachee','section-visible'); 
}

// --- 6. DOM CONTENT LOADED ---
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('champ-recherche')?.addEventListener('input', filtrerPatients);
    document.getElementById('filtre-recherche')?.addEventListener('change', filtrerPatients);
    document.getElementById('recherche-inventaire')?.addEventListener('input', filtrerInventaire);
    document.getElementById('recherche-personnel')?.addEventListener('input', filtrerPersonnel);
    
    ajouterLigneMedicament('conteneur-meds-creation');
    filtrerServicesParType('type_consultation', 'services_specifiques');

    // Réinitialisation mot de passe équipe (Accueil / Médecin)
    const formEquipe = document.getElementById('formResetMdpEquipe');
    if (formEquipe) {
        formEquipe.addEventListener('submit', async function(e) {
            e.preventDefault();
            const roleSelect = document.getElementById('role-a-modifier')?.value;
            const nouveauMdpInput = document.getElementById('nouveau-mdp-equipe');
            const nouveauMdp = nouveauMdpInput ? nouveauMdpInput.value.trim() : '';

            if (!nouveauMdp) return afficherAlerte("Champ requis", "Veuillez entrer un nouveau mot de passe valide.", "erreur");

            try {
                const reponse = await fetch('/api/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role_a_modifier: roleSelect, nouveau_mot_de_passe: nouveauMdp })
                });
                const data = await reponse.json();
                if (reponse.ok) {
                    await afficherAlerte("Succès", data.message, "succes");
                    if (nouveauMdpInput) nouveauMdpInput.value = '';
                } else await afficherAlerte("Erreur", data.erreur || "Impossible de modifier le mot de passe.", "erreur");
            } catch (err) {
                afficherAlerte("Erreur réseau", "Impossible de contacter le serveur.", "erreur");
            }
        });
    }

    const formAdmin = document.getElementById('formResetMdpAdmin');
    if (formAdmin) {
        formAdmin.addEventListener('submit', async function(e) {
            e.preventDefault();
            const ancienMdpInput = document.getElementById('ancien-mdp-admin');
            const nouveauMdpInput = document.getElementById('nouveau-mdp-admin');
            const ancienMdp = ancienMdpInput ? ancienMdpInput.value : '';
            const nouveauMdp = nouveauMdpInput ? nouveauMdpInput.value : '';

            if (!nouveauMdp || !nouveauMdp.trim()) return afficherAlerte("Champ requis", "Veuillez saisir un nouveau mot de passe valide.", "erreur");

            try {
                const reponse = await fetch('/api/admin-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ancien_mot_de_passe: ancienMdp, nouveau_mot_de_passe: nouveauMdp.trim() })
                });
                const data = await reponse.json();
                if (reponse.ok) {
                    await afficherAlerte("Succès", data.message, "succes");
                    if (ancienMdpInput) ancienMdpInput.value = '';
                    if (nouveauMdpInput) nouveauMdpInput.value = '';
                } else await afficherAlerte("Erreur", data.erreur || "L'ancien mot de passe est incorrect.", "erreur");
            } catch (err) {}
        });
    }

    const sess = localStorage.getItem('sessionCliniqueRole');
    if (sess) appliquerDroitsRole(sess);
});

// --- 7. NAVIGATION ---
function filtrerPatients() {
    const term = (document.getElementById('champ-recherche')?.value || '').toLowerCase().trim();
    const filtre = document.getElementById('filtre-recherche')?.value || 'tout';
    patientsFiltresGlobaux = tousLesPatients
        .filter(p => {
            const n=(p.nom_complet||'').toLowerCase(), c=(p.code_patient||'').toLowerCase(), t=(p.telephone||'').toLowerCase();
            if(!term) return true;
            if(filtre==='nom') return n.includes(term); 
            if(filtre==='code') return c.includes(term); 
            if(filtre==='telephone') return t.includes(term);
            return n.includes(term) || c.includes(term) || t.includes(term);
        })
        .sort((a, b) => (a.nom_complet || '').localeCompare(b.nom_complet || '', 'fr', { sensitivity: 'base' }));
    pageActuelle = 1; 
    afficherPatients(patientsFiltresGlobaux);
}

function changerOnglet(sec) {
    ['patients', 'inventaire', 'personnel', 'parametres', 'compte'].forEach(s => { 
        document.getElementById(`section-${s}`)?.classList.replace('section-visible','section-cachee'); 
        document.getElementById(`btn-${s}`)?.classList.remove('actif'); 
    });
    document.getElementById(`section-${sec}`)?.classList.replace('section-cachee','section-visible'); 
    document.getElementById(`btn-${sec}`)?.classList.add('actif');

    localStorage.setItem('ongletActif', sec);

    if (sec === 'personnel') {
        chargerPersonnel();
    }
}

function changerSousOngletPatients(ong) {
    const list = document.getElementById('zone-liste-patients'), form = document.getElementById('zone-form-patient');
    if(ong==='liste'){ 
        document.getElementById('btn-sous-liste')?.classList.add('actif'); document.getElementById('btn-sous-form')?.classList.remove('actif'); 
        list?.classList.replace('section-cachee','section-visible'); form?.classList.replace('section-visible','section-cachee'); 
        afficherPatients(patientsFiltresGlobaux); 
    } else { 
        document.getElementById('btn-sous-form')?.classList.add('actif'); document.getElementById('btn-sous-liste')?.classList.remove('actif'); 
        form?.classList.replace('section-cachee','section-visible'); list?.classList.replace('section-visible','section-cachee'); 
        filtrerServicesParType('type_consultation', 'services_specifiques');
    }
}

// --- 8. PATIENTS ---
async function chargerPatients() { 
    try { const res = await fetch('/api/patients'); if (res.ok) { tousLesPatients = await res.json(); filtrerPatients(); } } catch(e){} 
}

function afficherPatients(liste) {
    const ul = document.getElementById('listePatients'); if(!ul) return; ul.innerHTML = '';
    const badgeTotal = document.getElementById('total-dossiers-badge'); if (badgeTotal) badgeTotal.innerText = liste.length;
    if(liste.length === 0){ ul.innerHTML = '<li style="text-align:center;padding:20px;color:var(--texte-clair);">Aucun dossier patient trouvé.</li>'; return; }
    
    const maxPage = Math.ceil(liste.length / patientsParPage); 
    if(pageActuelle > maxPage) pageActuelle = maxPage;
    
    liste.slice((pageActuelle - 1) * patientsParPage, pageActuelle * patientsParPage).forEach(p => {
        let btn = `<button onclick="telechargerFicheA4(${p.id})" style="background:#0D9488;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;margin-right:5px;font-weight:600;">📄 Fiche</button>`;
        btn += `<button onclick="ouvrirModalEdition(${p.id})" style="background:var(--bleu-primaire);color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;margin-right:5px;font-weight:600;">✏️ Modif</button>`;
        
        if(roleActuel === 'admin') btn += `<button onclick="supprimerPatient(${p.id})" style="background:#DC2626;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">🗑️</button>`;

        let servicesBadge = p.services_specifiques ? `<div style="margin-top:6px; font-size:12px; color:#0284C7;">🩺 <strong>Services :</strong> ${p.services_specifiques}</div>` : '';
        let blocRdvSpecialiste = '';
        const typeTxt = (p.type_consultation || '').toLowerCase();
        
        if (typeTxt.includes('rendez-vous') || typeTxt.includes('spécialiste') || p.date_rdv_specialiste) {
            const dateEffective = p.date_rdv_specialiste || p.prochain_rdv || p.date_visite || p.date_entree;
            const dStr = dateEffective ? formaterDateEnLettres(dateEffective) : 'Non renseignée';
            const heureEffective = p.heure_rdv_specialiste && p.heure_rdv_specialiste.trim() !== '' ? p.heure_rdv_specialiste : '09:00';
            blocRdvSpecialiste = `<div style="margin-top:8px; padding:8px 12px; background:rgba(2,132,199,0.08); border-left:4px solid #0284C7; border-radius:6px; font-size:13px; color:#0369A1;">📅 <strong>RDV Spécialiste :</strong> <span style="font-weight:bold;">${dStr}</span> ⏰ à <strong>${heureEffective}</strong></div>`;
        }

        ul.innerHTML += `<li class="animate-fade">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <strong style="font-size:1.2em;color:var(--texte-sombre);">${p.nom_complet}</strong>
                <div style="display:flex;align-items:center;gap:6px;">
                    ${btn} 
                    <span style="font-family:monospace;background:var(--fond-page);border:1px solid var(--bordure);padding:4px 8px;border-radius:6px;font-size:12px;font-weight:700;">${p.code_patient}</span>
                </div>
            </div>
            <div style="font-size:13px;color:var(--texte-clair);margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <span><strong>Type :</strong> <span style="color:#0284C7;font-weight:bold;">${p.type_consultation || 'Consultation généraliste'}</span></span>
                <span><strong>Date de visite :</strong> ${formaterDateEnLettres(p.date_visite || p.date_entree)}</span>
                <span><strong>Téléphone :</strong> ${p.telephone}</span>
                <span><strong>Prochain RDV :</strong> ${formaterDateEnLettres(p.prochain_rdv)}</span>
            </div>
            ${blocRdvSpecialiste}${servicesBadge}
        </li>`;
    });

    const pagin = document.getElementById('pagination-patients');
    if (pagin) pagin.innerHTML = maxPage > 1 ? `<button onclick="changerPage(-1)" ${pageActuelle===1?'disabled':''}>Précédent</button> Page ${pageActuelle}/${maxPage} <button onclick="changerPage(1)" ${pageActuelle===maxPage?'disabled':''}>Suivant</button>` : '';
}

function changerPage(d) { pageActuelle += d; afficherPatients(patientsFiltresGlobaux); }

// NOUVEAU PATIENT
document.getElementById('formPatient')?.addEventListener('submit', async e => {
    e.preventDefault();

    if (!verifierStockAlerteAvantSoumission('conteneur-meds-creation')) return; 

    const vitals = { 
        temp: document.getElementById('vit_temp')?.value||null, 
        poids: document.getElementById('vit_poids')?.value||null, 
        pouls: document.getElementById('vit_pouls')?.value||null, 
        sys: document.getElementById('vit_sys')?.value||null, 
        dia: document.getElementById('vit_dia')?.value||null,
        spo2: document.getElementById('vit_spo2')?.value||null,
        analyses: obtenirAnalysesCochees('analyses_creation'),
        hospit_statut: obtenirStatutHospitCoche('cb_hospit_creation'),
        hospitalisation: document.getElementById('hospitalisation_details')?.value||''
    };
    const typeConsultation = document.getElementById('type_consultation')?.value || 'Consultation généraliste';
    let dateRdv = document.getElementById('date_rdv_specialiste')?.value || '';
    let heureRdv = document.getElementById('heure_rdv_specialiste')?.value || '09:00';
    if ((typeConsultation.toLowerCase().includes('rendez-vous') || typeConsultation.toLowerCase().includes('spécialiste')) && !dateRdv) {
        dateRdv = document.getElementById('date_entree')?.value || document.getElementById('prochain_rdv')?.value || new Date().toISOString().slice(0, 10);
    }

    const np = { 
        nom_complet: document.getElementById('nom_complet').value, date_naissance: document.getElementById('date_naissance').value, sexe: document.getElementById('sexe').value, telephone: document.getElementById('telephone').value, 
        date_entree: document.getElementById('date_entree').value, date_visite: document.getElementById('date_visite').value, adresse: document.getElementById('adresse').value, contact_urgence: document.getElementById('contact_urgence').value, 
        type_consultation: typeConsultation, services_specifiques: obtenirServicesCoches('services_specifiques'), date_rdv_specialiste: dateRdv, heure_rdv_specialiste: heureRdv, 
        facture_medicaments: obtenirListeMedicamentsJSON('conteneur-meds-creation'),
        remarque_paiement: document.getElementById('remarque_paiement')?.value || '',
        allergies: document.getElementById('allergies')?.value || '', 
        maladies_chroniques: document.getElementById('maladies_chroniques')?.value || '', 
        chirurgies: document.getElementById('chirurgies')?.value || '', 
        antecedents_familiaux: document.getElementById('antecedents_familiaux')?.value || '', 
        habitudes_toxiques: document.getElementById('habitudes_toxiques')?.value || '', 
        traitements_en_cours: document.getElementById('traitements_en_cours')?.value || '', 
        motif_visite: document.getElementById('motif_visite')?.value || '', diagnostic: document.getElementById('diagnostic')?.value || '', prochain_rdv: document.getElementById('prochain_rdv').value, 
        consultation_statut: obtenirStatutPaiementCoche('cb_statut_paiement_creation'), 
        besoin_controle: document.getElementById('besoin_controle').value, parametres: JSON.stringify(vitals), notes: document.getElementById('notes').value 
    };

    try { 
        const r = await fetch('/api/patients', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(np) }); 
        const data = await r.json();
        
        if(r.ok) { 
            await afficherAlerte("Succès", data.message || "Nouveau dossier créé !", "succes"); 
            e.target.reset(); 
            document.getElementById('conteneur-meds-creation').innerHTML = '';
            ajouterLigneMedicament('conteneur-meds-creation');
            cocherStatutPaiement('cb_statut_paiement_creation', 'Non payé');
            cocherHospitStatut('cb_hospit_creation', '02 - Non');
            gererChangementTypeConsultation('type_consultation', 'bloc_rdv_specialiste', 'services_specifiques'); 
            
            document.getElementById('select_categorie_analyse_creation').value = '';
            afficherCategorieAnalyse('select_categorie_analyse_creation', 'bloc_categories_analyses_creation');

            chargerPatients(); 
            chargerInventaire(true); 
            changerSousOngletPatients('liste'); 
        } else {
            afficherAlerte("Erreur", data.erreur || "Impossible de créer le dossier.", "erreur");
        }
    } catch(er){}
});

// ÉDITION PATIENT
function ouvrirModalEdition(id) {
    const p = tousLesPatients.find(x => x.id === id); if(!p) return;
    document.getElementById('modal-edition').style.display = 'flex';
    document.getElementById('edit_id').value = p.id;
    document.getElementById('edit_id').dataset.ancienPatient = JSON.stringify(p);
    
    ['nom_complet','date_naissance','sexe','telephone','date_entree','date_visite','adresse','contact_urgence','type_consultation','date_rdv_specialiste','heure_rdv_specialiste','remarque_paiement','allergies','maladies_chroniques','chirurgies','antecedents_familiaux','habitudes_toxiques','traitements_en_cours','motif_visite','diagnostic','prochain_rdv','besoin_controle','notes'].forEach(k => {
        const el = document.getElementById('edit_'+k); if(el) el.value = p[k]||'';
    });

    let v = { temp: '', poids: '', pouls: '', sys: '', dia: '', spo2: '', analyses: [], hospit_statut: '02 - Non', hospitalisation: '' };
    try { if (p.parametres && p.parametres.startsWith('{')) v = JSON.parse(p.parametres); } catch (e) {}
    if(document.getElementById('edit_vit_temp')) document.getElementById('edit_vit_temp').value = v.temp || '';
    if(document.getElementById('edit_vit_poids')) document.getElementById('edit_vit_poids').value = v.poids || '';
    if(document.getElementById('edit_vit_pouls')) document.getElementById('edit_vit_pouls').value = v.pouls || '';
    if(document.getElementById('edit_vit_sys')) document.getElementById('edit_vit_sys').value = v.sys || '';
    if(document.getElementById('edit_vit_dia')) document.getElementById('edit_vit_dia').value = v.dia || '';
    if(document.getElementById('edit_vit_spo2')) document.getElementById('edit_vit_spo2').value = v.spo2 || '';
    if(document.getElementById('edit_hospitalisation_details')) document.getElementById('edit_hospitalisation_details').value = v.hospitalisation || '';

    cocherHospitStatut('cb_hospit_edition', v.hospit_statut || '02 - Non');
    cocherAnalyses('analyses_edition', v.analyses || []);
    document.getElementById('select_categorie_analyse_edition').value = '';
    afficherCategorieAnalyse('select_categorie_analyse_edition', 'bloc_categories_analyses_edition');

    const editHeureEl = document.getElementById('edit_heure_rdv_specialiste');
    if (editHeureEl && !editHeureEl.value) editHeureEl.value = '09:00';

    cocherStatutPaiement('cb_statut_paiement_edition', p.consultation_statut);
    chargerFactureEdition(p.facture_medicaments, 'conteneur-meds-edition');
    cocherServicesSpecifiques('edit_services_specifiques', p.services_specifiques);
    gererChangementTypeConsultation('edit_type_consultation', 'edit_bloc_rdv_specialiste', 'edit_services_specifiques');
}

function fermerModalEdition() { document.getElementById('modal-edition').style.display = 'none'; }

document.getElementById('formEditPatient')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    if (!verifierStockAlerteAvantSoumission('conteneur-meds-edition')) return; 

    const id = document.getElementById('edit_id')?.value;
    const oldP = JSON.parse(document.getElementById('edit_id')?.dataset.ancienPatient || '{}');

    const vitals = { 
        temp: document.getElementById('edit_vit_temp')?.value||null, 
        poids: document.getElementById('edit_vit_poids')?.value||null, 
        pouls: document.getElementById('edit_vit_pouls')?.value||null, 
        sys: document.getElementById('edit_vit_sys')?.value||null, 
        dia: document.getElementById('edit_vit_dia')?.value||null,
        spo2: document.getElementById('edit_vit_spo2')?.value||null,
        analyses: obtenirAnalysesCochees('analyses_edition'),
        hospit_statut: obtenirStatutHospitCoche('cb_hospit_edition'),
        hospitalisation: document.getElementById('edit_hospitalisation_details')?.value||''
    };
    
    let history = [];
    if (oldP.historique_consultations && oldP.historique_consultations !== '[]') {
        try { history = JSON.parse(oldP.historique_consultations); } catch(e){}
    }

    const nouvelleDateVisite = document.getElementById('edit_date_visite')?.value || '';
    const ancienneDateVisite = oldP.date_visite || '';

    if (ancienneDateVisite && nouvelleDateVisite && ancienneDateVisite !== nouvelleDateVisite) {
        history.push({
            date_visite: oldP.date_visite, type_consultation: oldP.type_consultation, services_specifiques: oldP.services_specifiques,
            motif_visite: oldP.motif_visite, diagnostic: oldP.diagnostic, parametres: oldP.parametres,
            facture_medicaments: oldP.facture_medicaments, remarque_paiement: oldP.remarque_paiement, consultation_statut: oldP.consultation_statut,
            date_rdv_specialiste: oldP.date_rdv_specialiste, heure_rdv_specialiste: oldP.heure_rdv_specialiste
        });
    }

    const typeConsultation = document.getElementById('edit_type_consultation')?.value || 'Consultation généraliste';
    let dateRdv = document.getElementById('edit_date_rdv_specialiste')?.value || '';
    let heureRdv = document.getElementById('edit_heure_rdv_specialiste')?.value || '09:00';

    const mod = {}; 
    ['nom_complet','date_naissance','sexe','telephone','date_entree','date_visite','adresse','contact_urgence','remarque_paiement','allergies','maladies_chroniques','chirurgies','antecedents_familiaux','habitudes_toxiques','traitements_en_cours','motif_visite','diagnostic','prochain_rdv','besoin_controle','notes'].forEach(k => {
        const el = document.getElementById('edit_'+k); if (el) mod[k] = el.value;
    }); 

    mod.type_consultation = typeConsultation;
    mod.date_rdv_specialiste = dateRdv;
    mod.heure_rdv_specialiste = heureRdv;
    mod.services_specifiques = obtenirServicesCoches('edit_services_specifiques');
    mod.consultation_statut = obtenirStatutPaiementCoche('cb_statut_paiement_edition');
    mod.facture_medicaments = obtenirListeMedicamentsJSON('conteneur-meds-edition');
    mod.parametres = JSON.stringify(vitals);
    mod.historique_consultations = JSON.stringify(history);
    
    try { 
        const r = await fetch(`/api/patients/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(mod) }); 
        const data = await r.json();

        if (r.ok) { 
            await afficherAlerte("Succès", "Dossier mis à jour !", "succes"); 
            fermerModalEdition(); 
            chargerPatients(); 
            chargerInventaire(true); 
        } else {
            afficherAlerte("Erreur", data.erreur || "Mise à jour impossible.", "erreur");
        }
    } catch(er){}
});

async function supprimerPatient(id) { 
    if(confirm("Supprimer ce dossier patient ?")) { await fetch(`/api/patients/${id}`,{method:'DELETE'}); chargerPatients(); } 
}

// --- 9. FICHE A4 PDF ---
function telechargerFicheA4(id) {
    const patient = tousLesPatients.find(p => p.id === id);
    if (!patient) return;

    const fenetre = window.open('', '_blank');
    if (!fenetre) return afficherAlerte("Pop-up bloqué", "Veuillez autoriser les fenêtres surgissantes.", "info");

    let historique = [];
    try { if (patient.historique_consultations && patient.historique_consultations !== '[]') historique = JSON.parse(patient.historique_consultations); } catch (e) {}

    const visitesAImprimer = [...historique, {
        date_visite: patient.date_visite, type_consultation: patient.type_consultation, services_specifiques: patient.services_specifiques,
        motif_visite: patient.motif_visite, diagnostic: patient.diagnostic, parametres: patient.parametres,
        facture_medicaments: patient.facture_medicaments, remarque_paiement: patient.remarque_paiement, consultation_statut: patient.consultation_statut,
        date_rdv_specialiste: patient.date_rdv_specialiste, heure_rdv_specialiste: patient.heure_rdv_specialiste
    }];

    let contenuToutesLesPages = '';

    visitesAImprimer.forEach((visite, index) => {
        if (index > 0) contenuToutesLesPages += `<div class="html2pdf__page-break"></div>`;

        let v = { temp: '--', poids: '--', pouls: '--', sys: '--', dia: '--', spo2: '--', analyses: [], hospit_statut: '02 - Non', hospitalisation: '' };
        try { if (visite.parametres && visite.parametres.startsWith('{')) v = JSON.parse(visite.parametres); } catch (e) {}

        const dateVisiteAffichee = formaterDateEnLettres(visite.date_visite || patient.date_entree || new Date().toISOString().slice(0, 10));

        let ligneRdvSpecialistePDF = '';
        const typeTxt = (visite.type_consultation || '').toLowerCase();
        if (typeTxt.includes('rendez-vous') || typeTxt.includes('spécialiste') || visite.date_rdv_specialiste) {
            const dPdf = visite.date_rdv_specialiste ? formaterDateEnLettres(visite.date_rdv_specialiste) : 'Non renseignée';
            const hPdf = visite.heure_rdv_specialiste && visite.heure_rdv_specialiste.trim() !== '' ? visite.heure_rdv_specialiste : '09:00';
            ligneRdvSpecialistePDF = `<tr><td colspan="2" style="color:#0284C7; font-weight:bold; padding-top:4px;">📅 RDV Spécialiste : ${dPdf} ⏰ à ${hPdf}</td></tr>`;
        }

        const numeroFormatted = (index + 1).toString().padStart(2, '0');

        let blocAntecedentsPDF = '';
        let blocSuiviVitalsPDF = '';

        if (roleActuel !== 'accueil_pharmacie' && roleActuel !== 'agent') {
            blocAntecedentsPDF = `
                <div class="section-box" style="background:#FFF5F5; border:1px solid #FCA5A5;">
                    <div style="font-weight:bold; color:#DC2626; margin-bottom:6px;">🩺 ANTÉCÉDENTS</div>
                    <p><strong>Allergies :</strong> ${patient.allergies || 'Aucune'}</p>
                    <p><strong>Antécédents médicaux :</strong> ${patient.maladies_chroniques || 'Aucun'}</p>
                    <p><strong>Antécédents chirurgicaux :</strong> ${patient.chirurgies || 'Aucun'}</p>
                    <p><strong>Antécédents familiaux :</strong> ${patient.antecedents_familiaux || 'Aucun'}</p>
                    <p><strong>Habitudes toxiques :</strong> ${patient.habitudes_toxiques || 'Aucune'}</p>
                    <p><strong>Traitements en cours :</strong> ${patient.traitements_en_cours || 'Aucun'}</p>
                </div>`;
        }

        let analysesPDF = '';
        if (v.analyses && v.analyses.length > 0) {
            analysesPDF = `<p style="margin-top:8px; padding-top:8px; border-top:1px dashed #CBD5E1; color:#0369A1;"><strong>🔬 Analyses demandées :</strong> ${v.analyses.join(', ')}</p>`;
        }

        let hospitalisationPDF = '';
        if (v.hospit_statut || (v.hospitalisation && v.hospitalisation.trim() !== '')) {
            hospitalisationPDF = `<p style="margin-top:4px;"><strong>🏥 Hospitalisation :</strong> <span style="font-weight:bold; color:#0284C7;">${v.hospit_statut || '02 - Non'}</span> ${v.hospitalisation ? ' - ' + v.hospitalisation : ''}</p>`;
        }

        blocSuiviVitalsPDF = `
            <div class="section-box" style="background:#FAFAFA; border:1px solid #E2E8F0;">
                <div style="font-weight:bold; color:#0D9488; margin-bottom:6px;">📊 DETAILS DE CETTE CONSULTATION</div>
                ${roleActuel !== 'accueil_pharmacie' && roleActuel !== 'agent' ? `<p><strong>🌡️ Temp :</strong> ${v.temp||'--'} °C | <strong>⚖️ Poids :</strong> ${v.poids||'--'} kg | <strong>💓 Pouls :</strong> ${v.pouls||'--'} bpm | <strong>🩸 Tension :</strong> ${v.sys&&v.dia?v.sys+'/'+v.dia+' mmHg':'--'} | <strong>🫁 Sat O2 :</strong> ${v.spo2||'--'} %</p>
                <p><strong>Prescription :</strong> ${visite.motif_visite || 'Non renseignée'}</p>
                <p><strong>Diagnostic / avis médical :</strong> ${visite.diagnostic || 'En attente'}</p>` : ''}
                ${hospitalisationPDF}
                ${analysesPDF}
            </div>`;

        let listeMedsPDF = [];
        try { if (visite.facture_medicaments && visite.facture_medicaments !== '[]') listeMedsPDF = JSON.parse(visite.facture_medicaments); } catch(e){}

        let lignesFactureHTML = '';
        let grandTotalFacture = 0;

        if (listeMedsPDF.length > 0) {
            listeMedsPDF.forEach(m => {
                grandTotalFacture += (m.total || 0);
                lignesFactureHTML += `
                    <tr>
                        <td style="padding:4px 8px; border-bottom:1px solid #E2E8F0;">${m.nom}</td>
                        <td style="padding:4px 8px; border-bottom:1px solid #E2E8F0; text-align:center;">${m.quantite}</td>
                        <td style="padding:4px 8px; border-bottom:1px solid #E2E8F0; text-align:right;">${m.prix.toLocaleString('fr-FR')} Ar</td>
                        <td style="padding:4px 8px; border-bottom:1px solid #E2E8F0; text-align:right; font-weight:bold;">${m.total.toLocaleString('fr-FR')} Ar</td>
                    </tr>`;
            });
        } else {
            lignesFactureHTML = `<tr><td colspan="4" style="padding:6px; text-align:center; color:#94A3B8;">Aucun médicament facturé pour cette visite.</td></tr>`;
        }

        const remPaiementHTML = visite.remarque_paiement ? `<p style="margin-top:6px; font-size:10px; color:#475569;"><strong>Note paiement :</strong> ${visite.remarque_paiement}</p>` : '';
        const statutAffichagePaiement = visite.consultation_statut || 'Non payé';

        let blocFacturePDF = `
            <div class="section-box" style="background:#F8FAFC; border:1px solid #CBD5E1;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div style="font-weight:bold; color:#0284C7;">💊 FACTURE & DÉTAIL DES MÉDICAMENTS</div>
                    <div style="font-size:10px; font-weight:bold; background:#E0F2FE; color:#0369A1; padding:2px 8px; border-radius:4px;">Statut : ${statutAffichagePaiement}</div>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:10px;">
                    <thead>
                        <tr style="background:#E2E8F0; color:#0F172A;">
                            <th style="padding:4px 8px; text-align:left;">Désignation</th>
                            <th style="padding:4px 8px; text-align:center;">Quantité</th>
                            <th style="padding:4px 8px; text-align:right;">P.U (Ar)</th>
                            <th style="padding:4px 8px; text-align:right;">Total (Ar)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lignesFactureHTML}
                    </tbody>
                    <tfoot>
                        <tr style="background:#F1F5F9;">
                            <td colspan="3" style="padding:6px 8px; text-align:right; font-weight:bold; font-size:11px;">TOTAL GÉNÉRAL :</td>
                            <td style="padding:6px 8px; text-align:right; font-weight:bold; color:#0284C7; font-size:11px;">${grandTotalFacture.toLocaleString('fr-FR')} Ar</td>
                        </tr>
                    </tfoot>
                </table>
                ${remPaiementHTML}
            </div>`;

        contenuToutesLesPages += `
            <div class="page-a4" style="${index > 0 ? 'margin-top: 15px;' : 'margin-top: 45px;'}">
                <table class="header-table">
                    <tr>
                        <td style="width: 65%;">
                            <h1 class="header-logo-title">🏥 TPFV</h1>
                            <div class="header-subtitle">Toeram-Pitsaboana Fanantenan'ny Vononkandresy III Jaona 2</div>
                        </td>
                        <td style="width: 35%; text-align:right; font-size:11px;">
                            <strong>Code Patient :</strong> ${patient.code_patient || 'N/A'}<br>
                            <strong>Date de Consultation :</strong> <span style="color:#0D9488;">${dateVisiteAffichee}</span><br>
                            <strong>Consultation :</strong> <span style="color:#0284C7; font-weight:bold;">CONS${numeroFormatted}</span>
                        </td>
                    </tr>
                </table>
                <div class="header-bar"></div>
                
                <div class="banner-title">FICHE DU PATIENT</div>
                
                <div class="section-box section-admin">
                    <div style="font-weight:bold; color:#0284C7; margin-bottom:6px;">👤 INFORMATIONS DU PATIENT</div>
                    <table class="grid-table">
                        <tr><td><strong>Nom et Prénom :</strong> ${patient.nom_complet}</td><td><strong>Type :</strong> ${visite.type_consultation || 'Consultation généraliste'}</td></tr>
                        <tr><td><strong>Date de naissance :</strong> ${formaterDateEnLettres(patient.date_naissance)}</td><td><strong>Services :</strong> ${visite.services_specifiques || 'Aucun'}</td></tr>
                        <tr><td><strong>Téléphone :</strong> ${patient.telephone}</td><td><strong>Contact d'urgence :</strong> ${patient.contact_urgence || 'Non renseigné'}</td></tr>
                        <tr><td colspan="2"><strong>Adresse :</strong> ${patient.adresse || 'Non renseignée'}</td></tr>
                        ${ligneRdvSpecialistePDF}
                    </table>
                </div>

                ${blocAntecedentsPDF}
                ${blocSuiviVitalsPDF}
                ${blocFacturePDF}
            </div>
        `;
    });

    fenetre.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Fiche_${patient.code_patient || 'Patient'}</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
            <style>
                @page { size: A4 portrait; margin: 8mm; }
                * { box-sizing: border-box; }
                body { font-family: Arial, Helvetica, sans-serif; color: #0F172A; background-color: #525659; margin: 0; padding: 20px 0; display: flex; flex-direction: column; align-items: center; }
                .barre-outils-pdf { position: fixed; top: 0; left: 0; right: 0; background: #1E293B; color: white; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10000; }
                .btn-pdf { background: #0284C7; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; }
                .page-a4 { background: #FFFFFF; width: 190mm; min-height: 265mm; padding: 10mm; }
                .html2pdf__page-break { height: 0; page-break-before: always; }
                @media print { .barre-outils-pdf { display: none !important; } body { background: white; padding: 0; } .page-a4 { width: 100%; margin: 0; padding: 0; page-break-after: always; } .page-a4:last-child{page-break-after: auto;} }
                .header-table { width: 100%; border-collapse: collapse; }
                .header-logo-title { color: #0284C7; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5px; }
                .header-subtitle { color: #64748B; font-size: 11px; font-weight: 600; margin-top: 3px; line-height: 1.3; }
                .header-bar { height: 3px; background: #0284C7; width: 100%; margin: 8px 0 12px 0; }
                .banner-title { background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 8px; text-align: center; color: #0284C7; font-size: 13px; font-weight: 800; padding: 8px; margin-bottom: 14px; }
                .section-box { border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; font-size: 11px; line-height: 1.6; }
                .section-admin { background: #FAFAFA; border: 1px solid #E2E8F0; }
                .grid-table { width: 100%; border-collapse: collapse; }
                .grid-table td { width: 50%; vertical-align: top; padding: 2px 0; }
            </style>
        </head>
        <body>
            <div class="barre-outils-pdf">
                <span>📄 Historique Médical : <strong>${patient.nom_complet}</strong></span>
                <div>
                    <button class="btn-pdf" style="background:#0D9488" onclick="html2pdf().set({margin:0, filename:'Fiche_${patient.code_patient}.pdf', html2canvas:{scale:2}, jsPDF:{unit:'mm', format:'a4', orientation:'portrait'}}).from(document.getElementById('contenu-fiche-a4')).save()">📥 Télécharger PDF</button>
                    <button class="btn-pdf" onclick="window.print()">🖨️ Imprimer</button>
                </div>
            </div>
            <div id="contenu-fiche-a4">
                ${contenuToutesLesPages}
            </div>
        </body>
        </html>
    `);
    fenetre.document.close();
}


// --- 10. GESTION DE L'INVENTAIRE ET DE L'AUTOCOMPLÉTION ---

function chargerInventaire(forcerAffichage = true) {
    fetch('/api/inventaire')
        .then(res => res.json())
        .then(data => {
            if(!data.erreur) {
                tousLesArticles = data;
                mettreAJourSuggestionsMedicaments(tousLesArticles);
                if (forcerAffichage) filtrerInventaire(); 
            }
        })
        .catch(e => console.error("Erreur chargement inventaire", e));
}

function mettreAJourSuggestionsMedicaments(liste) {
    const datalist = document.getElementById('suggestions-medicaments');
    if (!datalist) return;
    datalist.innerHTML = ''; 
    liste.forEach(article => {
        if (article.designation) {
            const option = document.createElement('option');
            option.value = article.designation;
            datalist.appendChild(option);
        }
    });
}

function filtrerInventaire() {
    const term = (document.getElementById('recherche-inventaire')?.value || '').toLowerCase().trim();
    articlesFiltresGlobaux = tousLesArticles.filter(a => {
        return (a.designation||'').toLowerCase().includes(term) || 
               (a.reference||'').toLowerCase().includes(term) || 
               (a.categorie||'').toLowerCase().includes(term);
    });
    pageActuelleInventaire = 1; 
    afficherInventaire(articlesFiltresGlobaux);
}

function afficherInventaire(liste) {
    const tbody = document.getElementById('tbody-inventaire');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    let valeurGlobale = 0;
    liste.forEach(item => {
        const catLower = (item.categorie || '').toLowerCase();
        const estService = catLower.includes('autres') || catLower.includes('analyses');
        if (!estService) {
            const restant = (item.stock_initial || 0) + (item.entrees || 0) - (item.sorties || 0);
            valeurGlobale += restant * (item.prix_unitaire || 0);
        }
    });
    
    document.getElementById('total-valeur-inventaire').innerText = valeurGlobale.toLocaleString('fr-FR') + ' Ar';
    document.getElementById('total-articles-inventaire').innerText = liste.length;

    let colsSpan = roleActuel === 'admin' ? 9 : 7;
    if (liste.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colsSpan}" style="text-align:center;padding:20px;color:#64748B;">Aucun article trouvé.</td></tr>`;
        document.getElementById('pagination-inventaire').innerHTML = '';
        return;
    }

    const maxPage = Math.ceil(liste.length / articlesParPage);
    if (pageActuelleInventaire > maxPage) pageActuelleInventaire = maxPage;
    
    const articlesPage = liste.slice((pageActuelleInventaire - 1) * articlesParPage, pageActuelleInventaire * articlesParPage);

    articlesPage.forEach(item => {
        const catLower = (item.categorie || '').toLowerCase();
        const estService = catLower.includes('autres') || catLower.includes('analyses');
        
        const restant = (item.stock_initial || 0) + (item.entrees || 0) - (item.sorties || 0);
        
        let affichageRestant = estService ? '∞' : restant;
        let alerte = (!estService && restant <= 5) ? 'background:#FEF2F2; color:#991B1B;' : '';
        let pastille = (!estService && restant <= 5) ? '<span style="background:#EF4444;color:white;padding:2px 6px;border-radius:4px;font-size:10px;">Alerte</span>' : '';
        let valeurItem = estService ? '-' : (restant * (item.prix_unitaire || 0)).toLocaleString('fr-FR') + ' Ar';
        let affichageNombre = estService ? (item.sorties || 0) : '-';

        let tdValeur = roleActuel === 'admin' ? `<td style="padding:8px; text-align:right; font-weight:bold;">${valeurItem}</td>` : '';
        let tdActions = roleActuel === 'admin' ? `
            <td style="padding:8px; text-align:center;">
                <button onclick="ouvrirModalInventaire(${item.id})" style="background:var(--bleu-primaire);color:white;border:none;padding:6px;border-radius:4px;cursor:pointer;font-size:12px;margin-right:3px;" title="Modifier">✏️</button>
                <button onclick="remettreAZeroArticle(${item.id})" style="background:#EAB308;color:white;border:none;padding:6px;border-radius:4px;cursor:pointer;font-size:12px;margin-right:3px;" title="Remise à zéro">🔄</button>
                <button onclick="supprimerArticle(${item.id})" style="background:#EF4444;color:white;border:none;padding:6px;border-radius:4px;cursor:pointer;font-size:12px;" title="Supprimer">🗑️</button>
            </td>` : '';

        tbody.innerHTML += `
            <tr style="border-bottom:1px solid #E2E8F0; ${alerte}">
                <td style="padding:8px;"><strong>${item.reference}</strong></td>
                <td style="padding:8px; font-weight:bold;">${item.designation}</td>
                <td style="padding:8px;">${item.categorie}</td>
                <td style="padding:8px;">${formaterDateEnLettres(item.date_peremption)}</td>
                <td style="padding:8px; text-align:center; font-weight:bold; font-size:14px;">${affichageRestant} ${pastille}</td>
                <td style="padding:8px; text-align:center; color:#0369A1; font-weight:bold;">${affichageNombre}</td>
                <td style="padding:8px; text-align:right;">${(item.prix_unitaire||0).toLocaleString('fr-FR')} Ar</td>
                ${tdValeur}
                ${tdActions}
            </tr>
        `;
    });

    const pagin = document.getElementById('pagination-inventaire');
    if (pagin) {
        pagin.innerHTML = maxPage > 1 ? 
            `<button onclick="changerPageInventaire(-1)" ${pageActuelleInventaire===1?'disabled':''}>Précédent</button> Page ${pageActuelleInventaire}/${maxPage} <button onclick="changerPageInventaire(1)" ${pageActuelleInventaire===maxPage?'disabled':''}>Suivant</button>` 
            : '';
    }
}

async function remettreAZeroArticle(id) {
    const article = tousLesArticles.find(a => a.id === id);
    const nom = article ? article.designation : "cet article";
    
    if (confirm(`Voulez-vous vraiment remettre à zéro le compteur pour "${nom}" ?`)) {
        try {
            const r = await fetch(`/api/inventaire/reset/${id}`, { method: 'POST' });
            const data = await r.json();
            if (r.ok) {
                await afficherAlerte("Succès", data.message, "succes");
                chargerInventaire(true);
            } else {
                afficherAlerte("Erreur", data.erreur || "Impossible de réinitialiser cet article.", "erreur");
            }
        } catch(e) {}
    }
}

function changerPageInventaire(direction) {
    pageActuelleInventaire += direction;
    afficherInventaire(articlesFiltresGlobaux);
}

function ouvrirModalInventaire(id = null) {
    document.getElementById('modal-inventaire').style.display = 'flex';
    const form = document.getElementById('formInventaire');
    form.reset();
    
    if (id) {
        document.getElementById('titre-modal-inventaire').innerText = '✏️ Modifier l\'Article';
        articleEnEdition = tousLesArticles.find(a => a.id === id);
        document.getElementById('inv_id').value = articleEnEdition.id;
        document.getElementById('inv_reference').value = articleEnEdition.reference || '';
        document.getElementById('inv_designation').value = articleEnEdition.designation || '';
        document.getElementById('inv_categorie').value = articleEnEdition.categorie || 'Matériel & Consommables';
        document.getElementById('inv_forme').value = articleEnEdition.forme || 'Matériel Médical';
        document.getElementById('inv_date_peremption').value = articleEnEdition.date_peremption || '';
        document.getElementById('inv_prix').value = articleEnEdition.prix_unitaire || 0;
        document.getElementById('inv_stock_initial').value = articleEnEdition.stock_initial || 0;
        document.getElementById('inv_entrees').value = articleEnEdition.entrees || 0;
        document.getElementById('inv_sorties').value = articleEnEdition.sorties || 0;
    } else {
        document.getElementById('titre-modal-inventaire').innerText = '📦 Ajouter un Article';
        articleEnEdition = null;
        document.getElementById('inv_id').value = '';
    }
}

function fermerModalInventaire() { document.getElementById('modal-inventaire').style.display = 'none'; }

document.getElementById('formInventaire')?.addEventListener('submit', async e => {
    e.preventDefault();
    const item = {
        reference: document.getElementById('inv_reference').value,
        designation: document.getElementById('inv_designation').value,
        categorie: document.getElementById('inv_categorie').value,
        forme: document.getElementById('inv_forme').value,
        date_peremption: document.getElementById('inv_date_peremption').value,
        prix_unitaire: parseFloat(document.getElementById('inv_prix').value) || 0,
        stock_initial: parseInt(document.getElementById('inv_stock_initial').value) || 0,
        entrees: parseInt(document.getElementById('inv_entrees').value) || 0,
        sorties: parseInt(document.getElementById('inv_sorties').value) || 0,
    };
    
    const id = document.getElementById('inv_id').value;
    const url = id ? `/api/inventaire/${id}` : '/api/inventaire';
    const method = id ? 'PUT' : 'POST';
    
    try {
        const r = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(item) });
        if(r.ok) {
            fermerModalInventaire();
            chargerInventaire(true); 
            afficherAlerte("Succès", id ? "Article mis à jour !" : "Article ajouté à l'inventaire !", "succes");
        }
    } catch(err){}
});

async function supprimerArticle(id) {
    if(confirm("Supprimer définitivement cet article de l'inventaire ?")) {
        await fetch(`/api/inventaire/${id}`, {method:'DELETE'});
        chargerInventaire(true); 
    }
}


// --- 11. GESTION DU PERSONNEL ---
function chargerPersonnel() {
    fetch('/api/personnel')
        .then(res => res.json())
        .then(data => {
            if (!data.erreur) {
                tousLesEmployes = data;
                filtrerPersonnel();
            }
        })
        .catch(e => console.error("Erreur chargement personnel", e));
}

function filtrerPersonnel() {
    const term = (document.getElementById('recherche-personnel')?.value || '').toLowerCase().trim();
    personnelFiltreGlobal = tousLesEmployes
        .filter(e => {
            return (e.nom_complet || '').toLowerCase().includes(term) ||
                   (e.poste || '').toLowerCase().includes(term);
        })
        .sort((a, b) => {
            const codeA = a.code_personnel || '';
            const codeB = b.code_personnel || '';
            return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
        });

    pageActuellePersonnel = 1;
    afficherPersonnel(personnelFiltreGlobal);
}

function afficherPersonnel(liste) {
    const tbody = document.getElementById('tbody-personnel');
    if (!tbody) return;
    tbody.innerHTML = '';

    let masseSalarialeNet = 0;
    liste.forEach(e => { masseSalarialeNet += (e.salaire_net || 0); });

    const badgeTotal = document.getElementById('total-personnel-badge');
    const badgeMasse = document.getElementById('total-masse-salariale-badge');
    if (badgeTotal) badgeTotal.innerText = liste.length;
    if (badgeMasse) badgeMasse.innerText = masseSalarialeNet.toLocaleString('fr-FR') + ' Ar';

    if (liste.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#64748B;">Aucun employé trouvé.</td></tr>';
        document.getElementById('pagination-personnel').innerHTML = '';
        return;
    }

    const maxPage = Math.ceil(liste.length / personnelParPage);
    if (pageActuellePersonnel > maxPage && maxPage > 0) pageActuellePersonnel = maxPage;

    const employesPage = liste.slice((pageActuellePersonnel - 1) * personnelParPage, pageActuellePersonnel * personnelParPage);

    employesPage.forEach((emp, index) => {
        const indexGlobal = (pageActuellePersonnel - 1) * personnelParPage + index;
        let dateEmb = emp.date_embauche ? formaterDateEnLettres(emp.date_embauche) : 'Non renseignée';
        let matricule = emp.code_personnel || `TPFV_${(indexGlobal + 1).toString().padStart(3, '0')}`;

        tbody.innerHTML += `
            <tr style="border-bottom:1px solid #E2E8F0;">
                <td style="padding:10px;"><span style="font-family:monospace; background:#F1F5F9; border:1px solid #CBD5E1; padding:3px 8px; border-radius:6px; font-weight:bold; color:#0369A1;">${matricule}</span></td>
                <td style="padding:10px; font-weight:bold; color:#0F172A;">${emp.nom_complet}</td>
                <td style="padding:10px;"><span style="background:#E0F2FE; color:#0369A1; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:11px;">${emp.poste || 'N/A'}</span></td>
                <td style="padding:10px;">${dateEmb}</td>
                <td style="padding:10px; text-align:right;">${(emp.salaire_brut || 0).toLocaleString('fr-FR')} Ar</td>
                <td style="padding:10px; text-align:right; font-weight:bold; color:#0D9488;">${(emp.salaire_net || 0).toLocaleString('fr-FR')} Ar</td>
                <td style="padding:10px; text-align:center;">
                    <button onclick="ouvrirModalPaiement(${emp.id})" style="background:#0D9488;color:white;border:none;padding:6px;border-radius:4px;cursor:pointer;font-size:12px;margin-right:4px;" title="Suivi & Règlement de Salaire">💳</button>
                    <button onclick="ouvrirModalPersonnel(${emp.id})" style="background:var(--bleu-primaire);color:white;border:none;padding:6px;border-radius:4px;cursor:pointer;font-size:12px;margin-right:4px;" title="Modifier">✏️</button>
                    <button onclick="supprimerEmploye(${emp.id})" style="background:#EF4444;color:white;border:none;padding:6px;border-radius:4px;cursor:pointer;font-size:12px;" title="Supprimer">🗑️</button>
                </td>
            </tr>
        `;
    });

    const pagin = document.getElementById('pagination-personnel');
    if (pagin) {
        pagin.innerHTML = maxPage > 1 ? 
            `<button onclick="changerPagePersonnel(-1)" ${pageActuellePersonnel===1?'disabled':''}>Précédent</button> Page ${pageActuellePersonnel}/${maxPage} <button onclick="changerPagePersonnel(1)" ${pageActuellePersonnel===maxPage?'disabled':''}>Suivant</button>` 
            : '';
    }
}

function changerPagePersonnel(direction) {
    pageActuellePersonnel += direction;
    afficherPersonnel(personnelFiltreGlobal);
}

// --- SUIVI GÉNÉRAL MENSUEL DES SALAIRES ---
function ouvrirModalSuiviGlobalPaie() {
    document.getElementById('modal-suivi-global-paie').style.display = 'flex';
    const aujourdhui = new Date();
    const moisDefaut = `${aujourdhui.getFullYear()}-${(aujourdhui.getMonth() + 1).toString().padStart(2, '0')}`;
    document.getElementById('global_paie_mois_select').value = moisDefaut;
    chargerSuiviGlobalMois();
}

function fermerModalSuiviGlobalPaie() {
    document.getElementById('modal-suivi-global-paie').style.display = 'none';
}

function chargerSuiviGlobalMois() {
    const moisSelect = document.getElementById('global_paie_mois_select').value;
    if (!moisSelect) return;

    fetch(`/api/personnel/paiements-globaux/${moisSelect}`)
        .then(res => res.json())
        .then(data => {
            afficherTableauSuiviGlobalPaie(data);
        })
        .catch(e => console.error("Erreur chargement rapport mensuel", e));
}

function afficherTableauSuiviGlobalPaie(liste) {
    const tbody = document.getElementById('tbody-suivi-global-paie');
    if (!tbody) return;
    tbody.innerHTML = '';

    let cumulNetTotal = 0, cumulPaye = 0, cumulReste = 0;

    if (liste.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:15px; color:#64748B;">Aucune donnée enregistrée pour ce mois.</td></tr>';
        return;
    }

    liste.forEach((emp, index) => {
        const matricule = emp.code_personnel || `TPFV_${(index + 1).toString().padStart(3, '0')}`;
        const brut = emp.salaire_brut || 0;
        const cnaps = emp.cnaps !== undefined && emp.cnaps !== null ? emp.cnaps : Math.round(brut * 0.01);
        const irsa = emp.irsa !== undefined && emp.irsa !== null ? emp.irsa : 3000;
        const netBase = brut - cnaps - irsa;
        const indemnites = emp.indemnites || 0;
        const retard = emp.retard || 0;
        const avances = emp.avances || 0;

        const netAPayer = netBase + indemnites - retard - avances;
        const statut = emp.statut || 'Non payé';

        cumulNetTotal += netAPayer;
        if (statut === 'Payé') cumulPaye += netAPayer;
        else cumulReste += netAPayer;

        const badgeStatut = statut === 'Payé'
            ? '<span style="background:#DCFCE7; color:#15803D; padding:2px 8px; border-radius:4px; font-weight:bold;">🟢 Payé</span>'
            : '<span style="background:#FEE2E2; color:#B91C1C; padding:2px 8px; border-radius:4px; font-weight:bold;">🔴 Non payé</span>';

        tbody.innerHTML += `
            <tr style="border-bottom:1px solid #E2E8F0;">
                <td style="padding:8px;"><span style="font-family:monospace; font-weight:bold; color:#0369A1;">${matricule}</span></td>
                <td style="padding:8px; font-weight:bold;">${emp.nom_complet}</td>
                <td style="padding:8px;">${emp.poste || 'N/A'}</td>
                <td style="padding:8px; text-align:right;">${brut.toLocaleString('fr-FR')} Ar</td>
                <td style="padding:8px; text-align:right; color:#64748B;">${cnaps.toLocaleString('fr-FR')} Ar</td>
                <td style="padding:8px; text-align:right; color:#64748B;">${irsa.toLocaleString('fr-FR')} Ar</td>
                <td style="padding:8px; text-align:right; color:#15803D;">+${indemnites.toLocaleString('fr-FR')} Ar</td>
                <td style="padding:8px; text-align:right; color:#B91C1C;">-${(retard + avances).toLocaleString('fr-FR')} Ar</td>
                <td style="padding:8px; text-align:right; font-weight:bold; color:#0284C7;">${netAPayer.toLocaleString('fr-FR')} Ar</td>
                <td style="padding:8px; text-align:center;">${badgeStatut}</td>
            </tr>
        `;
    });

    document.getElementById('global_total_net').innerText = `${cumulNetTotal.toLocaleString('fr-FR')} Ar`;
    document.getElementById('global_total_paye').innerText = `${cumulPaye.toLocaleString('fr-FR')} Ar`;
    document.getElementById('global_total_reste').innerText = `${cumulReste.toLocaleString('fr-FR')} Ar`;
}

// GESTION DU SUIVI DE PAIEMENT INDIVIDUEL DU SALAIRE
function ouvrirModalPaiement(id) {
    employePaiementActuel = tousLesEmployes.find(e => e.id === id);
    if (!employePaiementActuel) return;

    document.getElementById('modal-paiement-personnel').style.display = 'flex';
    document.getElementById('paie_personnel_id').value = employePaiementActuel.id;
    document.getElementById('paie_nom_complet').innerText = employePaiementActuel.nom_complet;
    document.getElementById('paie_poste_info').innerText = `Poste : ${employePaiementActuel.poste || 'N/A'}`;
    document.getElementById('paie_salaire_brut_base').innerText = `${(employePaiementActuel.salaire_brut || 0).toLocaleString('fr-FR')} Ar`;

    const aujourdhui = new Date();
    const moisDefaut = `${aujourdhui.getFullYear()}-${(aujourdhui.getMonth() + 1).toString().padStart(2, '0')}`;
    document.getElementById('paie_mois').value = moisDefaut;
    document.getElementById('paie_date_paiement').value = aujourdhui.toISOString().slice(0, 10);

    chargerPaiementMois();
}

function fermerModalPaiement() { document.getElementById('modal-paiement-personnel').style.display = 'none'; }

function chargerPaiementMois() {
    if (!employePaiementActuel) return;
    const moisSelect = document.getElementById('paie_mois').value;
    if (!moisSelect) return;

    const brut = employePaiementActuel.salaire_brut || 0;
    const cnapsAutomatique = Math.round(brut * 0.01);
    document.getElementById('paie_cnaps').value = cnapsAutomatique;

    fetch(`/api/personnel/${employePaiementActuel.id}/paiements/${moisSelect}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('paie_irsa').value = data.irsa !== undefined ? data.irsa : 3000;
            document.getElementById('paie_indemnites').value = data.indemnites || 0;
            document.getElementById('paie_retard').value = data.retard || 0;
            document.getElementById('paie_avances').value = data.avances || 0;

            const radios = document.getElementsByName('paie_statut');
            radios.forEach(r => r.checked = (r.value === (data.statut || 'Non payé')));

            calculerTotalPaiement();
        })
        .catch(e => console.error("Erreur de chargement de paie", e));
}

function calculerTotalPaiement() {
    if (!employePaiementActuel) return;

    const brut = employePaiementActuel.salaire_brut || 0;
    const cnaps = Math.round(brut * 0.01);
    document.getElementById('paie_cnaps').value = cnaps;

    const irsa = parseFloat(document.getElementById('paie_irsa').value) || 0;
    const indemnites = parseFloat(document.getElementById('paie_indemnites').value) || 0;
    const retard = parseFloat(document.getElementById('paie_retard').value) || 0;
    const avances = parseFloat(document.getElementById('paie_avances').value) || 0;

    const salaireNetCalcule = brut - cnaps - irsa;
    document.getElementById('paie_salaire_net_base').innerText = `${salaireNetCalcule.toLocaleString('fr-FR')} Ar`;

    const totalCalcul = salaireNetCalcule + indemnites - retard - avances;
    document.getElementById('paie_total_affiche').innerText = `${totalCalcul.toLocaleString('fr-FR')} Ar`;
}

async function sauvegarderPaiementPersonnel(event) {
    event.preventDefault();
    if (!employePaiementActuel) return;

    const mois = document.getElementById('paie_mois').value;
    const brut = employePaiementActuel.salaire_brut || 0;
    const cnaps = Math.round(brut * 0.01);
    const irsa = parseFloat(document.getElementById('paie_irsa').value) || 0;
    const indemnites = parseFloat(document.getElementById('paie_indemnites').value) || 0;
    const retard = parseFloat(document.getElementById('paie_retard').value) || 0;
    const avances = parseFloat(document.getElementById('paie_avances').value) || 0;
    const date_paiement = document.getElementById('paie_date_paiement').value;

    const salaireNetCalcule = brut - cnaps - irsa;
    const total_paye = salaireNetCalcule + indemnites - retard - avances;

    const radios = document.getElementsByName('paie_statut');
    let statut = 'Non payé';
    radios.forEach(r => { if (r.checked) statut = r.value; });

    const payload = { mois, statut, cnaps, irsa, indemnites, retard, avances, total_paye, date_paiement };

    try {
        const res = await fetch(`/api/personnel/${employePaiementActuel.id}/paiements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            await afficherAlerte("Succès", data.message, "succes");
            fermerModalPaiement();
            if (document.getElementById('modal-suivi-global-paie').style.display === 'flex') chargerSuiviGlobalMois();
        } else {
            afficherAlerte("Erreur", data.erreur || "Impossible d'enregistrer le paiement.", "erreur");
        }
    } catch(e) {}
}

function ouvrirModalPersonnel(id = null) {
    document.getElementById('modal-personnel').style.display = 'flex';
    const form = document.getElementById('formPersonnel');
    form.reset();

    if (id) {
        document.getElementById('titre-modal-personnel').innerText = "✏️ Modifier l'Employé";
        employeEnEdition = tousLesEmployes.find(e => e.id === id);
        document.getElementById('pers_id').value = employeEnEdition.id;
        document.getElementById('pers_nom_complet').value = employeEnEdition.nom_complet || '';
        document.getElementById('pers_poste').value = employeEnEdition.poste || '';
        document.getElementById('pers_date_embauche').value = employeEnEdition.date_embauche || '';
        document.getElementById('pers_telephone').value = employeEnEdition.telephone || '';
        document.getElementById('pers_salaire_brut').value = employeEnEdition.salaire_brut || 0;
        document.getElementById('pers_salaire_net').value = employeEnEdition.salaire_net || 0;
        document.getElementById('pers_adresse').value = employeEnEdition.adresse || '';
    } else {
        document.getElementById('titre-modal-personnel').innerText = "👩‍⚕️ Ajouter un Employé";
        employeEnEdition = null;
        document.getElementById('pers_id').value = '';
    }
}

function fermerModalPersonnel() { document.getElementById('modal-personnel').style.display = 'none'; }

document.getElementById('formPersonnel')?.addEventListener('submit', async e => {
    e.preventDefault();
    const item = {
        nom_complet: document.getElementById('pers_nom_complet').value,
        poste: document.getElementById('pers_poste').value,
        date_embauche: document.getElementById('pers_date_embauche').value,
        telephone: document.getElementById('pers_telephone').value,
        salaire_brut: parseFloat(document.getElementById('pers_salaire_brut').value) || 0,
        salaire_net: parseFloat(document.getElementById('pers_salaire_net').value) || 0,
        adresse: document.getElementById('pers_adresse').value
    };

    const id = document.getElementById('pers_id').value;
    const url = id ? `/api/personnel/${id}` : '/api/personnel';
    const method = id ? 'PUT' : 'POST';

    try {
        const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
        if (r.ok) {
            fermerModalPersonnel();
            chargerPersonnel();
            afficherAlerte("Succès", id ? "Employé mis à jour !" : "Nouveau membre du personnel ajouté !", "succes");
        }
    } catch (err) {}
});

async function supprimerEmploye(id) {
    if (confirm("Voulez-vous vraiment supprimer cet employé de la base officielle ?")) {
        await fetch(`/api/personnel/${id}`, { method: 'DELETE' });
        chargerPersonnel();
    }
}