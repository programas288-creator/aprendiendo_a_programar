// public/app.js
const API = '';
let token = localStorage.getItem('token');
let usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

// ---------- Helpers ----------
function toast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'show' + (isError ? ' error' : '');
    setTimeout(() => t.className = '', 3000);
}

async function fetchJSON(url, options = {}) {
    options.headers = { ...(options.headers || {}), 'Authorization': 'Bearer ' + token };
    const res = await fetch(url, options);
    if (res.status === 401) { logout(); throw new Error('Sesión expirada'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
}

// ---------- Login ----------
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { username, password } = Object.fromEntries(new FormData(e.target));
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        token = data.token; usuario = data.usuario;
        localStorage.setItem('token', token);
        localStorage.setItem('usuario', JSON.stringify(usuario));
        entrar();
    } catch (err) {
        document.getElementById('login-error').textContent = err.message;
    }
});

function logout() {
    localStorage.clear(); token = null; usuario = null;
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}
document.getElementById('btn-logout').addEventListener('click', logout);

// ---------- Panel ----------
function entrar() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('user-label').textContent = `${usuario.username} (${usuario.rol})`;

    document.querySelectorAll('.admin-only').forEach(el =>
        el.style.display = usuario.rol === 'admin' ? '' : 'none');
    document.querySelectorAll('.emp-only').forEach(el =>
        el.style.display = ['empleado', 'admin'].includes(usuario.rol) ? '' : 'none');

    if (usuario.rol === 'empleado')
        document.getElementById('empleado-actual').textContent = usuario.username;

    // Tab inicial según rol
    const tabInicial = 'consultas';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-tab="${tabInicial}"]`).classList.add('active');
    document.getElementById('tab-' + tabInicial).classList.add('active');

    cargarTodo();
}

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        cargarTodo();
    });
});

// ---------- Cargas ----------
async function cargarDuenosSelect() {
    if (!['empleado', 'admin'].includes(usuario.rol)) return;
    try {
        const data = await fetchJSON('/api/duenos');
        document.getElementById('select-dueno').innerHTML =
            '<option value="">-- Selecciona un dueño --</option>' +
            data.map(d => `<option value="${d.id}">${d.nombre} ${d.apellidos}</option>`).join('');
    } catch (e) { /* admin sin permisos de select */ }
}

async function cargarMascotas() {
    try {
        const data = await fetchJSON('/api/mascotas');
        document.getElementById('tabla-mascotas').innerHTML = data.map(m => `
            <tr><td>${m.id}</td><td>${m.nombre}</td>
            <td>${m.raza || '-'}</td><td>${m.color_pelaje || '-'}</td>
            <td>${m.dueno_nombre} ${m.dueno_apellidos}</td></tr>
        `).join('');

        if (['empleado', 'admin'].includes(usuario.rol)) {
            document.getElementById('select-mascota').innerHTML =
                '<option value="">-- Selecciona una mascota --</option>' +
                data.map(m => `<option value="${m.id}">${m.nombre} (${m.dueno_nombre})</option>`).join('');
        }
    } catch (e) { console.error(e); }
}

async function cargarConsultas() {
    try {
        const data = await fetchJSON('/api/consultas');
        document.getElementById('tabla-consultas').innerHTML = data.map(c => `
            <tr>
                <td>${new Date(c.fecha_ingreso).toLocaleString()}</td>
                <td>${c.mascota_nombre}</td><td>${c.raza || '-'}</td>
                <td>${c.color_pelaje || '-'}</td>
                <td>${c.dueno_nombre} ${c.dueno_apellidos}</td>
                <td>${c.empleado_nombre}</td><td>${c.tipo_corte}</td>
                <td><a class="pdf-btn" href="/reporte/${c.id}?token=${token}" target="_blank">PDF</a></td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

async function cargarUsuarios() {
    if (usuario.rol !== 'admin') return;
    try {
        const data = await fetchJSON('/api/admin/usuarios');
        document.getElementById('tabla-usuarios').innerHTML = data.map(u => {
            const nombre = u.empleado_nombre || (u.dueno_nombre ? `${u.dueno_nombre} ${u.dueno_apellidos || ''}` : '-');
            return `
                <tr>
                    <td>${u.id}</td><td>${u.username}</td><td>${u.rol}</td>
                    <td>${nombre}</td>
                    <td>${new Date(u.creado_en).toLocaleDateString()}</td>
                    <td><button class="mini-btn" onclick="resetPassword(${u.id})">Cambiar</button></td>
                </tr>`;
        }).join('');
    } catch (e) { console.error(e); }
}

async function cargarTodo() {
    await Promise.all([
        cargarMascotas(),
        cargarConsultas(),
        cargarDuenosSelect(),
        cargarUsuarios()
    ]);
}

// ---------- Formularios ----------
document.getElementById('form-mascota').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await fetchJSON('/api/mascotas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
        });
        toast('✅ Mascota registrada');
        e.target.reset(); cargarTodo();
    } catch (err) { toast('❌ ' + err.message, true); }
});

document.getElementById('form-corte').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await fetchJSON('/api/consultas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
        });
        toast('✅ Corte registrado');
        e.target.reset(); cargarTodo();
    } catch (err) { toast('❌ ' + err.message, true); }
});

document.getElementById('form-nuevo-empleado').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await fetchJSON('/api/admin/empleados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
        });
        toast('✅ Empleado creado con credenciales');
        e.target.reset(); cargarTodo();
    } catch (err) { toast('❌ ' + err.message, true); }
});

document.getElementById('form-nuevo-dueno').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await fetchJSON('/api/admin/duenos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
        });
        toast('✅ Dueño creado con credenciales');
        e.target.reset(); cargarTodo();
    } catch (err) { toast('❌ ' + err.message, true); }
});

// Resetear contraseña (llamada desde la tabla)
window.resetPassword = async function(id) {
    const nueva = prompt('Nueva contraseña:');
    if (!nueva) return;
    try {
        await fetchJSON(`/api/admin/usuarios/${id}/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: nueva })
        });
        toast('✅ Contraseña actualizada');
    } catch (err) { toast('❌ ' + err.message, true); }
};

// ---------- Init ----------
if (token && usuario) entrar();