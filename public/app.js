// ==========================================
// SYSTÈME DE POP-UP D'ALERTE HAUT DE GAMME
// ==========================================
function afficherAlerte(titre, message, type = 'info') {
    return new Promise((resolve) => {
        // 1. Création de l'élément de fond (overlay)
        const overlay = document.createElement('div');
        overlay.className = 'overlay-alerte';
        
        // 2. Définition de l'icône animée selon le type de message
        let icone = 'ℹ️';
        if (type === 'succes') icone = '✅';
        if (type === 'erreur') icone = '❌';

        // 3. Injection de la boîte d'alerte
        overlay.innerHTML = `
            <div class="boite-alerte ${type}">
                <span class="icone-alerte">${icone}</span>
                <h3>${titre}</h3>
                <p>${message}</p>
                <button class="btn-alerte">D'accord</button>
            </div>
        `;

        document.body.appendChild(overlay);

        // 4. Focus automatique sur le bouton pour pouvoir appuyer sur "Entrée" pour fermer
        const bouton = overlay.querySelector('.btn-alerte');
        bouton.focus();

        // 5. Logique de fermeture animée
        function fermer() {
            overlay.classList.add('fermeture');
            // On retire du DOM après la fin de l'animation CSS (200ms)
            setTimeout(() => {
                overlay.remove();
                resolve(); // On débloque la suite du code
            }, 200);
        }

        bouton.addEventListener('click', fermer);
    });
}

// ==========================================
// 0. GESTION DE LA CONNEXION, DES SESSIONS ET DES RÔLES
// ==========================================
let roleActuel = ''; 

function appliquerDroitsRole(role) {
    roleActuel = role;
    
    document.getElementById('ecran-connexion').style.display = 'none';
    document.getElementById('application-principale').className = 'section-visible animate-fade';
    
    const btnInventaire = document.getElementById('btn-inventaire');
    const btnParametres = document.getElementById('btn-parametres');
    const btnCompte = document.getElementById('btn-compte');
    
    if (roleActuel === 'agent') {
        btnInventaire.style.display = 'none';
        btnParametres.style.display = 'none';
        btnCompte.style.display = 'none';
        changerOnglet('patients'); 
    } else if (roleActuel === 'support') {
        btnInventaire.style.display = 'none';
        btnParametres.style.display = 'none';
        btnCompte.style.display = 'none';
        changerOnglet('patients'); 
    } else if (roleActuel === 'admin') {
        btnInventaire.style.display = 'block';
        btnParametres.style.display = 'block';
        btnCompte.style.display = 'block';
    }
    
    chargerPatients();
    chargerInventaire();
}

async function seConnecter() {
    const roleSaisi = document.getElementById('choix-role').value;
    const mdpSaisi = document.getElementById('mot-de-passe').value;
    
    if (!mdpSaisi) {
        await afficherAlerte("Champs requis", "Veuillez entrer votre mot de passe pour vous connecter.", "info");
        return;
    }

    try {
        const reponse = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: roleSaisi, mot_de_passe: mdpSaisi })
        });
        
        if (!reponse.ok) {
            await afficherAlerte("Accès refusé", "Le mot de passe saisi est incorrect. Veuillez réessayer.", "erreur");
            return; 
        }

        localStorage.setItem('sessionCliniqueRole', roleSaisi);
        appliquerDroitsRole(roleSaisi);
        document.getElementById('mot-de-passe').value = '';

    } catch (erreur) {
        console.error("Erreur de connexion :", erreur);
        await afficherAlerte("Erreur réseau", "Impossible de joindre le serveur. Vérifiez votre connexion.", "erreur");
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
    if (sessionActive) {
        appliquerDroitsRole(sessionActive);
    }
});

// ==========================================
// 1. GESTION DES ONGLETS (NAVIGATION)
// ==========================================
function changerOnglet(section) {
    const divPatients = document.getElementById('section-patients');
    const divInventaire = document.getElementById('section-inventaire');
    const divParametres = document.getElementById('section-parametres');
    const divCompte = document.getElementById('section-compte');
    
    const btnPatients = document.getElementById('btn-patients');
    const btnInventaire = document.getElementById('btn-inventaire');
    const btnParametres = document.getElementById('btn-parametres');
    const btnCompte = document.getElementById('btn-compte');

    divPatients.className = 'section-cachee';
    divInventaire.className = 'section-cachee';
    divParametres.className = 'section-cachee';
    divCompte.className = 'section-cachee';
    
    btnPatients.className = 'onglet';
    btnInventaire.className = 'onglet';
    btnParametres.className = 'onglet';
    btnCompte.className = 'onglet';

    if (section === 'patients') {
        divPatients.className = 'section-visible animate-fade';
        btnPatients.className = 'onglet actif';
    } else if (section === 'inventaire') {
        divInventaire.className = 'section-visible animate-fade';
        btnInventaire.className = 'onglet actif';
    } else if (section === 'parametres') {
        divParametres.className = 'section-visible animate-fade';
        btnParametres.className = 'onglet actif';
    } else if (section === 'compte') {
        divCompte.className = 'section-visible animate-fade';
        btnCompte.className = 'onglet actif';
    }
}

// ==========================================
// 2. GESTION DES MOTS DE PASSE (ADMIN)
// ==========================================
document.getElementById('formResetMdpEquipe').addEventListener('submit', async function(evenement) {
    evenement.preventDefault();
    const roleCible = document.getElementById('role-a-modifier').value;
    const nouveauMdp = document.getElementById('nouveau-mdp-equipe').value;

    const reponse = await fetch('/api/reset-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_a_modifier: roleCible, nouveau_mot_de_passe: nouveauMdp })
    });

    if (reponse.ok) {
        await afficherAlerte("Mise à jour réussie", `Le mot de passe du compte ${roleCible} a été modifié avec succès !`, "succes");
        document.getElementById('formResetMdpEquipe').reset();
    } else {
        await afficherAlerte("Échec de mise à jour", "Erreur lors de la mise à jour du mot de passe de l'équipe.", "erreur");
    }
});

document.getElementById('formResetMdpAdmin').addEventListener('submit', async function(evenement) {
    evenement.preventDefault();
    const ancienMdp = document.getElementById('ancien-mdp-admin').value;
    const nouveauMdp = document.getElementById('nouveau-mdp-admin').value;

    const reponse = await fetch('/api/admin-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ancien_mot_de_passe: ancienMdp, nouveau_mot_de_passe: nouveauMdp })
    });

    if (reponse.ok) {
        await afficherAlerte("Sécurité renforcée", "Votre mot de passe administrateur a été modifié avec succès !", "succes");
        document.getElementById('formResetMdpAdmin').reset();
    } else {
        const erreur = await reponse.json();
        await afficherAlerte("Action refusée", erreur.erreur, "erreur");
    }
});

// ==========================================
// 3. GESTION DES PATIENTS ET RECHERCHE
// ==========================================
let tousLesPatients = []; 

async function chargerPatients() {
    try {
        const reponse = await fetch('/api/patients');
        tousLesPatients = await reponse.json(); 
        afficherPatients(tousLesPatients); 
    } catch (erreur) {
        console.error("Erreur de chargement", erreur);
    }
}

function afficherPatients(listeAAfficher) {
    const listElement = document.getElementById('listePatients');
    listElement.innerHTML = ''; 
    
    if (listeAAfficher.length === 0) {
        listElement.innerHTML = '<li style="text-align: center; color: #6B7280;">Aucun patient trouvé.</li>';
        return;
    }
    
    listeAAfficher.forEach(patient => {
        const li = document.createElement('li');
        let boutonsActionsHTML = '';
        
        if (roleActuel === 'admin' || roleActuel === 'support') {
            boutonsActionsHTML += `<button onclick="ouvrirModalEdition(${patient.id})" style="background-color: #3B82F6; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 5px;">✏️ Modifier</button>`;
        }
        
        if (roleActuel === 'admin') {
            boutonsActionsHTML += `<button onclick="supprimerPatient(${patient.id})" style="background-color: #EF4444; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 10px;">🗑️ Supprimer</button>`;
        }

        li.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="font-size: 1.2em; color: #111827;">${patient.nom} ${patient.prenom}</strong>
                <div>
                    ${boutonsActionsHTML}
                    <span style="background-color: #DBEAFE; color: #1E40AF; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-family: monospace;">
                        Code: ${patient.code_patient}
                    </span>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px; color: #4B5563; margin-bottom: 10px;">
                <span><strong>Sexe :</strong> ${patient.sexe}</span>
                <span><strong>Né(e) le :</strong> ${patient.date_naissance}</span>
                <span><strong>Téléphone :</strong> ${patient.telephone || 'Non renseigné'}</span>
                <span><strong>Entré(e) le :</strong> ${patient.date_entree}</span>
            </div>
            <div style="font-size: 14px; color: #374151; background: #F3F4F6; padding: 10px; border-radius: 6px;">
                <strong>Paramètres :</strong> ${patient.parametres || 'Non renseignés'}<br>
                <strong style="margin-top:4px; display:inline-block;">Notes :</strong> ${patient.notes || 'Aucune note'}
            </div>
        `;
        listElement.appendChild(li);
    });
}

document.getElementById('champ-recherche').addEventListener('input', filtrerLaListe);
document.getElementById('filtre-recherche').addEventListener('change', filtrerLaListe);

function filtrerLaListe() {
    const texte = document.getElementById('champ-recherche').value.toLowerCase();
    const critere = document.getElementById('filtre-recherche').value;

    const patientsFiltres = tousLesPatients.filter(patient => {
        if (critere === 'nom') return patient.nom.toLowerCase().includes(texte) || patient.prenom.toLowerCase().includes(texte);
        if (critere === 'code') return patient.code_patient.toLowerCase().includes(texte);
        if (critere === 'telephone') return (patient.telephone || '').toLowerCase().includes(texte);
        return patient.nom.toLowerCase().includes(texte) || patient.prenom.toLowerCase().includes(texte) || patient.code_patient.toLowerCase().includes(texte) || (patient.telephone || '').toLowerCase().includes(texte);
    });

    if(texte.length > 0) {
        document.getElementById('zone-liste-patients').className = 'carte transparent section-visible animate-fade';
        document.getElementById('btn-voir-patients').innerHTML = '🙈 Masquer la liste des patients';
        document.getElementById('btn-voir-patients').style.backgroundColor = '#6B7280';
    }
    afficherPatients(patientsFiltres);
}

document.getElementById('formPatient').addEventListener('submit', async function(evenement) {
    evenement.preventDefault();
    const nouveauPatient = {
        nom: document.getElementById('nom').value, prenom: document.getElementById('prenom').value,
        date_naissance: document.getElementById('date_naissance').value, telephone: document.getElementById('telephone').value,
        date_entree: document.getElementById('date_entree').value, sexe: document.getElementById('sexe').value,
        parametres: document.getElementById('parametres').value, notes: document.getElementById('notes').value
    };
    
    const reponse = await fetch('/api/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nouveauPatient) });
    if (reponse.ok) { 
        await afficherAlerte("Patient enregistré", "Le dossier médical a été créé avec succès !", "succes"); 
        document.getElementById('formPatient').reset(); 
        chargerPatients(); 
    }
});

async function supprimerPatient(id) {
    if (confirm("⚠️ Êtes-vous sûr de vouloir supprimer définitivement ce dossier ?")) {
        try {
            const reponse = await fetch(`/api/patients/${id}`, { method: 'DELETE' });
            if (reponse.ok) { 
                await afficherAlerte("Dossier supprimé", "Le dossier du patient a été retiré de la base de données.", "succes"); 
                chargerPatients(); 
            }
        } catch (erreur) { console.error("Erreur suppression", erreur); }
    }
}

document.getElementById('btn-voir-patients').addEventListener('click', function() {
    const zoneListe = document.getElementById('zone-liste-patients');
    const bouton = document.getElementById('btn-voir-patients');
    if (zoneListe.classList.contains('section-cachee')) {
        zoneListe.className = 'carte transparent section-visible animate-fade';
        bouton.innerHTML = '🙈 Masquer la liste des patients'; bouton.style.backgroundColor = '#6B7280'; 
    } else {
        zoneListe.className = 'carte transparent section-cachee';
        bouton.innerHTML = '👁️ Voir tous les dossiers des patients'; bouton.style.backgroundColor = '#4F46E5'; 
        document.getElementById('champ-recherche').value = ''; filtrerLaListe(); 
    }
});

// ==========================================
// 4. GESTION DE L'INVENTAIRE
// ==========================================
async function chargerInventaire() {
    try {
        const reponse = await fetch('/api/inventaire');
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
    } catch (erreur) { console.error("Erreur de chargement", erreur); }
}

document.getElementById('formInventaire').addEventListener('submit', async function(evenement) {
    evenement.preventDefault();
    const nouvelArticle = { nom_medicament: document.getElementById('nom_medicament').value, quantite: document.getElementById('quantite').value, description: document.getElementById('description').value };
    const reponse = await fetch('/api/inventaire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nouvelArticle) });
    if (reponse.ok) { 
        await afficherAlerte("Stock mis à jour", "Le produit a bien été ajouté ou mis à jour dans l'inventaire !", "succes"); 
        document.getElementById('formInventaire').reset(); 
        chargerInventaire(); 
    }
});

// ==========================================
// 5. MODIFICATION D'UN DOSSIER PATIENT
// ==========================================
function ouvrirModalEdition(id) {
    const patient = tousLesPatients.find(p => p.id === id);
    if (!patient) return;

    document.getElementById('edit_id').value = patient.id;
    document.getElementById('edit_nom').value = patient.nom;
    document.getElementById('edit_prenom').value = patient.prenom;
    document.getElementById('edit_date_naissance').value = patient.date_naissance;
    document.getElementById('edit_telephone').value = patient.telephone;
    document.getElementById('edit_date_entree').value = patient.date_entree;
    document.getElementById('edit_sexe').value = patient.sexe;
    document.getElementById('edit_parametres').value = patient.parametres;
    document.getElementById('edit_notes').value = patient.notes;

    document.getElementById('modal-edition').classList.remove('section-cachee');
}

function fermerModalEdition() {
    document.getElementById('modal-edition').classList.add('section-cachee');
}

document.getElementById('formEditPatient').addEventListener('submit', async function(evenement) {
    evenement.preventDefault();
    
    const id = document.getElementById('edit_id').value;
    const donneesModifiees = {
        nom: document.getElementById('edit_nom').value,
        prenom: document.getElementById('edit_prenom').value,
        date_naissance: document.getElementById('edit_date_naissance').value,
        telephone: document.getElementById('edit_telephone').value,
        date_entree: document.getElementById('edit_date_entree').value,
        sexe: document.getElementById('edit_sexe').value,
        parametres: document.getElementById('edit_parametres').value,
        notes: document.getElementById('edit_notes').value
    };
    
    try {
        const reponse = await fetch(`/api/patients/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(donneesModifiees)
        });
        
        if (reponse.ok) {
            await afficherAlerte("Modification enregistrée", "Le dossier du patient a été mis à jour avec succès !", "succes");
            fermerModalEdition();
            chargerPatients(); 
        }
    } catch (erreur) {
        console.error("Erreur lors de la modification", erreur);
    }
});