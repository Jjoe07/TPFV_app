// ==========================================
// FICHIER : serveur.js
// Rôle : Serveur Backend et Base de données
// ==========================================
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('clinique.db');

// --- 1. CRÉATION DES TABLES ---
db.run(`CREATE TABLE IF NOT EXISTS Utilisateurs (
    role TEXT PRIMARY KEY,
    mot_de_passe TEXT NOT NULL
)`, () => {
    db.get("SELECT COUNT(*) as count FROM Utilisateurs", (err, row) => {
        if (row && row.count === 0) {
            // Création des 3 comptes par défaut
            db.run("INSERT INTO Utilisateurs (role, mot_de_passe) VALUES ('agent', 'agent123'), ('admin', 'secret123'), ('support', 'sup123')");
        }
    });
});

db.run(`CREATE TABLE IF NOT EXISTS Patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_patient TEXT UNIQUE,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    date_entree TEXT NOT NULL,
    date_naissance TEXT NOT NULL,
    sexe TEXT,
    telephone TEXT,
    parametres TEXT,
    notes TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS Inventaire (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_medicament TEXT NOT NULL,
    quantite INTEGER NOT NULL,
    description TEXT
)`);

// --- 2. ROUTES DE SÉCURITÉ ---
// Connexion
app.post('/api/login', (req, res) => {
    const { role, mot_de_passe } = req.body;
    db.get("SELECT * FROM Utilisateurs WHERE role = ? AND mot_de_passe = ?", [role, mot_de_passe], (err, utilisateur) => {
        if (err) return res.status(500).json({ erreur: err.message });
        if (utilisateur) res.json({ message: "Connexion réussie !" });
        else res.status(401).json({ erreur: "Mot de passe incorrect." });
    });
});

// Réinitialiser le mot de passe de l'agent ou du support (par l'admin)
app.put('/api/reset-password', (req, res) => {
    const { role_a_modifier, nouveau_mot_de_passe } = req.body;
    
    if (role_a_modifier !== 'agent' && role_a_modifier !== 'support') {
        return res.status(403).json({ erreur: "Modification non autorisée pour ce rôle." });
    }

    db.run("UPDATE Utilisateurs SET mot_de_passe = ? WHERE role = ?", [nouveau_mot_de_passe, role_a_modifier], function(err) {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json({ message: `Le mot de passe du compte ${role_a_modifier} a été mis à jour !` });
    });
});

// Modifier le mot de passe de l'admin
app.put('/api/admin-password', (req, res) => {
    const { ancien_mot_de_passe, nouveau_mot_de_passe } = req.body;
    db.get("SELECT * FROM Utilisateurs WHERE role = 'admin' AND mot_de_passe = ?", [ancien_mot_de_passe], (err, utilisateur) => {
        if (err) return res.status(500).json({ erreur: err.message });
        if (utilisateur) {
            db.run("UPDATE Utilisateurs SET mot_de_passe = ? WHERE role = 'admin'", [nouveau_mot_de_passe], function(err) {
                if (err) return res.status(500).json({ erreur: err.message });
                res.json({ message: "Mot de passe administrateur mis à jour !" });
            });
        } else {
            res.status(401).json({ erreur: "L'ancien mot de passe est incorrect." });
        }
    });
});

// --- 3. ROUTES POUR LES PATIENTS ---
app.get('/api/patients', (req, res) => {
    db.all("SELECT * FROM Patients ORDER BY id DESC", [], (err, lignes) => {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json(lignes);
    });
});

app.post('/api/patients', (req, res) => {
    const { nom, prenom, date_entree, date_naissance, sexe, telephone, parametres, notes } = req.body; 
    const [annee, mois, jour] = date_entree.split('-');
    const dateFormatee = `${jour}${mois}${annee}`;

    db.get("SELECT COUNT(*) as nombre FROM Patients WHERE date_entree = ?", [date_entree], (err, resultat) => {
        if (err) return res.status(500).json({ erreur: err.message });
        const numero = (resultat.nombre + 1).toString().padStart(3, '0');
        const code_patient = `${dateFormatee}${numero}`;

        const requete = `INSERT INTO Patients (code_patient, nom, prenom, date_entree, date_naissance, sexe, telephone, parametres, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(requete, [code_patient, nom, prenom, date_entree, date_naissance, sexe, telephone, parametres, notes], function(err) {
            if (err) return res.status(400).json({ erreur: err.message });
            res.json({ id: this.lastID, message: "Dossier patient créé !" });
        });
    });
});

app.put('/api/patients/:id', (req, res) => {
    const idPatient = req.params.id;
    const { nom, prenom, date_entree, date_naissance, sexe, telephone, parametres, notes } = req.body; 
    
    const requete = `UPDATE Patients SET nom = ?, prenom = ?, date_entree = ?, date_naissance = ?, sexe = ?, telephone = ?, parametres = ?, notes = ? WHERE id = ?`;
    
    db.run(requete, [nom, prenom, date_entree, date_naissance, sexe, telephone, parametres, notes, idPatient], function(err) {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json({ message: "Dossier patient mis à jour avec succès !" });
    });
});

app.delete('/api/patients/:id', (req, res) => {
    const idPatient = req.params.id;
    db.run("DELETE FROM Patients WHERE id = ?", [idPatient], function(err) {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json({ message: "Dossier patient supprimé !" });
    });
});

// --- 4. ROUTES POUR L'INVENTAIRE ---
app.get('/api/inventaire', (req, res) => {
    db.all("SELECT * FROM Inventaire ORDER BY nom_medicament ASC", [], (err, lignes) => {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json(lignes);
    });
});

app.post('/api/inventaire', (req, res) => {
    const { nom_medicament, quantite, description } = req.body;
    const requete = `INSERT INTO Inventaire (nom_medicament, quantite, description) VALUES (?, ?, ?)`;
    db.run(requete, [nom_medicament, quantite, description], function(err) {
        if (err) return res.status(400).json({ erreur: err.message });
        res.json({ id: this.lastID, message: "Médicament ajouté !" });
    });
});

// --- 5. DÉMARRAGE ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur en ligne sur le port ${PORT}`);
});