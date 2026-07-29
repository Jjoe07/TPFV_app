// =========================================================================
// FICHIER : serveur.js
// Rôle : Backend Node.js, SQLite3, Patients, Inventaire & Sécurité TPFV
// =========================================================================
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('clinique.db');

// --- 1. INITIALISATION DES TABLES DE LA BASE DE DONNÉES ---
db.run(`CREATE TABLE IF NOT EXISTS Utilisateurs (
    role TEXT PRIMARY KEY,
    mot_de_passe TEXT NOT NULL
)`, () => {
    db.run("INSERT INTO Utilisateurs (role, mot_de_passe) VALUES ('agent', 'agent123') ON CONFLICT(role) DO UPDATE SET mot_de_passe = 'agent123'");
    db.run("INSERT INTO Utilisateurs (role, mot_de_passe) VALUES ('support', 'sup123') ON CONFLICT(role) DO UPDATE SET mot_de_passe = 'sup123'");
    db.run("INSERT INTO Utilisateurs (role, mot_de_passe) VALUES ('admin', 'secret123') ON CONFLICT(role) DO UPDATE SET mot_de_passe = 'secret123'");
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
    parametres TEXT,
    notes TEXT
)`, () => {
    db.serialize(() => {
        db.run("ALTER TABLE Patients ADD COLUMN contact_urgence TEXT", () => {});
        db.run("ALTER TABLE Patients ADD COLUMN allergies TEXT", () => {});
        db.run("ALTER TABLE Patients ADD COLUMN maladies_chroniques TEXT", () => {});
        db.run("ALTER TABLE Patients ADD COLUMN chirurgies TEXT", () => {});
        db.run("ALTER TABLE Patients ADD COLUMN traitements_en_cours TEXT", () => {});
        db.run("ALTER TABLE Patients ADD COLUMN motif_visite TEXT", () => {});
        db.run("ALTER TABLE Patients ADD COLUMN diagnostic TEXT", () => {});
        db.run("ALTER TABLE Patients ADD COLUMN prochain_rdv TEXT", () => {});
    });
});

db.run(`CREATE TABLE IF NOT EXISTS Inventaire (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_medicament TEXT NOT NULL,
    date_peremption TEXT,
    stock_initial INTEGER DEFAULT 0,
    entrees INTEGER DEFAULT 0,
    sorties INTEGER DEFAULT 0,
    quantite INTEGER DEFAULT 0,
    prix_unitaire REAL DEFAULT 0,
    seuil_alerte INTEGER DEFAULT 5,
    description TEXT
)`, () => {
    db.serialize(() => {
        db.run("ALTER TABLE Inventaire ADD COLUMN date_peremption TEXT", () => {});
        db.run("ALTER TABLE Inventaire ADD COLUMN stock_initial INTEGER DEFAULT 0", () => {});
        db.run("ALTER TABLE Inventaire ADD COLUMN entrees INTEGER DEFAULT 0", () => {});
        db.run("ALTER TABLE Inventaire ADD COLUMN sorties INTEGER DEFAULT 0", () => {});
        db.run("ALTER TABLE Inventaire ADD COLUMN prix_unitaire REAL DEFAULT 0", () => {});
        db.run("ALTER TABLE Inventaire ADD COLUMN seuil_alerte INTEGER DEFAULT 5", () => {});
        
        db.get("SELECT COUNT(*) as count FROM Inventaire", (err, row) => {
            if (row && row.count === 0) {
                const jsonPath = path.join(__dirname, 'produits_excel.json');
                if (fs.existsSync(jsonPath)) {
                    try {
                        const produitsExcel = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                        const stmt = db.prepare(`INSERT INTO Inventaire 
                            (nom_medicament, date_peremption, stock_initial, entrees, sorties, quantite, prix_unitaire, seuil_alerte, description) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                        
                        db.serialize(() => {
                            produitsExcel.forEach(p => {
                                stmt.run(
                                    p.nom_medicament, p.date_peremption || '', p.stock_initial || 0,
                                    p.entrees || 0, p.sorties || 0, p.quantite || 0, p.prix_unitaire || 0,
                                    p.seuil_alerte || 5, p.description || 'Pharmacie TPFV'
                                );
                            });
                            stmt.finalize();
                        });
                    } catch (e) {}
                }
            }
        });
    });
});

// --- 2. AUTHENTIFICATION ---
app.post('/api/login', (req, res) => {
    try {
        const { role, mot_de_passe } = req.body;
        const roleClean = (role || '').trim().toLowerCase();
        const mdpClean = (mot_de_passe || '').trim();

        db.get("SELECT * FROM Utilisateurs WHERE role = ?", [roleClean], (err, utilisateur) => {
            if (err) return res.status(500).json({ erreur: "Erreur BDD : " + err.message });
            if (!utilisateur) return res.status(401).json({ erreur: "Rôle introuvable." });

            if (utilisateur.mot_de_passe === mdpClean) {
                res.json({ message: "Connexion réussie !" });
            } else {
                res.status(401).json({ erreur: "Mot de passe incorrect." });
            }
        });
    } catch (error) { res.status(500).json({ erreur: error.message }); }
});

const modifierMotDePasseEquipe = (req, res) => {
    try {
        const { role_a_modifier, nouveau_mot_de_passe } = req.body;
        if (!nouveau_mot_de_passe || !nouveau_mot_de_passe.trim()) {
            return res.status(400).json({ erreur: "Veuillez entrer un mot de passe valide." });
        }
        const roleTarget = (role_a_modifier || '').trim().toLowerCase();
        if (roleTarget !== 'agent' && roleTarget !== 'support') {
            return res.status(400).json({ erreur: "Rôle invalide." });
        }

        const requeteSQL = `
            INSERT INTO Utilisateurs (role, mot_de_passe) 
            VALUES (?, ?) 
            ON CONFLICT(role) DO UPDATE SET mot_de_passe = excluded.mot_de_passe`;

        db.run(requeteSQL, [roleTarget, nouveau_mot_de_passe.trim()], function(err) {
            if (err) return res.status(500).json({ erreur: "Erreur BDD : " + err.message });
            res.json({ message: `Le mot de passe de ${roleTarget.toUpperCase()} a été modifié !` });
        });
    } catch (error) { res.status(500).json({ erreur: "Erreur serveur : " + error.message }); }
};

app.put('/api/reset-password', modifierMotDePasseEquipe);
app.post('/api/reset-password', modifierMotDePasseEquipe);

const modifierMotDePasseAdmin = (req, res) => {
    try {
        const { ancien_mot_de_passe, nouveau_mot_de_passe } = req.body;
        if (!nouveau_mot_de_passe || !nouveau_mot_de_passe.trim()) {
            return res.status(400).json({ erreur: "Veuillez saisir un mot de passe valide." });
        }
        db.get("SELECT * FROM Utilisateurs WHERE role = 'admin' AND mot_de_passe = ?", [ancien_mot_de_passe], (err, utilisateur) => {
            if (err) return res.status(500).json({ erreur: err.message });
            if (utilisateur) {
                db.run("UPDATE Utilisateurs SET mot_de_passe = ? WHERE role = 'admin'", [nouveau_mot_de_passe.trim()], function(err) {
                    if (err) return res.status(500).json({ erreur: err.message });
                    res.json({ message: "Mot de passe Administrateur mis à jour !" });
                });
            } else {
                res.status(401).json({ erreur: "L'ancien mot de passe Administrateur est incorrect." });
            }
        });
    } catch (error) { res.status(500).json({ erreur: "Erreur serveur : " + error.message }); }
};

app.put('/api/admin-password', modifierMotDePasseAdmin);
app.post('/api/admin-password', modifierMotDePasseAdmin);

// --- 3. ROUTES DES PATIENTS ---
app.get('/api/patients', (req, res) => {
    db.all("SELECT * FROM Patients ORDER BY nom_complet ASC", [], (err, lignes) => {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json(lignes);
    });
});

app.post('/api/patients', (req, res) => {
    try {
        const { 
            nom_complet, date_entree, date_naissance, sexe, telephone, adresse,
            contact_urgence, allergies, maladies_chroniques, chirurgies, traitements_en_cours,
            motif_visite, diagnostic, prochain_rdv, consultation_statut, besoin_controle, parametres, notes 
        } = req.body; 

        if (!nom_complet || !nom_complet.trim() || !telephone || !telephone.trim()) {
            return res.status(400).json({ erreur: "Le nom complet et le numéro de téléphone sont obligatoires." });
        }

        db.get(
            "SELECT * FROM Patients WHERE telephone = ? OR (nom_complet = ? AND date_naissance = ?)", 
            [telephone.trim(), nom_complet.trim(), date_naissance], 
            (err, patientExiste) => {
                if (err) return res.status(500).json({ erreur: err.message });
                if (patientExiste) {
                    if (patientExiste.telephone === telephone.trim()) {
                        return res.status(400).json({ erreur: `Le téléphone (${telephone}) appartient déjà à ${patientExiste.nom_complet}.` });
                    }
                    if (date_naissance && patientExiste.nom_complet === nom_complet.trim()) {
                        return res.status(400).json({ erreur: `Un dossier existe déjà pour ${nom_complet}.` });
                    }
                }

                let dateFormatee = "00000000";
                if (date_entree && date_entree.includes('-')) {
                    const parties = date_entree.split('-');
                    if (parties.length === 3) dateFormatee = `${parties[2]}${parties[1]}${parties[0]}`;
                }

                const prefixe = `${dateFormatee}%`;
                db.get("SELECT code_patient FROM Patients WHERE code_patient LIKE ? ORDER BY code_patient DESC LIMIT 1", [prefixe], (err, dernierPatient) => {
                    let dernierNumero = 0;
                    if (dernierPatient && dernierPatient.code_patient) {
                        const suffixe = dernierPatient.code_patient.slice(-3);
                        const numParsed = parseInt(suffixe, 10);
                        if (!isNaN(numParsed)) dernierNumero = numParsed;
                    }

                    const nouveauNumero = (dernierNumero + 1).toString().padStart(3, '0');
                    const code_patient = `${dateFormatee}${nouveauNumero}`;

                    const requete = `INSERT INTO Patients (
                        code_patient, nom_complet, date_entree, date_naissance, sexe, telephone, adresse,
                        contact_urgence, allergies, maladies_chroniques, chirurgies, traitements_en_cours,
                        motif_visite, diagnostic, prochain_rdv, consultation_statut, besoin_controle, parametres, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

                    db.run(requete, [
                        code_patient, nom_complet.trim(), date_entree, date_naissance, sexe, telephone.trim(), adresse,
                        contact_urgence, allergies, maladies_chroniques, chirurgies, traitements_en_cours,
                        motif_visite, diagnostic, prochain_rdv, consultation_statut || 'Non payé', besoin_controle || 'Non', parametres, notes
                    ], function(err) {
                        if (err) return res.status(400).json({ erreur: err.message });
                        res.json({ id: this.lastID, message: "Dossier médical créé avec succès !" });
                    });
                });
            }
        );
    } catch (error) { res.status(500).json({ erreur: error.message }); }
});

app.put('/api/patients/:id', (req, res) => {
    const idPatient = req.params.id;
    const { 
        nom_complet, date_entree, date_naissance, sexe, telephone, adresse,
        contact_urgence, allergies, maladies_chroniques, chirurgies, traitements_en_cours,
        motif_visite, diagnostic, prochain_rdv, consultation_statut, besoin_controle, parametres, notes 
    } = req.body; 

    const requete = `UPDATE Patients SET 
        nom_complet = ?, date_entree = ?, date_naissance = ?, sexe = ?, telephone = ?, adresse = ?,
        contact_urgence = ?, allergies = ?, maladies_chroniques = ?, chirurgies = ?, traitements_en_cours = ?,
        motif_visite = ?, diagnostic = ?, prochain_rdv = ?, consultation_statut = ?, besoin_controle = ?,
        parametres = ?, notes = ? WHERE id = ?`;

    db.run(requete, [
        nom_complet.trim(), date_entree, date_naissance, sexe, telephone.trim(), adresse,
        contact_urgence, allergies, maladies_chroniques, chirurgies, traitements_en_cours,
        motif_visite, diagnostic, prochain_rdv, consultation_statut, besoin_controle, parametres, notes, idPatient
    ], function(err) {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json({ message: "Dossier mis à jour !" });
    });
});

app.delete('/api/patients/:id', (req, res) => {
    db.run("DELETE FROM Patients WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json({ message: "Dossier supprimé !" });
    });
});

// IMPORTATION GROUPÉE DE PATIENTS
app.post('/api/patients/import', (req, res) => {
    try {
        const patientsImportes = req.body;
        if (!Array.isArray(patientsImportes) || patientsImportes.length === 0) {
            return res.status(400).json({ erreur: "Le fichier ne contient aucun dossier valide." });
        }

        let nbAjoutes = 0;
        let nbIgnores = 0;

        db.serialize(() => {
            const stmt = db.prepare(`INSERT OR IGNORE INTO Patients (
                code_patient, nom_complet, date_entree, date_naissance, sexe, telephone, adresse,
                contact_urgence, allergies, maladies_chroniques, chirurgies, traitements_en_cours,
                motif_visite, diagnostic, prochain_rdv, consultation_statut, besoin_controle, parametres, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            patientsImportes.forEach((p, idx) => {
                const nom = p.nom_complet || p['Nom et Prénom'] || p['Nom'] || p['nom_complet'];
                const tel = p.telephone || p['Téléphone'] || p['telephone'] || `0000${idx}`;

                if (nom && String(nom).trim()) {
                    const dateToday = new Date().toISOString().slice(0, 10);
                    const dateEntree = p.date_entree || p["Date d'entrée"] || dateToday;
                    const code = p.code_patient || p['Code Patient'] || (`IMP${Date.now()}${idx}`);

                    stmt.run([
                        String(code).trim(), String(nom).trim(), String(dateEntree).trim(),
                        String(p.date_naissance || p['Date de naissance'] || '').trim(),
                        String(p.sexe || p['Sexe'] || 'Masculin').trim(), String(tel).trim(),
                        String(p.adresse || p['Adresse'] || '').trim(), String(p.contact_urgence || p['Contact Urgence'] || '').trim(),
                        String(p.allergies || p['Allergies'] || '').trim(), String(p.maladies_chroniques || p['Maladies chroniques'] || '').trim(),
                        String(p.chirurgies || p['Chirurgies'] || '').trim(), String(p.traitements_en_cours || p['Traitements en cours'] || '').trim(),
                        String(p.motif_visite || p['Motif de la visite'] || '').trim(), String(p.diagnostic || p['Diagnostic'] || '').trim(),
                        String(p.prochain_rdv || p['Prochain RDV'] || '').trim(), String(p.consultation_statut || p['Statut Consultation'] || 'Non payé').trim(),
                        String(p.besoin_controle || p['Contrôle Requis'] || 'Non').trim(), String(p.parametres || ''), String(p.notes || p['Notes'] || '').trim()
                    ], function(err) {
                        if (!err && this.changes > 0) nbAjoutes++;
                        else nbIgnores++;
                    });
                } else { nbIgnores++; }
            });

            stmt.finalize((err) => {
                if (err) return res.status(500).json({ erreur: err.message });
                res.json({ message: `Importation terminée ! ${nbAjoutes} dossier(s) ajouté(s), ${nbIgnores} ignoré(s).` });
            });
        });
    } catch (error) { res.status(500).json({ erreur: "Erreur serveur : " + error.message }); }
});

// --- 4. ROUTES INVENTAIRE ---
app.get('/api/inventaire', (req, res) => {
    db.all("SELECT * FROM Inventaire ORDER BY nom_medicament ASC", [], (err, lignes) => {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json(lignes);
    });
});

app.post('/api/inventaire', (req, res) => {
    const { nom_medicament, date_peremption, stock_initial, entrees, sorties, prix_unitaire, seuil_alerte, description } = req.body;
    const s_init = parseInt(stock_initial, 10) || 0;
    const ent = parseInt(entrees, 10) || 0;
    const sor = parseInt(sorties, 10) || 0;
    const reste = Math.max(0, s_init + ent - sor);

    const requete = `INSERT INTO Inventaire (nom_medicament, date_peremption, stock_initial, entrees, sorties, quantite, prix_unitaire, seuil_alerte, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(requete, [nom_medicament.trim(), date_peremption || '', s_init, ent, sor, reste, parseFloat(prix_unitaire) || 0, parseInt(seuil_alerte, 10) || 5, description || ''], function(err) {
        if (err) return res.status(400).json({ erreur: err.message });
        res.json({ id: this.lastID, message: "Produit créé !" });
    });
});

app.put('/api/inventaire/:id', (req, res) => {
    const idProduit = req.params.id;
    const { nom_medicament, date_peremption, stock_initial, entrees, sorties, prix_unitaire, seuil_alerte, description } = req.body;
    const s_init = parseInt(stock_initial, 10) || 0;
    const ent = parseInt(entrees, 10) || 0;
    const sor = parseInt(sorties, 10) || 0;
    const reste = Math.max(0, s_init + ent - sor);

    const requete = `UPDATE Inventaire SET nom_medicament = ?, date_peremption = ?, stock_initial = ?, entrees = ?, sorties = ?, quantite = ?, prix_unitaire = ?, seuil_alerte = ?, description = ? WHERE id = ?`;
    db.run(requete, [nom_medicament.trim(), date_peremption || '', s_init, ent, sor, reste, parseFloat(prix_unitaire) || 0, parseInt(seuil_alerte, 10) || 5, description || '', idProduit], function(err) {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json({ message: "Produit mis à jour !" });
    });
});

app.put('/api/inventaire/:id/mouvement', (req, res) => {
    const idProduit = req.params.id;
    const { type, quantite_mouvement } = req.body;
    const qte = parseInt(quantite_mouvement, 10) || 0;

    if (qte <= 0) return res.status(400).json({ erreur: "Quantité invalide." });

    db.get("SELECT * FROM Inventaire WHERE id = ?", [idProduit], (err, prod) => {
        if (err || !prod) return res.status(404).json({ erreur: "Produit non trouvé." });

        let nouveauxEntrees = prod.entrees || 0;
        let nouvellesSorties = prod.sorties || 0;

        if (type === 'entrée') nouveauxEntrees += qte;
        else if (type === 'sortie') nouvellesSorties += qte;

        const reste = Math.max(0, (prod.stock_initial || 0) + nouveauxEntrees - nouvellesSorties);

        db.run("UPDATE Inventaire SET entrees = ?, sorties = ?, quantite = ? WHERE id = ?", [nouveauxEntrees, nouvellesSorties, reste, idProduit], function(err) {
            if (err) return res.status(500).json({ erreur: err.message });
            res.json({ message: `Mouvement enregistré (${type} de ${qte}) !`, quantite: reste });
        });
    });
});

app.delete('/api/inventaire/:id', (req, res) => {
    db.run("DELETE FROM Inventaire WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json({ message: "Produit supprimé !" });
    });
});

app.listen(PORT, '0.0.0.0', () => { 
    console.log(`🚀 Serveur TPFV prêt sur http://localhost:${PORT}`); 
});