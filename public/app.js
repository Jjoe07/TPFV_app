// =========================================================================
// FICHIER : app.js
// Rôle : Client TPFV, Sécurisation Onglets (Inventaire réservé Admin)
// =========================================================================

let tousLesPatients = []; 
let patientsFiltresGlobaux = []; 
let pageActuelle = 1;
const patientsParPage = 10; 

let tousLesProduits = [];
let produitsFiltresGlobaux = [];
let roleActuel = ''; 

// --- 1. THÈME & ALERTES POP-UP ---
function basculerTheme() {
    const body = document.body;
    body.classList.toggle('dark-theme');
    const estSombre = body.classList.contains('dark-theme');
    localStorage.setItem('themeClinique', estSombre ? 'sombre' : 'clair');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.innerText = estSombre ? '☀️ Mode Clair' : '🌙 Mode Sombre';
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

function formaterDateEtAge(dateString) {
    if (!dateString) return 'Non renseignée';
    const parties = dateString.split('-');
    if (parties.length !== 3) return dateString;
    const [annee, mois, jour] = parties;

    const dateNaissance = new Date(annee, mois - 1, jour);
    const aujourdhui = new Date();
    let age = aujourdhui.getFullYear() - dateNaissance.getFullYear();
    const m = aujourdhui.getMonth() - dateNaissance.getMonth();
    if (m < 0 || (m === 0 && aujourdhui.getDate() < dateNaissance.getDate())) {
        age--;
    }

    const dateFormatee = `${jour.padStart(2, '0')}/${mois.padStart(2, '0')}/${annee}`;
    return `${dateFormatee} (${age} ans)`;
}

function formaterAriary(montant) {
    return new Intl.NumberFormat('fr-FR').format(Math.round(montant || 0)) + ' Ar';
}

// --- 2. GESTION DES RÔLES ET ACCÈS SÉCURISÉS ---
function appliquerDroitsRole(role) {
    roleActuel = role;
    
    const ecranConnexion = document.getElementById('ecran-connexion');
    const appPrincipale = document.getElementById('application-principale');

    if (ecranConnexion) {
        ecranConnexion.classList.remove('section-visible');
        ecranConnexion.classList.add('section-cachee');
    }

    if (appPrincipale) {
        appPrincipale.classList.remove('section-cachee');
        appPrincipale.classList.add('section-visible', 'animate-fade');
    }
    
    const btnInventaire = document.getElementById('btn-inventaire');
    const btnParametres = document.getElementById('btn-parametres');
    const btnCompte = document.getElementById('btn-compte');
    const champsMedicaux = document.getElementById('champs-medicaux'); 
    const btnTheme = document.getElementById('btn-theme'); 
    
    // VERROUILLAGE SÉCURITÉ : AGENT ET SUPPORT N'ONT PAS ACCÈS À L'INVENTAIRE
    if (roleActuel === 'agent' || roleActuel === 'support') {
        if (btnInventaire) btnInventaire.style.display = 'none'; // MASQUÉ !
        if (btnParametres) btnParametres.style.display = 'none';
        if (btnCompte) btnCompte.style.display = 'none';
        changerOnglet('patients'); 
    } else if (roleActuel === 'admin') {
        if (btnInventaire) btnInventaire.style.display = 'block'; // AUTORISÉ UNIQUEMENT AUX ADMINS !
        if (btnParametres) btnParametres.style.display = 'block';
        if (btnCompte) btnCompte.style.display = 'block';
    }
    
    if (roleActuel === 'agent') {
        if (champsMedicaux) champsMedicaux.style.display = 'none';
        if (btnTheme) btnTheme.style.display = 'none';
        document.body.classList.remove('dark-theme');
    } else {
        if (champsMedicaux) champsMedicaux.style.display = 'block'; 
        if (btnTheme) btnTheme.style.display = 'block';
        const themeSauvegarde = localStorage.getItem('themeClinique');
        if (themeSauvegarde === 'sombre') {
            document.body.classList.add('dark-theme');
            if (btnTheme) btnTheme.innerText = '☀️ Mode Clair';
        } else {
            document.body.classList.remove('dark-theme');
            if (btnTheme) btnTheme.innerText = '🌙 Mode Sombre';
        }
    }
    
    chargerPatients();
    
    // CHARGER L'INVENTAIRE UNIQUEMENT POUR L'ADMIN
    if (roleActuel === 'admin') {
        chargerInventaire();
    }
}

async function seConnecter() {
    const roleSaisi = document.getElementById('choix-role').value;
    const mdpSaisi = document.getElementById('mot-de-passe').value;
    if (!mdpSaisi) return afficherAlerte("Champs requis", "Veuillez entrer votre mot de passe.", "info");
    try {
        const reponse = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: roleSaisi, mot_de_passe: mdpSaisi }) });
        if (!reponse.ok) {
            const err = await reponse.json().catch(() => ({erreur: "Mot de passe incorrect."}));
            return afficherAlerte("Accès refusé", err.erreur, "erreur");
        }
        localStorage.setItem('sessionCliniqueRole', roleSaisi);
        appliquerDroitsRole(roleSaisi);
        document.getElementById('mot-de-passe').value = '';
    } catch (erreur) { afficherAlerte("Erreur réseau", "Impossible de joindre le serveur.", "erreur"); }
}

function seDeconnecter() {
    roleActuel = ''; 
    localStorage.removeItem('sessionCliniqueRole');
    document.body.classList.remove('dark-theme'); 

    const ecranConnexion = document.getElementById('ecran-connexion');
    const appPrincipale = document.getElementById('application-principale');

    if (appPrincipale) {
        appPrincipale.classList.remove('section-visible');
        appPrincipale.classList.add('section-cachee');
    }

    if (ecranConnexion) {
        ecranConnexion.classList.remove('section-cachee');
        ecranConnexion.classList.add('section-visible');
    }
}

// --- 3. RECHERCHE TEMPS RÉEL PATIENTS ---
function filtrerPatients() {
    const me = document.getElementById('champ-recherche');
    const fe = document.getElementById('filtre-recherche');
    
    const terme = me ? me.value.toLowerCase().trim() : '';
    const filtre = fe ? fe.value : 'tout';

    patientsFiltresGlobaux = tousLesPatients.filter(p => {
        const nom = (p.nom_complet || '').toLowerCase();
        const code = (p.code_patient || '').toLowerCase();
        const tel = (p.telephone || '').toLowerCase();

        if (!terme) return true;
        if (filtre === 'nom') return nom.includes(terme);
        if (filtre === 'code') return code.includes(terme);
        if (filtre === 'telephone') return tel.includes(terme);
        return nom.includes(terme) || code.includes(terme) || tel.includes(terme);
    });

    pageActuelle = 1;
    afficherPatients(patientsFiltresGlobaux);
}

// --- 4. INITIALISATION DES ÉCOUTEURS ---
window.addEventListener('DOMContentLoaded', () => {
    const champ = document.getElementById('champ-recherche');
    const filtre = document.getElementById('filtre-recherche');
    if (champ) champ.addEventListener('input', filtrerPatients);
    if (filtre) filtre.addEventListener('change', filtrerPatients);

    // RÉINITIALISATION MOT DE PASSE ÉQUIPE
    const formResetEquipe = document.getElementById('formResetMdpEquipe');
    if (formResetEquipe) {
        formResetEquipe.addEventListener('submit', async function(e) {
            e.preventDefault();
            const roleAModifier = document.getElementById('role-a-modifier').value;
            const nouveauMdp = document.getElementById('nouveau-mdp-equipe').value;

            if (!nouveauMdp || !nouveauMdp.trim()) {
                return afficherAlerte("Champ requis", "Veuillez saisir un mot de passe.", "info");
            }

            try {
                const reponse = await fetch('/api/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role_a_modifier: roleAModifier, nouveau_mot_de_passe: nouveauMdp.trim() })
                });

                let data = {};
                try { data = await reponse.json(); } catch (jsonErr) { data = { erreur: "Redémarrez le serveur Node.js." }; }

                if (reponse.ok) {
                    await afficherAlerte("Succès", data.message || `Le mot de passe de ${roleAModifier.toUpperCase()} a été mis à jour !`, "succes");
                    formResetEquipe.reset();
                } else {
                    await afficherAlerte("Erreur", data.erreur || "Impossible de modifier le mot de passe.", "erreur");
                }
            } catch (erreur) {
                await afficherAlerte("Erreur réseau", "Impossible de contacter le serveur.", "erreur");
            }
        });
    }

    // MODIFICATION MOT DE PASSE ADMIN
    const formResetAdmin = document.getElementById('formResetMdpAdmin');
    if (formResetAdmin) {
        formResetAdmin.addEventListener('submit', async function(e) {
            e.preventDefault();
            const ancienMdp = document.getElementById('ancien-mdp-admin').value;
            const nouveauMdp = document.getElementById('nouveau-mdp-admin').value;

            if (!ancienMdp || !nouveauMdp) {
                return afficherAlerte("Champs requis", "Veuillez remplir tous les champs.", "info");
            }

            try {
                const reponse = await fetch('/api/admin-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ancien_mot_de_passe: ancienMdp, nouveau_mot_de_passe: nouveauMdp.trim() })
                });

                let data = {};
                try { data = await reponse.json(); } catch (jsonErr) { data = { erreur: "Redémarrez le serveur Node.js." }; }

                if (reponse.ok) {
                    await afficherAlerte("Succès", data.message || "Votre mot de passe Administrateur a été modifié !", "succes");
                    formResetAdmin.reset();
                } else {
                    await afficherAlerte("Accès refusé", data.erreur || "Ancien mot de passe incorrect.", "erreur");
                }
            } catch (erreur) {
                await afficherAlerte("Erreur réseau", "Impossible de contacter le serveur.", "erreur");
            }
        });
    }

    // SOUMISSION PRODUIT INVENTAIRE
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
                    await afficherAlerte("Succès", id ? "Produit mis à jour !" : "Produit ajouté à l'inventaire !", "succes");
                    fermerModalInventaire();
                    chargerInventaire();
                } else {
                    const err = await reponse.json();
                    await afficherAlerte("Erreur", err.erreur || "Action impossible.", "erreur");
                }
            } catch (erreur) {
                await afficherAlerte("Erreur réseau", "Connexion interrompue.", "erreur");
            }
        });
    }

    // SOUMISSION MOUVEMENT RAPIDE DE STOCK
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
                } else {
                    const err = await reponse.json();
                    await afficherAlerte("Erreur", err.erreur || "Mouvement impossible.", "erreur");
                }
            } catch (erreur) {
                await afficherAlerte("Erreur réseau", "Connexion interrompue.", "erreur");
            }
        });
    }

    const sessionActive = localStorage.getItem('sessionCliniqueRole');
    if (sessionActive && sessionActive !== 'agent') {
        const themeSauvegarde = localStorage.getItem('themeClinique');
        if (themeSauvegarde === 'sombre') document.body.classList.add('dark-theme');
    }
    if (sessionActive) appliquerDroitsRole(sessionActive);
});

// --- 5. NAVIGATION ONGLETS AVEC BARRIÈRE DE SÉCURITÉ ---
function changerOnglet(section) {
    // BARRIÈRE STRICTE : SI NI ADMIN, INTERDIRE L'INVENTAIRE
    if ((roleActuel === 'agent' || roleActuel === 'support') && section === 'inventaire') {
        section = 'patients'; // Redirection automatique vers Patients
    }

    const sections = ['patients', 'inventaire', 'parametres', 'compte'];
    sections.forEach(sec => {
        const elSec = document.getElementById(`section-${sec}`);
        const elBtn = document.getElementById(`btn-${sec}`);
        if (elSec) {
            elSec.classList.remove('section-visible', 'animate-fade');
            elSec.classList.add('section-cachee');
        }
        if (elBtn) elBtn.classList.remove('actif');
    });

    const activeSec = document.getElementById(`section-${section}`);
    const activeBtn = document.getElementById(`btn-${section}`);
    if (activeSec) {
        activeSec.classList.remove('section-cachee');
        activeSec.classList.add('section-visible', 'animate-fade');
    }
    if (activeBtn) activeBtn.classList.add('actif');
}

function changerSousOngletPatients(onglet) {
    const btnListe = document.getElementById('btn-sous-liste');
    const btnForm = document.getElementById('btn-sous-form');
    const zoneListe = document.getElementById('zone-liste-patients');
    const zoneForm = document.getElementById('zone-form-patient');

    if (onglet === 'liste') {
        if (btnListe) btnListe.classList.add('actif');
        if (btnForm) btnForm.classList.remove('actif');
        if (zoneListe) { zoneListe.classList.remove('section-cachee'); zoneListe.classList.add('section-visible'); }
        if (zoneForm) { zoneForm.classList.add('section-cachee'); zoneForm.classList.remove('section-visible'); }
        pageActuelle = 1;
        afficherPatients(patientsFiltresGlobaux);
    } else if (onglet === 'form') {
        if (btnForm) btnForm.classList.add('actif');
        if (btnListe) btnListe.classList.remove('actif');
        if (zoneForm) { zoneForm.classList.remove('section-cachee'); zoneForm.classList.add('section-visible'); }
        if (zoneListe) { zoneListe.classList.add('section-cachee'); zoneListe.classList.remove('section-visible'); }
    }
}

// --- 6. CHARGEMENT DONNÉES PATIENTS ---
async function chargerPatients() {
    try {
        const reponse = await fetch('/api/patients');
        if (!reponse.ok) throw new Error();
        tousLesPatients = await reponse.json(); 
        filtrerPatients();
    } catch (e) {}
}

function afficherPatients(listeAAfficher) {
    const listElement = document.getElementById('listePatients');
    const paginationElement = document.getElementById('pagination-patients');
    if (!listElement) return;
    listElement.innerHTML = ''; 
    if (paginationElement) paginationElement.innerHTML = '';
    
    const badge = document.getElementById('total-dossiers-badge');
    if (badge) badge.innerText = listeAAfficher.length;

    if (listeAAfficher.length === 0) { 
        listElement.innerHTML = '<li style="text-align: center; color: var(--texte-clair); padding: 30px;">Aucun patient trouvé.</li>'; 
        return; 
    }

    const totalPages = Math.ceil(listeAAfficher.length / patientsParPage);
    if (pageActuelle > totalPages) pageActuelle = totalPages;
    if (pageActuelle < 1) pageActuelle = 1;

    const debut = (pageActuelle - 1) * patientsParPage;
    const fin = Math.min(debut + patientsParPage, listeAAfficher.length);
    const patientsDeLaPage = listeAAfficher.slice(debut, fin);

    patientsDeLaPage.forEach(patient => {
        const li = document.createElement('li');
        
        let boutonsActionsHTML = '';
        boutonsActionsHTML += `<button onclick="telechargerFicheA4(${patient.id})" style="background-color: #0D9488; color: white; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-right: 5px; font-weight: 600;">📄 Fiche A4</button>`;

        if (roleActuel === 'admin' || roleActuel === 'support') {
            boutonsActionsHTML += `<button onclick="ouvrirModalEdition(${patient.id})" style="background-color: var(--bleu-primaire); color: white; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-right: 5px; font-weight: 600;">✏️ Modifier</button>`;
        }
        if (roleActuel === 'admin') {
            boutonsActionsHTML += `<button onclick="supprimerPatient(${patient.id})" style="background-color: #EF4444; color: white; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-right: 10px; font-weight: 600;">🗑️ Supprimer</button>`;
        }

        const classeConsultation = (patient.consultation_statut === 'Payé') ? 'badge-paye' : 'badge-non-paye';
        const estControleRequis = (patient.besoin_controle === 'Oui');
        const classeControle = estControleRequis ? 'badge-controle-oui' : 'badge-controle-non';
        const texteControle = estControleRequis ? '⚠️ Contrôle requis' : '✅ Pas de contrôle requis';

        let antecedentsHTML = '';
        let zoneMedicaleHTML = '';

        if (roleActuel !== 'agent') {
            const badgeAllergie = patient.allergies ? `<span class="badge-allergie">⚠️ Allergies : ${patient.allergies}</span>` : '<span style="color: #0D9488;">Aucune allergie connue</span>';
            
            antecedentsHTML = `
            <div style="background: var(--fond-page); padding: 12px; border-radius: 10px; border: 1px solid var(--bordure); margin-top: 10px;">
                <div style="margin-bottom: 10px;">${badgeAllergie}</div>
                <div class="grille-2" style="font-size: 13px; margin-bottom: 10px;">
                    <div><strong>Maladies chroniques :</strong> ${patient.maladies_chroniques || 'Aucune'}</div>
                    <div><strong>Chirurgies antérieures :</strong> ${patient.chirurgies || 'Aucune'}</div>
                    <div><strong>Traitements en cours :</strong> ${patient.traitements_en_cours || 'Aucun'}</div>
                    <div><strong>Prochain rendez-vous :</strong> ${patient.prochain_rdv ? formaterDateEtAge(patient.prochain_rdv).split(' ')[0] : 'Non planifié'}</div>
                </div>
                <div style="border-top: 1px solid var(--bordure); padding-top: 8px; margin-top: 8px;">
                    <strong style="color: var(--bleu-primaire);">Motif de la visite :</strong> ${patient.motif_visite || 'Non renseigné'}<br>
                    <strong style="color: var(--vert-soin); display: inline-block; margin-top: 4px;">Diagnostic / Avis médical :</strong> ${patient.diagnostic || 'En attente'}
                </div>
            </div>`;

            let vitalsHTML = 'Non renseignés';
            try {
                if (patient.parametres && patient.parametres.startsWith('{')) {
                    const v = JSON.parse(patient.parametres);
                    const tempStyle = (v.temp > 38) ? 'color: #EF4444; font-weight: bold;' : (v.temp >= 36.5 && v.temp <= 37.5 ? 'color: #0D9488; font-weight: bold;' : 'color: #F59E0B; font-weight: bold;');
                    const poulsStyle = (v.pouls < 60 || v.pouls > 100) ? 'color: #EF4444; font-weight: bold;' : 'color: #0D9488; font-weight: bold;';
                    const tensStyle = (v.sys > 140 || v.dia > 90) ? 'color: #EF4444; font-weight: bold;' : (v.sys && v.dia ? 'color: #0D9488; font-weight: bold;' : '');
                    vitalsHTML = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-top: 8px; padding: 10px; border-radius: 6px; border: 1px solid var(--bordure); background-color: rgba(255,255,255,0.6);">
                        <span>🌡️ Température : <strong style="${tempStyle}">${v.temp ? v.temp + ' °C' : '--'}</strong></span>
                        <span>⚖️ Poids : <strong style="color: #0284C7;">${v.poids ? v.poids + ' kg' : '--'}</strong></span>
                        <span>❤️ Fréq. Cardiaque : <strong style="${poulsStyle}">${v.pouls ? v.pouls + ' bpm' : '--'}</strong></span>
                        <span>🩺 Tension : <strong style="${tensStyle}">${v.sys && v.dia ? v.sys + '/' + v.dia + ' mmHg' : '--'}</strong></span>
                    </div>`;
                }
            } catch (e) {}
            zoneMedicaleHTML = `<div class="zone-medicale"><strong style="color: var(--bleu-primaire);">📊 Paramètres vitaux :</strong>${vitalsHTML}<strong style="margin-top:12px; display:inline-block; color: var(--bleu-primaire);">📝 Notes médicales :</strong><p style="margin: 5px 0 0 0; white-space: pre-wrap; line-height: 1.5; overflow-wrap: anywhere; word-break: break-word;">${patient.notes || 'Aucune note'}</p></div>`;
        }

        li.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
            <strong style="font-size: 1.2em; color: var(--texte-sombre);">${patient.nom_complet}</strong>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                ${boutonsActionsHTML}
                <span class="${classeConsultation}">${patient.consultation_statut || 'Non payé'}</span>
                <span class="${classeControle}">${texteControle}</span>
                <span style="font-family: monospace; background: var(--fond-page); padding: 3px 8px; border-radius: 6px; font-weight: 600; font-size: 12px;">Code: ${patient.code_patient}</span>
            </div>
        </div>
        
        <div class="grille-2" style="font-size: 13px; color: var(--texte-clair); margin-bottom: 8px;">
            <span><strong>Sexe :</strong> ${patient.sexe || 'Non renseigné'}</span>
            <span><strong>Date de naissance :</strong> ${formaterDateEtAge(patient.date_naissance)}</span>
            <span><strong>Téléphone :</strong> ${patient.telephone}</span>
            <span><strong>Entré(e) le :</strong> ${formaterDateEtAge(patient.date_entree).split(' ')[0]}</span>
        </div>
        
        <div style="font-size: 13px; border-top: 1px dashed var(--bordure); padding-top: 8px; margin-bottom: 6px;">
            <strong>Adresse :</strong> ${patient.adresse || 'Non renseignée'}<br>
            <strong>Urgence :</strong> ${patient.contact_urgence || 'Aucun contact saisi'}
        </div>
        ${antecedentsHTML}
        ${zoneMedicaleHTML}
        `;

        listElement.appendChild(li);
    });

    if (totalPages > 1 && paginationElement) {
        paginationElement.innerHTML = `<button class="btn-page" onclick="changerPage(-1)" ${pageActuelle === 1 ? 'disabled' : ''}>Précédent</button><span>Page ${pageActuelle} / ${totalPages}</span><button class="btn-page" onclick="changerPage(1)" ${pageActuelle === totalPages ? 'disabled' : ''}>Suivant</button>`;
    }
}

function changerPage(dir) { pageActuelle += dir; afficherPatients(patientsFiltresGlobaux); }

// --- 7. LOGIQUE MODULE INVENTAIRE PHARMACIE ---
async function chargerInventaire() {
    if (roleActuel !== 'admin') return; // Bloquer la requête réseau pour les non-admins
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

    afficherInventaire(produitsFiltresGlobaux);
}

function afficherInventaire(liste) {
    const corps = document.getElementById('corpsTableauInventaire');
    if (!corps) return;
    corps.innerHTML = '';

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

    const kpiTotal = document.getElementById('kpi-total-articles');
    const kpiValeur = document.getElementById('kpi-valeur-stock');
    const kpiRuptures = document.getElementById('kpi-ruptures');
    const kpiPeremptions = document.getElementById('kpi-peremptions');

    if (kpiTotal) kpiTotal.innerText = totalArticles;
    if (kpiValeur) kpiValeur.innerText = formaterAriary(valeurTotaleStock);
    if (kpiRuptures) kpiRuptures.innerText = nbRuptures;
    if (kpiPeremptions) kpiPeremptions.innerText = nbPeremptions;

    if (liste.length === 0) {
        corps.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--texte-clair); padding: 25px;">Aucun produit ne correspond à votre recherche.</td></tr>`;
        return;
    }

    liste.forEach(p => {
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
            const dateStr = formaterDateEtAge(p.date_peremption).split(' ')[0];

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

        let boutonsActionsAdmin = '';
        if (roleActuel === 'admin' || roleActuel === 'support') {
            boutonsActionsAdmin = `
                <button onclick="ouvrirModalEditionProduit(${p.id})" class="btn-inv-icon" title="Modifier la fiche">✏️</button>
            `;
        }
        if (roleActuel === 'admin') {
            boutonsActionsAdmin += `
                <button onclick="supprimerProduit(${p.id})" class="btn-inv-icon rouge" title="Supprimer le produit">🗑️</button>
            `;
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
                ${boutonsActionsAdmin}
            </td>
        `;

        corps.appendChild(tr);
    });
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
    if (confirm("⚠️ Êtes-vous sûr de vouloir supprimer définitivement ce produit de l'inventaire ?")) {
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

// --- 8. RAPPORT D'INVENTAIRE A4 (VISIONNEUSE HD NATIVE) ---
function imprimerRapportInventaireA4() {
    let totalArticles = tousLesProduits.length;
    let valeurTotaleStock = 0;

    let lignesHTML = '';
    tousLesProduits.forEach((p, idx) => {
        const reste = p.quantite || 0;
        const pu = p.prix_unitaire || 0;
        const val = reste * pu;
        valeurTotaleStock += val;

        const dpStr = p.date_peremption ? formaterDateEtAge(p.date_peremption).split(' ')[0] : 'N/A';

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
    if (!fenetre) {
        return afficherAlerte("Pop-up bloqué", "Veuillez autoriser les fenêtres surgissantes pour voir le rapport.", "info");
    }

    fenetre.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Rapport_Inventaire_TPFV_${new Date().toISOString().slice(0,10)}</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body {
                    font-family: Arial, Helvetica, sans-serif;
                    color: #0F172A;
                    background-color: #525659;
                    margin: 0;
                    padding: 20px 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .barre-outils-pdf {
                    position: fixed; top: 0; left: 0; right: 0;
                    background: #1E293B; color: white; padding: 10px 20px;
                    display: flex; justify-content: space-between; align-items: center;
                    z-index: 10000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);
                }
                .btn-pdf {
                    background: #0284C7; color: white; border: none;
                    padding: 8px 16px; border-radius: 6px; font-weight: bold;
                    cursor: pointer; font-size: 13px;
                }
                .btn-pdf:hover { background: #0369A1; }
                .page-a4 {
                    background: #FFFFFF; width: 210mm; min-height: 297mm;
                    padding: 15mm; box-sizing: border-box;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.3); margin-top: 50px;
                    overflow: hidden;
                }
                @media print {
                    .barre-outils-pdf { display: none !important; }
                    body { background: white; padding: 0; }
                    .page-a4 { width: 100%; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
                }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                td, th { vertical-align: middle; word-break: break-word; overflow-wrap: anywhere; }
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

                <table style="border-collapse: collapse;">
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
                    <tbody>
                        ${lignesHTML}
                    </tbody>
                </table>

                <table style="margin-top: 30px; font-size: 10px; color: #475569;">
                    <tr>
                        <td style="width: 60%;">Rapport de stock officiel généré par le logiciel TPFV.</td>
                        <td style="width: 40%; text-align: right;">
                            <div style="display: inline-block; text-align: center; border-top: 1px solid #94A3B8; width: 180px; padding-top: 4px;">
                                <strong>Visa Pharmacien / Resp.</strong>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>
        </body>
        </html>
    `);
    fenetre.document.close();
}

// --- 9. FICHE PATIENT A4 (CORRECTION ANTI-DÉBORDEMENT TEXTE SANS ESPACE) ---
function telechargerFicheA4(id) {
    const patient = tousLesPatients.find(p => p.id === id);
    if (!patient) return;

    let v = { temp: '--', poids: '--', pouls: '--', sys: '--', dia: '--' };
    try {
        if (patient.parametres && patient.parametres.startsWith('{')) {
            v = JSON.parse(patient.parametres);
        }
    } catch (e) {}

    const nomFichierFormat = (patient.nom_complet || 'Patient')
        .trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, '_');

    const nomPDFOfficiel = `Fiche_Medicale_${nomFichierFormat}.pdf`;

    const fenetre = window.open('', '_blank');
    if (!fenetre) {
        return afficherAlerte("Pop-up bloqué", "Veuillez autoriser les fenêtres surgissantes pour voir la fiche.", "info");
    }

    fenetre.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>${nomPDFOfficiel}</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body {
                    font-family: Arial, Helvetica, sans-serif;
                    color: #0F172A;
                    background-color: #525659;
                    margin: 0;
                    padding: 20px 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .barre-outils-pdf {
                    position: fixed; top: 0; left: 0; right: 0;
                    background: #1E293B; color: white; padding: 10px 20px;
                    display: flex; justify-content: space-between; align-items: center;
                    z-index: 10000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);
                }
                .btn-pdf {
                    background: #0284C7; color: white; border: none;
                    padding: 8px 16px; border-radius: 6px; font-weight: bold;
                    cursor: pointer; font-size: 13px;
                }
                .btn-pdf.vert { background: #0D9488; }
                .btn-pdf:hover { opacity: 0.9; }
                .page-a4 {
                    background: #FFFFFF; width: 210mm; min-height: 297mm;
                    padding: 15mm; box-sizing: border-box;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.3); margin-top: 50px;
                    overflow: hidden;
                }
                @media print {
                    .barre-outils-pdf { display: none !important; }
                    body { background: white; padding: 0; }
                    .page-a4 { width: 100%; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
                }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                
                td, p, div {
                    vertical-align: top;
                    overflow-wrap: anywhere !important;
                    word-break: break-all !important;
                    word-wrap: break-word !important;
                }
            </style>
        </head>
        <body>
            <div class="barre-outils-pdf">
                <span>📄 Fiche Médicale : <strong>${patient.nom_complet}</strong></span>
                <div>
                    <button class="btn-pdf vert" onclick="telechargerDirectPDF()">📥 Télécharger PDF</button>
                    <button class="btn-pdf" style="margin-left: 8px;" onclick="window.print()">🖨️ Imprimer</button>
                    <button class="btn-pdf" style="background: #64748B; margin-left: 8px;" onclick="window.close()">❌ Fermer</button>
                </div>
            </div>

            <div class="page-a4" id="contenu-fiche-a4">
                <table style="border-bottom: 2px solid #0284C7; padding-bottom: 8px; margin-bottom: 15px;">
                    <tr>
                        <td style="width: 65%;">
                            <h1 style="color: #0284C7; margin: 0; font-size: 22px; font-weight: 800;">🏥 TPFV</h1>
                            <p style="margin: 4px 0 0 0; color: #475569; font-size: 11px; font-weight: 700;">Toeram - Pitsaboana Fanantenan'ny Vononkandresy III Jaona 2</p>
                        </td>
                        <td style="width: 35%; text-align: right; font-size: 11px; color: #475569;">
                            <p style="margin: 0;"><strong>Code Patient :</strong> <span style="font-family: monospace; font-size: 12px; font-weight: bold;">${patient.code_patient || 'N/A'}</span></p>
                            <p style="margin: 4px 0 0 0;"><strong>Date d'émission :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
                        </td>
                    </tr>
                </table>

                <h2 style="text-align: center; text-transform: uppercase; color: #0369A1; font-size: 13px; margin: 0 0 15px 0; background: #F0F9FF; padding: 6px; border-radius: 6px; border: 1px solid #BAE6FD;">
                    FICHE MÉDICALE ET HISTORIQUE DU PATIENT
                </h2>

                <!-- 1. INFORMATIONS ADMINISTRATIVES -->
                <div style="border: 1px solid #E0F2FE; border-radius: 8px; padding: 10px; margin-bottom: 12px; background-color: #FAFAFA;">
                    <h3 style="color: #0284C7; font-size: 12px; margin: 0 0 6px 0; border-bottom: 1px solid #E0F2FE; padding-bottom: 4px; text-transform: uppercase;">👤 Informations Administratives</h3>
                    <table style="font-size: 11px; line-height: 1.6;">
                        <tr>
                            <td style="width: 50%;"><strong>Nom et Prénom :</strong> ${patient.nom_complet || 'Non renseigné'}</td>
                            <td style="width: 50%;"><strong>Sexe :</strong> ${patient.sexe || 'Non renseigné'}</td>
                        </tr>
                        <tr>
                            <td><strong>Date de naissance :</strong> ${formaterDateEtAge(patient.date_naissance)}</td>
                            <td><strong>Téléphone :</strong> ${patient.telephone || 'Non renseigné'}</td>
                        </tr>
                        <tr>
                            <td><strong>Date d'entrée :</strong> ${formaterDateEtAge(patient.date_entree).split(' ')[0]}</td>
                            <td><strong>Adresse :</strong> ${patient.adresse || 'Non renseignée'}</td>
                        </tr>
                        <tr>
                            <td colspan="2"><strong>Contact d'Urgence :</strong> ${patient.contact_urgence || 'Aucun contact renseigné'}</td>
                        </tr>
                    </table>
                </div>

                <!-- 2. ANTÉCÉDENTS MÉDICAUX -->
                <div style="border: 1px solid #FCA5A5; border-radius: 8px; padding: 10px; margin-bottom: 12px; background-color: #FFF5F5;">
                    <h3 style="color: #DC2626; font-size: 12px; margin: 0 0 6px 0; border-bottom: 1px solid #FCA5A5; padding-bottom: 4px; text-transform: uppercase;">🩺 Antécédents Médicaux</h3>
                    <table style="font-size: 11px; line-height: 1.6;">
                        <tr>
                            <td colspan="2" style="color: #DC2626; font-weight: bold;"><strong>⚠️ Allergies connues :</strong> ${patient.allergies || 'Aucune allergie signalée'}</td>
                        </tr>
                        <tr>
                            <td style="width: 50%;"><strong>Maladies chroniques :</strong> ${patient.maladies_chroniques || 'Aucune'}</td>
                            <td style="width: 50%;"><strong>Chirurgies antérieures :</strong> ${patient.chirurgies || 'Aucune'}</td>
                        </tr>
                        <tr>
                            <td colspan="2"><strong>Traitements en cours :</strong> ${patient.traitements_en_cours || 'Aucun'}</td>
                        </tr>
                    </table>
                </div>

                <!-- 3. CONSTANTES VITALES & SUIVI CLINIQUE -->
                <div style="border: 1px solid #E0F2FE; border-radius: 8px; padding: 10px; margin-bottom: 12px; background-color: #FAFAFA;">
                    <h3 style="color: #0D9488; font-size: 12px; margin: 0 0 6px 0; border-bottom: 1px solid #E0F2FE; padding-bottom: 4px; text-transform: uppercase;">📊 Constantes Vitales & Diagnostic</h3>
                    
                    <table style="background: #FFFFFF; border-radius: 6px; border: 1px solid #CBD5E1; margin-bottom: 10px; font-size: 11px; text-align: center;">
                        <tr>
                            <td style="padding: 6px; width: 25%;">🌡️ Temp : <strong>${v.temp ? v.temp + ' °C' : '--'}</strong></td>
                            <td style="padding: 6px; width: 25%;">⚖️ Poids : <strong>${v.poids ? v.poids + ' kg' : '--'}</strong></td>
                            <td style="padding: 6px; width: 25%;">❤️ Pouls : <strong>${v.pouls ? v.pouls + ' bpm' : '--'}</strong></td>
                            <td style="padding: 6px; width: 25%;">🩺 Tension : <strong>${v.sys && v.dia ? v.sys + '/' + v.dia + ' mmHg' : '--'}</strong></td>
                        </tr>
                    </table>

                    <p style="font-size: 11px; margin: 4px 0;"><strong>Motif de la visite :</strong> ${patient.motif_visite || 'Non renseigné'}</p>
                    <p style="font-size: 11px; margin: 4px 0;"><strong>Diagnostic / Avis médical :</strong> ${patient.diagnostic || 'En attente'}</p>
                    <p style="font-size: 11px; margin: 4px 0;"><strong>Prochain rendez-vous :</strong> ${patient.prochain_rdv ? formaterDateEtAge(patient.prochain_rdv).split(' ')[0] : 'Non planifié'}</p>
                    <p style="font-size: 11px; margin: 4px 0; overflow-wrap: anywhere; word-break: break-all;"><strong>Notes complémentaires :</strong> ${patient.notes || 'Aucune'}</p>
                </div>

                <!-- PIED DE PAGE -->
                <table style="margin-top: 25px; font-size: 10px; color: #475569;">
                    <tr>
                        <td style="width: 60%; vertical-align: bottom;">
                            <p style="margin: 0;"><strong>Statut Consultation :</strong> ${patient.consultation_statut || 'Non payé'}</p>
                            <p style="margin: 3px 0 0 0;"><strong>Contrôle Requis :</strong> ${patient.besoin_controle || 'Non'}</p>
                        </td>
                        <td style="width: 40%; vertical-align: bottom; text-align: right;">
                            <div style="display: inline-block; text-align: center; border-top: 1px solid #94A3B8; width: 180px; padding-top: 4px;">
                                <p style="margin: 0; font-weight: bold; color: #1E293B;">Cachet & Signature du Médecin</p>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>

            <script>
                function telechargerDirectPDF() {
                    const el = document.getElementById('contenu-fiche-a4');
                    const options = {
                        margin: 8,
                        filename: '${nomPDFOfficiel}',
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2, logging: false },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };
                    html2pdf().set(options).from(el).save();
                }
            </script>
        </body>
        </html>
    `);
    fenetre.document.close();
}

// --- 10. SOUMISSIONS FORMULAIRES PATIENTS ---
document.getElementById('formPatient').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btnSoumission = e.target.querySelector('button[type="submit"]');
    if (btnSoumission) { btnSoumission.disabled = true; btnSoumission.innerText = "Enregistrement en cours..."; }

    const vitals = {
        temp: document.getElementById('vit_temp').value ? parseFloat(document.getElementById('vit_temp').value) : null,
        poids: document.getElementById('vit_poids').value ? parseFloat(document.getElementById('vit_poids').value) : null,
        pouls: document.getElementById('vit_pouls').value ? parseInt(document.getElementById('vit_pouls').value, 10) : null,
        sys: document.getElementById('vit_sys').value ? parseInt(document.getElementById('vit_sys').value, 10) : null,
        dia: document.getElementById('vit_dia').value ? parseInt(document.getElementById('vit_dia').value, 10) : null
    };

    const nouveauPatient = {
        nom_complet: document.getElementById('nom_complet').value,
        date_naissance: document.getElementById('date_naissance').value,
        sexe: document.getElementById('sexe').value,
        telephone: document.getElementById('telephone').value,
        date_entree: document.getElementById('date_entree').value,
        adresse: document.getElementById('adresse').value,
        contact_urgence: document.getElementById('contact_urgence').value,
        allergies: document.getElementById('allergies').value,
        maladies_chroniques: document.getElementById('maladies_chroniques').value,
        chirurgies: document.getElementById('chirurgies').value,
        traitements_en_cours: document.getElementById('traitements_en_cours').value,
        motif_visite: document.getElementById('motif_visite').value,
        diagnostic: document.getElementById('diagnostic').value,
        prochain_rdv: document.getElementById('prochain_rdv').value,
        consultation_statut: document.getElementById('consultation_statut').value,
        besoin_controle: document.getElementById('besoin_controle').value,
        parametres: JSON.stringify(vitals),
        notes: document.getElementById('notes').value
    };

    try {
        const reponse = await fetch('/api/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nouveauPatient) });
        if (reponse.ok) { 
            await afficherAlerte("Succès", "Dossier médical créé avec succès !", "succes"); 
            document.getElementById('formPatient').reset(); 
            await chargerPatients(); 
            changerSousOngletPatients('liste');
        } else {
            let msg = "Erreur serveur";
            try { const err = await reponse.json(); msg = err.erreur; } catch(ex) {}
            await afficherAlerte("Erreur", msg, "erreur");
        }
    } catch (erreur) { await afficherAlerte("Erreur", "Connexion interrompue.", "erreur"); }
    finally { if (btnSoumission) { btnSoumission.disabled = false; btnSoumission.innerText = "Enregistrer le dossier médical"; } }
});

function ouvrirModalEdition(id) {
    const modal = document.getElementById('modal-edition');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('modal-ouvert');
    const patient = tousLesPatients.find(p => p.id === id);
    if (!patient) return;

    document.getElementById('edit_id').value = patient.id;
    document.getElementById('edit_nom_complet').value = patient.nom_complet || '';
    document.getElementById('edit_date_naissance').value = patient.date_naissance || '';
    document.getElementById('edit_sexe').value = patient.sexe || 'Masculin';
    document.getElementById('edit_telephone').value = patient.telephone || '';
    document.getElementById('edit_date_entree').value = patient.date_entree || '';
    document.getElementById('edit_adresse').value = patient.adresse || '';
    document.getElementById('edit_contact_urgence').value = patient.contact_urgence || '';
    document.getElementById('edit_allergies').value = patient.allergies || '';
    document.getElementById('edit_maladies_chroniques').value = patient.maladies_chroniques || '';
    document.getElementById('edit_chirurgies').value = patient.chirurgies || '';
    document.getElementById('edit_traitements_en_cours').value = patient.traitements_en_cours || '';
    document.getElementById('edit_motif_visite').value = patient.motif_visite || '';
    document.getElementById('edit_diagnostic').value = patient.diagnostic || '';
    document.getElementById('edit_prochain_rdv').value = patient.prochain_rdv || '';
    document.getElementById('edit_consultation_statut').value = patient.consultation_statut || 'Non payé';
    document.getElementById('edit_besoin_controle').value = patient.besoin_controle || 'Non';
    
    let v = { temp: '', poids: '', pouls: '', sys: '', dia: '' };
    try { if (patient.parametres && patient.parametres.startsWith('{')) v = JSON.parse(patient.parametres); } catch (e) {}
    document.getElementById('edit_vit_temp').value = v.temp || '';
    document.getElementById('edit_vit_poids').value = v.poids || '';
    document.getElementById('edit_vit_pouls').value = v.pouls || '';
    document.getElementById('edit_vit_sys').value = v.sys || '';
    document.getElementById('edit_vit_dia').value = v.dia || '';
    document.getElementById('edit_notes').value = patient.notes || '';
}

function fermerModalEdition() {
    const modal = document.getElementById('modal-edition');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('modal-ouvert');
}

document.getElementById('formEditPatient').addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('edit_id').value;
    const vitals = {
        temp: document.getElementById('edit_vit_temp').value ? parseFloat(document.getElementById('edit_vit_temp').value) : null,
        poids: document.getElementById('edit_vit_poids').value ? parseFloat(document.getElementById('edit_vit_poids').value) : null,
        pouls: document.getElementById('edit_vit_pouls').value ? parseInt(document.getElementById('edit_vit_pouls').value, 10) : null,
        sys: document.getElementById('edit_vit_sys').value ? parseInt(document.getElementById('edit_vit_sys').value, 10) : null,
        dia: document.getElementById('edit_vit_dia').value ? parseInt(document.getElementById('edit_vit_dia').value, 10) : null
    };

    const modif = {
        nom_complet: document.getElementById('edit_nom_complet').value,
        date_naissance: document.getElementById('edit_date_naissance').value,
        sexe: document.getElementById('edit_sexe').value,
        telephone: document.getElementById('edit_telephone').value,
        date_entree: document.getElementById('edit_date_entree').value,
        adresse: document.getElementById('edit_adresse').value,
        contact_urgence: document.getElementById('edit_contact_urgence').value,
        allergies: document.getElementById('edit_allergies').value,
        maladies_chroniques: document.getElementById('edit_maladies_chroniques').value,
        chirurgies: document.getElementById('edit_chirurgies').value,
        traitements_en_cours: document.getElementById('edit_traitements_en_cours').value,
        motif_visite: document.getElementById('edit_motif_visite').value,
        diagnostic: document.getElementById('edit_diagnostic').value,
        prochain_rdv: document.getElementById('edit_prochain_rdv').value,
        consultation_statut: document.getElementById('edit_consultation_statut').value,
        besoin_controle: document.getElementById('edit_besoin_controle').value,
        parametres: JSON.stringify(vitals),
        notes: document.getElementById('edit_notes').value
    };

    try {
        const reponse = await fetch(`/api/patients/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(modif) });
        if (reponse.ok) { 
            await afficherAlerte("Mis à jour", "Le dossier médical a été modifié !", "succes"); 
            fermerModalEdition(); 
            await chargerPatients(); 
        }
    } catch (erreur) { await afficherAlerte("Erreur", "Impossible de contacter le serveur.", "erreur"); }
});

async function supprimerPatient(id) {
    if (confirm("⚠️ Êtes-vous sûr de vouloir supprimer définitivement ce dossier médical ?")) {
        try {
            const reponse = await fetch(`/api/patients/${id}`, { method: 'DELETE' });
            if (reponse.ok) { await afficherAlerte("Supprimé", "Le dossier a été retiré.", "succes"); chargerPatients(); }
        } catch (erreur) { await afficherAlerte("Erreur", "Connexion interrompue.", "erreur"); }
    }
}