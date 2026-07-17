// =========================================================================
// FICHIER : app.js
// Rôle : Gestion Dynamique Frontend, Système de rôles, Pagination, Vitals & Exports
// =========================================================================

function afficherAlerte(titre, message, type = 'info') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'overlay-alerte';
        let icone = type === 'succes' ? '✅' : (type === 'erreur' ? '❌' : 'ℹ️');
        overlay.innerHTML = `
            <div class="boite-alerte ${type}">
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
            overlay.classList.add('fermeture');
            setTimeout(() => { overlay.remove(); resolve(); }, 200);
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

let roleActuel = ''; 

function appliquerDroitsRole(role) {
    roleActuel = role;
    document.getElementById('ecran-connexion').style.display = 'none';
    document.getElementById('application-principale').className = 'section-visible animate-fade';
    
    const btnInventaire = document.getElementById('btn-inventaire');
    const btnParametres = document.getElementById('btn-parametres');
    const btnCompte = document.getElementById('btn-compte');
    const champsMedicaux = document.getElementById('champs-medicaux'); 
    
    if (roleActuel === 'agent' || roleActuel === 'support') {
        btnInventaire.style.display = 'none';
        btnParametres.style.display = 'none';
        btnCompte.style.display = 'none';
        changerOnglet('patients'); 
    } else if (roleActuel === 'admin') {
        btnInventaire.style.display = 'block';
        btnParametres.style.display = 'block';
        btnCompte.style.display = 'block';
    }
    
    if (roleActuel === 'agent') {
        if (champsMedicaux) champsMedicaux.style.display = 'none';
    } else {
        if (champsMedicaux) champsMedicaux.style.display = 'block'; 
    }
    
    chargerPatients();
    chargerInventaire();
}

async function seConnecter() {
    const roleSaisi = document.getElementById('choix-role').value;
    const mdpSaisi = document.getElementById('mot-de-passe').value;
    
    if (!mdpSaisi) return afficherAlerte("Champs requis", "Veuillez entrer votre mot de passe.", "info");

    try {
        const reponse = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: roleSaisi, mot_de_passe: mdpSaisi })
        });
        
        if (!reponse.ok) {
            const err = await reponse.json().catch(() => ({erreur: "Erreur serveur"}));
            return afficherAlerte("Accès refusé", err.erreur || "Mot de passe incorrect.", "erreur");
        }

        localStorage.setItem('sessionCliniqueRole', roleSaisi);
        appliquerDroitsRole(roleSaisi);
        document.getElementById('mot-de-passe').value = '';
    } catch (erreur) {
        console.error(erreur);
        afficherAlerte("Erreur réseau", "Impossible de joindre le serveur. (" + erreur.message + ")", "erreur");
    }
}

function seDeconnecter() {
    roleActuel = ''; 
    localStorage.removeItem('sessionCliniqueRole');
    document.getElementById('application-principale').className = 'section-cachee';
    document.getElementById('ecran-connexion').style.display = 'flex';
}

window.addEventListener('DOMContentLoaded', () => {
    const sessionActive = localStorage.getItem('sessionCliniqueRole');
    if (sessionActive) appliquerDroitsRole(sessionActive);
});

function changerOnglet(section) {
    const sections = ['patients', 'inventaire', 'parametres', 'compte'];
    sections.forEach(sec => {
        document.getElementById(`section-${sec}`).className = 'section-cachee';
        document.getElementById(`btn-${sec}`).className = 'onglet';
    });
    document.getElementById(`section-${section}`).className = 'section-visible animate-fade';
    document.getElementById(`btn-${section}`).className = 'onglet actif';
}

document.getElementById('formResetMdpEquipe').addEventListener('submit', async function(e) {
    e.preventDefault();
    const roleCible = document.getElementById('role-a-modifier').value;
    const nouveauMdp = document.getElementById('nouveau-mdp-equipe').value;
    try {
        const reponse = await fetch('/api/reset-password', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role_a_modifier: roleCible, nouveau_mot_de_passe: nouveauMdp })
        });
        if (reponse.ok) {
            await afficherAlerte("Mise à jour réussie", `Le mot de passe de l'équipe ${roleCible} a été modifié !`, "succes");
            document.getElementById('formResetMdpEquipe').reset();
        } else {
            const err = await reponse.json().catch(() => ({erreur: "Erreur serveur"}));
            await afficherAlerte("Échec", err.erreur || "Erreur lors du traitement.", "erreur");
        }
    } catch (erreur) {
        await afficherAlerte("Erreur réseau", "Connexion interrompue. (" + erreur.message + ")", "erreur");
    }
});

document.getElementById('formResetMdpAdmin').addEventListener('submit', async function(e) {
    e.preventDefault();
    const ancienMdp = document.getElementById('ancien-mdp-admin').value;
    const nouveauMdp = document.getElementById('nouveau-mdp-admin').value;
    try {
        const reponse = await fetch('/api/admin-password', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ancien_mot_de_passe: ancienMdp, nouveau_mot_de_passe: nouveauMdp })
        });
        if (reponse.ok) {
            await afficherAlerte("Sécurité renforcée", "Votre mot de passe a été modifié !", "succes");
            document.getElementById('formResetMdpAdmin').reset();
        } else {
            const err = await reponse.json().catch(() => ({erreur: "Erreur serveur"}));
            await afficherAlerte("Action refusée", err.erreur || "Action refusée", "erreur");
        }
    } catch (erreur) {
        await afficherAlerte("Erreur réseau", "Connexion interrompue. (" + erreur.message + ")", "erreur");
    }
});

// --- PATIENTS & RECHERCHE ---
let tousLesPatients = []; 
let patientsFiltresGlobaux = []; 
let pageActuelle = 1;
const patientsParPage = 10; 

function changerSousOngletPatients(onglet) {
    if (onglet === 'liste') {
        document.getElementById('btn-sous-liste').classList.add('actif');
        document.getElementById('btn-sous-form').classList.remove('actif');
        document.getElementById('zone-liste-patients').className = 'carte transparent section-visible animate-fade';
        document.getElementById('zone-form-patient').className = 'section-cachee';
        pageActuelle = 1;
        afficherPatients(patientsFiltresGlobaux);
    } else if (onglet === 'form') {
        document.getElementById('btn-sous-form').classList.add('actif');
        document.getElementById('btn-sous-liste').classList.remove('actif');
        document.getElementById('zone-form-patient').className = 'section-visible animate-fade';
        document.getElementById('zone-liste-patients').className = 'section-cachee';
    }
}

async function chargerPatients() {
    try {
        const reponse = await fetch('/api/patients');
        if (!reponse.ok) throw new Error("Erreur de chargement");
        tousLesPatients = await reponse.json(); 
        patientsFiltresGlobaux = [...tousLesPatients]; 
        afficherPatients(patientsFiltresGlobaux); 
    } catch (erreur) { console.error("Erreur chargerPatients :", erreur); }
}

function afficherPatients(listeAAfficher) {
    const listElement = document.getElementById('listePatients');
    const paginationElement = document.getElementById('pagination-patients');
    listElement.innerHTML = ''; 
    paginationElement.innerHTML = '';
    
    const badge = document.getElementById('total-dossiers-badge');
    if (badge) badge.innerText = listeAAfficher.length;

    if (listeAAfficher.length === 0) {
        listElement.innerHTML = '<li style="text-align: center; color: #6B7280;">Aucun patient trouvé.</li>';
        paginationElement.style.display = 'none';
        return;
    }

    paginationElement.style.display = 'flex';
    const totalPages = Math.ceil(listeAAfficher.length / patientsParPage);
    if (pageActuelle > totalPages) pageActuelle = totalPages;
    if (pageActuelle < 1) pageActuelle = 1;

    const debut = (pageActuelle - 1) * patientsParPage;
    
    // NOUVEAU & CORRIGÉ : Déclaration et calcul de la variable manquante 'fin'
    const fin = Math.min(debut + patientsParPage, listeAAfficher.length);
    const patientsDeLaPage = listeAAfficher.slice(debut, fin);

    patientsDeLaPage.forEach(patient => {
        const li = document.createElement('li');
        let boutonsActionsHTML = '';
        if (roleActuel === 'admin' || roleActuel === 'support') boutonsActionsHTML += `<button onclick="ouvrirModalEdition(${patient.id})" style="background-color: #3B82F6; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 5px;">✏️ Modifier</button>`;
        if (roleActuel === 'admin') boutonsActionsHTML += `<button onclick="supprimerPatient(${patient.id})" style="background-color: #EF4444; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 10px;">🗑️ Supprimer</button>`;

        let zoneMedicaleHTML = '';
        if (roleActuel !== 'agent') {
            let vitalsHTML = 'Non renseignés';
            try {
                if (patient.parametres && patient.parametres.startsWith('{')) {
                    const v = JSON.parse(patient.parametres);
                    const tempStyle = (v.temp > 38) ? 'color: #EF4444; font-weight: bold;' : (v.temp >= 36.5 && v.temp <= 37.5 ? 'color: #10B981; font-weight: bold;' : 'color: #F59E0B; font-weight: bold;');
                    const poulsStyle = (v.pouls < 60 || v.pouls > 100) ? 'color: #EF4444; font-weight: bold;' : 'color: #10B981; font-weight: bold;';
                    const tensStyle = (v.sys > 140 || v.dia > 90) ? 'color: #EF4444; font-weight: bold;' : (v.sys && v.dia ? 'color: #10B981; font-weight: bold;' : '');

                    vitalsHTML = `
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-top: 8px; background: #FFFFFF; padding: 10px; border-radius: 6px; border: 1px solid var(--bordure);">
                            <span>🌡️ Température : <strong style="${tempStyle}">${v.temp ? v.temp + ' °C' : '--'}</strong></span>
                            <span>⚖️ Poids : <strong style="color: #1A56DB;">${v.poids ? v.poids + ' kg' : '--'}</strong></span>
                            <span>❤️ Fréq. Cardiaque : <strong style="${poulsStyle}">${v.pouls ? v.pouls + ' bpm' : '--'}</strong></span>
                            <span>🩺 Tension : <strong style="${tensStyle}">${v.sys && v.dia ? v.sys + '/' + v.dia + ' mmHg' : '--'}</strong></span>
                        </div>
                    `;
                } else {
                    vitalsHTML = `<p style="margin: 5px 0 0 0; font-style: italic;">${patient.parametres || 'Non renseignés'}</p>`;
                }
            } catch (e) {
                vitalsHTML = `<p style="margin: 5px 0 0 0; font-style: italic;">${patient.parametres || 'Non renseignés'}</p>`;
            }

            zoneMedicaleHTML = `
                <div class="zone-medicale">
                    <strong style="color: var(--bleu-primaire);">📊 Paramètres vitaux :</strong>
                    ${vitalsHTML}
                    <strong style="margin-top:12px; display:inline-block; color: var(--bleu-primaire);">📝 Notes médicales :</strong>
                    <p style="margin: 5px 0 0 0; white-space: pre-wrap; line-height: 1.5;">${patient.notes || 'Aucune note'}</p>
                </div>
            `;
        }

        const classeConsultation = (patient.consultation_statut === 'Payé') ? 'badge-paye' : 'badge-non-paye';
        const texteConsultation = (patient.consultation_statut === 'Payé') ? '🟢 Payé' : '🔴 Non payé';
        const classeControle = (patient.besoin_controle === 'Oui') ? 'badge-controle-oui' : 'badge-controle-non';
        const texteControle = (patient.besoin_controle === 'Oui') ? '⚠️ Contrôle requis' : '✅ Pas de contrôle';

        li.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
                <strong style="font-size: 1.2em; color: #111827;">${patient.nom_complet}</strong>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    ${boutonsActionsHTML}
                    <span class="${classeConsultation}">${texteConsultation}</span>
                    <span class="${classeControle}">${texteControle}</span>
                    <span style="background-color: #DBEAFE; color: #1E40AF; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-family: monospace;">
                        Code: ${patient.code_patient}
                    </span>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px; color: #4B5563; margin-bottom: 10px;">
                <span><strong>Sexe :</strong> ${patient.sexe}</span>
                <span><strong>Né(e) le :</strong> ${formaterDateNaissance(patient.date_naissance)}</span>
                <span><strong>Téléphone :</strong> ${patient.telephone || 'Non renseigné'}</span>
                <span><strong>Entré(e) le :</strong> ${formaterDateNaissance(patient.date_entree)}</span>
            </div>
            <div style="font-size: 14px; color: #4B5563; margin-bottom: 10px; border-top: 1px dashed #E5E7EB; padding-top: 10px;">
                <strong>Adresse :</strong> ${patient.adresse || 'Non renseignée'}
            </div>
            ${zoneMedicaleHTML}
        `;
        listElement.appendChild(li);
    });

    if (totalPages > 1) {
        paginationElement.innerHTML = `
            <div class="pagination-info">Affichage de <strong>${debut + 1}</strong> à <strong>${fin}</strong> sur <strong>${listeAAfficher.length}</strong> dossiers</div>
            <div class="pagination-boutons">
                <button class="btn-page" onclick="changerPage(-1)" ${pageActuelle === 1 ? 'disabled' : ''}>◀ Précédent</button>
                <span class="btn-page" style="background: transparent; border: none;">Page ${pageActuelle} / ${totalPages}</span>
                <button class="btn-page" onclick="changerPage(1)" ${pageActuelle === totalPages ? 'disabled' : ''}>Suivant ▶</button>
            </div>
        `;
    }
}

function changerPage(direction) {
    pageActuelle += direction;
    afficherPatients(patientsFiltresGlobaux);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('champ-recherche').addEventListener('input', filtrerLaListe);
document.getElementById('filtre-recherche').addEventListener('change', filtrerLaListe);

function filtrerLaListe() {
    const texte = document.getElementById('champ-recherche').value.toLowerCase();
    const critere = document.getElementById('filtre-recherche').value;

    patientsFiltresGlobaux = tousLesPatients.filter(patient => {
        if (critere === 'nom') return patient.nom_complet.toLowerCase().includes(texte);
        if (critere === 'code') return patient.code_patient.toLowerCase().includes(texte);
        if (critere === 'telephone') return (patient.telephone || '').toLowerCase().includes(texte);
        return patient.nom_complet.toLowerCase().includes(texte) || patient.code_patient.toLowerCase().includes(texte) || (patient.telephone || '').toLowerCase().includes(texte);
    });

    if (texte.length > 0) changerSousOngletPatients('liste');
    pageActuelle = 1; 
    afficherPatients(patientsFiltresGlobaux);
}

document.getElementById('formPatient').addEventListener('submit', async function(e) {
    e.preventDefault();

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
        telephone: document.getElementById('telephone').value,
        adresse: document.getElementById('adresse').value,
        date_entree: document.getElementById('date_entree').value, 
        sexe: document.getElementById('sexe').value,
        consultation_statut: document.getElementById('consultation_statut').value,
        besoin_controle: document.getElementById('besoin_controle').value,
        parametres: JSON.stringify(vitals), 
        notes: document.getElementById('notes').value
    };
    
    try {
        const reponse = await fetch('/api/patients', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(nouveauPatient) 
        });
        
        if (reponse.ok) { 
            await afficherAlerte("Patient enregistré", "Le dossier a été créé !", "succes"); 
            document.getElementById('formPatient').reset(); 
            chargerPatients(); changerSousOngletPatients('liste');
        } else {
            let messageErreur = "Erreur inconnue du serveur";
            try {
                const err = await reponse.json();
                messageErreur = err.erreur;
            } catch (jsonErr) {
                messageErreur = "Le serveur n'a pas répondu correctement.";
            }
            await afficherAlerte("Erreur", messageErreur, "erreur");
        }
    } catch (erreur) { 
        console.error("Erreur interceptée par fetch:", erreur);
        await afficherAlerte(
            "Connexion interrompue", 
            "Le serveur a fermé la connexion de manière inattendue. Veuillez vérifier votre terminal Node.js pour voir le message d'erreur. (Détail: " + erreur.message + ")", 
            "erreur"
        ); 
    }
});

async function supprimerPatient(id) {
    if (confirm("⚠️ Êtes-vous sûr de vouloir supprimer définitivement ce dossier ?")) {
        try {
            const reponse = await fetch(`/api/patients/${id}`, { method: 'DELETE' });
            if (reponse.ok) { await afficherAlerte("Dossier supprimé", "Le dossier a été retiré.", "succes"); chargerPatients(); }
        } catch (erreur) { 
            console.error(erreur); 
            await afficherAlerte("Erreur", "Connexion interrompue.", "erreur");
        }
    }
}

// --- GESTION INVENTAIRE ---
async function chargerInventaire() {
    try {
        const reponse = await fetch('/api/inventaire');
        if(!reponse.ok) return;
        const articles = await reponse.json();
        const listElement = document.getElementById('listeInventaire');
        listElement.innerHTML = ''; 
        articles.forEach(article => {
            const li = document.createElement('li');
            li.style.borderLeftColor = article.quantite <= 5 ? '#EF4444' : '#10B981';
            const couleurStock = article.quantite <= 5 ? 'color: #EF4444; font-weight: bold;' : 'color: #10B981; font-weight: bold;';
            li.innerHTML = `
                <strong style="font-size: 1.1em;">${article.nom_medicament}</strong><br>
                <span style="${couleurStock}; display: inline-block; margin: 5px 0;">En stock : ${article.quantite} unités</span><br>
                <span style="font-size: 14px; color: #6B7280;">${article.description || 'Aucune description'}</span>
            `;
            listElement.appendChild(li);
        });
    } catch (erreur) { console.error(erreur); }
}

document.getElementById('formInventaire').addEventListener('submit', async function(e) {
    e.preventDefault();
    const nouvelArticle = { nom_medicament: document.getElementById('nom_medicament').value, quantite: document.getElementById('quantite').value, description: document.getElementById('description').value };
    try {
        const reponse = await fetch('/api/inventaire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nouvelArticle) });
        if (reponse.ok) { await afficherAlerte("Stock mis à jour", "Produit ajouté !", "succes"); document.getElementById('formInventaire').reset(); chargerInventaire(); }
    } catch(erreur) { await afficherAlerte("Erreur", "Connexion interrompue.", "erreur"); }
});

// --- MODIFICATION ---
function ouvrirModalEdition(id) {
    const patient = tousLesPatients.find(p => p.id === id);
    if (!patient) return;

    document.getElementById('edit_id').value = patient.id;
    document.getElementById('edit_nom_complet').value = patient.nom_complet;
    document.getElementById('edit_date_naissance').value = patient.date_naissance;
    document.getElementById('edit_telephone').value = patient.telephone;
    document.getElementById('edit_adresse').value = patient.adresse || '';
    document.getElementById('edit_date_entree').value = patient.date_entree;
    document.getElementById('edit_sexe').value = patient.sexe;
    document.getElementById('edit_consultation_statut').value = patient.consultation_statut || 'Non payé';
    document.getElementById('edit_besoin_controle').value = patient.besoin_controle || 'Non';
    
    let v = { temp: '', poids: '', pouls: '', sys: '', dia: '' };
    try { if (patient.parametres && patient.parametres.startsWith('{')) v = JSON.parse(patient.parametres); } catch (e) {}

    document.getElementById('edit_vit_temp').value = v.temp || '';
    document.getElementById('edit_vit_poids').value = v.poids || '';
    document.getElementById('edit_vit_pouls').value = v.pouls || '';
    document.getElementById('edit_vit_sys').value = v.sys || '';
    document.getElementById('edit_vit_dia').value = v.dia || '';
    document.getElementById('edit_notes').value = patient.notes;

    document.getElementById('modal-edition').classList.remove('section-cachee');
    document.body.classList.add('modal-ouvert');
}

function fermerModalEdition() {
    document.getElementById('modal-edition').classList.add('section-cachee');
    document.body.classList.remove('modal-ouvert');
}

document.getElementById('formEditPatient').addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('edit_id').value;
    const vitalsModifiees = {
        temp: document.getElementById('edit_vit_temp').value ? parseFloat(document.getElementById('edit_vit_temp').value) : null,
        poids: document.getElementById('edit_vit_poids').value ? parseFloat(document.getElementById('edit_vit_poids').value) : null,
        pouls: document.getElementById('edit_vit_pouls').value ? parseInt(document.getElementById('edit_vit_pouls').value, 10) : null,
        sys: document.getElementById('edit_vit_sys').value ? parseInt(document.getElementById('edit_vit_sys').value, 10) : null,
        dia: document.getElementById('edit_vit_dia').value ? parseInt(document.getElementById('edit_vit_dia').value, 10) : null
    };

    const donneesModifiees = {
        nom_complet: document.getElementById('edit_nom_complet').value,
        date_naissance: document.getElementById('edit_date_naissance').value,
        telephone: document.getElementById('edit_telephone').value,
        adresse: document.getElementById('edit_adresse').value,
        date_entree: document.getElementById('edit_date_entree').value,
        sexe: document.getElementById('edit_sexe').value,
        consultation_statut: document.getElementById('edit_consultation_statut').value,
        besoin_controle: document.getElementById('edit_besoin_controle').value,
        parametres: JSON.stringify(vitalsModifiees),
        notes: document.getElementById('edit_notes').value
    };
    
    try {
        const reponse = await fetch(`/api/patients/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(donneesModifiees) });
        if (reponse.ok) {
            await afficherAlerte("Enregistré", "Le dossier a été mis à jour !", "succes");
            fermerModalEdition(); chargerPatients(); 
        } else {
            let messageErreur = "Erreur serveur";
            try {
                const err = await reponse.json();
                messageErreur = err.erreur;
            } catch(e) {}
            await afficherAlerte("Erreur", messageErreur, "erreur");
        }
    } catch (erreur) { 
        await afficherAlerte("Erreur réseau", "Impossible de contacter le serveur. (" + erreur.message + ")", "erreur"); 
    }
});

// --- EXPORTATION ---
function formaterParametresPourExport(paramString) {
    if (!paramString) return 'Non renseigné';
    try {
        if (paramString.startsWith('{')) {
            const v = JSON.parse(paramString);
            return `Temp: ${v.temp || '--'}°C | Poids: ${v.poids || '--'}kg | Pouls: ${v.pouls || '--'}bpm | Tension: ${v.sys && v.dia ? v.sys+'/'+v.dia : '--'}mmHg`;
        }
    } catch (e) {}
    return paramString;
}

// --- EXPORTS ---
function exporterCSV() {
    if (tousLesPatients.length === 0) return afficherAlerte("Vide", "Aucun dossier à exporter.", "info");
    let csvContent = "\uFEFFID;Code Patient;Nom et Prénom;Sexe;Date de Naissance;Téléphone;Adresse;Date d'entrée;Statut Consultation;Contrôle Requis;Paramètres vitaux;Notes\r\n";
    tousLesPatients.forEach(p => {
        const ligne = [
            p.id, p.code_patient, p.nom_complet, p.sexe, formaterDateNaissance(p.date_naissance), 
            p.telephone, p.adresse, formaterDateNaissance(p.date_entree), 
            p.consultation_statut || 'Non payé', p.besoin_controle || 'Non', formaterParametresPourExport(p.parametres), p.notes
        ];
        csvContent += ligne.map(cellule => `"${(cellule || '').toString().replace(/"/g, '""')}"`).join(";") + "\r\n";
    });
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    lien.download = "Export_Patients_Clinique.csv";
    document.body.appendChild(lien); lien.click(); lien.remove();
}

function exporterExcel() {
    if (tousLesPatients.length === 0) return afficherAlerte("Vide", "Aucun dossier à exporter.", "info");
    const donneesExcel = tousLesPatients.map(p => ({
        "ID": p.id, "Code Patient": p.code_patient, "Nom et Prénom": p.nom_complet, "Sexe": p.sexe,
        "Date de naissance": formaterDateNaissance(p.date_naissance), "Téléphone": p.telephone,
        "Adresse": p.adresse, "Date d'entrée": formaterDateNaissance(p.date_entree),
        "Statut Consultation": p.consultation_statut || 'Non payé', "Contrôle Requis": p.besoin_controle || 'Non',
        "Paramètres vitaux": formaterParametresPourExport(p.parametres), "Notes": p.notes
    }));
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, XLSX.utils.json_to_sheet(donneesExcel), "Dossiers Patients");
    XLSX.writeFile(classeur, "Export_Patients_Clinique.xlsx");
}