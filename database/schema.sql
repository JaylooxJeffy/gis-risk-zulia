--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: postgis_raster; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_raster WITH SCHEMA public;


--
-- Name: EXTENSION postgis_raster; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis_raster IS 'PostGIS raster types and functions';


--
-- Name: actualizar_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.actualizar_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.ultima_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: registrar_procesamiento_solicitud(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_procesamiento_solicitud() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.estado != OLD.estado AND NEW.estado IN ('aprobada', 'rechazada') THEN
        NEW.fecha_procesamiento = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria (
    id integer NOT NULL,
    usuario_id integer,
    accion character varying(100) NOT NULL,
    tabla_afectada character varying(50),
    registro_id integer,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ip_address character varying(45),
    detalles jsonb
);


--
-- Name: TABLE auditoria; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.auditoria IS 'Registro de auditoría de acciones en el sistema';


--
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditoria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditoria_id_seq OWNED BY public.auditoria.id;


--
-- Name: codigos_acceso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.codigos_acceso (
    id integer NOT NULL,
    codigo character varying(16) NOT NULL,
    email_usuario character varying(100) NOT NULL,
    rol character varying(20) NOT NULL,
    fecha_generacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion timestamp without time zone NOT NULL,
    usado boolean DEFAULT false,
    fecha_uso timestamp without time zone,
    id_solicitud integer,
    CONSTRAINT codigos_acceso_rol_check CHECK (((rol)::text = ANY ((ARRAY['analista'::character varying, 'administrador'::character varying])::text[])))
);


--
-- Name: TABLE codigos_acceso; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.codigos_acceso IS 'Códigos temporales para completar registro de usuarios especiales';


--
-- Name: COLUMN codigos_acceso.fecha_expiracion; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.codigos_acceso.fecha_expiracion IS 'Los códigos expiran en 10 minutos por defecto';


--
-- Name: COLUMN codigos_acceso.usado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.codigos_acceso.usado IS 'Indica si el código ya fue utilizado';


--
-- Name: codigos_acceso_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.codigos_acceso_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: codigos_acceso_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.codigos_acceso_id_seq OWNED BY public.codigos_acceso.id;


--
-- Name: factores_riesgo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.factores_riesgo (
    id integer NOT NULL,
    nombre character varying(200) NOT NULL,
    descripcion text,
    nivel character varying(10) NOT NULL,
    categoria character varying(50),
    activo boolean DEFAULT true,
    creado_por integer,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT factores_riesgo_nivel_check CHECK (((nivel)::text = ANY ((ARRAY['high'::character varying, 'medium'::character varying])::text[])))
);


--
-- Name: factores_riesgo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.factores_riesgo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: factores_riesgo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.factores_riesgo_id_seq OWNED BY public.factores_riesgo.id;


--
-- Name: solicitudes_pendientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_pendientes (
    id integer NOT NULL,
    email character varying(100) NOT NULL,
    nombre_usuario character varying(50) NOT NULL,
    rol_solicitado character varying(20) NOT NULL,
    fecha_solicitud timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    fecha_procesamiento timestamp without time zone,
    procesado_por integer,
    CONSTRAINT solicitudes_pendientes_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'aprobada'::character varying, 'rechazada'::character varying])::text[]))),
    CONSTRAINT solicitudes_pendientes_rol_solicitado_check CHECK (((rol_solicitado)::text = ANY ((ARRAY['analista'::character varying, 'administrador'::character varying])::text[])))
);


--
-- Name: TABLE solicitudes_pendientes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.solicitudes_pendientes IS 'Solicitudes de registro para roles especiales (analista/admin)';


--
-- Name: COLUMN solicitudes_pendientes.estado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.solicitudes_pendientes.estado IS 'Estados: pendiente, aprobada, rechazada';


--
-- Name: solicitudes_pendientes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitudes_pendientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitudes_pendientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitudes_pendientes_id_seq OWNED BY public.solicitudes_pendientes.id;


--
-- Name: ubicaciones_guardadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ubicaciones_guardadas (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    direccion text,
    municipio character varying(255),
    lat numeric(10,8) NOT NULL,
    lng numeric(11,8) NOT NULL,
    notas text DEFAULT ''::text,
    factores jsonb DEFAULT '[]'::jsonb,
    nivel_riesgo character varying(50),
    color_riesgo character varying(20),
    recomendacion text,
    validacion jsonb,
    fecha_guardado timestamp without time zone DEFAULT now()
);


--
-- Name: ubicaciones_guardadas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ubicaciones_guardadas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ubicaciones_guardadas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ubicaciones_guardadas_id_seq OWNED BY public.ubicaciones_guardadas.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    rol character varying(20) NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    activo boolean DEFAULT true,
    ultimo_acceso timestamp without time zone,
    password_temporal boolean DEFAULT false,
    delegado boolean DEFAULT false,
    CONSTRAINT usuarios_rol_check CHECK (((rol)::text = ANY ((ARRAY['consultor'::character varying, 'analista'::character varying, 'administrador'::character varying])::text[])))
);


--
-- Name: TABLE usuarios; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.usuarios IS 'Tabla de usuarios del sistema GIS Risk Zulia';


--
-- Name: COLUMN usuarios.rol; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.usuarios.rol IS 'Roles: consultor (usuario común), analista (reportes), administrador (control total)';


--
-- Name: COLUMN usuarios.activo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.usuarios.activo IS 'Indica si el usuario está activo o ha sido desactivado';


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: vista_estadisticas_solicitudes; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vista_estadisticas_solicitudes AS
 SELECT estado,
    rol_solicitado,
    count(*) AS total
   FROM public.solicitudes_pendientes
  GROUP BY estado, rol_solicitado;


--
-- Name: auditoria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria ALTER COLUMN id SET DEFAULT nextval('public.auditoria_id_seq'::regclass);


--
-- Name: codigos_acceso id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codigos_acceso ALTER COLUMN id SET DEFAULT nextval('public.codigos_acceso_id_seq'::regclass);


--
-- Name: factores_riesgo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.factores_riesgo ALTER COLUMN id SET DEFAULT nextval('public.factores_riesgo_id_seq'::regclass);


--
-- Name: solicitudes_pendientes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_pendientes ALTER COLUMN id SET DEFAULT nextval('public.solicitudes_pendientes_id_seq'::regclass);


--
-- Name: ubicaciones_guardadas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubicaciones_guardadas ALTER COLUMN id SET DEFAULT nextval('public.ubicaciones_guardadas_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: codigos_acceso codigos_acceso_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codigos_acceso
    ADD CONSTRAINT codigos_acceso_codigo_key UNIQUE (codigo);


--
-- Name: codigos_acceso codigos_acceso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codigos_acceso
    ADD CONSTRAINT codigos_acceso_pkey PRIMARY KEY (id);


--
-- Name: factores_riesgo factores_riesgo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.factores_riesgo
    ADD CONSTRAINT factores_riesgo_pkey PRIMARY KEY (id);


--
-- Name: solicitudes_pendientes solicitudes_pendientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_pendientes
    ADD CONSTRAINT solicitudes_pendientes_pkey PRIMARY KEY (id);


--
-- Name: ubicaciones_guardadas ubicaciones_guardadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubicaciones_guardadas
    ADD CONSTRAINT ubicaciones_guardadas_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_email_rol_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_rol_unique UNIQUE (email, rol);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_username_key UNIQUE (username);


--
-- Name: idx_auditoria_accion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_accion ON public.auditoria USING btree (accion);


--
-- Name: idx_auditoria_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_fecha ON public.auditoria USING btree (fecha DESC);


--
-- Name: idx_auditoria_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_usuario ON public.auditoria USING btree (usuario_id);


--
-- Name: idx_codigos_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_codigos_codigo ON public.codigos_acceso USING btree (codigo);


--
-- Name: idx_codigos_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_codigos_email ON public.codigos_acceso USING btree (email_usuario);


--
-- Name: idx_codigos_expiracion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_codigos_expiracion ON public.codigos_acceso USING btree (fecha_expiracion);


--
-- Name: idx_codigos_usado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_codigos_usado ON public.codigos_acceso USING btree (usado);


--
-- Name: idx_solicitudes_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solicitudes_email ON public.solicitudes_pendientes USING btree (email);


--
-- Name: idx_solicitudes_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solicitudes_estado ON public.solicitudes_pendientes USING btree (estado);


--
-- Name: idx_solicitudes_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_solicitudes_fecha ON public.solicitudes_pendientes USING btree (fecha_solicitud DESC);


--
-- Name: idx_ubicaciones_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ubicaciones_usuario ON public.ubicaciones_guardadas USING btree (usuario_id);


--
-- Name: idx_usuarios_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_email ON public.usuarios USING btree (email);


--
-- Name: idx_usuarios_rol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_rol ON public.usuarios USING btree (rol);


--
-- Name: idx_usuarios_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuarios_username ON public.usuarios USING btree (username);


--
-- Name: solicitudes_pendientes trigger_procesar_solicitud; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_procesar_solicitud BEFORE UPDATE ON public.solicitudes_pendientes FOR EACH ROW EXECUTE FUNCTION public.registrar_procesamiento_solicitud();


--
-- Name: auditoria auditoria_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: codigos_acceso codigos_acceso_id_solicitud_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codigos_acceso
    ADD CONSTRAINT codigos_acceso_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_pendientes(id) ON DELETE CASCADE;


--
-- Name: factores_riesgo factores_riesgo_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.factores_riesgo
    ADD CONSTRAINT factores_riesgo_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(id);


--
-- Name: solicitudes_pendientes solicitudes_pendientes_procesado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_pendientes
    ADD CONSTRAINT solicitudes_pendientes_procesado_por_fkey FOREIGN KEY (procesado_por) REFERENCES public.usuarios(id);


--
-- Name: ubicaciones_guardadas ubicaciones_guardadas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubicaciones_guardadas
    ADD CONSTRAINT ubicaciones_guardadas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


