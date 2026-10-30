// src/index.js
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./db');
const { generarReporteCorte } = require('./reportes');
const { verificarToken, soloAdmin, soloEmpleadoOAdmin } = require('./auth');
const authRutas = require('./authRutas');
require('dotenv').config();

const app = express();
app.use(express.json());

// Login público
app.use('/api', authRutas);

// A partir de aquí, todo requiere token
app.use('/api', verificarToken);

// ==================== ADMIN: crear empleado CON credenciales ====================
app.post('/api/admin/empleados', soloAdmin, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { nombre, especialidad, username, password } = req.body;
        if (!nombre || !username || !password)
            return res.status(400).json({ error: 'Nombre, usuario y contraseña obligatorios' });

        await conn.beginTransaction();

        const [emp] = await conn.execute(
            'INSERT INTO empleados (nombre, especialidad) VALUES (?, ?)',
            [nombre, especialidad || null]
        );

        const hash = await bcrypt.hash(password, 10);
        await conn.execute(
            `INSERT INTO usuarios (username, password_hash, rol, empleado_id)
             VALUES (?, ?, 'empleado', ?)`,
            [username, hash, emp.insertId]
        );

        await conn.commit();
        res.status(201).json({ id: emp.insertId, mensaje: 'Empleado y credenciales creados' });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(400).json({ error: 'Ese nombre de usuario ya existe' });
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ==================== ADMIN: crear dueño CON credenciales ====================
app.post('/api/admin/duenos', soloAdmin, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { nombre, apellidos, direccion, telefono_referencia, username, password } = req.body;
        if (!nombre || !apellidos || !username || !password)
            return res.status(400).json({ error: 'Faltan campos obligatorios' });

        await conn.beginTransaction();

        const [d] = await conn.execute(
            `INSERT INTO duenos (nombre, apellidos, direccion, telefono_referencia)
             VALUES (?, ?, ?, ?)`,
            [nombre, apellidos, direccion || null, telefono_referencia || null]
        );

        const hash = await bcrypt.hash(password, 10);
        await conn.execute(
            `INSERT INTO usuarios (username, password_hash, rol, dueno_id)
             VALUES (?, ?, 'dueno', ?)`,
            [username, hash, d.insertId]
        );

        await conn.commit();
        res.status(201).json({ id: d.insertId, mensaje: 'Dueño y credenciales creados' });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(400).json({ error: 'Ese nombre de usuario ya existe' });
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ==================== ADMIN: listar usuarios y resetear contraseña ====================
app.get('/api/admin/usuarios', soloAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT u.id, u.username, u.rol, u.creado_en,
                   e.nombre AS empleado_nombre, d.nombre AS dueno_nombre, d.apellidos AS dueno_apellidos
            FROM usuarios u
            LEFT JOIN empleados e ON u.empleado_id = e.id
            LEFT JOIN duenos d ON u.dueno_id = d.id
            ORDER BY u.id
        `);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/usuarios/:id/password', soloAdmin, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 4)
            return res.status(400).json({ error: 'Contraseña muy corta' });
        const hash = await bcrypt.hash(password, 10);
        await pool.execute('UPDATE usuarios SET password_hash = ? WHERE id = ?',
            [hash, req.params.id]);
        res.json({ mensaje: 'Contraseña actualizada' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== MASCOTAS ====================
app.get('/api/mascotas', async (req, res) => {
    try {
        let sql = `
            SELECT m.*, d.nombre AS dueno_nombre, d.apellidos AS dueno_apellidos
            FROM mascotas m JOIN duenos d ON m.dueno_id = d.id
        `;
        const params = [];
        if (req.usuario.rol === 'dueno') {
            sql += ' WHERE m.dueno_id = ?';
            params.push(req.usuario.dueno_id);
        }
        sql += ' ORDER BY m.id DESC';
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/mascotas', soloEmpleadoOAdmin, async (req, res) => {
    try {
        const { dueno_id, nombre, raza, color_pelaje, observaciones } = req.body;
        if (!dueno_id || !nombre)
            return res.status(400).json({ error: 'Dueño y nombre obligatorios' });
        const [r] = await pool.execute(
            'INSERT INTO mascotas (dueno_id, nombre, raza, color_pelaje, observaciones) VALUES (?,?,?,?,?)',
            [dueno_id, nombre, raza || null, color_pelaje || null, observaciones || null]
        );
        res.status(201).json({ id: r.insertId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== EMPLEADOS (listado para asignar cortes) ====================
app.get('/api/empleados', soloEmpleadoOAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nombre, especialidad FROM empleados ORDER BY id');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== DUEÑOS (listado para selects) ====================
app.get('/api/duenos', soloEmpleadoOAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nombre, apellidos FROM duenos ORDER BY nombre');
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== CONSULTAS ====================
app.get('/api/consultas', async (req, res) => {
    try {
        let sql = `
            SELECT c.id, c.fecha_ingreso, c.tipo_corte, c.notas_adicionales,
                   m.nombre AS mascota_nombre, m.raza, m.color_pelaje,
                   d.nombre AS dueno_nombre, d.apellidos AS dueno_apellidos,
                   e.nombre AS empleado_nombre
            FROM consultas c
            JOIN mascotas m ON c.mascota_id = m.id
            JOIN duenos d ON m.dueno_id = d.id
            JOIN empleados e ON c.empleado_id = e.id
        `;
        const params = [];
        if (req.usuario.rol === 'dueno') {
            sql += ' WHERE d.id = ?';
            params.push(req.usuario.dueno_id);
        }
        sql += ' ORDER BY c.fecha_ingreso DESC LIMIT 200';
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/consultas', soloEmpleadoOAdmin, async (req, res) => {
    try {
        const { mascota_id, tipo_corte, notas_adicionales } = req.body;
        // Empleado se toma del token; si es admin y no tiene empleado_id, se pide
        const empleado_id = req.usuario.empleado_id || req.body.empleado_id;
        if (!empleado_id)
            return res.status(400).json({ error: 'No se pudo determinar el empleado' });
        if (!mascota_id || !tipo_corte)
            return res.status(400).json({ error: 'Mascota y tipo de corte obligatorios' });

        const [r] = await pool.execute(
            'INSERT INTO consultas (mascota_id, empleado_id, tipo_corte, notas_adicionales) VALUES (?,?,?,?)',
            [mascota_id, empleado_id, tipo_corte, notas_adicionales || null]
        );
        res.status(201).json({ id: r.insertId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== REPORTE PDF ====================
app.get('/reporte/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT c.id AS consulta_id, c.fecha_ingreso, c.tipo_corte, c.notas_adicionales,
                   m.nombre AS mascota_nombre, m.raza, m.color_pelaje, m.observaciones,
                   d.id AS dueno_id, d.nombre AS dueno_nombre, d.apellidos AS dueno_apellidos,
                   d.direccion, d.telefono_referencia,
                   e.nombre AS empleado_nombre
            FROM consultas c
            JOIN mascotas m ON c.mascota_id = m.id
            JOIN duenos d ON m.dueno_id = d.id
            JOIN empleados e ON c.empleado_id = e.id
            WHERE c.id = ?
        `, [req.params.id]);

        if (rows.length === 0) return res.status(404).json({ error: 'No encontrada' });
        const data = rows[0];
        if (req.usuario.rol === 'dueno' && data.dueno_id !== req.usuario.dueno_id)
            return res.status(403).json({ error: 'No autorizado' });

        generarReporteCorte(res, data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al generar PDF' });
    }
});

// Frontend
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) =>
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));