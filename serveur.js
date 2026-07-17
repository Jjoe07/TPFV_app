// =========================================================================
// FICHIER : serveur.js
// Rôle : Serveur Backend, API REST, Gestion SQLite & Sécurité anti-doublon
// =========================================================================
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('clinique.db');

// --- 1. CONFIGURATION INITIALE DE LA BASE DE DONNÉES ---
db.run(`CREATE TABLE IF NOT EXISTS Utilisateurs (
    role TEXT PRIMARY KEY,
    mot_de_passe TEXT NOT NULL
)`, () => {
    db.get("SELECT COUNT(*) as count FROM Utilisateurs", (err, row) => {
        if (row && row.count === 0) {
            db.run("INSERT INTO Utilisateurs (role, mot_de_passe) VALUES ('agent', 'agent123'), ('admin', 'secret123'), ('support', 'sup123')");
        }
    });
});

db.run(`CREATE TABLE IF NOT EXISTS Patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_patient TEXT UNIQUE,
    nom_complet TEXT NOT NULL,
    date_entree TEXT NOT NULL,
    date_naissance TEXT NOT NULL,
    sexe TEXT,
    telephone TEXT NOT NULL,
    adresse TEXT,
    consultation_statut TEXT DEFAULT 'Non payé',
    besoin_controle TEXT DEFAULT 'Non',
    parametres TEXT,
    notes TEXT
)`, () => {
    db.serialize(() => {
        db.run("ALTER TABLE Patients ADD COLUMN consultation_statut TEXT DEFAULT 'Non payé'", () => {});
        db.run("ALTER TABLE Patients ADD COLUMN besoin_controle TEXT DEFAULT 'Non'", () => {});
    });
});

db.run(`CREATE TABLE IF NOT EXISTS Inventaire (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_medicament TEXT NOT NULL,
    quantite INTEGER NOT NULL,
    description TEXT
)`);

// --- 2. GESTION DES SESSIONS & SÉCURITÉ ---
app.post('/api/login', (req, res) => {
    try {
        const { role, mot_de_passe } = req.body;
        db.get("SELECT * FROM Utilisateurs WHERE role = ? AND mot_de_passe = ?", [role, mot_de_passe], (err, utilisateur) => {
            if (err) return res.status(500).json({ erreur: err.message });
            if (utilisateur) res.json({ message: "Connexion réussie !" });
            else res.status(401).json({ erreur: "Mot de passe incorrect." });
        });
    } catch (error) {
        res.status(500).json({ erreur: "Erreur interne: " + error.message });
    }
});

app.put('/api/reset-password', (req, res) => {
    try {
        const { role_a_modifier, nouveau_mot_de_passe } = req.body;
        if (role_a_modifier !== 'agent' && role_a_modifier !== 'support') {
            return res.status(403).json({ erreur: "Modification non autorisée." });
        }
        db.run("UPDATE Utilisateurs SET mot_de_passe = ? WHERE role = ?", [nouveau_mot_de_passe, role_a_modifier], function(err) {
            if (err) return res.status(500).json({ erreur: err.message });
            res.json({ message: "Mot de passe mis à jour !" });
        });
    } catch (error) {
        res.status(500).json({ erreur: "Erreur interne: " + error.message });
    }
});

app.put('/api/admin-password', (req, res) => {
    try {
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
    } catch (error) {
        res.status(500).json({ erreur: "Erreur interne: " + error.message });
    }
});

// --- 3. GESTION DES DOSSIERS PATIENTS ---
app.get('/api/patients', (req, res) => {
    try {
        db.all("SELECT * FROM Patients ORDER BY id DESC", [], (err, lignes) => {
            if (err) return res.status(500).json({ erreur: err.message });
            res.json(lignes);
        });
    } catch (error) {
        res.status(500).json({ erreur: "Erreur interne: " + error.message });
    }
});

app.post('/api/patients', (req, res) => {
    try {
        const { nom_complet, date_entree, date_naissance, sexe, telephone, adresse, consultation_statut, besoin_controle, parametres, notes } = req.body; 
        
        if (!nom_complet || !nom_complet.trim() || !telephone || !telephone.trim()) {
            return res.status(400).json({ erreur: "Le nom complet et le numéro de téléphone sont obligatoires." });
        }

        db.get(
            "SELECT * FROM Patients WHERE telephone = ? OR (nom_complet = ? AND date_naissance = ?)", 
            [telephone.trim(), nom_complet.trim(), date_naissance], 
            (err, patientExiste) => {
                try {
                    if (err) return res.status(500).json({ erreur: err.message });
                    
                    if (patientExiste) {
                        if (patientExiste.telephone === telephone.trim()) {
                            return res.status(400).json({ erreur: `Le numéro de téléphone (${telephone}) appartient déjà au patient : ${patientExiste.nom_complet}.` });
                        }
                        if (date_naissance && patientExiste.nom_complet === nom_complet.trim() && patientExiste.date_naissance === date_naissance) {
                            return res.status(400).json({ erreur: `Un dossier existe déjà pour ${nom_complet} né(e) le ${date_naissance.split('-').reverse().join('/')}.` });
                        }
                    }

                    let dateFormatee = "00000000";
                    if (date_entree && date_entree.includes('-')) {
                        const parties = date_entree.split('-');
                        if (parties.length === 3) {
                            dateFormatee = `${parties[2]}${parties[1]}${parties[0]}`;
                        }
                    }

                    db.get("SELECT COUNT(*) as nombre FROM Patients WHERE date_entree = ?", [date_entree], (err, resultat) => {
                        try {
                            if (err) return res.status(500).json({ erreur: err.message });
                            const count = (resultat && resultat.nombre) ? resultat.nombre : 0;
                            const numero = (count + 1).toString().padStart(3, '0');
                            const code_patient = `${dateFormatee}${numero}`;

                            const requete = `INSERT INTO Patients (code_patient, nom_complet, date_entree, date_naissance, sexe, telephone, adresse, consultation_statut, besoin_controle, parametres, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                            db.run(requete, [code_patient, nom_complet.trim(), date_entree, date_naissance, sexe, telephone.trim(), adresse, consultation_statut || 'Non payé', besoin_controle || 'Non', parametres, notes], function(err) {
                                try {
                                    if (err) return res.status(400).json({ erreur: err.message });
                                    res.json({ id: this.lastID, message: "Dossier patient créé avec succès !" });
                                } catch (innerErr) {
                                    res.status(500).json({ erreur: "Erreur de réponse: " + innerErr.message });
                                }
                            });
                        } catch (innerErr) {
                            res.status(500).json({ erreur: "Erreur de calcul du code: " + innerErr.message });
                        }
                    });
                } catch (innerErr) {
                    res.status(500).json({ erreur: "Erreur de doublon: " + innerErr.message });
                }
            }
        );
    } catch (error) {
        res.status(500).json({ erreur: "Erreur globale: " + error.message });
    }
});

app.put('/api/patients/:id', (req, res) => {
    try {
        const idPatient = req.params.id;
        const { nom_complet, date_entree, date_naissance, sexe, telephone, adresse, consultation_statut, besoin_controle, parametres, notes } = req.body; 
        
        if (!nom_complet || !nom_complet.trim() || !telephone || !telephone.trim()) {
            return res.status(400).json({ erreur: "Le nom complet et le numéro de téléphone sont obligatoires." });
        }

        db.get(
            "SELECT * FROM Patients WHERE (telephone = ? OR (nom_complet = ? AND date_naissance = ?)) AND id != ?", 
            [telephone.trim(), nom_complet.trim(), date_naissance, idPatient], 
            (err, patientExiste) => {
                try {
                    if (err) return res.status(500).json({ erreur: err.message });

                    if (patientExiste) {
                        if (patientExiste.telephone === telephone.trim()) {
                            return res.status(400).json({ erreur: `Ce numéro de téléphone (${telephone}) est déjà enregistré sur la fiche de : ${patientExiste.nom_complet}.` });
                        }
                        if (date_naissance && patientExiste.nom_complet === nom_complet.trim() && patientExiste.date_naissance === date_naissance) {
                            return res.status(400).json({ erreur: `Un autre dossier identique existe déjà pour ${nom_complet} né(e) le ${date_naissance.split('-').reverse().join('/')}.` });
                        }
                    }

                    const requete = `UPDATE Patients SET nom_complet = ?, date_entree = ?, date_naissance = ?, sexe = ?, telephone = ?, adresse = ?, consultation_statut = ?, besoin_controle = ?, parametres = ?, notes = ? WHERE id = ?`;
                    db.run(requete, [nom_complet.trim(), date_entree, date_naissance, sexe, telephone.trim(), adresse, consultation_statut, besoin_controle, parametres, notes, idPatient], function(err) {
                        try {
                            if (err) return res.status(500).json({ erreur: err.message });
                            res.json({ message: "Dossier patient mis à jour avec succès !" });
                        } catch(e) { res.status(500).json({ erreur: e.message }); }
                    });
                } catch(e) { res.status(500).json({ erreur: e.message }); }
            }
        );
    } catch (error) {
        res.status(500).json({ erreur: "Erreur interne: " + error.message });
    }
});

app.delete('/api/patients/:id', (req, res) => {
    try {
        const idPatient = req.params.id;
        db.run("DELETE FROM Patients WHERE id = ?", [idPatient], function(err) {
            if (err) return res.status(500).json({ erreur: err.message });
            res.json({ message: "Dossier patient supprimé !" });
        });
    } catch (error) {
        res.status(500).json({ erreur: "Erreur interne: " + error.message });
    }
});

// --- 4. GESTION DE L'INVENTAIRE ---
app.get('/api/inventaire', (req, res) => {
    try {
        db.all("SELECT * FROM Inventaire ORDER BY nom_medicament ASC", [], (err, lignes) => {
            if (err) return res.status(500).json({ erreur: err.message });
            res.json(lignes);
        });
    } catch (error) {
        res.status(500).json({ erreur: "Erreur interne: " + error.message });
    }
});

app.post('/api/inventaire', (req, res) => {
    try {
        const { nom_medicament, quantite, description } = req.body;
        const requete = `INSERT INTO Inventaire (nom_medicament, quantite, description) VALUES (?, ?, ?)`;
        db.run(requete, [nom_medicament, quantite, description], function(err) {
            if (err) return res.status(400).json({ erreur: err.message });
            res.json({ id: this.lastID, message: "Médicament ajouté !" });
        });
    } catch (error) {
        res.status(500).json({ erreur: "Erreur interne: " + error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur en ligne sur le port ${PORT}`);
});