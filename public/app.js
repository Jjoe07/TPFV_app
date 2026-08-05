// =========================================================================
// FICHIER : public/app.js (Format FICHE DU PATIENT & CONS01 sous la date)
// =========================================================================
let tousLesPatients = [];
let patientsFiltresGlobaux = [];
let pageActuelle = 1;
let roleActuel = '';
const patientsParPage = 5;

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

// --- 2. GESTION DU RDV SPÉCIALISTE ---
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

// --- 3. AUTHENTIFICATION & RÔLES ---
function appliquerDroitsRole(role) {
    roleActuel = role;
    const ecranConnexion = document.getElementById('ecran-connexion');
    const appPrincipale = document.getElementById('application-principale');

    if (ecranConnexion) ecranConnexion.classList.replace('section-visible', 'section-cachee');
    if (appPrincipale) appPrincipale.classList.replace('section-cachee', 'section-visible');
    
    const els = { inv: document.getElementById('btn-inventaire'), par: document.getElementById('btn-parametres'), ctp: document.getElementById('btn-compte') };
    
    if (role === 'agent' || role === 'support') { 
        if(els.inv) els.inv.style.display='none'; 
        if(els.par) els.par.style.display='none'; 
        if(els.ctp) els.ctp.style.display='none'; 
        changerOnglet('patients'); 
    } else { 
        if(els.inv) els.inv.style.display='block'; 
        if(els.par) els.par.style.display='block'; 
        if(els.ctp) els.ctp.style.display='block'; 
    }

    // PROTECTION DES DONNÉES MÉDICALES POUR LE RÔLE AGENT
    const champsMed = document.getElementById('champs-medicaux');
    const editChampsMed = document.getElementById('edit_champs-medicaux');
    
    if (role === 'agent') {
        if (champsMed) champsMed.style.display = 'none';
        if (editChampsMed) editChampsMed.style.display = 'none';
    } else {
        if (champsMed) champsMed.style.display = 'block';
        if (editChampsMed) editChampsMed.style.display = 'block';
    }

    chargerPatients();
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
    document.getElementById('application-principale').classList.replace('section-visible','section-cachee'); 
    document.getElementById('ecran-connexion').classList.replace('section-cachee','section-visible'); 
}

// --- 4. ÉCOUTEURS DES FORMULAIRES DE MOT DE PASSE ---
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('champ-recherche')?.addEventListener('input', filtrerPatients);
    document.getElementById('filtre-recherche')?.addEventListener('change', filtrerPatients);
    
    const formEquipe = document.getElementById('formResetMdpEquipe');
    if (formEquipe) {
        formEquipe.addEventListener('submit', async function(e) {
            e.preventDefault();
            const roleSelect = document.getElementById('role-a-modifier')?.value;
            const nouveauMdpInput = document.getElementById('nouveau-mdp-equipe');
            const nouveauMdp = nouveauMdpInput ? nouveauMdpInput.value : '';

            if (!nouveauMdp || !nouveauMdp.trim()) return afficherAlerte("Champ requis", "Veuillez entrer un mot de passe valide.", "erreur");

            try {
                const reponse = await fetch('/api/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role_a_modifier: roleSelect, nouveau_mot_de_passe: nouveauMdp.trim() })
                });
                const data = await reponse.json();
                if (reponse.ok) {
                    await afficherAlerte("Succès", data.message, "succes");
                    if (nouveauMdpInput) nouveauMdpInput.value = '';
                } else await afficherAlerte("Erreur", data.erreur || "Impossible de modifier le mot de passe.", "erreur");
            } catch (err) {}
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

// --- 5. NAVIGATION & RECHERCHE AVEC TRI ALPHABÉTIQUE ---
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
    ['patients', 'parametres', 'compte'].forEach(s => { 
        document.getElementById(`section-${s}`)?.classList.replace('section-visible','section-cachee'); 
        document.getElementById(`btn-${s}`)?.classList.remove('actif'); 
    });
    document.getElementById(`section-${sec}`)?.classList.replace('section-cachee','section-visible'); 
    document.getElementById(`btn-${sec}`)?.classList.add('actif');
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
    }
}

// --- 6. GESTION DES PATIENTS ---
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
                <div style="display:flex;align-items:center;gap:6px;">${btn} <span class="${p.consultation_statut==='Payé'?'badge-paye':'badge-non-paye'}">${p.consultation_statut||'Non payé'}</span> <span style="font-family:monospace;background:var(--fond-page);border:1px solid var(--bordure);padding:4px 8px;border-radius:6px;font-size:12px;font-weight:700;">${p.code_patient}</span></div>
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
    const vitals = { temp: document.getElementById('vit_temp')?.value||null, poids: document.getElementById('vit_poids')?.value||null, pouls: document.getElementById('vit_pouls')?.value||null, sys: document.getElementById('vit_sys')?.value||null, dia: document.getElementById('vit_dia')?.value||null };
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
        allergies: document.getElementById('allergies')?.value || '', maladies_chroniques: document.getElementById('maladies_chroniques')?.value || '', chirurgies: document.getElementById('chirurgies')?.value || '', traitements_en_cours: document.getElementById('traitements_en_cours')?.value || '', 
        motif_visite: document.getElementById('motif_visite')?.value || '', diagnostic: document.getElementById('diagnostic')?.value || '', prochain_rdv: document.getElementById('prochain_rdv').value, 
        consultation_statut: document.getElementById('consultation_statut').value, besoin_controle: document.getElementById('besoin_controle').value, parametres: JSON.stringify(vitals), notes: document.getElementById('notes').value 
    };

    try { 
        const r = await fetch('/api/patients', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(np) }); 
        if(r.ok) { await afficherAlerte("Succès", "Nouveau dossier créé !", "succes"); e.target.reset(); gererAffichageRdvSpecialiste('type_consultation', 'bloc_rdv_specialiste'); chargerPatients(); changerSousOngletPatients('liste'); } 
    } catch(er){}
});

// ÉDITION PATIENT
function ouvrirModalEdition(id) {
    const p = tousLesPatients.find(x => x.id === id); if(!p) return;
    document.getElementById('modal-edition').style.display = 'flex';
    document.getElementById('edit_id').value = p.id;
    document.getElementById('edit_id').dataset.ancienPatient = JSON.stringify(p);
    
    ['nom_complet','date_naissance','sexe','telephone','date_entree','date_visite','adresse','contact_urgence','type_consultation','date_rdv_specialiste','heure_rdv_specialiste','allergies','maladies_chroniques','chirurgies','traitements_en_cours','motif_visite','diagnostic','prochain_rdv','consultation_statut','besoin_controle','notes'].forEach(k => {
        const el = document.getElementById('edit_'+k); if(el) el.value = p[k]||'';
    });

    const editHeureEl = document.getElementById('edit_heure_rdv_specialiste');
    if (editHeureEl && !editHeureEl.value) editHeureEl.value = '09:00';

    cocherServicesSpecifiques('edit_services_specifiques', p.services_specifiques);
    gererAffichageRdvSpecialiste('edit_type_consultation', 'edit_bloc_rdv_specialiste');
}

function fermerModalEdition() { document.getElementById('modal-edition').style.display = 'none'; }

document.getElementById('formEditPatient')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('edit_id')?.value;
    const oldP = JSON.parse(document.getElementById('edit_id')?.dataset.ancienPatient || '{}');

    const vitals = { temp: document.getElementById('edit_vit_temp')?.value||null, poids: document.getElementById('edit_vit_poids')?.value||null, pouls: document.getElementById('edit_vit_pouls')?.value||null, sys: document.getElementById('edit_vit_sys')?.value||null, dia: document.getElementById('edit_vit_dia')?.value||null };
    
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
            date_rdv_specialiste: oldP.date_rdv_specialiste, heure_rdv_specialiste: oldP.heure_rdv_specialiste
        });
    }

    const typeConsultation = document.getElementById('edit_type_consultation')?.value || 'Consultation généraliste';
    let dateRdv = document.getElementById('edit_date_rdv_specialiste')?.value || '';
    let heureRdv = document.getElementById('edit_heure_rdv_specialiste')?.value || '09:00';

    const mod = {}; 
    ['nom_complet','date_naissance','sexe','telephone','date_entree','date_visite','adresse','contact_urgence','allergies','maladies_chroniques','chirurgies','traitements_en_cours','motif_visite','diagnostic','prochain_rdv','consultation_statut','besoin_controle','notes'].forEach(k => {
        const el = document.getElementById('edit_'+k); if (el) mod[k] = el.value;
    }); 

    mod.type_consultation = typeConsultation;
    mod.date_rdv_specialiste = dateRdv;
    mod.heure_rdv_specialiste = heureRdv;
    mod.services_specifiques = obtenirServicesCoches('edit_services_specifiques');
    mod.parametres = JSON.stringify(vitals);
    mod.historique_consultations = JSON.stringify(history);
    
    try { 
        const r = await fetch(`/api/patients/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(mod) }); 
        if (r.ok) { await afficherAlerte("Succès", "Dossier mis à jour !", "succes"); fermerModalEdition(); chargerPatients(); } 
    } catch(er){}
});

async function supprimerPatient(id) { 
    if(confirm("Supprimer ce dossier patient ?")) { await fetch(`/api/patients/${id}`,{method:'DELETE'}); chargerPatients(); } 
}

// --- 7. FICHE A4 PDF (Disposition CONS01 sous la Date + "FICHE DU PATIENT") ---
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
        date_rdv_specialiste: patient.date_rdv_specialiste, heure_rdv_specialiste: patient.heure_rdv_specialiste
    }];

    let contenuToutesLesPages = '';

    visitesAImprimer.forEach((visite, index) => {
        if (index > 0) contenuToutesLesPages += `<div class="html2pdf__page-break"></div>`;

        let v = { temp: '--', poids: '--', pouls: '--', sys: '--', dia: '--' };
        try { if (visite.parametres && visite.parametres.startsWith('{')) v = JSON.parse(visite.parametres); } catch (e) {}

        const dateVisiteAffichee = formaterDateEnLettres(visite.date_visite || patient.date_entree || new Date().toISOString().slice(0, 10));

        let ligneRdvSpecialistePDF = '';
        const typeTxt = (visite.type_consultation || '').toLowerCase();
        if (typeTxt.includes('rendez-vous') || typeTxt.includes('spécialiste') || visite.date_rdv_specialiste) {
            const dPdf = visite.date_rdv_specialiste ? formaterDateEnLettres(visite.date_rdv_specialiste) : 'Non renseignée';
            const hPdf = visite.heure_rdv_specialiste && visite.heure_rdv_specialiste.trim() !== '' ? visite.heure_rdv_specialiste : '09:00';
            ligneRdvSpecialistePDF = `<tr><td colspan="2" style="color:#0284C7; font-weight:bold; padding-top:4px;">📅 RDV Spécialiste : ${dPdf} ⏰ à ${hPdf}</td></tr>`;
        }

        // FORMATAGE DU CODE CONSULTATION (ex: CONS01, CONS02)
        const numeroFormatted = (index + 1).toString().padStart(2, '0');

        // MASQUAGE DES BLOCS MÉDICAUX SUR LE PDF SI RÔLE AGENT
        let blocAntecedentsPDF = '';
        let blocSuiviVitalsPDF = '';

        if (roleActuel !== 'agent') {
            blocAntecedentsPDF = `
                <div class="section-box" style="background:#FFF5F5; border:1px solid #FCA5A5;">
                    <div style="font-weight:bold; color:#DC2626; margin-bottom:6px;">🩺 ANTÉCÉDENTS MÉDICAUX</div>
                    <p><strong>Allergies :</strong> ${patient.allergies || 'Aucune'}</p>
                    <p><strong>Maladies chroniques :</strong> ${patient.maladies_chroniques || 'Aucune'}</p>
                </div>`;
            
            blocSuiviVitalsPDF = `
                <div class="section-box" style="background:#FAFAFA; border:1px solid #E2E8F0;">
                    <div style="font-weight:bold; color:#0D9488; margin-bottom:6px;">📊 DETAILS DE CETTE CONSULTATION</div>
                    <p><strong>Temp :</strong> ${v.temp||'--'} °C | <strong>Poids :</strong> ${v.poids||'--'} kg | <strong>Pouls :</strong> ${v.pouls||'--'} bpm | <strong>Tension :</strong> ${v.sys&&v.dia?v.sys+'/'+v.dia+' mmHg':'--'}</p>
                    <p><strong>Motif :</strong> ${visite.motif_visite || 'Non renseigné'}</p>
                    <p><strong>Diagnostic :</strong> ${visite.diagnostic || 'En attente'}</p>
                </div>`;
        }

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
                
                <!-- BANDEAU SIMPLIFIÉ -->
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