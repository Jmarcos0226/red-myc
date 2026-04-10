# 🚀 Red de Emprendedores MYC — Misión y Comunión

Aplicación web completa para gestionar la Red de Emprendedores de la comunidad Misión y Comunión.

---

## ⚡ Inicio rápido (3 pasos)

### 1. Instala Python (si no lo tienes)
Descarga desde: **https://www.python.org/downloads/**
> ⚠️ En Windows: marca ✅ "Add Python to PATH" durante la instalación

### 2. Instala Flask (una sola vez)
Abre una terminal/consola y ejecuta:
```bash
pip install flask
```
> En Mac/Linux puede ser `pip3 install flask`

### 3. Inicia la aplicación

**Windows:** Doble clic en `iniciar.bat`

**Mac / Linux:**
```bash
chmod +x iniciar.sh
./iniciar.sh
```

**O directamente:**
```bash
python server.py
# (en Mac/Linux: python3 server.py)
```

Luego abre tu navegador en: **http://localhost:3000**

---

## 👤 Cuentas de acceso (demo)

| Rol        | Email                | Contraseña  |
|------------|----------------------|-------------|
| 👑 Admin   | admin@myc.org        | admin123    |
| 🔐 Manager | manager@myc.org      | manager123  |
| 👤 Demo    | ana@myc.org          | pass123     |

> Todos los emprendedores demo usan la contraseña: **pass123**
> Emails demo: ana, luis, rosa, jorge, marta, pedro, carmen, roberto, lucia, miguel — todos @myc.org

---

## 📦 Estructura del proyecto

```
myc-app/
│
├── server.py          ← Backend Flask (todo en 1 archivo)
├── myc.db             ← Base de datos SQLite (se crea automáticamente)
├── iniciar.bat        ← Iniciar en Windows
├── iniciar.sh         ← Iniciar en Mac/Linux
│
└── public/            ← Frontend (HTML/CSS/JS)
    ├── index.html     ← Aplicación principal
    ├── css/
    │   └── style.css  ← Estilos
    ├── js/
    │   ├── api.js     ← Cliente API
    │   └── app.js     ← Lógica de la app
    └── img/
        └── logo.jpg   ← Logo MYC
```

---

## 🎯 Módulos disponibles

| Módulo              | Descripción                                                  |
|---------------------|--------------------------------------------------------------|
| **Dashboard**       | KPIs, cumpleaños próximos, recordatorios, sectores activos   |
| **Directorio**      | Búsqueda y filtros de emprendedores aprobados                |
| **Mi Perfil**       | Registro y edición del perfil personal completo              |
| **Ideas & Proyectos** | Gestión de oportunidades colaborativas con estados         |
| **Agenda**          | Recordatorios e historial de interacciones                   |
| **Mensajes**        | Chat interno entre integrantes                               |
| **Mis Contactos**   | CRM personal con etiquetas                                   |
| **Panel Manager**   | Aprobación/rechazo de perfiles (solo managers y admins)      |

---

## 🔐 Sistema de roles

- **Admin**: acceso completo, incluye panel manager
- **Manager**: puede aprobar/rechazar perfiles
- **Emprendedor**: registra su perfil, interactúa con la red

---

## 🗄️ Base de datos

Usa **SQLite** — sin instalación extra. El archivo `myc.db` se crea automáticamente
en la primera ejecución con datos de ejemplo incluidos.

Para reiniciar la base de datos desde cero:
```bash
# Simplemente borra el archivo:
rm myc.db    # Mac/Linux
del myc.db   # Windows
# Al reiniciar el servidor se creará nuevamente
```

---

## 🚀 Producción

Para un entorno de producción real, se recomienda:

1. **Cambiar el SECRET** en `server.py`:
   ```python
   SECRET = "tu-clave-secreta-muy-larga-y-segura"
   ```

2. **Usar Gunicorn** como servidor WSGI:
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:3000 server:app
   ```

3. **Nginx** como reverse proxy para HTTPS

---

## 📋 API REST

Todos los endpoints requieren header: `Authorization: Bearer <token>`

| Método | Ruta                          | Descripción                    |
|--------|-------------------------------|--------------------------------|
| POST   | /api/auth/login               | Iniciar sesión                 |
| POST   | /api/auth/register            | Registrar nueva cuenta         |
| GET    | /api/profiles                 | Listar perfiles aprobados      |
| POST   | /api/profiles                 | Guardar/actualizar mi perfil   |
| PUT    | /api/profiles/:id/approve     | Aprobar perfil (manager/admin) |
| GET    | /api/opportunities            | Listar ideas/proyectos         |
| POST   | /api/opportunities            | Crear nueva idea               |
| POST   | /api/opportunities/:id/join   | Unirse a un proyecto           |
| GET    | /api/reminders                | Mis recordatorios              |
| POST   | /api/reminders                | Crear recordatorio             |
| GET    | /api/interactions             | Historial de interacciones     |
| POST   | /api/interactions             | Registrar interacción          |
| GET    | /api/messages                 | Mis conversaciones             |
| POST   | /api/messages                 | Enviar mensaje                 |
| GET    | /api/dashboard                | Estadísticas generales         |

---

*Desarrollado para la comunidad Misión y Comunión — Asociación de Laicos Católicos*
