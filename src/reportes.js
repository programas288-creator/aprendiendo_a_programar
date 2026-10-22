// src/reportes.js
const PDFDocument = require('pdfkit');

function generarReporteCorte(res, datos) {
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
        `attachment; filename=reporte-${datos.consulta_id}.pdf`);

    doc.pipe(res);

    doc.fontSize(20).text('🐾 Peluquería Canina — Hoja de Consulta', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).fillColor('#666').text(`Folio: #${datos.consulta_id}`, { align: 'right' });
    doc.fillColor('#000').moveDown();

    doc.fontSize(14).text('Dueño', { underline: true });
    doc.fontSize(12)
        .text(`Nombre: ${datos.dueno_nombre} ${datos.dueno_apellidos}`)
        .text(`Dirección: ${datos.direccion || 'No registrada'}`)
        .text(`Teléfono de referencia: ${datos.telefono_referencia || 'No registrado'}`);
    doc.moveDown();

    doc.fontSize(14).text('Mascota', { underline: true });
    doc.fontSize(12)
        .text(`Nombre: ${datos.mascota_nombre}`)
        .text(`Raza: ${datos.raza || '-'}`)
        .text(`Color de pelaje: ${datos.color_pelaje || '-'}`)
        .text(`Observaciones: ${datos.observaciones || 'Ninguna'}`);
    doc.moveDown();

    doc.fontSize(14).text('Servicio', { underline: true });
    doc.fontSize(12)
        .text(`Fecha de ingreso: ${new Date(datos.fecha_ingreso).toLocaleString()}`)
        .text(`Tipo de corte: ${datos.tipo_corte}`)
        .text(`Empleado a cargo: ${datos.empleado_nombre}`)
        .text(`Notas: ${datos.notas_adicionales || 'Sin notas'}`);
    doc.moveDown(2);

    doc.fontSize(9).fillColor('#888')
        .text('Gracias por confiar en nosotros 🐶', { align: 'center' });

    doc.end();
}

module.exports = { generarReporteCorte };