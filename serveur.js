// =========================================================================
// FICHIER : serveur.js
// Rôle : Backend Node.js, Base SQLite3 & Module Inventaire Pharmacie TPFV
// =========================================================================
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('clinique.db');

// --- 1. INITIALISATION DES TABLES ET COMPTES UTILISATEURS ---
db.run(`CREATE TABLE IF NOT EXISTS Utilisateurs (
    role TEXT PRIMARY KEY,
    mot_de_passe TEXT NOT NULL
)`, () => {
    db.run("INSERT OR IGNORE INTO Utilisateurs (role, mot_de_passe) VALUES ('agent', 'agent123')");
    db.run("INSERT OR IGNORE INTO Utilisateurs (role, mot_de_passe) VALUES ('support', 'sup123')");
    db.run("INSERT OR IGNORE INTO Utilisateurs (role, mot_de_passe) VALUES ('admin', 'secret123')");
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

// TABLE INVENTAIRE ENRICHIE AVEC LA LOGIQUE DE VOTRE FICHIER EXCEL
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
        
        // Pré-remplissage avec des médicaments réels extraits du fichier Excel
        db.get("SELECT COUNT(*) as count FROM Inventaire", (err, row) => {
            if (row && row.count === 0) {
                const produitsExcel = [
                    { nom_medicament: "10cc", date_peremption: "2030-11-01", stock_initial: 1, entrees: 188, sorties: 181, quantite: 8, prix_unitaire: 400, seuil_alerte: 10, description: "Seringue 10cc" },
                    { nom_medicament: "20cc", date_peremption: "2028-02-01", stock_initial: 3, entrees: 0, sorties: 0, quantite: 3, prix_unitaire: 700, seuil_alerte: 5, description: "Seringue 20cc" },
                    { nom_medicament: "2cc", date_peremption: "2029-12-01", stock_initial: 5, entrees: 5, sorties: 6, quantite: 4, prix_unitaire: 300, seuil_alerte: 5, description: "Seringue 2cc" },
                    { nom_medicament: "5cc", date_peremption: "2026-03-01", stock_initial: 2, entrees: 0, sorties: 2, quantite: 0, prix_unitaire: 300, seuil_alerte: 5, description: "Seringue 5cc" },
                    { nom_medicament: "60cc", date_peremption: "2028-02-01", stock_initial: 0, entrees: 0, sorties: 0, quantite: 0, prix_unitaire: 1000, seuil_alerte: 2, description: "Seringue gavage 60cc" },
                    { nom_medicament: "acarbose 50mg", date_peremption: "2027-05-01", stock_initial: 6, entrees: 0, sorties: 0, quantite: 6, prix_unitaire: 3200, seuil_alerte: 5, description: "Comprimé oral" },
                    { nom_medicament: "acide aminé inj", date_peremption: "2028-04-01", stock_initial: 1, entrees: 0, sorties: 1, quantite: 0, prix_unitaire: 10300, seuil_alerte: 2, description: "Solution injectable" },
                    { nom_medicament: "acupan inj", date_peremption: "2027-12-01", stock_initial: 2, entrees: 0, sorties: 0, quantite: 2, prix_unitaire: 5000, seuil_alerte: 5, description: "Néfopam injectable" },
                    { nom_medicament: "adrenaline inj", date_peremption: "2026-05-01", stock_initial: 3, entrees: 0, sorties: 0, quantite: 3, prix_unitaire: 4900, seuil_alerte: 3, description: "Ampoule 1mg/ml" },
                    { nom_medicament: "aiguille rose", date_peremption: "2028-04-01", stock_initial: 5, entrees: 0, sorties: 1, quantite: 4, prix_unitaire: 200, seuil_alerte: 10, description: "Aiguille de prélèvement 18G" },
                    { nom_medicament: "alben cpr", date_peremption: "2028-08-01", stock_initial: 10, entrees: 60, sorties: 59, quantite: 11, prix_unitaire: 800, seuil_alerte: 10, description: "Albendazole 400mg" },
                    { nom_medicament: "alben sp", date_peremption: "2028-09-01", stock_initial: 2, entrees: 11, sorties: 11, quantite: 2, prix_unitaire: 2600, seuil_alerte: 5, description: "Albendazole sirop" },
                    { nom_medicament: "AMADAY 10 /cpr", date_peremption: "2027-10-01", stock_initial: 16, entrees: 0, sorties: 0, quantite: 16, prix_unitaire: 2500, seuil_alerte: 5, description: "Amlodipine 10mg" },
                    { nom_medicament: "amlopres 10", date_peremption: "2028-08-01", stock_initial: 0, entrees: 15, sorties: 12, quantite: 3, prix_unitaire: 2600, seuil_alerte: 5, description: "Amlodipine 10mg" },
                    { nom_medicament: "amlopres 5", date_peremption: "2028-08-01", stock_initial: 1, entrees: 7, sorties: 5, quantite: 3, prix_unitaire: 2000, seuil_alerte: 5, description: "Amlodipine 5mg" }
                ];
                const stmt = db.prepare(`INSERT INTO Inventaire 
                    (nom_medicament, date_peremption, stock_initial, entrees, sorties, quantite, prix_unitaire, seuil_alerte, description) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                produitsExcel.forEach(p => {
                    stmt.run(p.nom_medicament, p.date_peremption, p.stock_initial, p.entrees, p.sorties, p.quantite, p.prix_unitaire, p.seuil_alerte, p.description);
                });
                stmt.finalize();
            }
        });
    });
});

// --- 2. AUTHENTIFICATION & SÉCURITÉ ---
app.post('/api/login', (req, res) => {
    try {
        const { role, mot_de_passe } = req.body;
        db.get("SELECT * FROM Utilisateurs WHERE role = ? AND mot_de_passe = ?", [role, mot_de_passe], (err, utilisateur) => {
            if (err) return res.status(500).json({ erreur: err.message });
            if (utilisateur) res.json({ message: "Connexion réussie !" });
            else res.status(401).json({ erreur: "Mot de passe incorrect." });
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
    const { 
        nom_complet, date_entree, date_naissance, sexe, telephone, adresse,
        contact_urgence, allergies, maladies_chroniques, chirurgies, traitements_en_cours,
        motif_visite, diagnostic, prochain_rdv, consultation_statut, besoin_controle, parametres, notes 
    } = req.body; 

    if (!nom_complet || !telephone) return res.status(400).json({ erreur: "Champs obligatoires manquants." });

    let dateFormatee = "00000000";
    if (date_entree && date_entree.includes('-')) {
        const parties = date_entree.split('-');
        if (parties.length === 3) dateFormatee = `${parties[2]}${parties[1]}${parties[0]}`;
    }

    db.get("SELECT COUNT(*) as nombre FROM Patients WHERE date_entree = ?", [date_entree], (err, resultat) => {
        const count = (resultat && resultat.nombre) ? resultat.nombre : 0;
        const numero = (count + 1).toString().padStart(3, '0');
        const code_patient = `${dateFormatee}${numero}`;

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
            res.json({ id: this.lastID, message: "Dossier créé !" });
        });
    });
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

// --- 4. ROUTES COMPLÈTES DE L'INVENTAIRE (CRUD + MOUVEMENTS + CALCULS) ---
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

    const requete = `INSERT INTO Inventaire 
        (nom_medicament, date_peremption, stock_initial, entrees, sorties, quantite, prix_unitaire, seuil_alerte, description) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(requete, [
        nom_medicament.trim(), 
        date_peremption || '', 
        s_init, 
        ent, 
        sor, 
        reste, 
        parseFloat(prix_unitaire) || 0, 
        parseInt(seuil_alerte, 10) || 5, 
        description || ''
    ], function(err) {
        if (err) return res.status(400).json({ erreur: err.message });
        res.json({ id: this.lastID, message: "Produit créé avec succès !" });
    });
});

app.put('/api/inventaire/:id', (req, res) => {
    const idProduit = req.params.id;
    const { nom_medicament, date_peremption, stock_initial, entrees, sorties, prix_unitaire, seuil_alerte, description } = req.body;
    const s_init = parseInt(stock_initial, 10) || 0;
    const ent = parseInt(entrees, 10) || 0;
    const sor = parseInt(sorties, 10) || 0;
    const reste = Math.max(0, s_init + ent - sor);

    const requete = `UPDATE Inventaire SET 
        nom_medicament = ?, date_peremption = ?, stock_initial = ?, entrees = ?, sorties = ?, quantite = ?, 
        prix_unitaire = ?, seuil_alerte = ?, description = ? WHERE id = ?`;

    db.run(requete, [
        nom_medicament.trim(), 
        date_peremption || '', 
        s_init, 
        ent, 
        sor, 
        reste, 
        parseFloat(prix_unitaire) || 0, 
        parseInt(seuil_alerte, 10) || 5, 
        description || '', 
        idProduit
    ], function(err) {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json({ message: "Produit mis à jour avec succès !" });
    });
});

// Enregistrement rapide d'un mouvement de stock (+ Entrée ou - Sortie)
app.put('/api/inventaire/:id/mouvement', (req, res) => {
    const idProduit = req.params.id;
    const { type, quantite_mouvement } = req.body;
    const qte = parseInt(quantite_mouvement, 10) || 0;

    if (qte <= 0) return res.status(400).json({ erreur: "La quantité doit être supérieure à 0." });

    db.get("SELECT * FROM Inventaire WHERE id = ?", [idProduit], (err, prod) => {
        if (err || !prod) return res.status(404).json({ erreur: "Produit non trouvé." });

        let nouveauxEntrees = prod.entrees || 0;
        let nouvellesSorties = prod.sorties || 0;

        if (type === 'entrée') nouveauxEntrees += qte;
        else if (type === 'sortie') nouvellesSorties += qte;

        const reste = Math.max(0, (prod.stock_initial || 0) + nouveauxEntrees - nouvellesSorties);

        db.run("UPDATE Inventaire SET entrees = ?, sorties = ?, quantite = ? WHERE id = ?", 
            [nouveauxEntrees, nouvellesSorties, reste, idProduit], function(err) {
                if (err) return res.status(500).json({ erreur: err.message });
                res.json({ message: `Mouvement de stock enregistré (${type} de ${qte}) !`, quantite: reste });
            });
    });
});

app.delete('/api/inventaire/:id', (req, res) => {
    db.run("DELETE FROM Inventaire WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json({ message: "Produit supprimé de l'inventaire !" });
    });
});

app.listen(PORT, '0.0.0.0', () => { console.log(`Serveur TPFV prêt sur http://localhost:${PORT}`); });