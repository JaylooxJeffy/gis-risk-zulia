-- ============================================================================
-- SCRIPT DE CREACIÓN DE BASE DE DATOS - GIS RISK ZULIA
-- Sistema de Información Geográfica para Gestión de Zonas de Riesgo
-- ============================================================================


-- Habilitar extensión PostGIS para funcionalidades geoespaciales
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER USER postgres WITH PASSWORD '1010';

-- Verificar versión de PostGIS
SELECT PostGIS_Version();

-- ============================================================================
-- TABLA: usuarios
-- Almacena todos los usuarios del sistema (consultores, analistas, admins)
-- ============================================================================

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('consultor', 'analista', 'administrador')),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMP
);

-- Índices para optimizar búsquedas
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_username ON usuarios(username);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);

-- Comentarios descriptivos
COMMENT ON TABLE usuarios IS 'Tabla de usuarios del sistema GIS Risk Zulia';
COMMENT ON COLUMN usuarios.rol IS 'Roles: consultor (usuario común), analista (reportes), administrador (control total)';
COMMENT ON COLUMN usuarios.activo IS 'Indica si el usuario está activo o ha sido desactivado';

-- ============================================================================
-- TABLA: solicitudes_pendientes
-- Almacena solicitudes de registro para analistas y administradores
-- ============================================================================

CREATE TABLE solicitudes_pendientes (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    nombre_usuario VARCHAR(50) NOT NULL,
    rol_solicitado VARCHAR(20) NOT NULL CHECK (rol_solicitado IN ('analista', 'administrador')),
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
    fecha_procesamiento TIMESTAMP,
    procesado_por INTEGER REFERENCES usuarios(id)
);

-- Índices
CREATE INDEX idx_solicitudes_email ON solicitudes_pendientes(email);
CREATE INDEX idx_solicitudes_estado ON solicitudes_pendientes(estado);
CREATE INDEX idx_solicitudes_fecha ON solicitudes_pendientes(fecha_solicitud DESC);

-- Comentarios
COMMENT ON TABLE solicitudes_pendientes IS 'Solicitudes de registro para roles especiales (analista/admin)';
COMMENT ON COLUMN solicitudes_pendientes.estado IS 'Estados: pendiente, aprobada, rechazada';

-- ============================================================================
-- TABLA: codigos_acceso
-- Almacena códigos temporales de acceso para completar registro
-- ============================================================================

CREATE TABLE codigos_acceso (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(16) UNIQUE NOT NULL,
    email_usuario VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('analista', 'administrador')),
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    fecha_uso TIMESTAMP,
    id_solicitud INTEGER REFERENCES solicitudes_pendientes(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX idx_codigos_codigo ON codigos_acceso(codigo);
CREATE INDEX idx_codigos_email ON codigos_acceso(email_usuario);
CREATE INDEX idx_codigos_usado ON codigos_acceso(usado);
CREATE INDEX idx_codigos_expiracion ON codigos_acceso(fecha_expiracion);

-- Comentarios
COMMENT ON TABLE codigos_acceso IS 'Códigos temporales para completar registro de usuarios especiales';
COMMENT ON COLUMN codigos_acceso.fecha_expiracion IS 'Los códigos expiran en 10 minutos por defecto';
COMMENT ON COLUMN codigos_acceso.usado IS 'Indica si el código ya fue utilizado';

-- ============================================================================
-- TABLA: zonas_riesgo (para el sistema GIS)
-- Almacena información geoespacial de zonas de riesgo
-- ============================================================================

CREATE TABLE zonas_riesgo (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    ubicacion GEOMETRY(Point, 4326) NOT NULL, -- PostGIS: punto geográfico
    nivel_riesgo VARCHAR(20) CHECK (nivel_riesgo IN ('bajo', 'medio', 'alto', 'muy_alto')),
    tipo_riesgo VARCHAR(50), -- inundación, deslizamiento, etc.
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    registrado_por INTEGER REFERENCES usuarios(id),
    activo BOOLEAN DEFAULT TRUE,
    ultima_actualizacion TIMESTAMP
);

-- Índice espacial (PostGIS)
CREATE INDEX idx_zonas_ubicacion ON zonas_riesgo USING GIST(ubicacion);
CREATE INDEX idx_zonas_nivel_riesgo ON zonas_riesgo(nivel_riesgo);
CREATE INDEX idx_zonas_tipo_riesgo ON zonas_riesgo(tipo_riesgo);

-- Comentarios
COMMENT ON TABLE zonas_riesgo IS 'Zonas de riesgo identificadas en el Estado Zulia';
COMMENT ON COLUMN zonas_riesgo.ubicacion IS 'Coordenadas geográficas (latitud, longitud) en formato PostGIS';

-- ============================================================================
-- TABLA: reportes
-- Almacena reportes generados por analistas
-- ============================================================================

CREATE TABLE reportes (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    contenido TEXT NOT NULL,
    zona_riesgo_id INTEGER REFERENCES zonas_riesgo(id),
    creado_por INTEGER REFERENCES usuarios(id),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicado', 'archivado'))
);

-- Índices
CREATE INDEX idx_reportes_creador ON reportes(creado_por);
CREATE INDEX idx_reportes_zona ON reportes(zona_riesgo_id);
CREATE INDEX idx_reportes_estado ON reportes(estado);
CREATE INDEX idx_reportes_fecha ON reportes(fecha_creacion DESC);

-- Comentarios
COMMENT ON TABLE reportes IS 'Reportes de análisis generados por usuarios con rol analista';

-- ============================================================================
-- TABLA: auditoria
-- Registro de acciones importantes en el sistema
-- ============================================================================

CREATE TABLE auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    accion VARCHAR(100) NOT NULL,
    tabla_afectada VARCHAR(50),
    registro_id INTEGER,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    detalles JSONB
);

-- Índices
CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_fecha ON auditoria(fecha DESC);
CREATE INDEX idx_auditoria_accion ON auditoria(accion);

-- Comentarios
COMMENT ON TABLE auditoria IS 'Registro de auditoría de acciones en el sistema';

-- ============================================================================
-- TRIGGERS Y FUNCIONES
-- ============================================================================

-- Función para actualizar timestamp de última actualización
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.ultima_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para zonas_riesgo
CREATE TRIGGER trigger_actualizar_zona
BEFORE UPDATE ON zonas_riesgo
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp();

-- Función para registrar en auditoría cuando se procesa una solicitud
CREATE OR REPLACE FUNCTION registrar_procesamiento_solicitud()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado != OLD.estado AND NEW.estado IN ('aprobada', 'rechazada') THEN
        NEW.fecha_procesamiento = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para solicitudes_pendientes
CREATE TRIGGER trigger_procesar_solicitud
BEFORE UPDATE ON solicitudes_pendientes
FOR EACH ROW
EXECUTE FUNCTION registrar_procesamiento_solicitud();

-- ============================================================================
-- DATOS INICIALES (OPCIONAL)
-- ============================================================================

-- Crear usuario administrador inicial (contraseña: admin123)
-- Hash generado con bcrypt para 'admin123'
INSERT INTO usuarios (username, email, password_hash, rol) VALUES
('admin', 'admin@gisrisk.com', '$2b$10$8K1p/a0dL6kcPhRKPWKiOeqhcNvSY7.Y7iFxJC5q7CqZJQ3.v6wAi', 'administrador');

-- ============================================================================
-- VISTAS ÚTILES
-- ============================================================================

-- Vista de estadísticas de solicitudes
CREATE OR REPLACE VIEW vista_estadisticas_solicitudes AS
SELECT 
    estado,
    rol_solicitado,
    COUNT(*) as total
FROM solicitudes_pendientes
GROUP BY estado, rol_solicitado;

-- Vista de zonas de riesgo con información del registrador
CREATE OR REPLACE VIEW vista_zonas_completa AS
SELECT 
    z.id,
    z.nombre,
    z.descripcion,
    ST_Y(z.ubicacion::geometry) as latitud,
    ST_X(z.ubicacion::geometry) as longitud,
    z.nivel_riesgo,
    z.tipo_riesgo,
    z.fecha_registro,
    u.username as registrado_por_username,
    z.activo
FROM zonas_riesgo z
LEFT JOIN usuarios u ON z.registrado_por = u.id;

-- ============================================================================
-- PERMISOS (Ajustar según necesidad)
-- ============================================================================

-- Otorgar permisos al usuario postgres (o crear un usuario específico)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================

-- Verificar que todo se creó correctamente
SELECT 
    'Tablas creadas' as tipo,
    COUNT(*) as total 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 
    'Índices creados' as tipo,
    COUNT(*) as total 
FROM pg_indexes 
WHERE schemaname = 'public';

-- Mostrar todas las tablas creadas
--\dt

-- Mostrar todas las vistas creadas
--\dv

COMMENT ON DATABASE gis_risk_db IS 'Base de datos del Sistema de Información Geográfica GIS Risk Zulia - Gestión de Zonas de Riesgo';

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
