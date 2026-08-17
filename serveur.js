// =========================================================================
// FICHIER : serveur.js (Matricule unique et persistant en BDD)
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

const PERSONNEL_OFFICIEL_2026 = [
  { nom_complet: "RAZAFINDRAKOTO TIANA FANANTENANA", poste: "MEDECIN CHEF", date_embauche: "2021-10-02", salaire_brut: 1000000, salaire_net: 1000000 },
  { nom_complet: "RAZAFINDRAMBOA NIASY", poste: "MEDECIN", date_embauche: "2021-10-02", salaire_brut: 1000000, salaire_net: 987000 },
  { nom_complet: "RAZANADRASOA JULIENNE", poste: "STAFF", date_embauche: "", salaire_brut: 200000, salaire_net: 200000 },
  { nom_complet: "RAVELONANAHARY SAHOLINIRINA LILI", poste: "ACCEUIL-PCIE", date_embauche: "2021-10-02", salaire_brut: 625000, salaire_net: 615750 },
  { nom_complet: "MANDOVA RAZAFIMANDIMBY MARC NORBERT", poste: "PARAMED", date_embauche: "2021-10-02", salaire_brut: 450000, salaire_net: 442500 },
  { nom_complet: "RASOLONIRINA CELINE", poste: "FEMME DE MENAGE", date_embauche: "2021-10-02", salaire_brut: 310000, salaire_net: 303900 },
  { nom_complet: "RAZANAJATOVO VANESSA VALERIE", poste: "COMPTABLE", date_embauche: "2022-03-01", salaire_brut: 350000, salaire_net: 343500 },
  { nom_complet: "RAZANADRASOA VIVIANE HORTENSIA", poste: "ACCEUIL-PCIE", date_embauche: "2021-10-02", salaire_brut: 350000, salaire_net: 343500 },
  { nom_complet: "RANDRIATAHIANA HASINIAINA FANOMEZANTSOA", poste: "SECURITE", date_embauche: "2021-10-02", salaire_brut: 300000, salaire_net: 294000 },
  { nom_complet: "ZARANIRINA FITIAVANA", poste: "PARAMED", date_embauche: "2021-10-02", salaire_brut: 400000, salaire_net: 393000 },
  { nom_complet: "ONIARISOA HAJANIAINA NICOLAS", poste: "SECURITE", date_embauche: "2021-10-02", salaire_brut: 300000, salaire_net: 294000 },
  { nom_complet: "ZON'NY AINA MANANTSOA", poste: "GESTIONNAIRE", date_embauche: "2022-05-01", salaire_brut: 1000000, salaire_net: 987000 },
  { nom_complet: "RAZANARIVELO HARINAVALONA TOLOJANAHARY", poste: "ACCEUIL-PCIE", date_embauche: "2022-05-01", salaire_brut: 300000, salaire_net: 294000 },
  { nom_complet: "ANJARASOA SAROBIDY", poste: "PARAMED", date_embauche: "2023-01-16", salaire_brut: 350000, salaire_net: 343500 },
  { nom_complet: "NJOARILAHATRA HARIMALALA MAHARAVO", poste: "MAGASINIER", date_embauche: "2023-11-02", salaire_brut: 500000, salaire_net: 492000 },
  { nom_complet: "RAKOTONIRINA HENINTSOA DANIEL", poste: "SECURITE", date_embauche: "2024-03-01", salaire_brut: 300000, salaire_net: 294000 },
  { nom_complet: "RAKOTOMAHEFARAIBE VIVIANE", poste: "PARAMED", date_embauche: "2025-04-01", salaire_brut: 350000, salaire_net: 343500 },
  { nom_complet: "HARY", poste: "FEMME DE MENAGE", date_embauche: "", salaire_brut: 100000, salaire_net: 100000 },
  { nom_complet: "RASOAMANANTENASOA ODETTE", poste: "FEMME DE MENAGE", date_embauche: "2025-06-01", salaire_brut: 200000, salaire_net: 195000 },
  { nom_complet: "TAHIRINIAINA DIARY FANANTENANA", poste: "ACCEUIL-PCIE", date_embauche: "2026-05-07", salaire_brut: 300000, salaire_net: 300000 },
  { nom_complet: "ARSENE", poste: "RENSEIGMENT", date_embauche: "2026-05-04", salaire_brut: 0, salaire_net: 300000 }
];

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS Utilisateurs (role TEXT PRIMARY KEY, mot_de_passe TEXT NOT NULL)`);
    db.run("INSERT OR IGNORE INTO Utilisateurs (role, mot_de_passe) VALUES ('accueil_pharmacie', 'agent123')");
    db.run("INSERT OR IGNORE INTO Utilisateurs (role, mot_de_passe) VALUES ('medecin_paramed', 'sup123')");
    db.run("INSERT OR IGNORE INTO Utilisateurs (role, mot_de_passe) VALUES ('admin', 'secret123')");

    db.run(`CREATE TABLE IF NOT EXISTS Patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT, code_patient TEXT UNIQUE, nom_complet TEXT NOT NULL, date_entree TEXT, date_visite TEXT, date_naissance TEXT, sexe TEXT, telephone TEXT NOT NULL, adresse TEXT, contact_urgence TEXT, allergies TEXT, maladies_chroniques TEXT, chirurgies TEXT, antecedents_familiaux TEXT, habitudes_toxiques TEXT, traitements_en_cours TEXT, motif_visite TEXT, diagnostic TEXT, prochain_rdv TEXT, consultation_statut TEXT DEFAULT 'Non payé', besoin_controle TEXT DEFAULT 'Non', type_consultation TEXT, services_specifiques TEXT, date_rdv_specialiste TEXT, heure_rdv_specialiste TEXT, historique_consultations TEXT DEFAULT '[]', facture_medicaments TEXT DEFAULT '[]', remarque_paiement TEXT, parametres TEXT, notes TEXT
    )`);

    const colonnes = ['contact_urgence', 'allergies', 'maladies_chroniques', 'chirurgies', 'antecedents_familiaux', 'habitudes_toxiques', 'traitements_en_cours', 'motif_visite', 'diagnostic', 'prochain_rdv', 'date_visite', 'type_consultation', 'services_specifiques', 'date_rdv_specialiste', 'heure_rdv_specialiste', 'historique_consultations', 'facture_medicaments', 'remarque_paiement'];
    colonnes.forEach(col => { db.run(`ALTER TABLE Patients ADD COLUMN ${col} TEXT`, () => {}); });

    db.run(`CREATE TABLE IF NOT EXISTS Inventaire (
        id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT, designation TEXT NOT NULL, categorie TEXT, forme TEXT, date_peremption TEXT, stock_initial INTEGER DEFAULT 0, entrees INTEGER DEFAULT 0, sorties INTEGER DEFAULT 0, prix_unitaire REAL DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS Personnel (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_personnel TEXT UNIQUE,
        nom_complet TEXT NOT NULL,
        poste TEXT,
        date_embauche TEXT,
        salaire_brut REAL DEFAULT 0,
        salaire_net REAL DEFAULT 0,
        telephone TEXT DEFAULT '',
        adresse TEXT DEFAULT ''
    )`, () => {
        db.run("ALTER TABLE Personnel ADD COLUMN code_personnel TEXT", () => {
            initialiserCodesPersonnelExistant();
        });
    });

    db.run(`CREATE TABLE IF NOT EXISTS PaiementsPersonnel (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        personnel_id INTEGER NOT NULL,
        mois TEXT NOT NULL,
        statut TEXT DEFAULT 'Non payé',
        cnaps REAL DEFAULT 0,
        irsa REAL DEFAULT 0,
        indemnites REAL DEFAULT 0,
        retard REAL DEFAULT 0,
        avances REAL DEFAULT 0,
        total_paye REAL DEFAULT 0,
        date_paiement TEXT,
        FOREIGN KEY(personnel_id) REFERENCES Personnel(id),
        UNIQUE(personnel_id, mois)
    )`);

    db.run("ALTER TABLE PaiementsPersonnel ADD COLUMN cnaps REAL DEFAULT 0", () => {});
    db.run("ALTER TABLE PaiementsPersonnel ADD COLUMN irsa REAL DEFAULT 0", () => {});
});

// INITIALISATION ET ATTRIBUTION DES CODES POUR L'ÉQUIPE INITIALE
function initialiserCodesPersonnelExistant() {
    db.all("SELECT id, nom_complet, date_embauche, code_personnel FROM Personnel", [], (err, rows) => {
        if (err || !rows) return;

        if (rows.length === 0) {
            const stmt = db.prepare(`INSERT INTO Personnel (code_personnel, nom_complet, poste, date_embauche, salaire_brut, salaire_net) VALUES (?, ?, ?, ?, ?, ?)`);
            PERSONNEL_OFFICIEL_2026.forEach((emp, index) => {
                const code = `TPFV_${(index + 1).toString().padStart(3, '0')}`;
                stmt.run([code, emp.nom_complet, emp.poste, emp.date_embauche, emp.salaire_brut, emp.salaire_net]);
            });
            stmt.finalize();
        } else {
            const rowsSansCode = rows.filter(r => !r.code_personnel);
            if (rowsSansCode.length > 0) {
                const tries = rows.sort((a, b) => {
                    const nomA = (a.nom_complet || '').toUpperCase();
                    const nomB = (b.nom_complet || '').toUpperCase();

                    if (nomA.includes('RAZAFINDRAKOTO TIANA FANANTENANA')) return -1;
                    if (nomB.includes('RAZAFINDRAKOTO TIANA FANANTENANA')) return 1;
                    if (nomA.includes('RAZAFINDRAMBOA NIASY')) return -1;
                    if (nomB.includes('RAZAFINDRAMBOA NIASY')) return 1;

                    if (!a.date_embauche && b.date_embauche) return 1;
                    if (a.date_embauche && !b.date_embauche) return -1;
                    if (a.date_embauche !== b.date_embauche) {
                        return (a.date_embauche || '').localeCompare(b.date_embauche || '');
                    }
                    return (a.nom_complet || '').localeCompare(b.nom_complet || '', 'fr', { sensitivity: 'base' });
                });

                tries.forEach((row, idx) => {
                    if (!row.code_personnel) {
                        const code = `TPFV_${(idx + 1).toString().padStart(3, '0')}`;
                        db.run("UPDATE Personnel SET code_personnel = ? WHERE id = ?", [code, row.id]);
                    }
                });
            }
        }
    });
}

// --- VÉRIFICATION ET DÉDUCTION DU STOCK / ANALYSES ---
function verifierEtMettreAJourStock(factureJSON, parametresJSON, callback) {
    let listeMeds = [];
    try { if (factureJSON && factureJSON !== '[]') listeMeds = JSON.parse(factureJSON); } catch(e) {}
    
    let listeAnalyses = [];
    try {
        if (parametresJSON) {
            const params = typeof parametresJSON === 'string' ? JSON.parse(parametresJSON) : parametresJSON;
            if (Array.isArray(params.analyses)) listeAnalyses = params.analyses;
        }
    } catch(e) {}

    let erreursStock = [];
    let verificationsEffectuees = 0;
    const totalArticlesAVerifier = listeMeds.length;

    const finaliserMiseAJour = () => {
        let requetes = [];
        listeMeds.forEach(m => {
            const qte = parseInt(m.quantite) || 0;
            if (qte > 0 && m.nom) {
                requetes.push({ sql: "UPDATE Inventaire SET sorties = sorties + ? WHERE LOWER(designation) = LOWER(?)", params: [qte, m.nom.trim()] });
            }
        });

        listeAnalyses.forEach(nomAnalyse => {
            if (nomAnalyse && nomAnalyse.trim()) {
                requetes.push({ sql: "UPDATE Inventaire SET sorties = sorties + 1 WHERE LOWER(designation) = LOWER(?)", params: [nomAnalyse.trim()] });
            }
        });

        if (requetes.length === 0) return callback(null);

        let terminees = 0;
        let erreurSurvenue = null;
        requetes.forEach(req => {
            db.run(req.sql, req.params, (err) => {
                if (err) erreurSurvenue = err;
                terminees++;
                if (terminees === requetes.length) callback(erreurSurvenue ? erreurSurvenue.message : null);
            });
        });
    };

    if (totalArticlesAVerifier === 0) return finaliserMiseAJour();

    listeMeds.forEach(med => {
        const nomMed = (med.nom || '').trim();
        const qteDemandee = parseInt(med.quantite) || 0;

        db.get("SELECT * FROM Inventaire WHERE LOWER(designation) = LOWER(?)", [nomMed], (err, article) => {
            verificationsEffectuees++;
            
            if (article) {
                const catLower = (article.categorie || '').toLowerCase();
                const estService = catLower.includes('autres') || catLower.includes('analyses');
                const stockRestant = (article.stock_initial || 0) + (article.entrees || 0) - (article.sorties || 0);
                
                if (!estService) {
                    if (stockRestant < 5) {
                        erreursStock.push(`'${article.designation}' (Stock : ${stockRestant} - Min requis : 5)`);
                    } else if (qteDemandee > stockRestant) {
                        erreursStock.push(`'${article.designation}' (Qté demandée : ${qteDemandee}, Stock : ${stockRestant})`);
                    }
                }
            }

            if (verificationsEffectuees === totalArticlesAVerifier) {
                if (erreursStock.length > 0) return callback(`Validation impossible ! Stock insuffisant pour : ${erreursStock.join(', ')}`);
                finaliserMiseAJour();
            }
        });
    });
}

// --- API AUTHENTIFICATION & ROLES ---
app.post('/api/login', (req, res) => {
    const { role, mot_de_passe } = req.body;
    db.get("SELECT * FROM Utilisateurs WHERE role = ?", [(role || '').trim().toLowerCase()], (err, user) => {
        if (err) return res.status(500).json({ erreur: err.message });
        if (!user || user.mot_de_passe !== (mot_de_passe || '').trim()) return res.status(401).json({ erreur: "Identifiants incorrects." });
        res.json({ message: "Connexion réussie !" });
    });
});

app.post('/api/reset-password', (req, res) => {
    const { role_a_modifier, nouveau_mot_de_passe } = req.body;
    db.run("INSERT OR REPLACE INTO Utilisateurs (role, mot_de_passe) VALUES (?, ?)", [(role_a_modifier || '').trim().toLowerCase(), (nouveau_mot_de_passe || '').trim()], err => {
        res.json(err ? { erreur: err.message } : { message: `Mot de passe modifié !` });
    });
});

app.post('/api/admin-password', (req, res) => {
    const { ancien_mot_de_passe, nouveau_mot_de_passe } = req.body;
    db.get("SELECT * FROM Utilisateurs WHERE role = 'admin'", [], (err, user) => {
        if (err || !user || user.mot_de_passe !== (ancien_mot_de_passe || '').trim()) return res.status(401).json({ erreur: "Ancien mot de passe incorrect." });
        db.run("UPDATE Utilisateurs SET mot_de_passe = ? WHERE role = 'admin'", [(nouveau_mot_de_passe || '').trim()], e => {
            res.json(e ? { erreur: e.message } : { message: "Mot de passe Administrateur mis à jour !" });
        });
    });
});

// --- API PATIENTS ---
app.get('/api/patients', (req, res) => { db.all("SELECT * FROM Patients ORDER BY nom_complet COLLATE NOCASE ASC", [], (err, lignes) => res.json(err ? { erreur: err.message } : lignes)); });

app.post('/api/patients', (req, res) => {
    const p = req.body;
    verifierEtMettreAJourStock(p.facture_medicaments, p.parametres, (erreurStock) => {
        if (erreurStock) return res.status(400).json({ erreur: erreurStock });

        let df = "00000000"; 
        if (p.date_entree && p.date_entree.includes('-')) { const pt = p.date_entree.split('-'); df = `${pt[2]}${pt[1]}${pt[0]}`; }
        
        db.get("SELECT code_patient FROM Patients WHERE code_patient LIKE ? ORDER BY code_patient DESC LIMIT 1", [`${df}%`], (err, dernier) => {
            const num = dernier ? parseInt(dernier.code_patient.slice(-3), 10) || 0 : 0;
            const code = `${df}${(num + 1).toString().padStart(3, '0')}`;
            
            db.run(`INSERT INTO Patients (code_patient, nom_complet, date_entree, date_visite, date_naissance, sexe, telephone, adresse, contact_urgence, allergies, maladies_chroniques, chirurgies, antecedents_familiaux, habitudes_toxiques, traitements_en_cours, motif_visite, diagnostic, prochain_rdv, consultation_statut, besoin_controle, type_consultation, services_specifiques, date_rdv_specialiste, heure_rdv_specialiste, historique_consultations, facture_medicaments, remarque_paiement, parametres, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
            [code, p.nom_complet.trim(), p.date_entree||'', p.date_visite||'', p.date_naissance||'', p.sexe||'Masculin', p.telephone.trim(), p.adresse||'', p.contact_urgence||'', p.allergies||'', p.maladies_chroniques||'', p.chirurgies||'', p.antecedents_familiaux||'', p.habitudes_toxiques||'', p.traitements_en_cours||'', p.motif_visite||'', p.diagnostic||'', p.prochain_rdv||'', p.consultation_statut || 'Non payé', p.besoin_controle || 'Non', p.type_consultation || 'Consultation généraliste', p.services_specifiques || '', p.date_rdv_specialiste || '', p.heure_rdv_specialiste || '', p.historique_consultations || '[]', p.facture_medicaments || '[]', p.remarque_paiement||'', p.parametres||'', p.notes||''], 
            function(e) { res.json(e ? { erreur: e.message } : { id: this.lastID, message: "Dossier créé et stock mis à jour !" }); });
        });
    });
});

app.put('/api/patients/:id', (req, res) => {
    const p = req.body;
    verifierEtMettreAJourStock(p.facture_medicaments, p.parametres, (erreurStock) => {
        if (erreurStock) return res.status(400).json({ erreur: erreurStock });

        db.run(`UPDATE Patients SET nom_complet=?, date_entree=?, date_visite=?, date_naissance=?, sexe=?, telephone=?, adresse=?, contact_urgence=?, allergies=?, maladies_chroniques=?, chirurgies=?, antecedents_familiaux=?, habitudes_toxiques=?, traitements_en_cours=?, motif_visite=?, diagnostic=?, prochain_rdv=?, consultation_statut=?, besoin_controle=?, type_consultation=?, services_specifiques=?, date_rdv_specialiste=?, heure_rdv_specialiste=?, historique_consultations=?, facture_medicaments=?, remarque_paiement=?, parametres=?, notes=? WHERE id=?`, 
        [p.nom_complet.trim(), p.date_entree||'', p.date_visite||'', p.date_naissance||'', p.sexe||'Masculin', p.telephone.trim(), p.adresse||'', p.contact_urgence||'', p.allergies||'', p.maladies_chroniques||'', p.chirurgies||'', p.antecedents_familiaux||'', p.habitudes_toxiques||'', p.traitements_en_cours||'', p.motif_visite||'', p.diagnostic||'', p.prochain_rdv||'', p.consultation_statut||'Non payé', p.besoin_controle||'Non', p.type_consultation||'Consultation généraliste', p.services_specifiques||'', p.date_rdv_specialiste||'', p.heure_rdv_specialiste||'', p.historique_consultations||'[]', p.facture_medicaments||'[]', p.remarque_paiement||'', p.parametres||'', p.notes||'', req.params.id], 
        e => res.json(e ? { erreur: e.message } : { message: "Mis à jour" }));
    });
});

app.delete('/api/patients/:id', (req, res) => { db.run("DELETE FROM Patients WHERE id = ?", [req.params.id], e => res.json(e ? { erreur: e.message } : { message: "Supprimé" })); });

// --- API INVENTAIRE ---
app.get('/api/inventaire', (req, res) => { db.all("SELECT * FROM Inventaire ORDER BY designation COLLATE NOCASE ASC", [], (err, lignes) => res.json(err ? { erreur: err.message } : lignes)); });
app.post('/api/inventaire', (req, res) => {
    const i = req.body;
    db.run(`INSERT INTO Inventaire (reference, designation, categorie, forme, date_peremption, stock_initial, entrees, sorties, prix_unitaire) VALUES (?,?,?,?,?,?,?,?,?)`, [i.reference||'', i.designation.trim(), i.categorie||'', i.forme||'', i.date_peremption||'', i.stock_initial||0, i.entrees||0, i.sorties||0, i.prix_unitaire||0], function(e) { res.json(e ? { erreur: e.message } : { id: this.lastID, message: "Article ajouté !" }); });
});
app.put('/api/inventaire/:id', (req, res) => {
    const i = req.body;
    db.run(`UPDATE Inventaire SET reference=?, designation=?, categorie=?, forme=?, date_peremption=?, stock_initial=?, entrees=?, sorties=?, prix_unitaire=? WHERE id=?`, [i.reference||'', i.designation.trim(), i.categorie||'', i.forme||'', i.date_peremption||'', i.stock_initial||0, i.entrees||0, i.sorties||0, i.prix_unitaire||0, req.params.id], e => res.json(e ? { erreur: e.message } : { message: "Article mis à jour" }));
});
app.delete('/api/inventaire/:id', (req, res) => { db.run("DELETE FROM Inventaire WHERE id = ?", [req.params.id], e => res.json(e ? { erreur: e.message } : { message: "Supprimé" })); });

app.post('/api/inventaire/reset/:id', (req, res) => {
    db.run("UPDATE Inventaire SET sorties = 0 WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json({ message: "Le compteur de sorties de cet article a été remis à zéro." });
    });
});

// --- API PERSONNEL ---
app.get('/api/personnel', (req, res) => {
    const sqlQuery = `SELECT * FROM Personnel ORDER BY code_personnel ASC`;

    db.all(sqlQuery, [], (err, lignes) => {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json(lignes || []);
    });
});

app.post('/api/personnel', (req, res) => {
    const e = req.body;
    if (!e.nom_complet) return res.status(400).json({ erreur: "Le nom complet est requis." });

    // Génération automatique du code matricule suivant (ex: TPFV_022)
    db.get("SELECT MAX(CAST(SUBSTR(code_personnel, 6) AS INTEGER)) as max_num FROM Personnel WHERE code_personnel LIKE 'TPFV_%'", [], (err, row) => {
        const maxNum = (row && row.max_num) ? row.max_num : 0;
        const nouveauCode = `TPFV_${(maxNum + 1).toString().padStart(3, '0')}`;

        db.run(`INSERT INTO Personnel (code_personnel, nom_complet, poste, date_embauche, salaire_brut, salaire_net, telephone, adresse) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [nouveauCode, e.nom_complet.trim(), e.poste||'', e.date_embauche||'', parseFloat(e.salaire_brut)||0, parseFloat(e.salaire_net)||0, e.telephone||'', e.adresse||''],
        function(errInsert) {
            if (errInsert) return res.status(500).json({ erreur: errInsert.message });
            res.json({ id: this.lastID, code_personnel: nouveauCode, message: `Employé ajouté avec le matricule ${nouveauCode} !` });
        });
    });
});

app.put('/api/personnel/:id', (req, res) => {
    const e = req.body;
    db.run(`UPDATE Personnel SET nom_complet=?, poste=?, date_embauche=?, salaire_brut=?, salaire_net=?, telephone=?, adresse=? WHERE id=?`,
    [e.nom_complet.trim(), e.poste||'', e.date_embauche||'', parseFloat(e.salaire_brut)||0, parseFloat(e.salaire_net)||0, e.telephone||'', e.adresse||'', req.params.id],
    err => res.json(err ? { erreur: err.message } : { message: "Employé mis à jour !" }));
});

app.delete('/api/personnel/:id', (req, res) => {
    db.run("DELETE FROM Personnel WHERE id = ?", [req.params.id], err => res.json(err ? { erreur: err.message } : { message: "Employé supprimé !" }));
});

// --- API PAIEMENTS MENSUELS ---
app.get('/api/personnel/paiements-globaux/:mois', (req, res) => {
    const mois = req.params.mois;
    const sqlQuery = `
        SELECT 
            p.id, p.code_personnel, p.nom_complet, p.poste, p.salaire_brut, p.salaire_net, p.date_embauche,
            pay.mois, pay.statut, pay.cnaps, pay.irsa, pay.indemnites, pay.retard, pay.avances, pay.total_paye, pay.date_paiement
        FROM Personnel p
        LEFT JOIN PaiementsPersonnel pay ON p.id = pay.personnel_id AND pay.mois = ?
        ORDER BY p.code_personnel ASC`;

    db.all(sqlQuery, [mois], (err, lignes) => {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json(lignes);
    });
});

app.get('/api/personnel/:id/paiements/:mois', (req, res) => {
    db.get("SELECT * FROM PaiementsPersonnel WHERE personnel_id = ? AND mois = ?", [req.params.id, req.params.mois], (err, row) => {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json(row || { statut: 'Non payé', cnaps: 0, irsa: 0, indemnites: 0, retard: 0, avances: 0, total_paye: 0 });
    });
});

app.post('/api/personnel/:id/paiements', (req, res) => {
    const p = req.body;
    const sql = `
        INSERT INTO PaiementsPersonnel (personnel_id, mois, statut, cnaps, irsa, indemnites, retard, avances, total_paye, date_paiement)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(personnel_id, mois) DO UPDATE SET
            statut = excluded.statut,
            cnaps = excluded.cnaps,
            irsa = excluded.irsa,
            indemnites = excluded.indemnites,
            retard = excluded.retard,
            avances = excluded.avances,
            total_paye = excluded.total_paye,
            date_paiement = excluded.date_paiement`;

    db.run(sql, [
        req.params.id,
        p.mois,
        p.statut || 'Non payé',
        parseFloat(p.cnaps) || 0,
        parseFloat(p.irsa) || 0,
        parseFloat(p.indemnites) || 0,
        parseFloat(p.retard) || 0,
        parseFloat(p.avances) || 0,
        parseFloat(p.total_paye) || 0,
        p.date_paiement || new Date().toISOString().slice(0, 10)
    ], function(err) {
        if (err) return res.status(500).json({ erreur: err.message });
        res.json({ message: "Statut de paie enregistré avec succès !" });
    });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Serveur prêt sur http://localhost:${PORT}`));