// ============================================================================
// EXPORTACION DE REPORTES — PDF (jsPDF + autoTable) y Word (HTML -> .doc)
// Lee siempre de `lastAnalysis`, la foto exacta del ultimo analisis mostrado
// en pantalla (ver displayResults() en sig-pro.js), no de los filtros
// actualmente seleccionados -- asi el reporte siempre coincide con lo que
// el usuario vio en el panel de resultados.
//
// El diseño del documento cambia segun el nivel de riesgo general: BAJO y
// MODERADO usan un badge compacto y calmado; ALTO y MUY ALTO usan un banner
// de cabecera de ancho completo, dandole mas peso visual a lo mas urgente.
// El color en si sigue siendo el mismo riskColor que ya se usa en pantalla,
// para que el documento nunca se desincronice del resultado mostrado.
// ============================================================================

const TEMAS_RIESGO = {
    'BAJO': {
        etiqueta: 'Riesgo Bajo',
        nota: 'Condiciones generalmente favorables. Se recomienda monitoreo periódico.',
        banner: false
    },
    'MODERADO': {
        etiqueta: 'Riesgo Moderado',
        nota: 'Atención recomendada antes de iniciar actividades en la zona.',
        banner: false
    },
    'ALTO': {
        etiqueta: 'Riesgo Alto',
        nota: 'Se recomienda evaluación especializada antes de continuar.',
        banner: true
    },
    'MUY ALTO': {
        etiqueta: 'Riesgo Muy Alto',
        nota: 'Requiere atención prioritaria antes de cualquier desarrollo en la zona.',
        banner: true
    }
};

function obtenerTema(overallRisk) {
    return TEMAS_RIESGO[overallRisk] || TEMAS_RIESGO['MODERADO'];
}

function lastAnalysisDisponible() {
    if (typeof lastAnalysis === 'undefined' || !lastAnalysis) {
        alert('No hay un analisis reciente para exportar. Realiza un analisis primero.');
        return false;
    }
    return true;
}

function etiquetaVeredicto(v) {
    const mapa = { coincide: 'Coincide', parcial: 'Parcial', no_coincide: 'No coincide', sin_datos: 'Sin datos' };
    return mapa[v] || v;
}

function hexToRgb(hex) {
    hex = String(hex).replace('#', '');
    const bigint = parseInt(hex, 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function nombreArchivoBase(datos) {
    return 'Reporte_' + datos.location.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40) + '_' + Date.now();
}

// ========== PDF ==========
function exportarReportePDF() {
    if (!lastAnalysisDisponible()) return;
    if (!window.jspdf) { alert('La libreria de exportacion PDF no cargo correctamente. Verifica tu conexion e intenta de nuevo.'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const datos = lastAnalysis;
    const tema = obtenerTema(datos.overallRisk);
    const rgb = hexToRgb(datos.riskColor);
    const margenIzq = 14;
    const anchoUtil = 182;
    let y = 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text('GIS Risk Zulia', margenIzq, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 90);
    doc.text('Reporte de Análisis de Zona de Riesgo', margenIzq, y);
    y += 5;
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    doc.setLineWidth(0.8);
    doc.line(margenIzq, y, margenIzq + anchoUtil, y);
    doc.setLineWidth(0.2);
    y += 8;

    // ---- Indicador de severidad (primero lo que más importa) ----
    if (tema.banner) {
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.rect(0, y, 210, 22, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(tema.etiqueta.toUpperCase(), margenIzq, y + 9);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(tema.nota, margenIzq, y + 16, { maxWidth: anchoUtil });
        doc.setTextColor(20, 20, 20);
        y += 30;
    } else {
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.roundedRect(margenIzq, y, 58, 12, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(tema.etiqueta.toUpperCase(), margenIzq + 4, y + 7.5);
        doc.setTextColor(120, 120, 120);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        const notaLines = doc.splitTextToSize(tema.nota, anchoUtil - 64);
        doc.text(notaLines, margenIzq + 64, y + 5);
        doc.setTextColor(20, 20, 20);
        y += 18;
    }

    // ---- Ubicacion ----
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text('Ubicación', margenIzq, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Nombre: ' + datos.location.name, margenIzq, y); y += 5;
    if (datos.location.address) { doc.text('Dirección: ' + datos.location.address, margenIzq, y); y += 5; }
    doc.text('Municipio: ' + (datos.location.municipality || 'N/D'), margenIzq, y); y += 5;
    doc.text('Coordenadas: ' + datos.location.lat.toFixed(6) + 'N, ' + Math.abs(datos.location.lng).toFixed(6) + 'W', margenIzq, y); y += 5;
    doc.setTextColor(37, 99, 235);
    doc.text('Fuente: ArcGIS World Geocoding Service', margenIzq, y);
    doc.setTextColor(20, 20, 20);
    y += 10;

    // ---- Tabla de factores de riesgo ----
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Factores de Riesgo Detectados (' + datos.risks.length + ')', margenIzq, y);
    y += 4;

    doc.autoTable({
        startY: y,
        head: [['Factor', 'Nivel', 'Descripción']],
        body: datos.risks.map(r => [r.name, r.level === 'high' ? 'ALTO' : 'MEDIO', r.descripcion || '']),
        theme: 'striped',
        headStyles: { fillColor: rgb },
        styles: { fontSize: 9, cellPadding: 2.5 },
        columnStyles: { 2: { cellWidth: 95 } },
        margin: { left: margenIzq, right: margenIzq }
    });
    y = doc.lastAutoTable.finalY + 10;

    // ---- Recomendaciones ----
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Recomendaciones Técnicas', margenIzq, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const recLines = doc.splitTextToSize(datos.recommendation, anchoUtil);
    doc.text(recLines, margenIzq, y);
    y += recLines.length * 5 + 8;

    // ---- Validacion cientifica ----
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Validación con Datos Científicos', margenIzq, y);
    y += 6;

    if (!datos.validacion) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(140, 140, 140);
        doc.text('No disponible al momento de exportar (la consulta a SoilGrids/NASA POWER aun no habia terminado).', margenIzq, y);
        doc.setTextColor(20, 20, 20);
        y += 8;
    } else if (datos.validacion.sinMapeo) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('Ninguno de los factores seleccionados cuenta con fuente de datos científicos automatizada.', margenIzq, y);
        y += 8;
    } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        if (datos.validacion.porcentaje !== null) {
            doc.text('Coincidencia con datos científicos: ' + datos.validacion.porcentaje + '% (calculado sobre ' + datos.validacion.conDatos + ' factor(es) con datos disponibles, de ' + datos.validacion.validados.length + ' con fuente asignada).', margenIzq, y, { maxWidth: anchoUtil });
            y += 9;
        }

        doc.autoTable({
            startY: y,
            head: [['Factor', 'Fuente', 'Veredicto', 'Detalle']],
            body: datos.validacion.validados.map(v => [v.nombre, v.fuente, etiquetaVeredicto(v.veredicto), v.detalle]),
            theme: 'striped',
            headStyles: { fillColor: [5, 150, 105] },
            styles: { fontSize: 7.5, cellPadding: 2 },
            columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 26 }, 2: { cellWidth: 20 }, 3: { cellWidth: 'auto' } },
            margin: { left: margenIzq, right: margenIzq }
        });
        y = doc.lastAutoTable.finalY + 6;

        if (datos.validacion.noValidados > 0) {
            doc.setFontSize(8);
            doc.setTextColor(140, 140, 140);
            const notaLines2 = doc.splitTextToSize(datos.validacion.noValidados + ' factor(es) seleccionados no cuentan aun con fuente de datos científicos automatizada.', anchoUtil);
            doc.text(notaLines2, margenIzq, y);
            y += notaLines2.length * 4 + 4;
        }

        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        const disclaimerLines = doc.splitTextToSize('Validación basada en datos abiertos de SoilGrids (ISRIC) y NASA POWER. Es un indicador de apoyo y no sustituye un estudio de suelo o hidrológico in situ.', anchoUtil);
        doc.text(disclaimerLines, margenIzq, y);
        doc.setTextColor(20, 20, 20);
    }

    // ---- Footer en cada pagina ----
    const totalPaginas = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPaginas; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Generado por: ' + datos.usuario + ' (' + (typeof capitalizeRole === 'function' ? capitalizeRole(datos.rol) : datos.rol) + ') -- ' + datos.generadoEn.toLocaleString('es-ES'), margenIzq, 290);
        doc.text('Página ' + i + ' de ' + totalPaginas, 175, 290);
    }

    doc.save(nombreArchivoBase(datos) + '.pdf');
}

// ========== WORD (.doc via HTML) ==========
function exportarReporteWord() {
    if (!lastAnalysisDisponible()) return;
    const datos = lastAnalysis;
    const tema = obtenerTema(datos.overallRisk);

    let filasRiesgo = '';
    datos.risks.forEach(r => {
        filasRiesgo += '<tr><td>' + r.name + '</td><td>' + (r.level === 'high' ? 'ALTO' : 'MEDIO') + '</td><td>' + (r.descripcion || '') + '</td></tr>';
    });

    let validacionHtml;
    if (!datos.validacion) {
        validacionHtml = '<p><em>No disponible al momento de exportar (la consulta a SoilGrids/NASA POWER aun no habia terminado).</em></p>';
    } else if (datos.validacion.sinMapeo) {
        validacionHtml = '<p><em>Ninguno de los factores seleccionados cuenta con fuente de datos científicos automatizada.</em></p>';
    } else {
        let filasValidacion = '';
        datos.validacion.validados.forEach(v => {
            filasValidacion += '<tr><td>' + v.nombre + '</td><td>' + v.fuente + '</td><td>' + etiquetaVeredicto(v.veredicto) + '</td><td>' + v.detalle + '</td></tr>';
        });
        const resumen = datos.validacion.porcentaje !== null
            ? '<p><strong>Coincidencia con datos científicos: ' + datos.validacion.porcentaje + '%</strong> (calculado sobre ' + datos.validacion.conDatos + ' factor(es) con datos disponibles, de ' + datos.validacion.validados.length + ' con fuente asignada)</p>'
            : '';
        const nota = datos.validacion.noValidados > 0
            ? '<p style="font-size:9pt;color:#888;">' + datos.validacion.noValidados + ' factor(es) seleccionados no cuentan aun con fuente de datos científicos automatizada.</p>'
            : '';
        validacionHtml = resumen +
            '<table class="tabla-validacion"><tr><th>Factor</th><th>Fuente</th><th>Veredicto</th><th>Detalle</th></tr>' + filasValidacion + '</table>' +
            nota +
            '<p style="font-size:9pt;color:#888;">Validación basada en datos abiertos de SoilGrids (ISRIC) y NASA POWER. Es un indicador de apoyo y no sustituye un estudio de suelo o hidrológico in situ.</p>';
    }

    const indicadorHtml = tema.banner
        ? '<div style="background:' + datos.riskColor + ';color:white;padding:14px 18px;border-radius:4px;margin:14px 0 18px;">' +
          '<div style="font-size:14pt;font-weight:bold;letter-spacing:0.5px;">' + tema.etiqueta.toUpperCase() + '</div>' +
          '<div style="font-size:10pt;margin-top:4px;">' + tema.nota + '</div></div>'
        : '<p style="margin:14px 0 18px;"><span class="badge">' + tema.etiqueta.toUpperCase() + '</span> ' +
          '<span style="font-size:9.5pt;color:#777;font-style:italic;margin-left:8px;">' + tema.nota + '</span></p>';

    const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
        '<head><meta charset="utf-8"><title>Reporte de Riesgo</title>' +
        '<style>' +
        'body{font-family:Calibri,Arial,sans-serif;color:#1a1a1a;}' +
        'h1{color:#1e3a8a;margin-bottom:0;} h2{color:#1e3a8a;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-top:22px;}' +
        'table{border-collapse:collapse;width:100%;margin-bottom:10px;}' +
        'td,th{border:1px solid #ccc;padding:6px;font-size:10pt;text-align:left;vertical-align:top;}' +
        'table:not(.tabla-validacion) th{background:' + datos.riskColor + ';color:white;}' +
        '.tabla-validacion th{background:#059669;color:white;}' +
        '.badge{display:inline-block;padding:6px 14px;border-radius:6px;color:white;font-weight:bold;background:' + datos.riskColor + ';}' +
        '</style></head><body>' +
        '<h1>GIS Risk Zulia</h1><p>Reporte de Análisis de Zona de Riesgo</p><hr>' +
        indicadorHtml +
        '<h2>Ubicación</h2>' +
        '<p><strong>Nombre:</strong> ' + datos.location.name + '<br>' +
        (datos.location.address ? '<strong>Dirección:</strong> ' + datos.location.address + '<br>' : '') +
        '<strong>Municipio:</strong> ' + (datos.location.municipality || 'N/D') + '<br>' +
        '<strong>Coordenadas:</strong> ' + datos.location.lat.toFixed(6) + 'N, ' + Math.abs(datos.location.lng).toFixed(6) + 'W<br>' +
        '<strong>Fuente:</strong> ArcGIS World Geocoding Service</p>' +
        '<h2>Factores de Riesgo Detectados (' + datos.risks.length + ')</h2>' +
        '<table><tr><th>Factor</th><th>Nivel</th><th>Descripción</th></tr>' + filasRiesgo + '</table>' +
        '<h2>Recomendaciones Técnicas</h2><p>' + datos.recommendation + '</p>' +
        '<h2>Validación con Datos Científicos</h2>' + validacionHtml +
        '<p style="font-size:9pt;color:#888;margin-top:20px;">Generado por: ' + datos.usuario + ' (' + (typeof capitalizeRole === 'function' ? capitalizeRole(datos.rol) : datos.rol) + ') -- ' + datos.generadoEn.toLocaleString('es-ES') + '</p>' +
        '</body></html>';

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivoBase(datos) + '.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

window.exportarReportePDF = exportarReportePDF;
window.exportarReporteWord = exportarReporteWord;
