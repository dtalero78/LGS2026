import { sendmessage } from 'backend/realtime.jsw';
import { searchPeopleAndAcademica, getPersonByContrato, getPersonById, getStudentById, updateClass, deleteClass, getRelatedPersons, getFinancialDataByContrato, approveBeneficiario, createNewBeneficiario, updateBeneficiario, deleteBeneficiario, inactivateBeneficiario, inactivateUser, toggleUserStatus, toggleContractStatus, toggleOnHoldStatus, extendStudentVigencia, updateTitularEstado, getCalendarioEventos, createClassEvent, createBookingEvent, updateStudentStep, cargarStepsDelNivel, createStepOverride, deleteStepOverride, testStepOverrideByIdEnAcademica, updateOnHold, getWelcomeEvents, getAllClassSessions, getAdvisors, getAdvisorById, getAdvisorByEmail, getCalendarioEvents, getCalendarioEventsByAdvisor, getCalendarioEventsByAdvisorAndDay, getEventBookings, getEventUsersByCriteria, getEventBookingsByCriteria, getContracts, getEventInscritosCount, getMultipleEventsInscritosCount, createCalendarioEvent, updateCalendarioEvent, deleteCalendarioEvent, getNiveles, updateAprobacion, getContractosByTipo, getBeneficiariosSinRegistro, addCommentToPerson, getPersonComments, restorePersonData, getTopStudentsThisMonth, getAdvisorStats, createPerson, createFinancial, getContractsByPattern, getPendingApprovals, getCalendarioEventById, updateClassRecord, generateStudentActivity, generateSessionActivities, getStudentProgress, getNivelMaterial, getMaterialUsuario, debugNivelesOrder, getExpiredOnHoldStudents, getExpiredContracts, markContractExpired } from 'backend/search.jsw';
import {
    exportarNiveles,
    exportarPeople,
    exportarAcademica,
    exportarClasses,
    exportarBooking,
    exportarAdvisors,
    exportarUsuariosRoles,
    exportarRolPermisos,
    exportarContratos,
    exportarCalendario,
    exportarMetadata
} from 'backend/exposeDataBase.jsw';
import { fetch } from 'wix-fetch';
import wixData from 'wix-data';
import { ok, serverError, badRequest } from 'wix-http-functions';


export async function get_exportCSV(request) {
    try {
        const results = await wixData.query("CLASSES").find();
        const items = results.items;

        if (items.length === 0) {
            return ok({ body: "No hay datos para exportar." });
        }

        // Obtener los nombres de los advisors
        const advisorIds = [...new Set(items.map(item => item.advisor).filter(id => id))];
        const advisors = await getAdvisorNames(advisorIds);

        // 🔹 Seleccionar y estructurar solo las columnas necesarias
        let selectedColumns = items.map(({ _id, fechaEvento, tipoEvento, nivel, step, primerNombre, primerApellido, advisor, asistencia, participacion }) => ({
            idEvento: _id,
            fechaEvento: formatFecha(fechaEvento),
            tipoEvento,
            nivel,
            step,
            nombreCompleto: `${primerNombre || ""} ${primerApellido || ""}`.trim(),
            advisorName: advisors[advisor] || "No asignado",
            asistencia: asistencia === true ? "Sí" : "No",
            participacion: participacion ? "Sí" : "No"
        }));

        // Ordenar como en la tabla (Asistencia: "No" primero)
        selectedColumns.sort((a, b) => a.asistencia.localeCompare(b.asistencia));

        // Convertir a CSV solo con las columnas seleccionadas
        let csvContent = convertToCSV(selectedColumns);

        return ok({
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": "attachment; filename=clases.csv"
            },
            body: csvContent
        });

    } catch (error) {
        console.error("Error al exportar CSV:", error);
        return serverError({ body: "Error al exportar CSV: " + error.message });
    }
}

// Función para obtener los nombres de los advisors por sus IDs
async function getAdvisorNames(advisorIds) {
    if (advisorIds.length === 0) return {};

    try {
        const result = await wixData.query("ADVISORS")
            .hasSome("_id", advisorIds)
            .find();

        const advisorMap = {};
        result.items.forEach(advisor => {
            advisorMap[advisor._id] = `${advisor.primerNombre} ${advisor.primerApellido}`;
        });

        return advisorMap;
    } catch (error) {
        console.error("Error al obtener nombres de advisors:", error);
        return {};
    }
}

// Función para formatear la fecha igual que en el frontend
function formatFecha(fecha) {
    if (!fecha) return "";
    const date = new Date(fecha);
    return date.toLocaleString("es-CO", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    }).replace(",", "");
}

// Función para convertir JSON a CSV asegurando compatibilidad con Excel
function convertToCSV(data) {
    if (!data.length) return "";

    const keys = Object.keys(data[0]); // Obtener encabezados
    const rows = data.map(row => 
        keys.map(key => `"${row[key]?.toString().replace(/"/g, '""') || ""}"`).join(",") // Escapar comillas dobles
    );

    return [keys.join(","), ...rows].join("\n"); // Formato CSV válido
}






/*
export function post_handleInput(request) {
    const BOT_NUMBER = "56932631038"; // Número del bot para evitar ciclos

    return request.body.json()
        .then(async (body) => {
            // Validar que el payload contiene el arreglo 'messages'
            if (!body || !body.messages || !Array.isArray(body.messages)) {
                return {
                    status: 200,
                    body: { message: "Solicitud ignorada: el payload no contiene mensajes." }
                };
            }

            const messages = body.messages;

            for (const message of messages) {
                const from = message?.from?.trim(); // Número del remitente
                const bodyText = message?.text?.body?.trim() || "Sin mensaje"; // Texto del mensaje
                const profileName = message?.from_name?.trim() || "Nombre Desconocido"; // Nombre del remitente
                const fromMe = message?.from_me || false; // Indica si el mensaje fue enviado por el bot

                // Evitar ciclos: ignorar mensajes enviados por el bot
                if (from === BOT_NUMBER || fromMe) {
                    console.log(`Mensaje ignorado: fue enviado por el bot (${from}).`);
                    continue;
                }

                if (!from || !bodyText) {
                    console.error("No se pudieron identificar las propiedades 'from' y 'body' en el mensaje.");
                    continue;
                }

                let conversation;
                try {
                    const queryResult = await wixData.query("WHP").eq("userId", from).find();
                    if (queryResult.items.length > 0) {
                        conversation = queryResult.items[0];
                    } else {
                        conversation = { userId: from, nombre: profileName, mensajes: [], stopBot: false };
                    }
                } catch (error) {
                    console.error("Error consultando la conversación existente:", error);
                }

                // Respuesta fija
                const response = "Hola. Te comunicas con LGS. ¿En qué te podemos colaborar?";
                conversation.stopBot = true;

                // Guardar la conversación actualizada
                try {
                    conversation.mensajes.push({
                        from: "usuario",
                        mensaje: bodyText,
                        timestamp: new Date().toISOString()
                    });
                    conversation.mensajes.push({
                        from: "sistema",
                        mensaje: response,
                        timestamp: new Date().toISOString()
                    });

                    if (conversation._id) {
                        await wixData.update("WHP", conversation);
                    } else {
                        delete conversation._id;
                        await wixData.insert("WHP", conversation);
                    }
                } catch (error) {
                    console.error("Error guardando la conversación:", error);
                }

                // Enviar la respuesta al usuario
                await sendTextMessage(from, response);
            }

            return {
                status: 200,
                body: { message: "Mensajes procesados correctamente." }
            };
        })
        .catch(error => {
            console.error("Error procesando webhook:", error);
            return {
                status: 500,
                body: { message: "Error procesando el webhook." }
            };
        });
}*/



export function sendTextMessage(toNumber, messageBody) {
    const url = "https://gate.whapi.cloud/messages/text";
    const headers = {
        "accept": "application/json",
        "authorization": "Bearer VSyDX4j7ooAJ7UGOhz8lGplUVDDs2EYj",
        "content-type": "application/json"
    };
    const postData = {
        "typing_time": 0,
        "to": toNumber,
        "body": messageBody
    };

    // Realizar la solicitud POST
    return fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(postData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error en la solicitud: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(json => {
            console.log("Mensaje enviado con éxito:", json);

            // Registrar el evento y cerrar la lightbox
            return sendmessage("chatsWhp", { type: "updateComplete" })
                .then(() => {
                    console.log("Evento 'updateComplete' registrado correctamente.");
                    return json; // Devuelve la respuesta principal
                });
        })
        .catch(err => {
            console.error("Error en el proceso de envío o registro del evento:", err);
            throw err; // Propagar el error
        });
}

// ====== FUNCIONES DE BÚSQUEDA ======

export async function get_search(request) {
    try {
        const query = request.query;
        const searchTerm = query.q || query.term || query.search;

        if (!searchTerm) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'Parámetro de búsqueda requerido (q, term, o search)'
                })
            });
        }

        const result = await searchPeopleAndAcademica(searchTerm);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de búsqueda:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export async function get_person(request) {
    try {
        const query = request.query;
        const contrato = query.contrato;

        if (!contrato) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'Número de contrato requerido'
                })
            });
        }

        const result = await getPersonByContrato(contrato);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de persona:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

// Manejar OPTIONS para CORS
export function options_search(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

export function options_person(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

export async function get_personById(request) {
    try {
        const query = request.query;
        const personId = query.id;

        if (!personId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de persona requerido'
                })
            });
        }

        const result = await getPersonById(personId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de persona por ID:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_personById(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

// ====== ENDPOINTS PARA ESTUDIANTES (ACADEMICA) ======

export async function get_studentById(request) {
    try {
        const query = request.query;
        const studentId = query.id;
        const page = parseInt(query.page || '1', 10);
        const pageSize = parseInt(query.pageSize || '50', 10);

        console.log('📄 HTTP Endpoint studentById - ID:', studentId, 'Page:', page, 'PageSize:', pageSize);

        if (!studentId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de estudiante requerido'
                })
            });
        }

        const result = await getStudentById(studentId, page, pageSize);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de estudiante por ID:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export async function put_updateClass(request) {
    try {
        const query = request.query;
        const classId = query.id;

        if (!classId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de clase requerido'
                })
            });
        }

        const body = await request.body.json();
        const result = await updateClass(classId, body);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de actualizar clase:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export async function delete_deleteClass(request) {
    try {
        const query = request.query;
        const classId = query.id;

        if (!classId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de clase requerido'
                })
            });
        }

        const result = await deleteClass(classId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de eliminar clase:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

// Funciones OPTIONS para CORS
export function options_studentById(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

export function options_updateClass(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

export function options_deleteClass(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

// ====== ENDPOINT PARA PERSONAS RELACIONADAS ======

export async function post_getRelatedPersons(request) {
    try {
        const body = await request.body.json();
        const { personId, tipoUsuario, titularId } = body;

        if (!personId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de persona requerido'
                })
            });
        }

        const result = await getRelatedPersons(personId, tipoUsuario, titularId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de personas relacionadas:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getRelatedPersons(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

// ====== ENDPOINT PARA INFORMACIÓN FINANCIERA ======

export async function get_financialDataByContrato(request) {
    try {
        const query = request.query;
        const contrato = query.contrato;

        if (!contrato) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'Número de contrato requerido'
                })
            });
        }

        const result = await getFinancialDataByContrato(contrato);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de información financiera:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_financialDataByContrato(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

// ====== ENDPOINT PARA APROBACIÓN DE BENEFICIARIOS ======

export async function post_approveBeneficiario(request) {
    try {
        const body = await request.body.json();
        const { beneficiarioId } = body;

        if (!beneficiarioId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de beneficiario requerido'
                })
            });
        }

        const result = await approveBeneficiario(beneficiarioId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de aprobación de beneficiario:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_approveBeneficiario(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

// ====== ENDPOINT PARA CREAR NUEVO BENEFICIARIO ======

export async function post_createNewBeneficiario(request) {
    try {
        const body = await request.body.json();
        const { titularId } = body;

        if (!titularId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de titular requerido'
                })
            });
        }

        const result = await createNewBeneficiario(titularId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de creación de beneficiario:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_createNewBeneficiario(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ====== ENDPOINT PARA ACTUALIZAR BENEFICIARIO ======

export async function post_updateBeneficiario(request) {
    try {
        const body = await request.body.json();
        const { beneficiarioId, datosBeneficiario } = body;

        if (!beneficiarioId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de beneficiario requerido'
                })
            });
        }

        if (!datosBeneficiario) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'Datos de beneficiario requeridos'
                })
            });
        }

        const result = await updateBeneficiario(beneficiarioId, datosBeneficiario);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de actualización de beneficiario:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_updateBeneficiario(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ====== ENDPOINT PARA ELIMINAR BENEFICIARIO ======

export async function post_deleteBeneficiario(request) {
    try {
        const body = await request.body.json();
        const { beneficiarioId } = body;

        if (!beneficiarioId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de beneficiario requerido'
                })
            });
        }

        const result = await deleteBeneficiario(beneficiarioId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de eliminación de beneficiario:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_deleteBeneficiario(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ====== ENDPOINT PARA INACTIVAR BENEFICIARIO ======

export async function post_inactivateBeneficiario(request) {
    try {
        const body = await request.body.json();
        const { beneficiarioId } = body;

        if (!beneficiarioId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de beneficiario requerido'
                })
            });
        }

        const result = await inactivateBeneficiario(beneficiarioId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de inactivación de beneficiario:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_inactivateBeneficiario(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ====== ENDPOINT PARA INACTIVAR CUALQUIER USUARIO ======

export async function post_inactivateUser(request) {
    try {
        const body = await request.body.json();
        const { userId } = body;

        if (!userId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'userId es requerido'
                })
            });
        }

        console.log('📝 HTTP: Inactivando usuario:', userId);

        const result = await inactivateUser(userId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de inactivación de usuario:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_inactivateUser(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ====== ENDPOINT PARA TOGGLE ESTADO USUARIO (ACTIVAR/INACTIVAR) ======

export async function post_toggleUserStatus(request) {
    try {
        const body = await request.body.json();
        const { userId, setInactive, fechaOnHold, fechaFinOnHold, motivo } = body;

        if (!userId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'userId es requerido'
                })
            });
        }

        console.log('📝 HTTP: Toggle user status:', { userId, setInactive, fechaOnHold, fechaFinOnHold, motivo });

        const result = await toggleUserStatus(userId, setInactive, fechaOnHold, fechaFinOnHold, motivo);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de toggle user status:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_toggleUserStatus(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// HTTP function para toggleContractStatus
export async function post_toggleContractStatus(request) {
    try {
        const body = await request.body.json();
        const { contrato, titularId, beneficiaryIds, setInactive } = body;

        if (!contrato || !titularId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'contrato y titularId son requeridos'
                })
            });
        }

        console.log('📝 HTTP: Toggle contract status:', { contrato, titularId, beneficiaryCount: beneficiaryIds?.length || 0, setInactive });

        const result = await toggleContractStatus(contrato, titularId, beneficiaryIds, setInactive);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de toggle contract status:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_toggleContractStatus(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// HTTP function para toggleOnHoldStatus
export async function post_toggleOnHoldStatus(request) {
    try {
        const body = await request.body.json();
        const { contrato, titularId, beneficiaryIds, setOnHold, fechaOnHold, fechaFinOnHold } = body;

        if (!contrato || !titularId || setOnHold === undefined) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'contrato, titularId y setOnHold son requeridos'
                })
            });
        }

        if (setOnHold && (!fechaOnHold || !fechaFinOnHold)) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'fechaOnHold y fechaFinOnHold son requeridos para activar OnHold'
                })
            });
        }

        console.log('📝 HTTP: Toggle OnHold status:', {
            contrato,
            titularId,
            beneficiaryCount: beneficiaryIds?.length || 0,
            setOnHold,
            fechaOnHold,
            fechaFinOnHold
        });

        const result = await toggleOnHoldStatus(contrato, titularId, beneficiaryIds, setOnHold, fechaOnHold, fechaFinOnHold);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de toggle OnHold status:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_toggleOnHoldStatus(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// HTTP function para extendStudentVigencia (extiende vigencia de un estudiante individual)
export async function post_extendStudentVigencia(request) {
    try {
        const body = await request.body.json();
        const { studentId, nuevaFechaFinal, motivo } = body;

        if (!studentId || !nuevaFechaFinal) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'studentId y nuevaFechaFinal son requeridos'
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        console.log('🔄 HTTP extendStudentVigencia:', {
            studentId,
            nuevaFechaFinal,
            motivo: motivo || 'Sin motivo'
        });

        const result = await extendStudentVigencia(studentId, nuevaFechaFinal, motivo);

        return ok({
            body: JSON.stringify(result),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With'
            }
        });

    } catch (error) {
        console.error('Error en post_extendStudentVigencia:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: error.message || 'Error interno del servidor'
            }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

export function options_extendStudentVigencia(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// HTTP function para updateTitularEstado
export async function post_updateTitularEstado(request) {
    try {
        const body = await request.body.json();
        console.log('HTTP updateTitularEstado request:', body);

        const { personId, nuevoEstado } = body;

        const result = await updateTitularEstado(personId, nuevoEstado);

        return ok({
            body: JSON.stringify(result),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With'
            }
        });

    } catch (error) {
        console.error('Error en post_updateTitularEstado:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

export function options_updateTitularEstado(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ============= ENDPOINTS PARA AGENDAR CLASES =============

export async function get_calendarioEventos(request) {
    try {
        const url = new URL(request.url);
        const nivel = url.searchParams.get('nivel');
        const tipoEvento = url.searchParams.get('tipoEvento');
        const fechaInicio = url.searchParams.get('fechaInicio');
        const fechaFin = url.searchParams.get('fechaFin');

        const result = await getCalendarioEventos(nivel, tipoEvento, fechaInicio, fechaFin);

        return ok({
            body: JSON.stringify(result),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('Error en get_calendarioEventos:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

export function options_calendarioEventos(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function get_advisors(request) {
    try {
        const result = await getAdvisors();

        return ok({
            body: JSON.stringify(result),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('Error en get_advisors:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

export function options_advisors(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function post_createClassEvent(request) {
    try {
        const eventData = await request.body.json();
        const result = await createClassEvent(eventData);

        return ok({
            body: JSON.stringify(result),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('Error en post_createClassEvent:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

export function options_createClassEvent(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function post_createBookingEvent(request) {
    try {
        const eventData = await request.body.json();
        const result = await createBookingEvent(eventData);

        return ok({
            body: JSON.stringify(result),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('Error en post_createBookingEvent:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

export function options_createBookingEvent(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function post_updateStudentStep(request) {
    try {
        console.log('🎯 HTTP: Recibida petición para actualizar step del estudiante');

        const stepData = await request.body.json();
        console.log('🔍 Datos recibidos:', stepData);

        const result = await updateStudentStep(stepData);

        if (result.success) {
            console.log('✅ Step actualizado exitosamente');
            return ok({
                body: JSON.stringify(result),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } else {
            console.error('❌ Error al actualizar step:', result.error);
            return serverError({
                body: JSON.stringify(result),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    } catch (error) {
        console.error('❌ Error en HTTP endpoint:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

export function options_updateStudentStep(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ============= ENDPOINTS PARA NIVELES Y STEPS =============

export async function get_levelSteps(request) {
    try {
        const query = request.query;
        const nivel = query.nivel;
        const studentId = query.studentId;

        if (!nivel) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'Nivel requerido'
                })
            });
        }

        if (!studentId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de estudiante requerido'
                })
            });
        }

        const result = await cargarStepsDelNivel(nivel, studentId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de level steps:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_levelSteps(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

export async function post_stepOverride(request) {
    try {
        const body = await request.body.json();
        const { studentId, step, nivel, isCompleted } = body;

        if (!studentId || !step || !nivel || isCompleted === undefined) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'studentId, step, nivel e isCompleted son requeridos'
                })
            });
        }

        const result = await createStepOverride({ studentId, step, nivel, isCompleted });

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de step override:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export async function delete_stepOverride(request) {
    try {
        const query = request.query;
        const studentId = query.studentId;
        const step = query.step;

        if (!studentId || !step) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'studentId y step son requeridos'
                })
            });
        }

        const result = await deleteStepOverride(studentId, step);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de eliminar step override:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

// ==================== GESTIÓN DE CONTRATOS ====================

export async function post_getContracts(request) {
    try {
        console.log('🔄 Proxy: Received Contracts request');

        const body = request.body;
        const { status, search, dateStart, dateEnd, page = 1, limit = 15 } = body || {};

        console.log('📋 Contract filters:', { status, search, dateStart, dateEnd, page, limit });

        // Usar la función getContracts de search.jsw
        const result = await getContracts(status, search, dateStart, dateEnd, page, limit);

        if (result.success) {
            console.log('✅ Contracts loaded from search.jsw:', result);

            return ok({
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: JSON.stringify(result)
            });
        } else {
            throw new Error(result.error || 'Error al obtener contratos');
        }

    } catch (error) {
        console.error('❌ Error en endpoint de contratos:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getContracts(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export function options_stepOverride(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function get_testStepOverrides(request) {
    try {
        const numeroId = request.query.numeroId;
        if (!numeroId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'numeroId parameter is required'
                })
            });
        }

        const result = await testStepOverrideByIdEnAcademica(numeroId);
        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(result)
        });
    } catch (error) {
        console.error('Error en endpoint de test step overrides:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

// Endpoint para actualizar estado ON HOLD
export async function post_updateOnHold(request) {
    try {
        const body = await request.body.json();
        const { personId, estado, fechaOnHold, fechaFinOnHold, vigenciaExtra } = body;

        if (!personId || !fechaOnHold || !fechaFinOnHold) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'personId, fechaOnHold y fechaFinOnHold son requeridos'
                })
            });
        }

        console.log('📝 Procesando actualización ON HOLD:', { personId, estado, fechaOnHold, fechaFinOnHold });

        const result = await updateOnHold(personId, estado || 'ON HOLD', fechaOnHold, fechaFinOnHold, vigenciaExtra);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de actualizar ON HOLD:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_updateOnHold(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ============= ENDPOINT PARA EVENTOS DE BIENVENIDA =============

export async function post_getWelcomeEvents(request) {
    try {
        const body = await request.body.json();
        const { fechaInicio, fechaFin } = body;

        console.log('📅 Solicitud de eventos de bienvenida:', { fechaInicio, fechaFin });

        const result = await getWelcomeEvents(fechaInicio, fechaFin);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de eventos de bienvenida:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getWelcomeEvents(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ============= ENDPOINT PARA TODAS LAS SESIONES DE CLASSES =============

export async function post_getAllClassSessions(request) {
    try {
        const body = await request.body.json();
        const { fechaInicio, fechaFin } = body;

        console.log('📚 Solicitud de todas las sesiones:', { fechaInicio, fechaFin });

        const result = await getAllClassSessions(fechaInicio, fechaFin);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de todas las sesiones:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getAllClassSessions(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ============= ENDPOINTS PARA AGENDA =============

export async function post_getAdvisors(request) {
    try {
        console.log('📞 Solicitud de lista de advisors');

        const result = await getAdvisors();

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de advisors:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getAdvisors(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function get_advisorById(request) {
    try {
        const advisorId = request.path[0];
        console.log('👨‍🏫 Solicitud de advisor por ID:', advisorId);

        if (!advisorId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de advisor requerido'
                })
            });
        }

        const result = await getAdvisorById(advisorId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de advisor por ID:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_advisorById(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function get_advisorByEmail(request) {
    try {
        const { query } = request;
        const email = query.email;
        console.log('👨‍🏫 Solicitud de advisor por email:', email);

        if (!email) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'Email de advisor requerido'
                })
            });
        }

        const result = await getAdvisorByEmail(email);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de advisor por email:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_advisorByEmail(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function post_getCalendarioEvents(request) {
    try {
        const body = await request.body.json();
        const { fechaInicio, fechaFin, advisorId } = body;

        console.log('📅 Solicitud de eventos de calendario:', { fechaInicio, fechaFin, advisorId });

        const result = await getCalendarioEvents(fechaInicio, fechaFin, advisorId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de eventos de calendario:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getCalendarioEvents(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function post_getCalendarioEventsByAdvisor(request) {
    try {
        const body = await request.body.json();
        const { advisorId, fechaInicio, fechaFin } = body;

        console.log('👤 Solicitud de eventos por advisor:', { advisorId, fechaInicio, fechaFin });

        const result = await getCalendarioEventsByAdvisor(advisorId, fechaInicio, fechaFin);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de eventos por advisor:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getCalendarioEventsByAdvisor(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function post_getCalendarioEventsByAdvisorAndDay(request) {
    try {
        const body = await request.body.json();
        const { advisorId, fechaInicio, fechaFin } = body;

        console.log('👤📅 Solicitud de eventos por advisor y día:', { advisorId, fechaInicio, fechaFin });

        const result = await getCalendarioEventsByAdvisorAndDay(advisorId, fechaInicio, fechaFin);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de eventos por advisor y día:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getCalendarioEventsByAdvisorAndDay(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function post_getEventBookings(request) {
    try {
        const body = await request.body.json();
        const { eventId } = body;

        console.log('📋 Solicitud de bookings para evento:', eventId);

        const result = await getEventBookings(eventId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de bookings del evento:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getEventBookings(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// Endpoint para obtener usuarios por criterios del evento desde CLASSES
export async function post_getEventUsersByCriteria(request) {
    try {
        const body = await request.body.json();
        const { advisorId, fechaEvento, hora, tipoEvento, nivel, step } = body;

        console.log('📋 Solicitud de usuarios por criterios (CLASSES):', {
            advisorId, fechaEvento, hora, tipoEvento, nivel, step
        });

        const result = await getEventUsersByCriteria(advisorId, fechaEvento, hora, tipoEvento, nivel, step);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de usuarios por criterios (CLASSES):', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getEventUsersByCriteria(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// Endpoint para obtener usuarios por criterios del evento desde BOOKING
export async function post_getEventBookingsByCriteria(request) {
    try {
        const body = await request.body.json();
        const { advisorId, fechaEvento, hora, tipoEvento, nivel, step } = body;

        console.log('📋 Solicitud de usuarios por criterios (BOOKING):', {
            advisorId, fechaEvento, hora, tipoEvento, nivel, step
        });

        const result = await getEventBookingsByCriteria(advisorId, fechaEvento, hora, tipoEvento, nivel, step);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de usuarios por criterios (BOOKING):', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getEventBookingsByCriteria(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function post_getTotalAcademicaUsers(request) {
    try {
        console.log('🔄 Obteniendo total de usuarios de ACADEMICA...');

        // Contar todos los registros en la colección ACADEMICA
        const totalCount = await wixData.query('ACADEMICA').count();

        console.log('✅ Total de usuarios de ACADEMICA:', totalCount);

        return ok({
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({
                success: true,
                total: totalCount
            })
        });

    } catch (error) {
        console.error('❌ Error obteniendo total de usuarios de ACADEMICA:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getTotalAcademicaUsers(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ============= ENDPOINT PARA CONTAR INSCRITOS DE UN EVENTO =============

export async function post_getEventInscritosCount(request) {
    try {
        const body = await request.body.json();
        const { eventId } = body;

        console.log('🔢 Solicitud de conteo de inscritos para evento:', eventId);

        if (!eventId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de evento requerido'
                })
            });
        }

        const result = await getEventInscritosCount(eventId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de conteo de inscritos:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message,
                inscritos: 0
            })
        });
    }
}

export function options_getEventInscritosCount(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ============= ENDPOINT PARA CONTAR INSCRITOS DE MÚLTIPLES EVENTOS =============

export async function post_getMultipleEventsInscritosCount(request) {
    try {
        const body = await request.body.json();
        const { eventIds } = body;

        console.log('🔢📊 Solicitud de conteo de inscritos para múltiples eventos:', eventIds?.length || 0);

        if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'Array de IDs de eventos requerido'
                })
            });
        }

        const result = await getMultipleEventsInscritosCount(eventIds);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de conteo múltiple de inscritos:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message,
                inscritosCounts: {}
            })
        });
    }
}

export function options_getMultipleEventsInscritosCount(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ============= ENDPOINTS PARA GESTIÓN DE EVENTOS EN CALENDARIO =============

export async function post_createCalendarioEvent(request) {
    try {
        const eventData = await request.body.json();
        console.log('📅 HTTP: Crear evento en CALENDARIO:', eventData);

        const result = await createCalendarioEvent(eventData);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de crear evento en CALENDARIO:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_createCalendarioEvent(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function post_updateCalendarioEvent(request) {
    try {
        const body = await request.body.json();
        const { _id, ...eventData } = body;
        console.log('📝 HTTP: Actualizar evento en CALENDARIO:', _id, eventData);

        if (!_id) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de evento requerido'
                })
            });
        }

        const result = await updateCalendarioEvent(_id, eventData);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de actualizar evento en CALENDARIO:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_updateCalendarioEvent(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function post_deleteCalendarioEvent(request) {
    try {
        const body = await request.body.json();
        const { eventId } = body;
        console.log('🗑️ HTTP: Eliminar evento en CALENDARIO:', eventId);

        if (!eventId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de evento requerido'
                })
            });
        }

        const result = await deleteCalendarioEvent(eventId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de eliminar evento en CALENDARIO:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_deleteCalendarioEvent(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ============= ENDPOINT PARA OBTENER NIVELES =============

export async function get_niveles(request) {
    try {
        console.log('📚 HTTP: Obtener niveles');

        const result = await getNiveles();

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de niveles:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_niveles(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ==================== ENDPOINT PARA ACTUALIZAR APROBACIÓN ====================
export async function post_updateAprobacion(request) {
    try {
        const { personId, aprobacion } = request.body;

        console.log('🔄 HTTP updateAprobacion:', { personId, aprobacion });

        if (!personId || !aprobacion) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'personId y aprobacion son requeridos'
                })
            });
        }

        const result = await updateAprobacion(personId, aprobacion);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('❌ Error en HTTP updateAprobacion:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_updateAprobacion(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ==================== ENDPOINT PARA OBTENER CONTRATOS POR TIPO ====================
export async function get_contratosByTipo(request) {
    try {
        const query = request.query;
        const tipoUsuario = query.tipoUsuario || 'TITULAR';

        console.log('📋 HTTP contratosByTipo:', { tipoUsuario });

        const result = await getContractosByTipo(tipoUsuario);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('❌ Error en HTTP contratosByTipo:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_contratosByTipo(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ==================== ENDPOINT PARA OBTENER BENEFICIARIOS SIN REGISTRO ACADÉMICO ====================
export async function get_beneficiariosSinRegistro(request) {
    try {
        console.log('🔍 HTTP beneficiariosSinRegistro solicitado');

        const result = await getBeneficiariosSinRegistro();

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('❌ Error en HTTP beneficiariosSinRegistro:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_beneficiariosSinRegistro(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}



export async function post_addCommentToPerson(request) {
    try {
        const body = await request.body.text();
        const { personId, commentData } = JSON.parse(body);

        const result = await addCommentToPerson(personId, commentData);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de agregar comentario:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_addCommentToPerson(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

export async function get_personComments(request) {
    try {
        const query = request.query;
        const personId = query.id;

        if (!personId) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de persona requerido'
                })
            });
        }

        const result = await getPersonComments(personId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de comentarios:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_personComments(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

export async function post_restorePersonData(request) {
    try {
        const body = await request.body.text();
        const { personId } = JSON.parse(body);

        const result = await restorePersonData(personId);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('Error en endpoint de restauración:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export async function post_getDashboardStats(request) {
    try {
        console.log('📊 Obteniendo estadísticas del dashboard...');

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const finDelDia = new Date();
        finDelDia.setHours(23, 59, 59, 999);

        const [
            totalUsuarios,
            totalInactivos,
            sesionesHoy,
            usuariosInscritosHoy,
            advisorsHoy
        ] = await Promise.all([
            wixData.query('ACADEMICA').count(),

            wixData.query('ACADEMICA')
                .ne('estadoInactivo', true)
                .count(),

            wixData.query('CALENDARIO')
                .between('dia', hoy, finDelDia)
                .count(),

            wixData.query('CLASSES')
                .between('fechaEvento', hoy, finDelDia)
                .count(),

            wixData.query('CLASSES')
                .between('fechaEvento', hoy, finDelDia)
                .distinct('advisor')
        ]);

        const stats = {
            totalUsuarios,
            totalInactivos,
            sesionesHoy,
            usuariosInscritosHoy,
            advisorsHoy: advisorsHoy.length
        };

        console.log('✅ Estadísticas del dashboard:', stats);

        return ok({
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({
                success: true,
                stats
            })
        });

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas del dashboard:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getDashboardStats(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function post_getTopStudentsThisMonth(request) {
    try {
        const result = await getTopStudentsThisMonth();

        return ok({
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('❌ Error en endpoint de top estudiantes:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export async function post_getAdvisorStats(request) {
    try {
        const requestBody = await request.body.text();
        const { advisorId, fechaInicio, fechaFin } = JSON.parse(requestBody);

        const result = await getAdvisorStats(advisorId, fechaInicio, fechaFin);

        return ok({
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('❌ Error en endpoint de estadísticas del advisor:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getAdvisorStats(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export function options_getTopStudentsThisMonth(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ========== HTTP HANDLERS PARA CREAR CONTRATOS ==========

export async function post_createPerson(request) {
    try {
        const personData = await request.body.json();
        console.log('👤 HTTP Handler: Creating person with data:', personData);

        const result = await createPerson(personData);

        if (result.success) {
            return ok({
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(result.data)
            });
        } else {
            return serverError({
                body: JSON.stringify({ error: result.error, details: result.details })
            });
        }
    } catch (error) {
        console.error('❌ Error in post_createPerson:', error);
        return serverError({
            body: JSON.stringify({ error: 'Error creating person', details: error.message })
        });
    }
}

export function options_createPerson(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function post_createFinancial(request) {
    try {
        const financialData = await request.body.json();
        console.log('💰 HTTP Handler: Creating financial record with data:', financialData);

        const result = await createFinancial(financialData);

        if (result.success) {
            return ok({
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(result.data)
            });
        } else {
            return serverError({
                body: JSON.stringify({ error: result.error, details: result.details })
            });
        }
    } catch (error) {
        console.error('❌ Error in post_createFinancial:', error);
        return serverError({
            body: JSON.stringify({ error: 'Error creating financial record', details: error.message })
        });
    }
}

export function options_createFinancial(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function post_getContractsByPattern(request) {
    try {
        const { pattern, year } = await request.body.json();
        console.log('🔍 HTTP Handler: Getting contracts by pattern:', pattern, 'year:', year);

        const result = await getContractsByPattern(pattern, year);

        if (result.success) {
            return ok({
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ contracts: result.contracts })
            });
        } else {
            return serverError({
                body: JSON.stringify({ error: result.error, details: result.details })
            });
        }
    } catch (error) {
        console.error('❌ Error in post_getContractsByPattern:', error);
        return serverError({
            body: JSON.stringify({ error: 'Error fetching contracts', details: error.message })
        });
    }
}

export function options_getContractsByPattern(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ==================== ENDPOINT PARA OBTENER REGISTROS PENDIENTES DE APROBACIÓN ====================

export async function post_getPendingApprovals(request) {
    try {
        console.log('🔍 HTTP Handler: Obteniendo registros pendientes de aprobación');

        const result = await getPendingApprovals();

        if (result.success) {
            console.log('✅ HTTP Handler: Registros pendientes obtenidos:', result.totalRecords);
            return ok({
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(result)
            });
        } else {
            console.error('❌ HTTP Handler: Error obteniendo registros pendientes:', result.error);
            return serverError({
                body: JSON.stringify({
                    success: false,
                    error: result.error,
                    details: result.details
                })
            });
        }
    } catch (error) {
        console.error('❌ Error in post_getPendingApprovals:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error obteniendo registros pendientes',
                details: error.message
            })
        });
    }
}

export function options_getPendingApprovals(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ==================== ENDPOINT PARA OBTENER EVENTO DE CALENDARIO POR ID ====================

export async function get_getCalendarioEventById(request) {
    try {
        const { query } = request;
        const id = query.id;

        console.log('🔍 HTTP Handler: Obteniendo evento por ID:', id);

        if (!id) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'ID de evento requerido'
                })
            });
        }

        const result = await getCalendarioEventById(id);

        return ok({
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('❌ Error in get_getCalendarioEventById:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error obteniendo evento',
                details: error.message
            })
        });
    }
}

export function options_getCalendarioEventById(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ==================== ENDPOINT PARA ACTUALIZAR REGISTRO DE CLASE ====================

export async function post_updateClassRecord(request) {
    try {
        const recordData = await request.body.json();

        console.log('📝 HTTP Handler: Actualizando registro de clase:', {
            idEstudiante: recordData.idEstudiante,
            idEvento: recordData.idEvento
        });

        if (!recordData.idEstudiante || !recordData.idEvento) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'idEstudiante e idEvento son requeridos'
                })
            });
        }

        const result = await updateClassRecord(recordData);

        return ok({
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('❌ Error in post_updateClassRecord:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error actualizando registro de clase',
                details: error.message
            })
        });
    }
}

export function options_updateClassRecord(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ==================== ENDPOINTS PARA OPENAI ACTIVITIES ====================

export async function post_generateStudentActivity(request) {
    try {
        const body = await request.body.json();
        const { studentId, nivel } = body;

        console.log('🤖 HTTP Handler: Generando actividad para estudiante:', studentId, 'nivel:', nivel);

        if (!studentId || !nivel) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'studentId y nivel son requeridos'
                })
            });
        }

        const result = await generateStudentActivity(studentId, nivel);

        return ok({
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('❌ Error in post_generateStudentActivity:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error generando actividad',
                details: error.message
            })
        });
    }
}

export function options_generateStudentActivity(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function post_generateSessionActivities(request) {
    try {
        const body = await request.body.json();
        const { step, studentsData } = body;

        console.log('🤖 HTTP Handler: Generando actividades de sesión, step:', step, 'estudiantes:', studentsData?.length);

        if (!step) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: 'step es requerido'
                })
            });
        }

        const result = await generateSessionActivities(step, studentsData);

        return ok({
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error('❌ Error in post_generateSessionActivities:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error generando actividades de sesión',
                details: error.message
            })
        });
    }
}

export function options_generateSessionActivities(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ============================================================================
// ENDPOINTS DE PERMISOS Y ROLES
// ============================================================================

/**
 * GET /api/wix-proxy/user-role?email=usuario@lgs.com
 * Obtiene el rol de un usuario por su email
 */
export async function get_userRole(request) {
    try {
        const email = request.query.email;

        if (!email) {
            return badRequest({
                body: {
                    success: false,
                    error: 'Email es requerido'
                }
            });
        }

        const results = await wixData.query("USUARIOS_ROLES")
            .eq("email", email)
            .find();

        if (results.items.length === 0) {
            return ok({
                body: {
                    success: false,
                    error: 'Usuario no encontrado'
                }
            });
        }

        const user = results.items[0];

        if (!user.activo) {
            return ok({
                body: {
                    success: false,
                    error: 'Usuario desactivado'
                }
            });
        }

        return ok({
            body: {
                success: true,
                email: user.email,
                password: user.password, // Hash bcrypt de la contraseña
                rol: user.rol,
                nombre: user.nombre,
                activo: user.activo
            }
        });
    } catch (error) {
        console.error('❌ Error en get_userRole:', error);
        return serverError({
            body: {
                success: false,
                error: 'Error al obtener rol del usuario'
            }
        });
    }
}

export function options_userRole(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

/**
 * GET /api/wix-proxy/user-permissions?email=usuario@lgs.com
 * Obtiene los permisos personalizados de un usuario
 */
export async function get_userPermissions(request) {
    try {
        const email = request.query.email;

        if (!email) {
            return badRequest({
                body: {
                    success: false,
                    error: 'Email es requerido'
                }
            });
        }

        const results = await wixData.query("PERMISOS_PERSONALIZADOS")
            .eq("email", email)
            .find();

        if (results.items.length === 0) {
            return ok({
                body: {
                    success: true,
                    email: email,
                    permisos: []
                }
            });
        }

        const userPermisos = results.items[0];

        // El campo permisos viene como string JSON
        let permisos = [];
        try {
            permisos = JSON.parse(userPermisos.permisos);
        } catch (parseError) {
            console.error('❌ Error al parsear permisos:', parseError);
            permisos = [];
        }

        return ok({
            body: {
                success: true,
                email: email,
                permisos: permisos
            }
        });
    } catch (error) {
        console.error('❌ Error en get_userPermissions:', error);
        return serverError({
            body: {
                success: false,
                error: 'Error al obtener permisos personalizados'
            }
        });
    }
}

export function options_userPermissions(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

/**
 * POST /api/wix-proxy/update-user-role
 * Body: { email: "usuario@lgs.com", nuevoRol: "ADVISOR" }
 * Actualiza el rol de un usuario
 */
export async function post_updateUserRole(request) {
    try {
        const body = await request.body.text();
        const data = JSON.parse(body);

        const { email, nuevoRol } = data;

        if (!email || !nuevoRol) {
            return badRequest({
                body: {
                    success: false,
                    error: 'Email y nuevoRol son requeridos'
                }
            });
        }

        // Validar que el rol sea válido
        const rolesValidos = [
            'SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'COMERCIAL',
            'APROBADOR', 'TALERO', 'FINANCIERO', 'SERVICIO', 'READONLY'
        ];

        if (!rolesValidos.includes(nuevoRol)) {
            return badRequest({
                body: {
                    success: false,
                    error: `Rol inválido. Roles válidos: ${rolesValidos.join(', ')}`
                }
            });
        }

        const results = await wixData.query("USUARIOS_ROLES")
            .eq("email", email)
            .find();

        if (results.items.length === 0) {
            return ok({
                body: {
                    success: false,
                    error: 'Usuario no encontrado'
                }
            });
        }

        const user = results.items[0];
        user.rol = nuevoRol;
        user.fechaActualizacion = new Date();

        await wixData.update("USUARIOS_ROLES", user);

        return ok({
            body: {
                success: true,
                email: user.email,
                rol: user.rol,
                mensaje: 'Rol actualizado exitosamente'
            }
        });
    } catch (error) {
        console.error('❌ Error en post_updateUserRole:', error);
        return serverError({
            body: {
                success: false,
                error: 'Error al actualizar rol del usuario'
            }
        });
    }
}

export function options_updateUserRole(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

/**
 * POST /api/wix-proxy/update-user-permissions
 * Body: { email: "usuario@lgs.com", permisos: ["PERMISO1", "PERMISO2"] }
 * Actualiza los permisos personalizados de un usuario
 */
export async function post_updateUserPermissions(request) {
    try {
        const body = await request.body.text();
        const data = JSON.parse(body);

        const { email, permisos } = data;

        if (!email || !Array.isArray(permisos)) {
            return badRequest({
                body: {
                    success: false,
                    error: 'Email y permisos (array) son requeridos'
                }
            });
        }

        const results = await wixData.query("PERMISOS_PERSONALIZADOS")
            .eq("email", email)
            .find();

        const permisosJson = JSON.stringify(permisos);
        const fechaActual = new Date();

        if (results.items.length === 0) {
            // Crear nuevo registro
            const newRecord = {
                email: email,
                permisos: permisosJson,
                fechaActualizacion: fechaActual,
                notas: 'Permisos personalizados creados desde Admin Panel'
            };

            await wixData.insert("PERMISOS_PERSONALIZADOS", newRecord);
        } else {
            // Actualizar registro existente
            const record = results.items[0];
            record.permisos = permisosJson;
            record.fechaActualizacion = fechaActual;

            await wixData.update("PERMISOS_PERSONALIZADOS", record);
        }

        return ok({
            body: {
                success: true,
                email: email,
                permisos: permisos,
                mensaje: 'Permisos actualizados exitosamente'
            }
        });
    } catch (error) {
        console.error('❌ Error en post_updateUserPermissions:', error);
        return serverError({
            body: {
                success: false,
                error: 'Error al actualizar permisos personalizados'
            }
        });
    }
}

export function options_updateUserPermissions(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// ============================================================================
// ROL_PERMISOS ENDPOINTS
// Gestión de permisos por rol (no por usuario individual)
// ============================================================================

/**
 * GET /rolePermissions?rol=ADVISOR
 * Obtiene los permisos configurados para un rol específico
 */
export async function get_rolePermissions(request) {
    const rol = request.query.rol;

    if (!rol) {
        return badRequest({
            body: {
                success: false,
                error: 'Parámetro rol es requerido'
            }
        });
    }

    try {
        console.log(`🔍 Consultando permisos para rol: ${rol}`);

        const results = await wixData.query("ROL_PERMISOS")
            .eq("rol", rol)
            .eq("activo", true)
            .find();

        if (results.items.length === 0) {
            console.log(`⚠️ Rol no encontrado: ${rol}`);
            return ok({
                body: {
                    success: false,
                    error: 'Rol no encontrado o inactivo',
                    permisos: [] // Retorna array vacío para fallback
                }
            });
        }

        const rolConfig = results.items[0];

        console.log(`✅ Permisos encontrados para ${rol}: ${rolConfig.permisos.length} permisos`);

        return ok({
            body: {
                success: true,
                rol: rolConfig.rol,
                permisos: rolConfig.permisos,
                descripcion: rolConfig.descripcion,
                fechaActualizacion: rolConfig.fechaActualizacion
            }
        });
    } catch (error) {
        console.error('❌ Error en get_rolePermissions:', error);
        return serverError({
            body: {
                success: false,
                error: 'Error al obtener permisos del rol',
                permisos: [] // Retorna array vacío para fallback
            }
        });
    }
}

export function options_rolePermissions(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

/**
 * GET /debugNivelesOrder?nivel=BN1
 * 🔍 FUNCIÓN DE DIAGNÓSTICO: Inspecciona el orden de los steps en NIVELES
 */
export async function get_debugNivelesOrder(request) {
    const nivel = request.query.nivel || 'BN1';

    try {
        console.log(`🔍 [DEBUG] Diagnosticando orden de steps para nivel: ${nivel}`);

        const result = await debugNivelesOrder(nivel);

        return ok({
            body: result
        });
    } catch (error) {
        console.error('❌ Error en get_debugNivelesOrder:', error);
        return serverError({
            body: {
                success: false,
                error: 'Error al diagnosticar orden de steps',
                details: error.message
            }
        });
    }
}

export function options_debugNivelesOrder(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

/**
 * POST /updateRolePermissions
 * Body: { rol: "ADVISOR", permisos: ["ACADEMICO.VER", ...] }
 * Actualiza los permisos de un rol específico
 */
export async function post_updateRolePermissions(request) {
    try {
        const body = await request.body.json();
        const { rol, permisos } = body;

        if (!rol || !permisos) {
            return badRequest({
                body: {
                    success: false,
                    error: 'Parámetros rol y permisos son requeridos'
                }
            });
        }

        if (!Array.isArray(permisos)) {
            return badRequest({
                body: {
                    success: false,
                    error: 'Permisos debe ser un array'
                }
            });
        }

        console.log(`🔄 Actualizando permisos para rol: ${rol}, total: ${permisos.length} permisos`);

        const results = await wixData.query("ROL_PERMISOS")
            .eq("rol", rol)
            .find();

        if (results.items.length === 0) {
            return ok({
                body: {
                    success: false,
                    error: 'Rol no encontrado en la base de datos'
                }
            });
        }

        const rolConfig = results.items[0];
        const fechaActual = new Date();

        // Actualizar permisos
        const updatedConfig = {
            ...rolConfig,
            permisos: permisos,
            fechaActualizacion: fechaActual
        };

        await wixData.update("ROL_PERMISOS", updatedConfig);

        console.log(`✅ Permisos actualizados exitosamente para rol ${rol}`);

        return ok({
            body: {
                success: true,
                rol: rol,
                permisos: permisos,
                mensaje: `Permisos de ${rol} actualizados correctamente`,
                fechaActualizacion: fechaActual
            }
        });
    } catch (error) {
        console.error('❌ Error en post_updateRolePermissions:', error);
        return serverError({
            body: {
                success: false,
                error: 'Error al actualizar permisos del rol'
            }
        });
    }
}

export function options_updateRolePermissions(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

/**
 * GET /studentProgress?id={studentId}
 * Obtiene el diagnóstico académico "¿Cómo voy?" del estudiante
 */
export async function get_studentProgress(request) {
  try {
    const query = request.query;
    const studentId = query.id;

    if (!studentId) {
      return badRequest({
        body: JSON.stringify({
          success: false,
          error: 'ID de estudiante requerido'
        })
      });
    }

    console.log('📊 HTTP Request: get_studentProgress para studentId:', studentId);

    const result = await getStudentProgress(studentId);

    return ok({
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(result)
    });

  } catch (error) {
    console.error('❌ Error en get_studentProgress:', error);
    return serverError({
      body: JSON.stringify({
        success: false,
        error: 'Error obteniendo diagnóstico académico',
        details: error.message
      })
    });
  }
}

/**
 * OPTIONS /studentProgress
 * CORS preflight para el endpoint de diagnóstico
 */
export function options_studentProgress(request) {
  return ok({
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}

export async function get_getNivelMaterial(request) {
    try {
        const query = request.query;
        const step = query.step;

        if (!step) {
            return badRequest({
                body: JSON.stringify({
                    success: false,
                    error: "Step parameter is required"
                })
            });
        }

        const result = await getNivelMaterial(step);

        return ok({
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error("Error en endpoint getNivelMaterial:", error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: "Error interno del servidor",
                details: error.message
            })
        });
    }
}

export function options_getNivelMaterial(request) {
    return ok({
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    });
}

// ============================================================================
// ENDPOINT: getExpiredOnHoldStudents
// Retorna estudiantes con OnHold vencido para reactivación automática via cron
// ============================================================================

/**
 * HTTP Endpoint: GET /getExpiredOnHoldStudents
 *
 * Retorna lista de estudiantes cuyo período OnHold ha vencido.
 * Usado por el cron job para reactivación automática.
 */
export async function get_getExpiredOnHoldStudents(request) {
    try {
        console.log('📡 HTTP get_getExpiredOnHoldStudents: Solicitud recibida');

        const result = await getExpiredOnHoldStudents();

        if (result.success) {
            console.log(`✅ HTTP get_getExpiredOnHoldStudents: Retornando ${result.count} estudiantes`);
            return ok({
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type"
                },
                body: JSON.stringify(result)
            });
        } else {
            console.error('❌ HTTP get_getExpiredOnHoldStudents: Error:', result.error);
            return serverError({
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    success: false,
                    error: result.error || 'Error desconocido'
                })
            });
        }

    } catch (error) {
        console.error('❌ HTTP get_getExpiredOnHoldStudents: Error general:', error);
        return serverError({
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getExpiredOnHoldStudents(request) {
    return ok({
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    });
}

// ============================================================================
// ENDPOINT: getMaterialUsuario
// Obtiene los materiales de usuario (libros) de un step específico
// ============================================================================

export async function get_getMaterialUsuario(request) {
    try {
        const query = request.query;
        const step = query.step || 'Step 1';

        console.log("📚 HTTP getMaterialUsuario - Step:", step);

        const result = await getMaterialUsuario(step);

        return ok({
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            body: JSON.stringify(result)
        });

    } catch (error) {
        console.error("Error en endpoint getMaterialUsuario:", error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: "Error interno del servidor",
                details: error.message
            })
        });
    }
}

export function options_getMaterialUsuario(request) {
    return ok({
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    });
}

// ============================================================================
// ENDPOINT: getExpiredContracts
// Retorna estudiantes con contrato expirado para marcarlos via cron
// ============================================================================

/**
 * HTTP Endpoint: GET /getExpiredContracts
 *
 * Retorna lista de estudiantes cuyo contrato ha vencido (finalContrato < hoy).
 * Usado por el cron job para marcar contratos como FINALIZADA.
 */
export async function get_getExpiredContracts(request) {
    try {
        console.log('📡 HTTP get_getExpiredContracts: Solicitud recibida');

        const result = await getExpiredContracts();

        if (result.success) {
            console.log(`✅ HTTP get_getExpiredContracts: Retornando ${result.count} contratos expirados`);
            return ok({
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type"
                },
                body: JSON.stringify(result)
            });
        } else {
            console.error('❌ HTTP get_getExpiredContracts: Error:', result.error);
            return serverError({
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    success: false,
                    error: result.error || 'Error desconocido'
                })
            });
        }

    } catch (error) {
        console.error('❌ HTTP get_getExpiredContracts: Error general:', error);
        return serverError({
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_getExpiredContracts(request) {
    return ok({
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    });
}

// ============================================================================
// ENDPOINT: markContractExpired
// Marca un contrato como FINALIZADA y estadoInactivo = true
// ============================================================================

/**
 * HTTP Endpoint: POST /markContractExpired
 *
 * Marca un estudiante con contrato expirado como:
 * - estado: "FINALIZADA"
 * - estadoInactivo: true
 */
export async function post_markContractExpired(request) {
    try {
        const body = await request.body.json();
        const { personId } = body;

        console.log('📡 HTTP post_markContractExpired: Solicitud recibida para', personId);

        if (!personId) {
            return badRequest({
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    success: false,
                    error: 'personId es requerido'
                })
            });
        }

        const result = await markContractExpired({ personId });

        if (result.success) {
            console.log(`✅ HTTP post_markContractExpired: Contrato marcado para ${personId}`);
            return ok({
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type"
                },
                body: JSON.stringify(result)
            });
        } else {
            console.error('❌ HTTP post_markContractExpired: Error:', result.error);
            return serverError({
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    success: false,
                    error: result.error || 'Error desconocido'
                })
            });
        }

    } catch (error) {
        console.error('❌ HTTP post_markContractExpired: Error general:', error);
        return serverError({
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_markContractExpired(request) {
    return ok({
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    });
}

// ============================================================================
// ENDPOINT DE PRUEBA: EXPORTAR NIVELES
// ============================================================================

/**
 * GET /_functions/exportarNiveles?skip=0&limit=100
 * Endpoint de prueba para verificar que el import funciona
 */
export async function get_exportarNiveles(request) {
    try {
        const { skip = '0', limit = '100' } = request.query;
        const skipNum = parseInt(skip);
        const limitNum = parseInt(limit);

        console.log(`📤 HTTP: exportarNiveles llamado con skip=${skipNum}, limit=${limitNum}`);

        const resultado = await exportarNiveles(skipNum, limitNum);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(resultado)
        });

    } catch (error) {
        console.error('❌ Error en HTTP exportarNiveles:', error);
        return serverError({
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_exportarNiveles(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

// ============================================================================
// ENDPOINTS DE EXPORTACIÓN PARA MIGRACIÓN A POSTGRESQL
// ============================================================================

/**
 * GET /_functions/exportarPeople?skip=0&limit=100
 */
export async function get_exportarPeople(request) {
    try {
        const { skip = '0', limit = '100' } = request.query;
        const resultado = await exportarPeople(parseInt(skip), parseInt(limit));
        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(resultado)
        });
    } catch (error) {
        console.error('❌ Error en exportarPeople:', error);
        return serverError({ body: JSON.stringify({ success: false, error: error.message }) });
    }
}

export function options_exportarPeople(request) {
    return ok({ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}

/**
 * GET /_functions/exportarAcademica?skip=0&limit=100
 */
export async function get_exportarAcademica(request) {
    try {
        const { skip = '0', limit = '100' } = request.query;
        const resultado = await exportarAcademica(parseInt(skip), parseInt(limit));
        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(resultado)
        });
    } catch (error) {
        console.error('❌ Error en exportarAcademica:', error);
        return serverError({ body: JSON.stringify({ success: false, error: error.message }) });
    }
}

export function options_exportarAcademica(request) {
    return ok({ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}

/**
 * GET /_functions/exportarClasses?skip=0&limit=100
 */
export async function get_exportarClasses(request) {
    try {
        const { skip = '0', limit = '100' } = request.query;
        const resultado = await exportarClasses(parseInt(skip), parseInt(limit));
        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(resultado)
        });
    } catch (error) {
        console.error('❌ Error en exportarClasses:', error);
        return serverError({ body: JSON.stringify({ success: false, error: error.message }) });
    }
}

export function options_exportarClasses(request) {
    return ok({ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}

/**
 * GET /_functions/exportarBooking?skip=0&limit=100
 */
export async function get_exportarBooking(request) {
    try {
        const { skip = '0', limit = '100' } = request.query;
        const resultado = await exportarBooking(parseInt(skip), parseInt(limit));
        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(resultado)
        });
    } catch (error) {
        console.error('❌ Error en exportarBooking:', error);
        return serverError({ body: JSON.stringify({ success: false, error: error.message }) });
    }
}

export function options_exportarBooking(request) {
    return ok({ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}

/**
 * GET /_functions/exportarAdvisors?skip=0&limit=100
 */
export async function get_exportarAdvisors(request) {
    try {
        const { skip = '0', limit = '100' } = request.query;
        const resultado = await exportarAdvisors(parseInt(skip), parseInt(limit));
        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(resultado)
        });
    } catch (error) {
        console.error('❌ Error en exportarAdvisors:', error);
        return serverError({ body: JSON.stringify({ success: false, error: error.message }) });
    }
}

export function options_exportarAdvisors(request) {
    return ok({ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}

/**
 * GET /_functions/exportarUsuariosRoles?skip=0&limit=100
 */
export async function get_exportarUsuariosRoles(request) {
    try {
        const { skip = '0', limit = '100' } = request.query;
        const resultado = await exportarUsuariosRoles(parseInt(skip), parseInt(limit));
        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(resultado)
        });
    } catch (error) {
        console.error('❌ Error en exportarUsuariosRoles:', error);
        return serverError({ body: JSON.stringify({ success: false, error: error.message }) });
    }
}

export function options_exportarUsuariosRoles(request) {
    return ok({ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}

/**
 * GET /_functions/exportarRolPermisos?skip=0&limit=100
 */
export async function get_exportarRolPermisos(request) {
    try {
        const { skip = '0', limit = '100' } = request.query;
        const resultado = await exportarRolPermisos(parseInt(skip), parseInt(limit));
        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(resultado)
        });
    } catch (error) {
        console.error('❌ Error en exportarRolPermisos:', error);
        return serverError({ body: JSON.stringify({ success: false, error: error.message }) });
    }
}

export function options_exportarRolPermisos(request) {
    return ok({ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}

/**
 * GET /_functions/exportarContratos?skip=0&limit=100
 */
export async function get_exportarContratos(request) {
    try {
        const { skip = '0', limit = '100' } = request.query;
        const resultado = await exportarContratos(parseInt(skip), parseInt(limit));
        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(resultado)
        });
    } catch (error) {
        console.error('❌ Error en exportarContratos:', error);
        return serverError({ body: JSON.stringify({ success: false, error: error.message }) });
    }
}

export function options_exportarContratos(request) {
    return ok({ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}

/**
 * GET /_functions/exportarCalendario?skip=0&limit=100
 */
export async function get_exportarCalendario(request) {
    try {
        const { skip = '0', limit = '100' } = request.query;
        const resultado = await exportarCalendario(parseInt(skip), parseInt(limit));
        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(resultado)
        });
    } catch (error) {
        console.error('❌ Error en exportarCalendario:', error);
        return serverError({ body: JSON.stringify({ success: false, error: error.message }) });
    }
}

export function options_exportarCalendario(request) {
    return ok({ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}

/**
 * GET /_functions/exportarMetadata
 * Retorna metadata de todas las colecciones (nombre y totalCount)
 */
export async function get_exportarMetadata(request) {
    try {
        const resultado = await exportarMetadata();
        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(resultado)
        });
    } catch (error) {
        console.error('❌ Error en exportarMetadata:', error);
        return serverError({ body: JSON.stringify({ success: false, error: error.message }) });
    }
}

export function options_exportarMetadata(request) {
    return ok({ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}



// ============================================================================
// ENDPOINTS PORTAL DE ESTUDIANTES
// ============================================================================

/**
 * GET /_functions/searchStudentByEmail?email=estudiante@lgs.com
 * Busca un estudiante por su email en la colección ACADEMICA
 */
export async function get_searchStudentByEmail(request) {
    try {
        const { query } = request;
        const email = query.email;

        console.log('🔍 HTTP searchStudentByEmail: Buscando estudiante con email:', email);

        if (!email) {
            return badRequest({
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Email es requerido'
                })
            });
        }

        // Buscar en ACADEMICA por campo "email"
        const results = await wixData.query("ACADEMICA")
            .eq("email", email)
            .limit(1)
            .find();

        if (results.items.length === 0) {
            console.log('⚠️ No se encontró estudiante con email:', email);
            return ok({
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'No se encontró estudiante con este email',
                    student: null
                })
            });
        }

        const student = results.items[0];
        console.log('✅ Estudiante encontrado:', student._id, student.primerNombre, student.primerApellido);

        return ok({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({
                success: true,
                student: {
                    _id: student._id,
                    email: student.email,
                    primerNombre: student.primerNombre,
                    segundoNombre: student.segundoNombre || null,
                    primerApellido: student.primerApellido,
                    segundoApellido: student.segundoApellido || null,
                    numeroId: student.numeroId,
                    nivel: student.nivel,
                    step: student.step,
                    nivelParalelo: student.nivelParalelo || null,
                    stepParalelo: student.stepParalelo || null,
                    foto: student.foto || null,
                    celular: student.celular || null,
                    contrato: student.contrato || null,
                    finalContrato: student.finalContrato || null,
                    vigencia: student.vigencia || null,
                    estadoInactivo: student.estadoInactivo || false,
                    peopleId: student.peopleId || student.usuarioId || null
                }
            })
        });

    } catch (error) {
        console.error('❌ Error en searchStudentByEmail:', error);
        return serverError({
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            })
        });
    }
}

export function options_searchStudentByEmail(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
        }
    });
}

/**
 * GET /_functions/getNextClass?studentId=xxx
 * Retorna la próxima clase del estudiante
 */
export async function get_getNextClass(request) {
    try {
        const { query } = request;
        const studentId = query.studentId;

        if (!studentId) {
            return badRequest({
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: false, error: 'studentId es requerido' })
            });
        }

        const now = new Date();

        // Buscar la próxima clase del estudiante
        const results = await wixData.query("CLASSES")
            .eq("usuarioId", studentId)
            .gt("dia", now)
            .ascending("dia")
            .limit(1)
            .find();

        if (results.items.length === 0) {
            return ok({
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: true, nextClass: null })
            });
        }

        const clase = results.items[0];

        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                success: true,
                nextClass: {
                    _id: clase._id,
                    dia: clase.dia,
                    nivel: clase.nivel,
                    step: clase.step,
                    nombreEvento: clase.nombreEvento,
                    advisor: clase.advisor,
                    advisorNombre: clase.advisorNombre || null,
                    zoom: clase.zoom || null,
                    cancelo: clase.cancelo || false
                }
            })
        });

    } catch (error) {
        console.error('❌ Error en getNextClass:', error);
        return serverError({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: false, error: error.message })
        });
    }
}

export function options_getNextClass(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

/**
 * GET /_functions/getUpcomingEvents?studentId=xxx&limit=4
 * Retorna las próximas N clases del estudiante
 */
export async function get_getUpcomingEvents(request) {
    try {
        const { query } = request;
        const studentId = query.studentId;
        const limit = parseInt(query.limit) || 4;

        if (!studentId) {
            return badRequest({
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: false, error: 'studentId es requerido' })
            });
        }

        const now = new Date();

        // Buscar las próximas clases del estudiante
        const results = await wixData.query("CLASSES")
            .eq("usuarioId", studentId)
            .gt("dia", now)
            .ascending("dia")
            .limit(limit)
            .find();

        const events = results.items.map(clase => ({
            _id: clase._id,
            dia: clase.dia,
            nivel: clase.nivel,
            step: clase.step,
            nombreEvento: clase.nombreEvento,
            advisor: clase.advisor,
            advisorNombre: clase.advisorNombre || null,
            cancelo: clase.cancelo || false,
            tipoEvento: clase.tipoEvento || 'SESSION'
        }));

        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: true, events })
        });

    } catch (error) {
        console.error('❌ Error en getUpcomingEvents:', error);
        return serverError({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: false, error: error.message })
        });
    }
}

export function options_getUpcomingEvents(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

/**
 * GET /_functions/consolidadoNumericoAsistencia?studentId=xxx
 * Retorna estadísticas de asistencia del estudiante
 */
export async function get_consolidadoNumericoAsistencia(request) {
    try {
        const { query } = request;
        const studentId = query.studentId;

        if (!studentId) {
            return badRequest({
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: false, error: 'studentId es requerido' })
            });
        }

        // Obtener todas las clases del estudiante
        const results = await wixData.query("CLASSES")
            .eq("usuarioId", studentId)
            .find();

        let asistidos = 0;
        let cancelados = 0;
        let noAsistidos = 0;

        results.items.forEach(clase => {
            if (clase.asistio === true) {
                asistidos++;
            } else if (clase.cancelo === true) {
                cancelados++;
            } else if (clase.dia < new Date()) {
                // Si la clase ya pasó y no asistió ni canceló
                noAsistidos++;
            }
        });

        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                success: true,
                stats: {
                    asistidos,
                    cancelados,
                    noAsistidos
                }
            })
        });

    } catch (error) {
        console.error('❌ Error en consolidadoNumericoAsistencia:', error);
        return serverError({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: false, error: error.message })
        });
    }
}

export function options_consolidadoNumericoAsistencia(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

/**
 * POST /_functions/cancelEvent
 * Cancela una clase del estudiante
 */
export async function post_cancelEvent(request) {
    try {
        const { body } = request;
        const { eventId, studentId } = JSON.parse(body);

        if (!eventId || !studentId) {
            return badRequest({
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: false, error: 'eventId y studentId son requeridos' })
            });
        }

        // Verificar que la clase existe y pertenece al estudiante
        const clase = await wixData.get("CLASSES", eventId);

        if (!clase || clase.usuarioId !== studentId) {
            return badRequest({
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: false, error: 'Clase no encontrada o no pertenece al estudiante' })
            });
        }

        // Verificar que la clase no haya pasado
        const now = new Date();
        const claseDia = new Date(clase.dia);

        if (claseDia < now) {
            return badRequest({
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: false, error: 'No se puede cancelar una clase que ya pasó' })
            });
        }

        // Verificar que falten más de 60 minutos
        const minutosHastaClase = (claseDia.getTime() - now.getTime()) / (1000 * 60);
        if (minutosHastaClase < 60) {
            return badRequest({
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: false, error: 'Debes cancelar con al menos 60 minutos de anticipación' })
            });
        }

        // Marcar la clase como cancelada
        await wixData.update("CLASSES", {
            _id: eventId,
            cancelo: true,
            asistio: false
        });

        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: true, message: 'Clase cancelada exitosamente' })
        });

    } catch (error) {
        console.error('❌ Error en cancelEvent:', error);
        return serverError({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: false, error: error.message })
        });
    }
}

export function options_cancelEvent(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

/**
 * GET /_functions/getAvailableEvents?studentId=xxx&nivel=BN1&tipoEvento=SESSION&fecha=2025-01-11
 * Retorna eventos disponibles para agendar
 */
export async function get_getAvailableEvents(request) {
    try {
        const { query } = request;
        const studentId = query.studentId;
        const nivel = query.nivel;
        const tipoEvento = query.tipoEvento;
        const fecha = query.fecha;

        if (!studentId || !nivel || !tipoEvento || !fecha) {
            return badRequest({
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: false, error: 'Todos los parámetros son requeridos' })
            });
        }

        // Parsear fecha
        const fechaInicio = new Date(fecha);
        fechaInicio.setHours(0, 0, 0, 0);

        const fechaFin = new Date(fecha);
        fechaFin.setHours(23, 59, 59, 999);

        // Buscar eventos del calendario para ese día y nivel
        const calendarioResults = await wixData.query("CALENDARIO")
            .eq("tituloONivel", nivel)
            .eq("evento", tipoEvento)
            .ge("dia", fechaInicio)
            .le("dia", fechaFin)
            .ascending("dia")
            .find();

        // Para cada evento, contar cuántos estudiantes están inscritos
        const eventosConCapacidad = await Promise.all(
            calendarioResults.items.map(async (evento) => {
                const inscritosResults = await wixData.query("CLASSES")
                    .eq("eventoId", evento._id)
                    .find();

                const usuariosInscritos = inscritosResults.items.length;
                const limiteUsuarios = evento.limiteUsuarios || 6;
                const cupoCompleto = usuariosInscritos >= limiteUsuarios;

                return {
                    _id: evento._id,
                    dia: evento.dia,
                    nivel: evento.tituloONivel,
                    nombreEvento: evento.nombreEvento || evento.evento,
                    advisor: evento.advisor,
                    advisorNombre: evento.advisorNombre || null,
                    limiteUsuarios,
                    usuariosInscritos,
                    cupoCompleto
                };
            })
        );

        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: true, events: eventosConCapacidad })
        });

    } catch (error) {
        console.error('❌ Error en getAvailableEvents:', error);
        return serverError({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: false, error: error.message })
        });
    }
}

export function options_getAvailableEvents(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

/**
 * POST /_functions/bookEvent
 * Agenda una clase para el estudiante
 */
export async function post_bookEvent(request) {
    try {
        const { body } = request;
        const { eventId, studentId, tipoEvento } = JSON.parse(body);

        if (!eventId || !studentId || !tipoEvento) {
            return badRequest({
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: false, error: 'eventId, studentId y tipoEvento son requeridos' })
            });
        }

        // Obtener el evento del calendario
        const evento = await wixData.get("CALENDARIO", eventId);

        if (!evento) {
            return badRequest({
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: false, error: 'Evento no encontrado' })
            });
        }

        // Verificar que el evento no haya pasado
        const now = new Date();
        const eventoDia = new Date(evento.dia);

        if (eventoDia < now) {
            return badRequest({
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: false, error: 'No se puede agendar un evento que ya pasó' })
            });
        }

        // Verificar capacidad
        const inscritosResults = await wixData.query("CLASSES")
            .eq("eventoId", eventId)
            .find();

        const limiteUsuarios = evento.limiteUsuarios || 6;
        if (inscritosResults.items.length >= limiteUsuarios) {
            return badRequest({
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: false, error: 'El evento está lleno' })
            });
        }

        // Verificar que el estudiante no esté ya inscrito
        const yaInscrito = inscritosResults.items.some(c => c.usuarioId === studentId);
        if (yaInscrito) {
            return badRequest({
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: false, error: 'Ya estás inscrito en este evento' })
            });
        }

        // Obtener datos del estudiante
        const studentResults = await wixData.query("ACADEMICA")
            .eq("_id", studentId)
            .limit(1)
            .find();

        if (studentResults.items.length === 0) {
            return badRequest({
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: false, error: 'Estudiante no encontrado' })
            });
        }

        const student = studentResults.items[0];

        // Crear la clase
        const nuevaClase = {
            usuarioId: studentId,
            peopleId: student.peopleId || student.usuarioId,
            eventoId: eventId,
            dia: evento.dia,
            nivel: evento.nivel,
            step: student.step,
            nombreEvento: evento.nombreEvento || evento.tipoEvento,
            tipoEvento: tipoEvento,
            advisor: evento.advisor,
            advisorNombre: evento.advisorNombre || null,
            zoom: evento.zoom || null,
            asistio: false,
            cancelo: false,
            _createdDate: new Date()
        };

        await wixData.insert("CLASSES", nuevaClase);

        return ok({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: true, message: 'Clase agendada exitosamente' })
        });

    } catch (error) {
        console.error('❌ Error en bookEvent:', error);
        return serverError({
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: false, error: error.message })
        });
    }
}

export function options_bookEvent(request) {
    return ok({
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}