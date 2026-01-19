# Matriz de Permisos por Rol - Versión Actualizada

**Fecha**: 2025-01-15
**Total de Permisos**: 45
**Total de Roles**: 9

---

## Leyenda
- ✅ = Tiene el permiso
- ❌ = No tiene el permiso
- ⭐ = Permiso nuevo agregado

---

## Tabla Completa de Permisos por Rol

### PERSON.INFO (9 permisos)

| # | Permiso | SUPER_ADMIN | ADMIN | ADVISOR | COMERCIAL | APROBADOR | TALERO | FINANCIERO | SERVICIO | READONLY |
|---|---------|-------------|-------|---------|-----------|-----------|--------|------------|----------|----------|
| 1 | PERSON.INFO.DESCARGAR_CONTRATO | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| 2 | PERSON.INFO.VER_DOCUMENTACION | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| 3 | PERSON.INFO.ADICION_DOCUMENTACION | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 4 | PERSON.INFO.CAMBIO_CELULAR | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 5 | PERSON.INFO.CAMBIAR_ESTADO | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 6 | PERSON.INFO.MODIFICAR | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 7 | PERSON.INFO.AGREGAR_BENEFICIARIO | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 8 | PERSON.INFO.WHATSAPP | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| 9 | PERSON.INFO.ELIMINAR | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

### STUDENT.GLOBAL (3 permisos)

| # | Permiso | SUPER_ADMIN | ADMIN | ADVISOR | COMERCIAL | APROBADOR | TALERO | FINANCIERO | SERVICIO | READONLY |
|---|---------|-------------|-------|---------|-----------|-----------|--------|------------|----------|----------|
| 10 | STUDENT.GLOBAL.ENVIAR_MENSAJE | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| 11 | STUDENT.GLOBAL.CONSULTA_CONTRATO | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| 12 | STUDENT.GLOBAL.GENERAR_ESTADO_CUENTA | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |

---

### STUDENT.ACADEMIA (3 permisos)

| # | Permiso | SUPER_ADMIN | ADMIN | ADVISOR | COMERCIAL | APROBADOR | TALERO | FINANCIERO | SERVICIO | READONLY |
|---|---------|-------------|-------|---------|-----------|-----------|--------|------------|----------|----------|
| 13 | STUDENT.ACADEMIA.EVALUACION | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 14 | STUDENT.ACADEMIA.AGENDAR_CLASE | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 15 | STUDENT.ACADEMIA.MARCAR_STEP | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

### ACADEMICO.AGENDA (9 permisos)

| # | Permiso | SUPER_ADMIN | ADMIN | ADVISOR | COMERCIAL | APROBADOR | TALERO | FINANCIERO | SERVICIO | READONLY |
|---|---------|-------------|-------|---------|-----------|-----------|--------|------------|----------|----------|
| 16 | ACADEMICO.AGENDA.VER_CALENDARIO | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 17 | ACADEMICO.AGENDA.VER_AGENDA | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 18 | ACADEMICO.AGENDA.FILTRO | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 19 | ACADEMICO.AGENDA.NUEVO_EVENTO | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 20 | ACADEMICO.AGENDA.EDITAR | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 21 | ACADEMICO.AGENDA.ELIMINAR | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 22 | ACADEMICO.AGENDA.CREAR_EVENTO | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 23 | ACADEMICO.AGENDA.VER_AGENDA_ACADEMICA | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 24 | ACADEMICO.AGENDA.VER_ENLACE | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

### ACADEMICO.ADVISOR (4 permisos) ⭐ NUEVOS

| # | Permiso | SUPER_ADMIN | ADMIN | ADVISOR | COMERCIAL | APROBADOR | TALERO | FINANCIERO | SERVICIO | READONLY |
|---|---------|-------------|-------|---------|-----------|-----------|--------|------------|----------|----------|
| 25 | ACADEMICO.ADVISOR.LISTA_VER ⭐ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| 26 | ACADEMICO.ADVISOR.VER_ENLACE ⭐ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 27 | ACADEMICO.ADVISOR.AGREGAR ⭐ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 28 | ACADEMICO.ADVISOR.ESTADISTICA ⭐ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

### SERVICIO.WELCOME (2 permisos)

| # | Permiso | SUPER_ADMIN | ADMIN | ADVISOR | COMERCIAL | APROBADOR | TALERO | FINANCIERO | SERVICIO | READONLY |
|---|---------|-------------|-------|---------|-----------|-----------|--------|------------|----------|----------|
| 29 | SERVICIO.WELCOME.CARGAR_EVENTOS | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 30 | SERVICIO.WELCOME.EXPORTAR_CSV | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

---

### SERVICIO.SESIONES (2 permisos)

| # | Permiso | SUPER_ADMIN | ADMIN | ADVISOR | COMERCIAL | APROBADOR | TALERO | FINANCIERO | SERVICIO | READONLY |
|---|---------|-------------|-------|---------|-----------|-----------|--------|------------|----------|----------|
| 31 | SERVICIO.SESIONES.CARGAR_EVENTOS | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 32 | SERVICIO.SESIONES.EXPORTAR_CSV | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

---

### SERVICIO.USUARIOS (2 permisos)

| # | Permiso | SUPER_ADMIN | ADMIN | ADVISOR | COMERCIAL | APROBADOR | TALERO | FINANCIERO | SERVICIO | READONLY |
|---|---------|-------------|-------|---------|-----------|-----------|--------|------------|----------|----------|
| 33 | SERVICIO.USUARIOS.ACTUALIZAR | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| 34 | SERVICIO.USUARIOS.EXPORTAR_CSV | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

---

### COMERCIAL.CONTRATO (4 permisos)

| # | Permiso | SUPER_ADMIN | ADMIN | ADVISOR | COMERCIAL | APROBADOR | TALERO | FINANCIERO | SERVICIO | READONLY |
|---|---------|-------------|-------|---------|-----------|-----------|--------|------------|----------|----------|
| 35 | COMERCIAL.CONTRATO.MODIFICAR | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 36 | COMERCIAL.CONTRATO.ENVIAR_PDF | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 37 | COMERCIAL.CONTRATO.DESCARGAR | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 38 | COMERCIAL.CONTRATO.APROBACION_AUTONOMA | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

### COMERCIAL.PROSPECTOS (1 permiso)

| # | Permiso | SUPER_ADMIN | ADMIN | ADVISOR | COMERCIAL | APROBADOR | TALERO | FINANCIERO | SERVICIO | READONLY |
|---|---------|-------------|-------|---------|-----------|-----------|--------|------------|----------|----------|
| 39 | COMERCIAL.PROSPECTOS.VER | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

### APROBACION.MODIFICAR (6 permisos)

| # | Permiso | SUPER_ADMIN | ADMIN | ADVISOR | COMERCIAL | APROBADOR | TALERO | FINANCIERO | SERVICIO | READONLY |
|---|---------|-------------|-------|---------|-----------|-----------|--------|------------|----------|----------|
| 40 | APROBACION.MODIFICAR.ACTUALIZAR | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 41 | APROBACION.MODIFICAR.EXPORTAR_CSV | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 42 | APROBACION.MODIFICAR.CONTRATO | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 43 | APROBACION.MODIFICAR.ENVIAR_PDF | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 44 | APROBACION.MODIFICAR.DESCARGAR | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 45 | APROBACION.MODIFICAR.APROBACION_AUTONOMA | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Resumen de Permisos por Rol

| Rol | Total Permisos | % del Total | Módulos con Acceso |
|-----|----------------|-------------|-------------------|
| SUPER_ADMIN | 45 | 100% | PERSON (9), STUDENT (6), ACADEMICO (13), SERVICIO (6), COMERCIAL (5), APROBACION (6) |
| ADMIN | 44 | 98% | PERSON (8 - sin ELIMINAR), STUDENT (6), ACADEMICO (13), SERVICIO (6), COMERCIAL (5), APROBACION (6) |
| ADVISOR | 18 | 40% | PERSON (2), STUDENT (4), ACADEMICO (11), SERVICIO.WELCOME (2) |
| COMERCIAL | 21 | 47% | PERSON (6), STUDENT (3), COMERCIAL (5), APROBACION (6) |
| APROBADOR | 12 | 27% | PERSON (3), STUDENT (3), APROBACION (6) |
| TALERO | 1 | 2% | ACADEMICO.ADVISOR (1) |
| FINANCIERO | 4 | 9% | PERSON (2), STUDENT (2) |
| SERVICIO | 9 | 20% | PERSON (2), STUDENT (1), SERVICIO (6) |
| READONLY | 2 | 4% | PERSON (1), STUDENT (1) |

---

## Acceso a Secciones del Dashboard

| Sección | SUPER_ADMIN | ADMIN | ADVISOR | COMERCIAL | APROBADOR | TALERO | FINANCIERO | SERVICIO | READONLY |
|---------|-------------|-------|---------|-----------|-----------|--------|------------|----------|----------|
| **Académico** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| - Agenda Sesiones | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| - Agenda Académica | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| - Advisors | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Servicio** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| - Welcome Session | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| - Lista Sesiones | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| - Sin Registro | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Comercial** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| - Crear Contrato | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| - Prospectos | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Aprobación** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Casos de Uso por Rol

### SUPER_ADMIN (45 permisos - 100%)
**Usuario**: Administrador del sistema
**Acceso**: Todo el sistema sin restricciones
**Puede**:
- Gestionar personas (incluido eliminar)
- Gestionar estudiantes y contratos
- Ver y modificar agenda académica
- Gestionar advisors
- Ver y gestionar servicios
- Aprobar contratos
- Acceder a todas las secciones

### ADMIN (44 permisos - 98%)
**Usuario**: Administrador operativo
**Acceso**: Casi todo (sin eliminar personas)
**Puede**:
- Todo lo que SUPER_ADMIN excepto eliminar personas
- Gestión completa de estudiantes y contratos
- Gestión académica completa
- Gestión de servicios
- Aprobaciones

### ADVISOR (18 permisos - 40%)
**Usuario**: Asesor académico
**Acceso**: Académico + Welcome Sessions
**Puede**:
- Ver documentación de personas
- Enviar mensajes a estudiantes
- Evaluar y agendar clases
- Ver y gestionar agenda académica
- Ver lista de advisors
- Acceder a panel de advisor
- Cargar eventos de welcome session

**No puede**:
- Modificar datos de personas
- Gestionar contratos
- Aprobar documentos
- Acceder a sesiones completas de servicio

### COMERCIAL (21 permisos - 47%)
**Usuario**: Área comercial
**Acceso**: Comercial + Aprobación
**Puede**:
- Modificar datos de personas
- Consultar contratos de estudiantes
- Crear y modificar contratos
- Enviar y descargar PDFs
- Aprobar contratos
- Ver prospectos

**No puede**:
- Gestionar agenda académica
- Acceder a servicios
- Eliminar personas

### APROBADOR (12 permisos - 27%)
**Usuario**: Aprobador de contratos
**Acceso**: Solo aprobación y consulta
**Puede**:
- Ver documentación
- Consultar contratos
- Aprobar y actualizar contratos
- Exportar información

**No puede**:
- Modificar datos de personas
- Gestionar agenda académica
- Acceder a servicios
- Crear contratos nuevos

### TALERO (1 permiso - 2%) ⚠️ ROL RESTRINGIDO
**Usuario**: Usuario limitado
**Acceso**: Solo lista de advisors
**Puede**:
- Ver lista de advisors

**No puede**:
- TODO lo demás

**Nota**: Este es el rol más restrictivo del sistema.

### FINANCIERO (4 permisos - 9%)
**Usuario**: Área financiera
**Acceso**: Solo consultas financieras
**Puede**:
- Descargar contratos
- Ver documentación
- Consultar contratos
- Generar estados de cuenta

**No puede**:
- Modificar nada
- Gestionar estudiantes
- Acceder a secciones operativas

### SERVICIO (9 permisos - 20%)
**Usuario**: Área de servicio al cliente
**Acceso**: Servicios + consulta básica
**Puede**:
- Ver documentación
- Enviar WhatsApp
- Enviar mensajes a estudiantes
- Cargar eventos de welcome y sesiones
- Actualizar usuarios
- Exportar información

**No puede**:
- Modificar datos de personas
- Gestionar contratos
- Acceder a académico o comercial

### READONLY (2 permisos - 4%)
**Usuario**: Solo lectura
**Acceso**: Mínimo del sistema
**Puede**:
- Ver documentación
- Consultar contratos

**No puede**:
- Modificar NADA
- Acceder a secciones operativas

---

## Permisos Únicos por Rol

### Permisos que SOLO tiene SUPER_ADMIN
```
1. PERSON.INFO.ELIMINAR (el único que puede eliminar personas)
```

### Permisos que SOLO tiene TALERO
```
Ninguno - TALERO solo tiene ACADEMICO.ADVISOR.LISTA_VER que también tienen SUPER_ADMIN, ADMIN y ADVISOR
```

### Permisos compartidos por menos roles (exclusivos)

**PERSON.INFO.ELIMINAR**: Solo SUPER_ADMIN
**ACADEMICO.AGENDA.ELIMINAR**: Solo SUPER_ADMIN y ADMIN
**ACADEMICO.ADVISOR.AGREGAR**: Solo SUPER_ADMIN y ADMIN
**ACADEMICO.ADVISOR.ESTADISTICA**: Solo SUPER_ADMIN y ADMIN

---

**Última actualización**: 2025-01-15
**Fuente**: ROL_PERMISOS_ACTUALIZADO.csv
