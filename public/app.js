// =========================================================================
// FICHIER : app.js
// Rôle : Gestion Client, Recherche Temps Réel, Masquage Sécurisé & Navigation
// =========================================================================

let tousLesPatients = []; 
let patientsFiltresGlobaux = []; 
let pageActuelle = 1;
const patientsParPage = 10; 
let roleActuel = ''; 

// --- 1. THÈME & ALERTES MODALES ---
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

function formaterDateNaissance(dateString) {
    if (!dateString) return 'Non renseignée';
    const parties = dateString.split('-');
    if (parties.length !== 3) return dateString;
    const [annee, mois, jour] = parties;
    const moisLettres = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    return `${jour} ${moisLettres[parseInt(mois, 10) - 1] || mois} ${annee}`;
}

// --- 2. DÉMARRAGE ET CONNEXION ---
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

// --- 3. RECHERCHE TEMPS RÉEL ---
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

window.addEventListener('DOMContentLoaded', () => {
    const champ = document.getElementById('champ-recherche');
    const filtre = document.getElementById('filtre-recherche');
    
    if (champ) champ.addEventListener('input', filtrerPatients);
    if (filtre) filtre.addEventListener('change', filtrerPatients);

    const sessionActive = localStorage.getItem('sessionCliniqueRole');
    if (sessionActive && sessionActive !== 'agent') {
        const themeSauvegarde = localStorage.getItem('themeClinique');
        if (themeSauvegarde === 'sombre') document.body.classList.add('dark-theme');
    }
    if (sessionActive) appliquerDroitsRole(sessionActive);
});

// --- 4. NAVIGATION SANS ÉCRASER LES CLASSES HTML (CORRECTION CLEF) ---
function changerOnglet(section) {
    const sections = ['patients', 'inventaire', 'parametres', 'compte'];
    
    sections.forEach(sec => {
        const elSec = document.getElementById(`section-${sec}`);
        const elBtn = document.getElementById(`btn-${sec}`);
        if (elSec) {
            elSec.classList.remove('section-visible', 'animate-fade');
            elSec.classList.add('section-cachee');
        }
        if (elBtn) {
            elBtn.classList.remove('actif');
        }
    });

    const activeSec = document.getElementById(`section-${section}`);
    const activeBtn = document.getElementById(`btn-${section}`);
    
    if (activeSec) {
        activeSec.classList.remove('section-cachee');
        activeSec.classList.add('section-visible', 'animate-fade');
    }
    if (activeBtn) {
        activeBtn.classList.add('actif');
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
        
        if (zoneListe) {
            zoneListe.classList.remove('section-cachee');
            zoneListe.classList.add('section-visible');
        }
        if (zoneForm) {
            zoneForm.classList.add('section-cachee');
            zoneForm.classList.remove('section-visible');
        }
        
        pageActuelle = 1;
        afficherPatients(patientsFiltresGlobaux);

    } else if (onglet === 'form') {
        if (btnForm) btnForm.classList.add('actif');
        if (btnListe) btnListe.classList.remove('actif');
        
        if (zoneForm) {
            zoneForm.classList.remove('section-cachee');
            zoneForm.classList.add('section-visible');
        }
        if (zoneListe) {
            zoneListe.classList.add('section-cachee');
            zoneListe.classList.remove('section-visible');
        }
    }
}

// --- 5. AFFICHAGE DES PATIENTS & BADGES ---
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
    if(!listElement) return;
    listElement.innerHTML = ''; 
    if(paginationElement) paginationElement.innerHTML = '';
    
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
        if (roleActuel === 'admin' || roleActuel === 'support') {
            boutonsActionsHTML += `<button onclick="ouvrirModalEdition(${patient.id})" style="background-color: var(--bleu-primaire); color: white; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-right: 5px; font-weight: 600;">✏️ Modifier</button>`;
        }
        if (roleActuel === 'admin') {
            boutonsActionsHTML += `<button onclick="supprimerPatient(${patient.id})" style="background-color: #EF4444; color: white; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-right: 10px; font-weight: 600;">🗑️ Supprimer</button>`;
        }

        let zoneMedicaleHTML = '';
        if (roleActuel !== 'agent') {
            let vitalsHTML = 'Non renseignés';
            try {
                if (patient.parametres && patient.parametres.startsWith('{')) {
                    const v = JSON.parse(patient.parametres);
                    const tempStyle = (v.temp > 38) ? 'color: #EF4444; font-weight: bold;' : (v.temp >= 36.5 && v.temp <= 37.5 ? 'color: #0D9488; font-weight: bold;' : 'color: #F59E0B; font-weight: bold;');
                    const poulsStyle = (v.pouls < 60 || v.pouls > 100) ? 'color: #EF4444; font-weight: bold;' : 'color: #0D9488; font-weight: bold;';
                    const tensStyle = (v.sys > 140 || v.dia > 90) ? 'color: #EF4444; font-weight: bold;' : (v.sys && v.dia ? 'color: #0D9488; font-weight: bold;' : '');
                    vitalsHTML = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-top: 8px; padding: 10px; border-radius: 6px; border: 1px solid var(--bordure); background-color: rgba(255,255,255,0.6);">
                        <span>🌡️ Température : <strong style="${tempStyle}">${v.temp ? v.temp + ' °C' : '--'}</strong></span>
                        <span>⚖️ Poids : <strong style="color: #0284C7;">${v.poids ? v.poids + ' kg' : '--'}</strong></span>
                        <span>❤️ Fréq. Cardiaque : <strong style="${poulsStyle}">${v.pouls ? v.pouls + ' bpm' : '--'}</strong></span>
                        <span>🩺 Tension : <strong style="${tensStyle}">${v.sys && v.dia ? v.sys + '/' + v.dia + ' mmHg' : '--'}</strong></span>
                    </div>`;
                }
            } catch (e) {}
            zoneMedicaleHTML = `<div class="zone-medicale"><strong style="color: var(--bleu-primaire);">📊 Paramètres vitaux :</strong>${vitalsHTML}<strong style="margin-top:12px; display:inline-block; color: var(--bleu-primaire);">📝 Notes médicales :</strong><p style="margin: 5px 0 0 0; white-space: pre-wrap; line-height: 1.5;">${patient.notes || 'Aucune note'}</p></div>`;
        }

        const classeConsultation = (patient.consultation_statut === 'Payé') ? 'badge-paye' : 'badge-non-paye';
        const estControleRequis = (patient.besoin_controle === 'Oui');
        const classeControle = estControleRequis ? 'badge-controle-oui' : 'badge-controle-non';
        const texteControle = estControleRequis ? '⚠️ Contrôle requis' : '✅ Pas de contrôle requis';

        li.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
            <strong style="font-size: 1.25em; color: var(--texte-sombre);">${patient.nom_complet}</strong>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">${boutonsActionsHTML}<span class="${classeConsultation}">${patient.consultation_statut || 'Non payé'}</span><span class="${classeControle}">${texteControle}</span><span style="font-family: monospace; background: var(--fond-page); padding: 3px 8px; border-radius: 6px; font-weight: 600;">Code: ${patient.code_patient}</span></div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px; color: var(--texte-clair); margin-bottom: 10px;">
            <span><strong>Sexe :</strong> ${patient.sexe}</span><span><strong>Né(e) le :</strong> ${formaterDateNaissance(patient.date_naissance)}</span>
            <span><strong>Téléphone :</strong> ${patient.telephone}</span><span><strong>Entré(e) le :</strong> ${formaterDateNaissance(patient.date_entree)}</span>
        </div>
        <div style="font-size: 14px; border-top: 1px dashed var(--bordure); padding-top: 10px;"><strong>Adresse :</strong> ${patient.adresse || 'Non renseignée'}</div>
        ${zoneMedicaleHTML}`;
        listElement.appendChild(li);
    });

    if (totalPages > 1 && paginationElement) {
        paginationElement.innerHTML = `<button class="btn-page" onclick="changerPage(-1)" ${pageActuelle === 1 ? 'disabled' : ''}>Précédent</button><span>Page ${pageActuelle} / ${totalPages}</span><button class="btn-page" onclick="changerPage(1)" ${pageActuelle === totalPages ? 'disabled' : ''}>Suivant</button>`;
    }
}

function changerPage(dir) { pageActuelle += dir; afficherPatients(patientsFiltresGlobaux); }

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
        nom_complet: document.getElementById('nom_complet').value, date_naissance: document.getElementById('date_naissance').value, 
        telephone: document.getElementById('telephone').value, adresse: document.getElementById('adresse').value,
        date_entree: document.getElementById('date_entree').value, sexe: document.getElementById('sexe').value,
        consultation_statut: document.getElementById('consultation_statut').value, besoin_controle: document.getElementById('besoin_controle').value,
        parametres: JSON.stringify(vitals), notes: document.getElementById('notes').value
    };
    try {
        const reponse = await fetch('/api/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nouveauPatient) });
        if (reponse.ok) { 
            await afficherAlerte("Patient enregistré", "Le dossier a été créé avec succès !", "succes"); 
            document.getElementById('formPatient').reset(); 
            await chargerPatients(); 
            changerSousOngletPatients('liste');
        } else {
            let msg = "Erreur serveur";
            try { const err = await reponse.json(); msg = err.erreur; } catch(ex) {}
            await afficherAlerte("Erreur", msg, "erreur");
        }
    } catch (erreur) { await afficherAlerte("Erreur", "Connexion interrompue.", "erreur"); }
    finally { if (btnSoumission) { btnSoumission.disabled = false; btnSoumission.innerText = "Enregistrer le dossier"; } }
});

function ouvrirModalEdition(id) {
    const modal = document.getElementById('modal-edition');
    if (modal) modal.style.display = 'flex';
    document.body.classList.add('modal-ouvert');
    const patient = tousLesPatients.find(p => p.id === id);
    if (!patient) return;

    if (document.getElementById('edit_id')) document.getElementById('edit_id').value = patient.id;
    if (document.getElementById('edit_nom_complet')) document.getElementById('edit_nom_complet').value = patient.nom_complet || '';
    if (document.getElementById('edit_date_naissance')) document.getElementById('edit_date_naissance').value = patient.date_naissance || '';
    if (document.getElementById('edit_telephone')) document.getElementById('edit_telephone').value = patient.telephone || '';
    if (document.getElementById('edit_adresse')) document.getElementById('edit_adresse').value = patient.adresse || '';
    if (document.getElementById('edit_date_entree')) document.getElementById('edit_date_entree').value = patient.date_entree || '';
    if (document.getElementById('edit_sexe')) document.getElementById('edit_sexe').value = patient.sexe || 'Homme';
    if (document.getElementById('edit_consultation_statut')) document.getElementById('edit_consultation_statut').value = patient.consultation_statut || 'Non payé';
    if (document.getElementById('edit_besoin_controle')) document.getElementById('edit_besoin_controle').value = patient.besoin_controle || 'Non';
    
    let v = { temp: '', poids: '', pouls: '', sys: '', dia: '' };
    try { if (patient.parametres && patient.parametres.startsWith('{')) v = JSON.parse(patient.parametres); } catch (e) {}
    if (document.getElementById('edit_vit_temp')) document.getElementById('edit_vit_temp').value = v.temp || '';
    if (document.getElementById('edit_vit_poids')) document.getElementById('edit_vit_poids').value = v.poids || '';
    if (document.getElementById('edit_vit_pouls')) document.getElementById('edit_vit_pouls').value = v.pouls || '';
    if (document.getElementById('edit_vit_sys')) document.getElementById('edit_vit_sys').value = v.sys || '';
    if (document.getElementById('edit_vit_dia')) document.getElementById('edit_vit_dia').value = v.dia || '';
    if (document.getElementById('edit_notes')) document.getElementById('edit_notes').value = patient.notes || '';
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
        nom_complet: document.getElementById('edit_nom_complet').value, date_naissance: document.getElementById('edit_date_naissance').value,
        telephone: document.getElementById('edit_telephone').value, adresse: document.getElementById('edit_adresse').value,
        date_entree: document.getElementById('edit_date_entree').value, sexe: document.getElementById('edit_sexe').value,
        consultation_statut: document.getElementById('edit_consultation_statut').value, besoin_controle: document.getElementById('edit_besoin_controle').value,
        parametres: JSON.stringify(vitals), notes: document.getElementById('edit_notes').value
    };
    try {
        const reponse = await fetch(`/api/patients/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(modif) });
        if (reponse.ok) { await afficherAlerte("Enregistré", "Le dossier a été mis à jour !", "succes"); fermerModalEdition(); chargerPatients(); }
    } catch (erreur) { await afficherAlerte("Erreur", "Impossible de contacter le serveur.", "erreur"); }
});

async function supprimerPatient(id) {
    if (confirm("⚠️ Êtes-vous sûr de vouloir supprimer définitivement ce dossier ?")) {
        try {
            const reponse = await fetch(`/api/patients/${id}`, { method: 'DELETE' });
            if (reponse.ok) { await afficherAlerte("Dossier supprimé", "Le dossier a été retiré.", "succes"); chargerPatients(); }
        } catch (erreur) { await afficherAlerte("Erreur", "Connexion interrompue.", "erreur"); }
    }
}