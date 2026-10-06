-- Tabla para ubicaciones guardadas por analistas (y administradores)
-- Ejecutar una sola vez en la base de datos de GIS Risk Zulia.
CREATE TABLE IF NOT EXISTS ubicaciones_guardadas (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre          VARCHAR(255) NOT NULL,
    direccion       TEXT,
    municipio       VARCHAR(255),
    lat             DECIMAL(10, 8) NOT NULL,
    lng             DECIMAL(11, 8) NOT NULL,
    notas           TEXT DEFAULT '',
    factores        JSONB DEFAULT '[]',
    nivel_riesgo    VARCHAR(50),
    color_riesgo    VARCHAR(20),
    recomendacion   TEXT,
    validacion      JSONB,
    fecha_guardado  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ubicaciones_usuario ON ubicaciones_guardadas(usuario_id);
