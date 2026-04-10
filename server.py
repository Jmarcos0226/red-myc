#!/usr/bin/env python3
"""
Red de Emprendedores MYC — Backend Flask
Autónomo: usa solo stdlib + Flask (ya instalado)
"""

import sqlite3, hashlib, hmac, base64, json, time, os, re
from datetime import datetime, date
from flask import Flask, request, jsonify, send_from_directory, g

# ── CONFIG ────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
DB_PATH    = os.path.join(BASE_DIR, "myc.db")
SECRET     = "myc-secret-2026-change-me"
PORT       = 3000

app = Flask(__name__, static_folder=PUBLIC_DIR)
app.config["JSON_ENSURE_ASCII"] = False

# ── HELPERS JWT (puro stdlib) ─────────────────────────────────
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _b64url_dec(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * (pad % 4))

def jwt_encode(payload: dict, exp_seconds=604800) -> str:
    payload = {**payload, "exp": int(time.time()) + exp_seconds, "iat": int(time.time())}
    header  = _b64url(json.dumps({"alg":"HS256","typ":"JWT"}).encode())
    body    = _b64url(json.dumps(payload).encode())
    sig     = _b64url(hmac.new(SECRET.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"

def jwt_decode(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) != 3: raise ValueError("bad token")
        header, body, sig = parts
        expected = _b64url(hmac.new(SECRET.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected): raise ValueError("bad sig")
        payload = json.loads(_b64url_dec(body))
        if payload.get("exp", 0) < time.time(): raise ValueError("expired")
        return payload
    except Exception as e:
        raise ValueError(str(e))

# ── PASSWORD HASH (stdlib sha256 + salt) ─────────────────────
def hash_pw(pw: str) -> str:
    salt = base64.b64encode(os.urandom(16)).decode()
    h    = hashlib.sha256(f"{salt}{pw}".encode()).hexdigest()
    return f"{salt}:{h}"

def check_pw(pw: str, stored: str) -> bool:
    try:
        salt, h = stored.split(":", 1)
        return hmac.compare_digest(h, hashlib.sha256(f"{salt}{pw}".encode()).hexdigest())
    except:
        return False

# ── DATABASE ──────────────────────────────────────────────────
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db = g.pop("db", None)
    if db: db.close()

def query(sql, params=(), one=False):
    db  = get_db()
    cur = db.execute(sql, params)
    db.commit()
    if one: row = cur.fetchone(); return dict(row) if row else None
    return [dict(r) for r in cur.fetchall()]

def execute(sql, params=()):
    db  = get_db()
    cur = db.execute(sql, params)
    db.commit()
    return cur.lastrowid

# ── AUTH MIDDLEWARE ───────────────────────────────────────────
def require_auth(f):
    from functools import wraps
    @wraps(f)
    def decorated(*a, **kw):
        auth = request.headers.get("Authorization", "")
        token = auth.replace("Bearer ", "").strip()
        if not token:
            return jsonify({"error": "No autenticado"}), 401
        try:
            request.user = jwt_decode(token)
        except ValueError as e:
            return jsonify({"error": str(e)}), 401
        return f(*a, **kw)
    return decorated

def require_role(*roles):
    def decorator(f):
        from functools import wraps
        @wraps(f)
        def decorated(*a, **kw):
            if request.user.get("role") not in roles:
                return jsonify({"error": "Sin permisos"}), 403
            return f(*a, **kw)
        return decorated
    return decorator

# ── INIT DB ───────────────────────────────────────────────────
def init_db():
    with app.app_context():
        db = get_db()
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'emprendedor',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            nombre TEXT NOT NULL,
            fecha_nacimiento TEXT,
            ciudad TEXT DEFAULT '',
            telefono TEXT DEFAULT '',
            linkedin TEXT DEFAULT '',
            redes TEXT DEFAULT '',
            profesion TEXT DEFAULT '',
            especialidad TEXT DEFAULT '',
            anios_experiencia INTEGER DEFAULT 0,
            nivel_experiencia TEXT DEFAULT '',
            disponibilidad TEXT DEFAULT '',
            nombre_emprendimiento TEXT DEFAULT '',
            tipo_empresa TEXT DEFAULT '',
            tamano_negocio TEXT DEFAULT '',
            estado_emprendimiento TEXT DEFAULT '',
            servicios TEXT DEFAULT '',
            habilidades_tecnicas TEXT DEFAULT '',
            habilidades_blandas TEXT DEFAULT '',
            tecnologias TEXT DEFAULT '',
            certificaciones TEXT DEFAULT '',
            interes_colaborar TEXT DEFAULT '',
            bio TEXT DEFAULT '',
            sectores TEXT DEFAULT '[]',
            status TEXT DEFAULT 'pendiente',
            approved_at TEXT,
            approved_by INTEGER,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS opportunities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            descripcion TEXT DEFAULT '',
            categoria TEXT DEFAULT '',
            estado TEXT DEFAULT 'idea',
            creado_por INTEGER REFERENCES users(id),
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS opportunity_members (
            opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (opportunity_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS opportunity_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id),
            contenido TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id),
            contacto_id INTEGER,
            tipo TEXT NOT NULL,
            fecha TEXT NOT NULL,
            resumen TEXT DEFAULT '',
            acuerdos TEXT DEFAULT '',
            proxima_accion TEXT DEFAULT '',
            responsable TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id),
            tipo TEXT NOT NULL,
            titulo TEXT NOT NULL,
            descripcion TEXT DEFAULT '',
            fecha TEXT NOT NULL,
            completado INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id),
            contacto_id INTEGER REFERENCES users(id),
            etiqueta TEXT DEFAULT '',
            notas TEXT DEFAULT '',
            estrategico INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, contacto_id)
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_id INTEGER REFERENCES users(id),
            to_id INTEGER REFERENCES users(id),
            contenido TEXT NOT NULL,
            leido INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
        """)
        db.commit()
        # Seed if empty
        existing = db.execute("SELECT id FROM users WHERE email='admin@myc.org'").fetchone()
        if not existing:
            _seed(db)
            db.commit()
            print("✅ Base de datos inicializada con datos de ejemplo")

def _seed(db):
    def ins_user(email, pw, role):
        db.execute("INSERT INTO users(email,password,role) VALUES(?,?,?)", (email, hash_pw(pw), role))
        return db.execute("SELECT last_insert_rowid()").fetchone()[0]

    def ins_profile(uid, d):
        db.execute("""INSERT INTO profiles(user_id,nombre,fecha_nacimiento,ciudad,telefono,profesion,especialidad,
            anios_experiencia,nivel_experiencia,disponibilidad,nombre_emprendimiento,tipo_empresa,tamano_negocio,
            estado_emprendimiento,servicios,habilidades_tecnicas,habilidades_blandas,certificaciones,
            interes_colaborar,bio,sectores,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'aprobado')""",
            (uid, d["nombre"], d.get("bday"), d.get("ciudad",""), d.get("tel",""),
             d.get("prof",""), d.get("esp",""), d.get("exp",0), d.get("nivel",""), d.get("disp",""),
             d.get("emp",""), d.get("tipe",""), d.get("tam",""), d.get("est",""),
             d.get("svcs",""), d.get("tec",""), d.get("bland",""), d.get("cert",""),
             d.get("colab",""), d.get("bio",""), json.dumps(d.get("sects",[]))))

    admin_id = ins_user("admin@myc.org",   "admin123",   "admin")
    mgr_id   = ins_user("manager@myc.org", "manager123", "manager")
    ins_profile(admin_id,{"nombre":"Administrador MYC","ciudad":"Lima, Perú","prof":"Administrador","esp":"Gestión de plataforma","exp":10,"nivel":"Experto","disp":"Tiempo completo","emp":"MYC","tipe":"ONG","tam":"Micro (2-5)","est":"Consolidado","svcs":"Gestión de la plataforma","tec":"Sistemas","bland":"Liderazgo","cert":"","colab":"Sí, activamente","bio":"Administrador oficial de la Red de Emprendedores MYC.","sects":["Tecnología","Consultoría"]})
    ins_profile(mgr_id,  {"nombre":"María Gestora","bday":"1985-03-15","ciudad":"Lima, Perú","tel":"+51 999 111 222","prof":"Gestora de Red","esp":"Networking & CRM","exp":8,"nivel":"Senior (7+ años)","disp":"Tiempo completo","emp":"MYC Red","tipe":"ONG","tam":"Micro (2-5)","est":"Consolidado","svcs":"Gestión de contactos; Seguimiento de oportunidades","tec":"CRM, Excel, Redes","bland":"Comunicación, Empatía","cert":"","colab":"Sí, activamente","bio":"Responsable de administrar y hacer crecer la red de emprendedores MYC.","sects":["Consultoría","Recursos Humanos"]})

    members = [
        ("ana@myc.org",     {"nombre":"Ana Torres",       "bday":"1988-07-22","ciudad":"Lima, Perú",  "tel":"+51 999 222 333","prof":"Arquitecta & Urbanista",          "esp":"Diseño sostenible",       "exp":8,  "nivel":"Senior (7+ años)","disp":"Tiempo parcial",  "emp":"Estudio Torres & Asoc.","tipe":"MYPE",             "tam":"Micro (2-5)",      "est":"Consolidado","svcs":"Diseño arquitectónico sostenible; Gestión de proyectos urbanos; Consultoría de espacios comunitarios","tec":"AutoCAD, Revit, SketchUp","bland":"Liderazgo, Creatividad","cert":"CAP Arquitectos","colab":"Sí, activamente","bio":"Cofundadora del colectivo de vivienda colaborativa. Apasionada por espacios que conectan personas.","sects":["Diseño","Innovación","Consultoría"]}),
        ("luis@myc.org",    {"nombre":"Luis Medina",       "bday":"1980-04-08","ciudad":"Lima, Perú",  "tel":"+51 999 333 444","prof":"Médico General",                   "esp":"Medicina preventiva",     "exp":12, "nivel":"Experto",         "disp":"Tiempo parcial",  "emp":"Centro de Salud Norte",  "tipe":"Persona natural",  "tam":"Solo (1 persona)", "est":"Consolidado","svcs":"Consultas médicas; Asesoría en salud preventiva; Capacitaciones primeros auxilios","tec":"Historia clínica electrónica","bland":"Empatía, Comunicación","cert":"CMP, SERUMS","colab":"Sí, activamente","bio":"Médico con 12 años de trayectoria. Creo en la salud como derecho colectivo.","sects":["Salud","Consultoría","Innovación"]}),
        ("rosa@myc.org",    {"nombre":"Rosa Quispe",       "bday":"1990-04-11","ciudad":"Cusco, Perú", "tel":"+51 988 444 555","prof":"Educadora & Emprendedora",         "esp":"Emprendimiento rural",    "exp":6,  "nivel":"Mid (3-7 años)",  "disp":"Tiempo completo", "emp":"Panadería El Amanecer",  "tipe":"MYPE",             "tam":"Micro (2-5)",      "est":"En marcha",  "svcs":"Talleres de panadería artesanal; Cursos de emprendimiento rural; Asesoría para emprendedoras","tec":"Redes sociales, Canva","bland":"Resiliencia, Empatía","cert":"Certificado SINEACE","colab":"Sí, activamente","bio":"Maestra de corazón y emprendedora. Fundé una panadería que emplea a 4 mujeres.","sects":["Educación","Comercio","Innovación"]}),
        ("jorge@myc.org",   {"nombre":"Jorge Sánchez",     "bday":"1993-04-14","ciudad":"Lima, Perú",  "tel":"+51 999 555 666","prof":"Ing. de Sistemas",                 "esp":"Desarrollo Full Stack",   "exp":4,  "nivel":"Mid (3-7 años)",  "disp":"Por proyectos",   "emp":"JS Tech Studio",         "tipe":"Startup",          "tam":"Solo (1 persona)", "est":"En marcha",  "svcs":"Desarrollo web y móvil; Automatización de procesos; Transformación digital PYME","tec":"React, Node.js, Python, SQL","bland":"Adaptabilidad, Aprendizaje rápido","cert":"AWS Cloud Practitioner","colab":"Sí, en proyectos puntuales","bio":"Desarrollador Full Stack. Transformación digital para pequeñas empresas.","sects":["Tecnología","Desarrollo Software"]}),
        ("marta@myc.org",   {"nombre":"Marta Flores",      "bday":"1975-09-30","ciudad":"Lima, Perú",  "tel":"+51 999 666 777","prof":"Abogada Corporativa",              "esp":"Derecho empresarial",     "exp":15, "nivel":"Experto",         "disp":"Tiempo parcial",  "emp":"Consultorio Jurídico Popular","tipe":"Persona natural", "tam":"Solo (1 persona)", "est":"Consolidado","svcs":"Asesoría legal empresarial; Contratos y constitución de empresas; Defensa civil","tec":"Sistemas legales, Legislación peruana","bland":"Análisis, Persuasión","cert":"CAL Lima","colab":"Sí, activamente","bio":"Abogada con 15 años. Que todos los emprendedores conozcan sus derechos.","sects":["Legal","Consultoría"]}),
        ("pedro@myc.org",   {"nombre":"Pedro Ccahuana",    "bday":"1970-11-05","ciudad":"Puno, Perú",  "tel":"+51 977 777 888","prof":"Agricultor & Gestor Ambiental",    "esp":"Agricultura orgánica",    "exp":20, "nivel":"Experto",         "disp":"Tiempo completo", "emp":"Finca Ccahuana",          "tipe":"Persona natural",  "tam":"Micro (2-5)",      "est":"Consolidado","svcs":"Producción quinua orgánica; Consultoría agricultura sostenible; Certificación orgánica","tec":"Gestión hídrica, Compostaje","bland":"Perseverancia, Trabajo en equipo","cert":"SENASA Orgánico","colab":"Sí, activamente","bio":"Mi familia lleva generaciones cultivando esta tierra. Combino lo ancestral con lo moderno.","sects":["Agricultura","Innovación","Consultoría"]}),
        ("carmen@myc.org",  {"nombre":"Carmen Vargas",     "bday":"1992-12-20","ciudad":"Lima, Perú",  "tel":"+51 999 888 999","prof":"Especialista Marketing Digital",   "esp":"Estrategia digital",      "exp":5,  "nivel":"Mid (3-7 años)",  "disp":"Tiempo completo", "emp":"CVargas Digital",         "tipe":"Persona natural",  "tam":"Solo (1 persona)", "est":"En marcha",  "svcs":"Estrategia redes sociales; Publicidad Google & Meta; Branding para startups","tec":"Meta Ads, Google Ads, Canva, HubSpot","bland":"Creatividad, Orientación a resultados","cert":"Google Ads, Meta Blueprint","colab":"Sí, activamente","bio":"Ayudo a emprendedores a tener presencia digital poderosa sin gastar una fortuna.","sects":["Marketing","Diseño","Tecnología"]}),
        ("roberto@myc.org", {"nombre":"Roberto Huanca",    "bday":"1982-02-14","ciudad":"Lima, Perú",  "tel":"+51 999 999 000","prof":"Consultor SAP FI/CO",              "esp":"SAP S/4HANA",             "exp":10, "nivel":"Experto",         "disp":"Por proyectos",   "emp":"Huanca Consulting",       "tipe":"MYPE",             "tam":"Solo (1 persona)", "est":"Consolidado","svcs":"Implementación SAP FI/CO; Capacitación SAP; Migración S/4HANA","tec":"SAP FI, SAP CO, SAP BW, ABAP básico","bland":"Análisis, Precisión","cert":"SAP Certified Application Associate","colab":"Sí, en proyectos puntuales","bio":"Consultor SAP con 10 años en proyectos en Perú, Chile y Colombia.","sects":["SAP","Finanzas","Tecnología"]}),
        ("lucia@myc.org",   {"nombre":"Lucía Ríos",        "bday":"1991-08-17","ciudad":"Arequipa, Perú","tel":"+51 958 111 222","prof":"Contadora & Asesora Financiera","esp":"Finanzas empresariales",  "exp":7,  "nivel":"Senior (7+ años)","disp":"Tiempo completo", "emp":"Ríos Consulting Financiero","tipe":"Persona natural","tam":"Solo (1 persona)","est":"Consolidado","svcs":"Contabilidad empresarial; Planeamiento financiero; Declaración de impuestos; Costos y presupuestos","tec":"SAP FI, Excel avanzado, Siigo","bland":"Orden, Proactividad","cert":"CPC, SUNAT Electrónica","colab":"Sí, activamente","bio":"Contadora apasionada que ayuda a los emprendedores MYC a ordenar sus finanzas y crecer sostenidamente.","sects":["Finanzas","Consultoría","SAP"]}),
        ("miguel@myc.org",  {"nombre":"Miguel Quispe",     "bday":"1987-05-23","ciudad":"Lima, Perú",  "tel":"+51 999 444 555","prof":"Diseñador Gráfico & UX/UI",       "esp":"Branding y diseño digital","exp":9, "nivel":"Senior (7+ años)","disp":"Por proyectos",   "emp":"MQ Estudio Creativo",    "tipe":"Startup",          "tam":"Micro (2-5)",      "est":"En marcha",  "svcs":"Diseño de identidad visual; UX/UI para apps; Ilustración digital; Diseño de presentaciones","tec":"Figma, Adobe Suite, Sketch","bland":"Creatividad, Atención al detalle","cert":"Google UX Design, Coursera","colab":"Sí, activamente","bio":"Diseñador con 9 años ayudando a marcas a comunicar visualmente su esencia y conectar con su audiencia.","sects":["Diseño","Tecnología","Marketing"]}),
    ]
    for email, d in members:
        uid = ins_user(email, "pass123", "emprendedor")
        ins_profile(uid, d)

    # Opportunities
    db.execute("INSERT INTO opportunities(nombre,descripcion,categoria,estado,creado_por) VALUES(?,?,?,?,?)",
               ("Plataforma FinTech MYC","App de microfinanzas y ahorro grupal para integrantes. Modelo cooperativo digital.","Tecnología","desarrollo",admin_id))
    o1 = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    db.execute("INSERT INTO opportunities(nombre,descripcion,categoria,estado,creado_por) VALUES(?,?,?,?,?)",
               ("Marketplace Emprendedores","Tienda virtual colaborativa para vender productos y servicios entre miembros MYC.","Comercio","evaluacion",admin_id))
    o2 = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    db.execute("INSERT INTO opportunities(nombre,descripcion,categoria,estado,creado_por) VALUES(?,?,?,?,?)",
               ("Academia MYC Online","Plataforma de cursos y talleres dictados por los emprendedores de la red.","Educación","idea",admin_id))
    o3 = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    db.execute("INSERT INTO opportunities(nombre,descripcion,categoria,estado,creado_por) VALUES(?,?,?,?,?)",
               ("Red de Proveedores Orgánicos","Conectar productores orgánicos MYC con restaurantes y consumidores en Lima y provincias.","Agricultura","desarrollo",admin_id))
    o4 = db.execute("SELECT last_insert_rowid()").fetchone()[0]

    for oid in [o1, o2, o3, o4]:
        db.execute("INSERT OR IGNORE INTO opportunity_members VALUES(?,?)", (oid, admin_id))

    # Reminders
    for r in [
        (admin_id,"cumpleanos","Cumpleaños Luis Medina","Recordar felicitar","2026-04-08"),
        (admin_id,"cumpleanos","Cumpleaños Rosa Quispe","Recordar felicitar","2026-04-11"),
        (admin_id,"reunion","Reunión Red MYC","Zoom 7:00 PM - todos los miembros","2026-04-10"),
        (admin_id,"seguimiento","Seguimiento Proyecto FinTech","Revisar avances con el equipo","2026-04-18"),
    ]:
        db.execute("INSERT INTO reminders(user_id,tipo,titulo,descripcion,fecha) VALUES(?,?,?,?,?)", r)

# ══════════════════════════════════════════════════════════════
#  ROUTES — AUTH
# ══════════════════════════════════════════════════════════════
@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    d = request.json or {}
    if not d.get("email") or not d.get("password") or not d.get("nombre"):
        return jsonify({"error":"Email, contraseña y nombre son requeridos"}), 400
    if query("SELECT id FROM users WHERE email=?", (d["email"],), one=True):
        return jsonify({"error":"Este email ya está registrado"}), 409
    uid = execute("INSERT INTO users(email,password,role) VALUES(?,?,?)",
                  (d["email"], hash_pw(d["password"]), "emprendedor"))
    execute("INSERT INTO profiles(user_id,nombre,ciudad,profesion,status) VALUES(?,?,?,?,'pendiente')",
            (uid, d["nombre"], d.get("ciudad",""), d.get("profesion","")))
    token = jwt_encode({"id":uid,"email":d["email"],"role":"emprendedor"})
    return jsonify({"token":token,"user":{"id":uid,"email":d["email"],"role":"emprendedor","nombre":d["nombre"]}})

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    d = request.json or {}
    user = query("SELECT u.*,p.nombre FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.email=?",
                 (d.get("email",""),), one=True)
    if not user or not check_pw(d.get("password",""), user["password"]):
        return jsonify({"error":"Email o contraseña incorrectos"}), 401
    token = jwt_encode({"id":user["id"],"email":user["email"],"role":user["role"]})
    return jsonify({"token":token,"user":{"id":user["id"],"email":user["email"],"role":user["role"],"nombre":user["nombre"]}})

@app.route("/api/auth/me")
@require_auth
def auth_me():
    u = query("SELECT u.id,u.email,u.role,p.nombre,p.status FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.id=?",
              (request.user["id"],), one=True)
    return jsonify(u)

# ══════════════════════════════════════════════════════════════
#  ROUTES — PROFILES
# ══════════════════════════════════════════════════════════════
@app.route("/api/profiles")
@require_auth
def profiles_list():
    q    = request.args.get("q","")
    sec  = request.args.get("sector","")
    niv  = request.args.get("nivel","")
    disp = request.args.get("disponibilidad","")
    sql  = "SELECT p.*,u.email,u.role FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.status='aprobado'"
    params = []
    if q:
        sql += " AND (p.nombre LIKE ? OR p.profesion LIKE ? OR p.servicios LIKE ? OR p.bio LIKE ? OR p.sectores LIKE ?)"
        v = f"%{q}%"; params += [v,v,v,v,v]
    if sec:  sql += " AND p.sectores LIKE ?";          params.append(f"%{sec}%")
    if niv:  sql += " AND p.nivel_experiencia=?";      params.append(niv)
    if disp: sql += " AND p.disponibilidad=?";         params.append(disp)
    sql += " ORDER BY p.nombre"
    return jsonify(query(sql, params))

@app.route("/api/profiles/pending")
@require_auth
@require_role("manager","admin")
def profiles_pending():
    rows = query("SELECT p.*,u.email FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.status='pendiente' ORDER BY p.created_at DESC")
    return jsonify(rows)

@app.route("/api/profiles/mine")
@require_auth
def profiles_mine():
    p = query("SELECT p.*,u.email FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=?",
              (request.user["id"],), one=True)
    return jsonify(p or {})

@app.route("/api/profiles/<int:pid>")
@require_auth
def profiles_get(pid):
    role = request.user.get("role","")
    uid  = request.user["id"]
    p = query("SELECT p.*,u.email FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.id=? AND (p.status='aprobado' OR p.user_id=? OR ?='admin' OR ?='manager')",
              (pid, uid, role, role), one=True)
    if not p: return jsonify({"error":"No encontrado"}), 404
    return jsonify(p)

@app.route("/api/profiles", methods=["POST"])
@require_auth
def profiles_save():
    d    = request.json or {}
    uid  = request.user["id"]
    sects = json.dumps(d.get("sectores", []) if isinstance(d.get("sectores"), list) else [])
    existing = query("SELECT id FROM profiles WHERE user_id=?", (uid,), one=True)
    if existing:
        execute("""UPDATE profiles SET nombre=?,fecha_nacimiento=?,ciudad=?,telefono=?,linkedin=?,redes=?,
            profesion=?,especialidad=?,anios_experiencia=?,nivel_experiencia=?,disponibilidad=?,
            nombre_emprendimiento=?,tipo_empresa=?,tamano_negocio=?,estado_emprendimiento=?,
            servicios=?,habilidades_tecnicas=?,habilidades_blandas=?,tecnologias=?,certificaciones=?,
            interes_colaborar=?,bio=?,sectores=?,status='pendiente',updated_at=datetime('now') WHERE user_id=?""",
            (d.get("nombre",""), d.get("fecha_nacimiento"), d.get("ciudad",""), d.get("telefono",""),
             d.get("linkedin",""), d.get("redes",""), d.get("profesion",""), d.get("especialidad",""),
             d.get("anios_experiencia",0), d.get("nivel_experiencia",""), d.get("disponibilidad",""),
             d.get("nombre_emprendimiento",""), d.get("tipo_empresa",""), d.get("tamano_negocio",""),
             d.get("estado_emprendimiento",""), d.get("servicios",""), d.get("habilidades_tecnicas",""),
             d.get("habilidades_blandas",""), d.get("tecnologias",""), d.get("certificaciones",""),
             d.get("interes_colaborar",""), d.get("bio",""), sects, uid))
    else:
        execute("""INSERT INTO profiles(user_id,nombre,fecha_nacimiento,ciudad,telefono,linkedin,redes,
            profesion,especialidad,anios_experiencia,nivel_experiencia,disponibilidad,nombre_emprendimiento,
            tipo_empresa,tamano_negocio,estado_emprendimiento,servicios,habilidades_tecnicas,habilidades_blandas,
            tecnologias,certificaciones,interes_colaborar,bio,sectores,status)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pendiente')""",
            (uid, d.get("nombre",""), d.get("fecha_nacimiento"), d.get("ciudad",""), d.get("telefono",""),
             d.get("linkedin",""), d.get("redes",""), d.get("profesion",""), d.get("especialidad",""),
             d.get("anios_experiencia",0), d.get("nivel_experiencia",""), d.get("disponibilidad",""),
             d.get("nombre_emprendimiento",""), d.get("tipo_empresa",""), d.get("tamano_negocio",""),
             d.get("estado_emprendimiento",""), d.get("servicios",""), d.get("habilidades_tecnicas",""),
             d.get("habilidades_blandas",""), d.get("tecnologias",""), d.get("certificaciones",""),
             d.get("interes_colaborar",""), d.get("bio",""), sects))
    return jsonify({"ok": True})

@app.route("/api/profiles/<int:pid>/approve", methods=["PUT"])
@require_auth
@require_role("manager","admin")
def profiles_approve(pid):
    execute("UPDATE profiles SET status='aprobado',approved_at=datetime('now'),approved_by=? WHERE id=?",
            (request.user["id"], pid))
    return jsonify({"ok": True})

@app.route("/api/profiles/<int:pid>/reject", methods=["PUT"])
@require_auth
@require_role("manager","admin")
def profiles_reject(pid):
    execute("UPDATE profiles SET status='rechazado',updated_at=datetime('now') WHERE id=?", (pid,))
    return jsonify({"ok": True})

# ══════════════════════════════════════════════════════════════
#  ROUTES — OPPORTUNITIES
# ══════════════════════════════════════════════════════════════
@app.route("/api/opportunities")
@require_auth
def opps_list():
    rows = query("""SELECT o.*,
        (SELECT COUNT(*) FROM opportunity_members om WHERE om.opportunity_id=o.id) as total_miembros
        FROM opportunities o ORDER BY o.created_at DESC""")
    return jsonify(rows)

@app.route("/api/opportunities/<int:oid>")
@require_auth
def opps_get(oid):
    o = query("SELECT * FROM opportunities WHERE id=?", (oid,), one=True)
    if not o: return jsonify({"error":"No encontrado"}), 404
    o["miembros"] = query("SELECT u.id,p.nombre,p.profesion FROM opportunity_members om JOIN users u ON u.id=om.user_id JOIN profiles p ON p.user_id=u.id WHERE om.opportunity_id=?", (oid,))
    o["updates"]  = query("SELECT ou.*,p.nombre as autor FROM opportunity_updates ou JOIN profiles p ON p.user_id=ou.user_id WHERE ou.opportunity_id=? ORDER BY ou.created_at DESC", (oid,))
    return jsonify(o)

@app.route("/api/opportunities", methods=["POST"])
@require_auth
def opps_create():
    d = request.json or {}
    if not d.get("nombre"): return jsonify({"error":"Nombre requerido"}), 400
    oid = execute("INSERT INTO opportunities(nombre,descripcion,categoria,estado,creado_por) VALUES(?,?,?,?,?)",
                  (d["nombre"], d.get("descripcion",""), d.get("categoria",""), d.get("estado","idea"), request.user["id"]))
    execute("INSERT OR IGNORE INTO opportunity_members VALUES(?,?)", (oid, request.user["id"]))
    return jsonify({"ok":True,"id":oid})

@app.route("/api/opportunities/<int:oid>", methods=["PUT"])
@require_auth
def opps_update(oid):
    d = request.json or {}
    execute("UPDATE opportunities SET nombre=?,descripcion=?,categoria=?,estado=?,updated_at=datetime('now') WHERE id=?",
            (d.get("nombre",""), d.get("descripcion",""), d.get("categoria",""), d.get("estado",""), oid))
    return jsonify({"ok":True})

@app.route("/api/opportunities/<int:oid>", methods=["DELETE"])
@require_auth
def opps_delete(oid):
    o = query("SELECT * FROM opportunities WHERE id=?", (oid,), one=True)
    if not o: return jsonify({"error":"No encontrado"}), 404
    if o["creado_por"] != request.user["id"] and request.user.get("role") not in ("manager","admin"):
        return jsonify({"error":"Sin permiso"}), 403
    execute("DELETE FROM opportunities WHERE id=?", (oid,))
    return jsonify({"ok":True})

@app.route("/api/opportunities/<int:oid>/join", methods=["POST"])
@require_auth
def opps_join(oid):
    try:
        execute("INSERT INTO opportunity_members VALUES(?,?)", (oid, request.user["id"]))
        return jsonify({"ok":True})
    except:
        return jsonify({"error":"Ya eres miembro"}), 409

@app.route("/api/opportunities/<int:oid>/updates", methods=["POST"])
@require_auth
def opps_update_post(oid):
    d = request.json or {}
    if not d.get("contenido"): return jsonify({"error":"Contenido requerido"}), 400
    execute("INSERT INTO opportunity_updates(opportunity_id,user_id,contenido) VALUES(?,?,?)",
            (oid, request.user["id"], d["contenido"]))
    return jsonify({"ok":True})

# ══════════════════════════════════════════════════════════════
#  ROUTES — NETWORK (interactions, reminders, contacts, msgs)
# ══════════════════════════════════════════════════════════════
@app.route("/api/interactions")
@require_auth
def interactions_list():
    rows = query("SELECT i.*,p.nombre as contacto_nombre FROM interactions i LEFT JOIN profiles p ON p.user_id=i.contacto_id WHERE i.user_id=? ORDER BY i.fecha DESC", (request.user["id"],))
    return jsonify(rows)

@app.route("/api/interactions", methods=["POST"])
@require_auth
def interactions_create():
    d = request.json or {}
    if not d.get("tipo") or not d.get("fecha"):
        return jsonify({"error":"Tipo y fecha requeridos"}), 400
    iid = execute("INSERT INTO interactions(user_id,contacto_id,tipo,fecha,resumen,acuerdos,proxima_accion,responsable) VALUES(?,?,?,?,?,?,?,?)",
                  (request.user["id"], d.get("contacto_id") or None, d["tipo"], d["fecha"],
                   d.get("resumen",""), d.get("acuerdos",""), d.get("proxima_accion",""), d.get("responsable","")))
    return jsonify({"ok":True,"id":iid})

@app.route("/api/interactions/<int:iid>", methods=["DELETE"])
@require_auth
def interactions_delete(iid):
    execute("DELETE FROM interactions WHERE id=? AND user_id=?", (iid, request.user["id"]))
    return jsonify({"ok":True})

@app.route("/api/reminders")
@require_auth
def reminders_list():
    return jsonify(query("SELECT * FROM reminders WHERE user_id=? ORDER BY fecha ASC", (request.user["id"],)))

@app.route("/api/reminders", methods=["POST"])
@require_auth
def reminders_create():
    d = request.json or {}
    if not d.get("tipo") or not d.get("titulo") or not d.get("fecha"):
        return jsonify({"error":"Tipo, título y fecha requeridos"}), 400
    rid = execute("INSERT INTO reminders(user_id,tipo,titulo,descripcion,fecha) VALUES(?,?,?,?,?)",
                  (request.user["id"], d["tipo"], d["titulo"], d.get("descripcion",""), d["fecha"]))
    return jsonify({"ok":True,"id":rid})

@app.route("/api/reminders/<int:rid>/done", methods=["PUT"])
@require_auth
def reminders_done(rid):
    execute("UPDATE reminders SET completado=1 WHERE id=? AND user_id=?", (rid, request.user["id"]))
    return jsonify({"ok":True})

@app.route("/api/reminders/<int:rid>", methods=["DELETE"])
@require_auth
def reminders_delete(rid):
    execute("DELETE FROM reminders WHERE id=? AND user_id=?", (rid, request.user["id"]))
    return jsonify({"ok":True})

@app.route("/api/contacts")
@require_auth
def contacts_list():
    return jsonify(query("SELECT c.*,p.nombre,p.profesion,p.ciudad,p.sectores FROM contacts c JOIN profiles p ON p.user_id=c.contacto_id WHERE c.user_id=? ORDER BY p.nombre", (request.user["id"],)))

@app.route("/api/contacts", methods=["POST"])
@require_auth
def contacts_create():
    d = request.json or {}
    if not d.get("contacto_id"): return jsonify({"error":"contacto_id requerido"}), 400
    try:
        execute("INSERT INTO contacts(user_id,contacto_id,etiqueta,notas,estrategico) VALUES(?,?,?,?,?)",
                (request.user["id"], d["contacto_id"], d.get("etiqueta",""), d.get("notas",""), 1 if d.get("estrategico") else 0))
        return jsonify({"ok":True})
    except:
        return jsonify({"error":"Ya está en tus contactos"}), 409

@app.route("/api/contacts/<int:cid>", methods=["PUT"])
@require_auth
def contacts_update(cid):
    d = request.json or {}
    execute("UPDATE contacts SET etiqueta=?,notas=?,estrategico=? WHERE id=? AND user_id=?",
            (d.get("etiqueta",""), d.get("notas",""), 1 if d.get("estrategico") else 0, cid, request.user["id"]))
    return jsonify({"ok":True})

@app.route("/api/contacts/<int:cid>", methods=["DELETE"])
@require_auth
def contacts_delete(cid):
    execute("DELETE FROM contacts WHERE id=? AND user_id=?", (cid, request.user["id"]))
    return jsonify({"ok":True})

@app.route("/api/messages")
@require_auth
def messages_list():
    uid = request.user["id"]
    partners = query("""SELECT DISTINCT CASE WHEN from_id=? THEN to_id ELSE from_id END as partner_id,
        (SELECT p.nombre FROM profiles p WHERE p.user_id=CASE WHEN m.from_id=? THEN m.to_id ELSE m.from_id END) as nombre,
        (SELECT COUNT(*) FROM messages WHERE to_id=? AND from_id=CASE WHEN m.from_id=? THEN m.to_id ELSE m.from_id END AND leido=0) as unread
        FROM messages m WHERE from_id=? OR to_id=?""", (uid,uid,uid,uid,uid,uid))
    return jsonify(partners)

@app.route("/api/messages/<int:pid>")
@require_auth
def messages_chat(pid):
    uid = request.user["id"]
    msgs = query("SELECT m.*,p.nombre as from_nombre FROM messages m JOIN profiles p ON p.user_id=m.from_id WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY created_at ASC",
                 (uid,pid,pid,uid))
    execute("UPDATE messages SET leido=1 WHERE from_id=? AND to_id=?", (pid,uid))
    return jsonify(msgs)

@app.route("/api/messages", methods=["POST"])
@require_auth
def messages_send():
    d = request.json or {}
    if not d.get("to_id") or not d.get("contenido"):
        return jsonify({"error":"to_id y contenido requeridos"}), 400
    mid = execute("INSERT INTO messages(from_id,to_id,contenido) VALUES(?,?,?)",
                  (request.user["id"], d["to_id"], d["contenido"]))
    return jsonify({"ok":True,"id":mid})

# ══════════════════════════════════════════════════════════════
#  ROUTES — DASHBOARD
# ══════════════════════════════════════════════════════════════
@app.route("/api/dashboard")
@require_auth
def dashboard():
    uid   = request.user["id"]
    today = date.today().isoformat()
    total = query("SELECT COUNT(*) as n FROM profiles WHERE status='aprobado'", one=True)["n"]
    pend  = query("SELECT COUNT(*) as n FROM profiles WHERE status='pendiente'", one=True)["n"]
    opps  = query("SELECT COUNT(*) as n FROM opportunities WHERE estado NOT IN ('finalizado','pausa')", one=True)["n"]
    ints  = query("SELECT COUNT(*) as n FROM interactions", one=True)["n"]
    bdays = query("""SELECT nombre, fecha_nacimiento FROM profiles WHERE status='aprobado'
        AND fecha_nacimiento IS NOT NULL AND fecha_nacimiento != ''
        AND strftime('%m-%d', fecha_nacimiento) >= strftime('%m-%d', 'now')
        AND strftime('%m-%d', fecha_nacimiento) <= strftime('%m-%d', 'now', '+30 days')
        ORDER BY strftime('%m-%d', fecha_nacimiento) LIMIT 5""")
    rems  = query("SELECT * FROM reminders WHERE user_id=? AND completado=0 AND fecha>=? ORDER BY fecha ASC LIMIT 5", (uid, today))
    unread= query("SELECT COUNT(*) as n FROM messages WHERE to_id=? AND leido=0", (uid,), one=True)["n"]
    # sectors
    all_sects = query("SELECT sectores FROM profiles WHERE status='aprobado'")
    sc = {}
    for r in all_sects:
        try:
            for s in json.loads(r["sectores"] or "[]"):
                sc[s] = sc.get(s,0)+1
        except: pass
    sectors = [{"sector":k,"count":v} for k,v in sorted(sc.items(), key=lambda x:-x[1])[:6]]
    return jsonify({"total":total,"pending":pend,"opps":opps,"interactions":ints,
                    "upcoming_bdays":bdays,"upcoming_reminders":rems,"unread_msgs":unread,"sectors":sectors})

# ══════════════════════════════════════════════════════════════
#  STATIC — SPA FALLBACK
# ══════════════════════════════════════════════════════════════
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def spa(path):
    if path and os.path.exists(os.path.join(PUBLIC_DIR, path)):
        return send_from_directory(PUBLIC_DIR, path)
    return send_from_directory(PUBLIC_DIR, "index.html")

# ══════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    init_db()
    print(f"\n🚀  Red Emprendedores MYC corriendo en  http://localhost:{PORT}")
    print("\n📋  Cuentas de acceso:")
    print("    👑  Admin:    admin@myc.org    / admin123")
    print("    🔐  Manager:  manager@myc.org  / manager123")
    print("    👤  Demo:     ana@myc.org      / pass123")
    print("         (todos los emprendedores demo usan: pass123)\n")
    app.run(host="0.0.0.0", port=PORT, debug=False)
