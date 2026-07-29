// =========================================================================
// FICHIER : app.js
// Rôle : Client TPFV, Fiches A4 HD (1 Page A4 Intégrale), Dates en Lettres
// =========================================================================

let tousLesPatients = []; 
let patientsFiltresGlobaux = []; 
let pageActuelle = 1;
const patientsParPage = 10; 
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

// FORMATAGE DES DATES EN LETTRES (EX: 23 DÉCEMBRE 1999) SANS CALCUL D'ÂGE
function formaterDateEnLettres(dateString) {
    if (!dateString) return 'Non renseignée';
    
    let year, month, day;

    if (dateString.includes('-')) {
        const parties = dateString.split('-');
        if (parties.length === 3) [year, month, day] = parties;
    } else if (dateString.includes('/')) {
        const parties = dateString.split('/');
        if (parties.length === 3) [day, month, year] = parties;
    }

    if (!year || !month || !day) return dateString;

    const moisLettres = [
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre"
    ];

    const moisIndex = parseInt(month, 10) - 1;
    if (moisIndex < 0 || moisIndex >= 12) return dateString;

    const jourNumero = parseInt(day, 10).toString().padStart(2, '0');
    const nomMois = moisLettres[moisIndex];

    return `${jourNumero} ${nomMois} ${year}`;
}

function formaterDateEtAge(dateString) {
    return formaterDateEnLettres(dateString);
}

// --- 2. GESTION DES RÔLES ET ACCÈS ---
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
    
    if (roleActuel === 'agent' || roleActuel === 'support') {
        if (btnInventaire) btnInventaire.style.display = 'none';
        if (btnParametres) btnParametres.style.display = 'none';
        if (btnCompte) btnCompte.style.display = 'none';
        changerOnglet('patients'); 
    } else if (roleActuel === 'admin') {
        if (btnInventaire) btnInventaire.style.display = 'block';
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
}

async function seConnecter() {
    const roleSaisi = document.getElementById('choix-role').value;
    const mdpSaisi = document.getElementById('mot-de-passe').value;
    if (!mdpSaisi) return afficherAlerte("Champs requis", "Veuillez entrer votre mot de passe.", "info");
    try {
        const reponse = await fetch('/api/login', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ role: roleSaisi, mot_de_passe: mdpSaisi.trim() }) 
        });
        const data = await reponse.json();
        if (!reponse.ok) {
            return afficherAlerte("Accès refusé", data.erreur || "Mot de passe incorrect.", "erreur");
        }
        localStorage.setItem('sessionCliniqueRole', roleSaisi);
        appliquerDroitsRole(roleSaisi);
        document.getElementById('mot-de-passe').value = '';
    } catch (erreur) { 
        afficherAlerte("Erreur réseau", "Impossible de joindre le serveur. Lancez `node serveur.js` dans le terminal.", "erreur"); 
    }
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

    // FORMULAIRE IMPORTATION PATIENTS
    const formImport = document.getElementById('formImportPatients');
    if (formImport) {
        formImport.addEventListener('submit', function(e) {
            e.preventDefault();
            const fichierInput = document.getElementById('fichierImport');
            if (!fichierInput || !fichierInput.files || fichierInput.files.length === 0) {
                return afficherAlerte("Fichier requis", "Veuillez sélectionner un fichier CSV ou Excel.", "info");
            }

            const fichier = fichierInput.files[0];
            const lecteur = new FileReader();

            lecteur.onload = async function(evt) {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const classeur = XLSX.read(data, { type: 'array' });
                    const nomFeuille = classeur.SheetNames[0];
                    const feuille = classeur.Sheets[nomFeuille];
                    const patientsJSON = XLSX.utils.sheet_to_json(feuille);

                    if (!patientsJSON || patientsJSON.length === 0) {
                        return afficherAlerte("Fichier vide", "Le fichier ne contient aucun dossier.", "erreur");
                    }

                    const reponse = await fetch('/api/patients/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(patientsJSON)
                    });

                    const resData = await reponse.json();
                    if (reponse.ok) {
                        await afficherAlerte("Importation réussie", resData.message, "succes");
                        formImport.reset();
                        await chargerPatients();
                        afficherStatsMensuelles();
                    } else {
                        await afficherAlerte("Erreur Importation", resData.erreur || "Impossible d'importer.", "erreur");
                    }
                } catch (err) {
                    await afficherAlerte("Format invalide", "Erreur fichier : " + err.message, "erreur");
                }
            };

            lecteur.readAsArrayBuffer(fichier);
        });
    }

    const sessionActive = localStorage.getItem('sessionCliniqueRole');
    if (sessionActive && sessionActive !== 'agent') {
        const themeSauvegarde = localStorage.getItem('themeClinique');
        if (themeSauvegarde === 'sombre') document.body.classList.add('dark-theme');
    }
    if (sessionActive) appliquerDroitsRole(sessionActive);
});

// --- 5. NAVIGATION ONGLETS ---
function changerOnglet(section) {
    const sections = ['patients', 'parametres', 'compte'];
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

    if (section === 'parametres') {
        afficherStatsMensuelles();
    }
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

// --- 6. CHARGEMENT & AFFICHAGE DES PATIENTS ---
async function chargerPatients() {
    try {
        const reponse = await fetch('/api/patients');
        if (!reponse.ok) throw new Error();
        tousLesPatients = await reponse.json(); 
        filtrerPatients();
        afficherStatsMensuelles();
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
                    <div><strong>Prochain rendez-vous :</strong> ${formaterDateEnLettres(patient.prochain_rdv)}</div>
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
            <span><strong>Date de naissance :</strong> ${formaterDateEnLettres(patient.date_naissance)}</span>
            <span><strong>Téléphone :</strong> ${patient.telephone}</span>
            <span><strong>Première entrée :</strong> ${formaterDateEnLettres(patient.date_entree)}</span>
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

// --- 7. STATISTIQUES MENSUELLES ---
function afficherStatsMensuelles() {
    const corps = document.getElementById('corpsStatsMensuelles');
    if (!corps) return;
    corps.innerHTML = '';

    if (!tousLesPatients || tousLesPatients.length === 0) {
        corps.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--texte-clair); padding: 20px;">Aucun patient enregistré.</td></tr>`;
        return;
    }

    const moisMap = {};
    const nomsMois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

    tousLesPatients.forEach(p => {
        let dateKey = "Date non renseignée";
        if (p.date_entree && p.date_entree.includes('-')) {
            const parties = p.date_entree.split('-');
            if (parties.length === 3) {
                const annee = parties[0];
                const moisNum = parseInt(parties[1], 10) - 1;
                if (moisNum >= 0 && moisNum < 12) {
                    dateKey = `${annee}-${(moisNum + 1).toString().padStart(2, '0')}`;
                }
            }
        }
        moisMap[dateKey] = (moisMap[dateKey] || 0) + 1;
    });

    const moisTries = Object.keys(moisMap).sort().reverse();
    const totalGlobal = tousLesPatients.length;

    moisTries.forEach(key => {
        const count = moisMap[key];
        const pourcentage = Math.round((count / totalGlobal) * 100);

        let libelleMois = key;
        if (key !== "Date non renseignée" && key.includes('-')) {
            const [annee, moisStr] = key.split('-');
            const idxMois = parseInt(moisStr, 10) - 1;
            libelleMois = `${nomsMois[idxMois]} ${annee}`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>📅 ${libelleMois}</strong></td>
            <td style="text-align: center;"><span class="badge-stock-normal" style="font-size: 13px;">${count} patient(s)</span></td>
            <td style="text-align: center;"><strong>${pourcentage}%</strong></td>
            <td>
                <div style="background: var(--bordure); border-radius: 6px; height: 10px; width: 100%; overflow: hidden;">
                    <div style="background: var(--bleu-primaire); height: 100%; width: ${Math.min(100, Math.max(5, pourcentage))}%;"></div>
                </div>
            </td>
        `;
        corps.appendChild(tr);
    });
}

// --- 8. IMPORTATION ET EXPORTATION ---
function preparerDonneesPatientsExport() {
    return tousLesPatients.map(p => {
        let v = { temp: '', poids: '', pouls: '', sys: '', dia: '' };
        try { if (p.parametres && p.parametres.startsWith('{')) v = JSON.parse(p.parametres); } catch (e) {}

        return {
            "Code Patient": p.code_patient || '',
            "Nom et Prénom": p.nom_complet || '',
            "Sexe": p.sexe || '',
            "Date de naissance": formaterDateEnLettres(p.date_naissance),
            "Téléphone": p.telephone || '',
            "Date d'entrée": formaterDateEnLettres(p.date_entree),
            "Adresse": p.adresse || '',
            "Contact Urgence": p.contact_urgence || '',
            "Allergies": p.allergies || '',
            "Maladies chroniques": p.maladies_chroniques || '',
            "Chirurgies": p.chirurgies || '',
            "Traitements en cours": p.traitements_en_cours || '',
            "Motif de la visite": p.motif_visite || '',
            "Diagnostic": p.diagnostic || '',
            "Prochain RDV": formaterDateEnLettres(p.prochain_rdv),
            "Statut Consultation": p.consultation_statut || 'Non payé',
            "Contrôle Requis": p.besoin_controle || 'Non',
            "Notes": p.notes || ''
        };
    });
}

function exporterPatientsCSV() {
    if (!tousLesPatients || tousLesPatients.length === 0) return afficherAlerte("Export impossible", "Aucun patient à exporter.", "info");
    const donnees = preparerDonneesPatientsExport();
    const enTetes = Object.keys(donnees[0]);
    let contenuCSV = "\uFEFF" + enTetes.map(h => `"${h}"`).join(";") + "\n";

    donnees.forEach(row => {
        const ligne = enTetes.map(h => `"${(row[h] !== undefined && row[h] !== null) ? String(row[h]).replace(/"/g, '""') : ''}"`).join(";");
        contenuCSV += ligne + "\n";
    });

    const blob = new Blob([contenuCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.setAttribute('href', url);
    lien.setAttribute('download', `Patients_TPFV_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
}

function exporterPatientsExcel() {
    if (!tousLesPatients || tousLesPatients.length === 0) return afficherAlerte("Export impossible", "Aucun patient à exporter.", "info");
    const donnees = preparerDonneesPatientsExport();
    const feuille = XLSX.utils.json_to_sheet(donnees);
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, feuille, "Patients");
    XLSX.writeFile(classeur, `Patients_TPFV_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// --- 9. FICHE PATIENT A4 PDF (LARGEUR ET HAUTEUR CORRIGÉES - SANS TRONQUATURE ET EN 1 PAGE) ---
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
    if (!fenetre) return afficherAlerte("Pop-up bloqué", "Veuillez autoriser les fenêtres surgissantes.", "info");

    fenetre.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>${nomPDFOfficiel}</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
            <style>
                @page { size: A4 portrait; margin: 8mm; }
                * { box-sizing: border-box; }
                body { font-family: Arial, Helvetica, sans-serif; color: #0F172A; background-color: #525659; margin: 0; padding: 20px 0; display: flex; flex-direction: column; align-items: center; }
                .barre-outils-pdf { position: fixed; top: 0; left: 0; right: 0; background: #1E293B; color: white; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); }
                .btn-pdf { background: #0284C7; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; }
                .btn-pdf.vert { background: #0D9488; }
                .btn-pdf:hover { opacity: 0.9; }
                .page-a4 { background: #FFFFFF; width: 190mm; min-height: 270mm; padding: 8mm; box-sizing: border-box; box-shadow: 0 10px 25px rgba(0,0,0,0.3); margin-top: 50px; overflow: hidden; }
                @media print { .barre-outils-pdf { display: none !important; } body { background: white; padding: 0; } .page-a4 { width: 100%; min-height: auto; margin: 0; padding: 0; box-shadow: none; } }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                td, p, div { vertical-align: top; overflow-wrap: anywhere !important; word-break: break-word !important; }
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
                <table style="border-bottom: 2px solid #0284C7; padding-bottom: 8px; margin-bottom: 12px;">
                    <tr>
                        <td style="width: 55%;">
                            <h1 style="color: #0284C7; margin: 0; font-size: 20px; font-weight: 800;">🏥 TPFV</h1>
                            <p style="margin: 3px 0 0 0; color: #475569; font-size: 10.5px; font-weight: 700;">Toeram - Pitsaboana Fanantenan'ny Vononkandresy III Jaona 2</p>
                        </td>
                        <td style="width: 45%; text-align: right; font-size: 11px; color: #475569;">
                            <p style="margin: 0; white-space: nowrap;"><strong>Code Patient :</strong> <span style="font-family: monospace; font-size: 11.5px; font-weight: bold;">${patient.code_patient || 'N/A'}</span></p>
                            <p style="margin: 3px 0 0 0; white-space: nowrap;"><strong>Date d'émission :</strong> ${formaterDateEnLettres(new Date().toISOString().slice(0, 10))}</p>
                        </td>
                    </tr>
                </table>

                <h2 style="text-align: center; text-transform: uppercase; color: #0369A1; font-size: 12.5px; margin: 0 0 12px 0; background: #F0F9FF; padding: 5px; border-radius: 6px; border: 1px solid #BAE6FD;">
                    FICHE MÉDICALE ET HISTORIQUE DU PATIENT
                </h2>

                <div style="border: 1px solid #E0F2FE; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; background-color: #FAFAFA;">
                    <h3 style="color: #0284C7; font-size: 11.5px; margin: 0 0 5px 0; border-bottom: 1px solid #E0F2FE; padding-bottom: 3px; text-transform: uppercase;">👤 Informations Administratives</h3>
                    <table style="font-size: 10.5px; line-height: 1.5;">
                        <tr>
                            <td style="width: 50%;"><strong>Nom et Prénom :</strong> ${patient.nom_complet || 'Non renseigné'}</td>
                            <td style="width: 50%;"><strong>Sexe :</strong> ${patient.sexe || 'Non renseigné'}</td>
                        </tr>
                        <tr>
                            <td><strong>Date de naissance :</strong> ${formaterDateEnLettres(patient.date_naissance)}</td>
                            <td><strong>Téléphone :</strong> ${patient.telephone || 'Non renseigné'}</td>
                        </tr>
                        <tr>
                            <td><strong>Date d'entrée :</strong> ${formaterDateEnLettres(patient.date_entree)}</td>
                            <td><strong>Adresse :</strong> ${patient.adresse || 'Non renseignée'}</td>
                        </tr>
                        <tr>
                            <td colspan="2"><strong>Contact d'Urgence :</strong> ${patient.contact_urgence || 'Aucun contact renseigné'}</td>
                        </tr>
                    </table>
                </div>

                <div style="border: 1px solid #FCA5A5; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; background-color: #FFF5F5;">
                    <h3 style="color: #DC2626; font-size: 11.5px; margin: 0 0 5px 0; border-bottom: 1px solid #FCA5A5; padding-bottom: 3px; text-transform: uppercase;">🩺 Antécédents Médicaux</h3>
                    <table style="font-size: 10.5px; line-height: 1.5;">
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

                <div style="border: 1px solid #E0F2FE; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; background-color: #FAFAFA;">
                    <h3 style="color: #0D9488; font-size: 11.5px; margin: 0 0 5px 0; border-bottom: 1px solid #E0F2FE; padding-bottom: 3px; text-transform: uppercase;">📊 Constantes Vitales & Diagnostic</h3>
                    <table style="background: #FFFFFF; border-radius: 6px; border: 1px solid #CBD5E1; margin-bottom: 8px; font-size: 10.5px; text-align: center;">
                        <tr>
                            <td style="padding: 5px; width: 25%;">🌡️ Temp : <strong>${v.temp ? v.temp + ' °C' : '--'}</strong></td>
                            <td style="padding: 5px; width: 25%;">⚖️ Poids : <strong>${v.poids ? v.poids + ' kg' : '--'}</strong></td>
                            <td style="padding: 5px; width: 25%;">❤️ Pouls : <strong>${v.pouls ? v.pouls + ' bpm' : '--'}</strong></td>
                            <td style="padding: 5px; width: 25%;">🩺 Tension : <strong>${v.sys && v.dia ? v.sys + '/' + v.dia + ' mmHg' : '--'}</strong></td>
                        </tr>
                    </table>
                    <p style="font-size: 10.5px; margin: 3px 0;"><strong>Motif de la visite :</strong> ${patient.motif_visite || 'Non renseigné'}</p>
                    <p style="font-size: 10.5px; margin: 3px 0;"><strong>Diagnostic / Avis médical :</strong> ${patient.diagnostic || 'En attente'}</p>
                    <p style="font-size: 10.5px; margin: 3px 0;"><strong>Prochain rendez-vous :</strong> ${formaterDateEnLettres(patient.prochain_rdv)}</p>
                    <p style="font-size: 10.5px; margin: 3px 0;"><strong>Notes complémentaires :</strong> ${patient.notes || 'Aucune'}</p>
                </div>

                <table style="margin-top: 20px; font-size: 10px; color: #475569;">
                    <tr>
                        <td style="width: 60%; vertical-align: bottom;">
                            <p style="margin: 0;"><strong>Statut Consultation :</strong> ${patient.consultation_statut || 'Non payé'}</p>
                            <p style="margin: 2px 0 0 0;"><strong>Contrôle Requis :</strong> ${patient.besoin_controle || 'Non'}</p>
                        </td>
                        <td style="width: 40%; vertical-align: bottom; text-align: right;">
                            <div style="display: inline-block; text-align: center; border-top: 1px solid #94A3B8; width: 170px; padding-top: 3px;">
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
                        margin: 0,
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

// --- 10. SOUMISSIONS FORMULAIRES ---
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