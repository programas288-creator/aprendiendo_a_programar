// src/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

function verificarToken(req, res, next) {
    let token = null;
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);
    else if (req.query.token) token = req.query.token; // para PDFs

    if (!token) return res.status(401).json({ error: 'No autorizado' });

    try {
        req.usuario = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
}

function soloAdmin(req, res, next) {
    if (req.usuario.rol !== 'admin')
        return res.status(403).json({ error: 'Solo administrador' });
    next();
}

function soloEmpleadoOAdmin(req, res, next) {
    if (!['empleado', 'admin'].includes(req.usuario.rol))
        return res.status(403).json({ error: 'Solo empleados o admin' });
    next();
}

module.exports = { verificarToken, soloAdmin, soloEmpleadoOAdmin };