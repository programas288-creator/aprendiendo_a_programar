// src/authRutas.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');
require('dotenv').config();

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ error: 'Usuario y contraseña obligatorios' });

        const [rows] = await pool.execute(
            'SELECT * FROM usuarios WHERE username = ?',
            [username]
        );
        if (rows.length === 0)
            return res.status(401).json({ error: 'Credenciales inválidas' });

        const user = rows[0];
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok)
            return res.status(401).json({ error: 'Credenciales inválidas' });

        const payload = {
            id: user.id,
            username: user.username,
            rol: user.rol,
            empleado_id: user.empleado_id,
            dueno_id: user.dueno_id
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES || '8h'
        });

        res.json({ token, usuario: payload });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;