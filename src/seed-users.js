
const bcrypt = require('bcryptjs');
const pool = require('./db');

async function main() {
    const password = '123456';
    const hash = bcrypt.hashSync(password, 10);
    const check = bcrypt.compareSync(password, hash);
    console.log('Hash generado:', hash);
    console.log('¿Hash válido?', check);

    const [rows] = await pool.query('SELECT id, username FROM usuarios');
    if (rows.length === 0) {
        console.log('No hay usuarios. Crea uno con INSERT.');
        await pool.end();
        return;
    }

    for (const u of rows) {
        await pool.execute(
            'UPDATE usuarios SET password_hash = ? WHERE id = ?',
            [hash, u.id]
        );
        console.log(`✔ ${u.username} → contraseña ${password}`);
    }

    await pool.end();
    console.log('\n✅ Todas las contraseñas quedaron en: 123456');
    console.log('   Cambia cada una luego desde el panel de admin.');
}

main().catch(err => { console.error(err); process.exit(1); });