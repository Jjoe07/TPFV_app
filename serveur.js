// =========================================================================
// FICHIER : serveur.js (Tri Alphabétique A-Z dans la base SQLite)
// =========================================================================
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const dbFolder = path.join(__dirname, '.data');
if (!fs.existsSync(dbFolder)) { fs.mkdirSync(dbFolder, { recursive: true }); }
const dbPath = path.join(dbFolder, 'clinique.db');
const db = new sqlite3.Database(dbPath);

// --- INITIALISATION DE LA BASE DE DONNÉES ---
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS Utilisateurs (
        role TEXT PRIMARY KEY, 
        mot_de_passe TEXT NOT NULL
    )`);

    db.run("INSERT OR IGNORE INTO Utilisateurs (role, mot_de_passe) VALUES ('agent', 'agent123')");
    db.run("INSERT OR IGNORE INTO Utilisateurs (role, mot_de_passe) VALUES ('support', 'sup123')");
    db.run("INSERT OR IGNORE INTO Utilisateurs (role, mot_de_passe) VALUES ('admin', 'secret123')");

    db.run(`CREATE TABLE IF NOT EXISTS Patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        code_patient TEXT UNIQUE, 
        nom_complet TEXT NOT NULL,
        date_entree TEXT, 
        date_visite TEXT, 
        date_naissance TEXT, 
        sexe TEXT, 
        telephone TEXT NOT NULL, 
        adresse TEXT,
        contact_urgence TEXT, 
        allergies TEXT, 
        maladies_chroniques TEXT, 
        chirurgies TEXT, 
        traitements_en_cours TEXT,
        motif_visite TEXT, 
        diagnostic TEXT, 
        prochain_rdv TEXT, 
        consultation_statut TEXT DEFAULT 'Non payé', 
        besoin_controle TEXT DEFAULT 'Non', 
        type_consultation TEXT,
        services_specifiques TEXT,
        date_rdv_specialiste TEXT,
        heure_rdv_specialiste TEXT,
        parametres TEXT, 
        notes TEXT
    )`);

    // Verification & Migration des colonnes SQLite
    const colonnes = ['contact_urgence', 'allergies', 'maladies_chroniques', 'chirurgies', 'traitements_en_cours', 'motif_visite', 'diagnostic', 'prochain_rdv', 'date_visite', 'type_consultation', 'services_specifiques', 'date_rdv_specialiste', 'heure_rdv_specialiste'];
    colonnes.forEach(col => {
        db.run(`ALTER TABLE Patients ADD COLUMN ${col} TEXT`, () => {});
    });
});

// --- AUTHENTIFICATION ---
app.post('/api/login', (req, res) => {
    const { role, mot_de_passe } = req.body;
    db.get("SELECT * FROM Utilisateurs WHERE role = ?", [(role || '').trim().toLowerCase()], (err, user) => {
        if (err) return res.status(500).json({ erreur: err.message });
        if (!user || user.mot_de_passe !== (mot_de_passe || '').trim()) {
            return res.status(401).json({ erreur: "Identifiants incorrects." });
        }
        res.json({ message: "Connexion réussie !" });
    });
});

app.post('/api/reset-password', (req, res) => {
    const { role_a_modifier, nouveau_mot_de_passe } = req.body;
    const target = (role_a_modifier || '').trim().toLowerCase();
    db.run("INSERT OR REPLACE INTO Utilisateurs (role, mot_de_passe) VALUES (?, ?)", [target, (nouveau_mot_de_passe || '').trim()], err => {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json({ message: `Le mot de passe pour ${target.toUpperCase()} a été modifié avec succès !` });
    });
});

app.post('/api/admin-password', (req, res) => {
    const { ancien_mot_de_passe, nouveau_mot_de_passe } = req.body;
    db.get("SELECT * FROM Utilisateurs WHERE role = 'admin'", [], (err, user) => {
        if (err || !user || user.mot_de_passe !== (ancien_mot_de_passe || '').trim()) {
            return res.status(401).json({ erreur: "L'ancien mot de passe est incorrect." });
        }
        db.run("UPDATE Utilisateurs SET mot_de_passe = ? WHERE role = 'admin'", [(nouveau_mot_de_passe || '').trim()], e => {
            res.json(e ? { erreur: e.message } : { message: "Mot de passe Administrateur mis à jour !" });
        });
    });
});

// --- API PATIENTS (Trié de A à Z par nom_complet) ---
app.get('/api/patients', (req, res) => { 
    db.all("SELECT * FROM Patients ORDER BY nom_complet COLLATE NOCASE ASC", [], (err, lignes) => res.json(err ? { erreur: err.message } : lignes)); 
});

app.post('/api/patients', (req, res) => {
    const p = req.body;
    if (!p.nom_complet || !p.telephone) return res.status(400).json({ erreur: "Nom et téléphone requis." });
    
    let df = "00000000"; 
    if (p.date_entree && p.date_entree.includes('-')) { 
        const pt = p.date_entree.split('-'); 
        df = `${pt[2]}${pt[1]}${pt[0]}`; 
    }

    db.get("SELECT code_patient FROM Patients WHERE code_patient LIKE ? ORDER BY code_patient DESC LIMIT 1", [`${df}%`], (err, dernier) => {
        const num = dernier ? parseInt(dernier.code_patient.slice(-3), 10) || 0 : 0;
        const code = `${df}${(num + 1).toString().padStart(3, '0')}`;
        
        db.run(`INSERT INTO Patients (code_patient, nom_complet, date_entree, date_visite, date_naissance, sexe, telephone, adresse, contact_urgence, allergies, maladies_chroniques, chirurgies, traitements_en_cours, motif_visite, diagnostic, prochain_rdv, consultation_statut, besoin_controle, type_consultation, services_specifiques, date_rdv_specialiste, heure_rdv_specialiste, parametres, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
        [code, p.nom_complet.trim(), p.date_entree||'', p.date_visite||'', p.date_naissance||'', p.sexe||'Masculin', p.telephone.trim(), p.adresse||'', p.contact_urgence||'', p.allergies||'', p.maladies_chroniques||'', p.chirurgies||'', p.traitements_en_cours||'', p.motif_visite||'', p.diagnostic||'', p.prochain_rdv||'', p.consultation_statut || 'Non payé', p.besoin_controle || 'Non', p.type_consultation || 'Consultation généraliste', p.services_specifiques || '', p.date_rdv_specialiste || '', p.heure_rdv_specialiste || '', p.parametres||'', p.notes||''], 
        function(e) { res.json(e ? { erreur: e.message } : { id: this.lastID, message: "Dossier créé !" }); });
    });
});

app.put('/api/patients/:id', (req, res) => {
    const p = req.body;
    db.run(`UPDATE Patients SET nom_complet=?, date_entree=?, date_visite=?, date_naissance=?, sexe=?, telephone=?, adresse=?, contact_urgence=?, allergies=?, maladies_chroniques=?, chirurgies=?, traitements_en_cours=?, motif_visite=?, diagnostic=?, prochain_rdv=?, consultation_statut=?, besoin_controle=?, type_consultation=?, services_specifiques=?, date_rdv_specialiste=?, heure_rdv_specialiste=?, parametres=?, notes=? WHERE id=?`, 
    [p.nom_complet.trim(), p.date_entree||'', p.date_visite||'', p.date_naissance||'', p.sexe||'Masculin', p.telephone.trim(), p.adresse||'', p.contact_urgence||'', p.allergies||'', p.maladies_chroniques||'', p.chirurgies||'', p.traitements_en_cours||'', p.motif_visite||'', p.diagnostic||'', p.prochain_rdv||'', p.consultation_statut||'Non payé', p.besoin_controle||'Non', p.type_consultation||'Consultation généraliste', p.services_specifiques||'', p.date_rdv_specialiste||'', p.heure_rdv_specialiste||'', p.parametres||'', p.notes||'', req.params.id], 
    e => res.json(e ? { erreur: e.message } : { message: "Mis à jour" }));
});

app.delete('/api/patients/:id', (req, res) => { 
    db.run("DELETE FROM Patients WHERE id = ?", [req.params.id], e => res.json(e ? { erreur: e.message } : { message: "Supprimé" })); 
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Serveur prêt sur http://localhost:${PORT}`));