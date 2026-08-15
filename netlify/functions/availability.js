const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

// Horarios disponibles por día
// 0 = domingo
// 1 = lunes
// 2 = martes
// 3 = miércoles
// 4 = jueves
// 5 = viernes
// 6 = sábado

const SCHEDULE = {
  0: [],

  1: [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30"
  ],

  2: [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30"
  ],

  3: [
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30"
  ],

  4: [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30"
  ],

  5: [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30"
  ],

  6: []
};

function json(statusCode, body) {
  return {
    statusCode,

    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    },

    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  try {

    // CORS
    if (event.httpMethod === "OPTIONS") {
      return json(200, {
        ok: true
      });
    }

    // Solo GET
    if (event.httpMethod !== "GET") {
      return json(405, {
        ok: false,
        error: "Método no permitido."
      });
    }

    // Comprobar variables de Netlify
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, {
        ok: false,
        error:
          "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Netlify."
      });
    }

    // Obtener fecha
    const date =
      event.queryStringParameters?.date;

    if (!date) {
      return json(400, {
        ok: false,
        error: "Falta la fecha."
      });
    }

    // Comprobar formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json(400, {
        ok: false,
        error: "La fecha debe tener formato YYYY-MM-DD."
      });
    }

    /*
      Creamos la fecha usando UTC para evitar
      problemas de cambio de día por zona horaria.
    */
    const fecha = new Date(`${date}T12:00:00Z`);

    if (Number.isNaN(fecha.getTime())) {
      return json(400, {
        ok: false,
        error: "La fecha no es válida."
      });
    }

    const diaSemana = fecha.getUTCDay();

    const horarios =
      SCHEDULE[diaSemana] || [];

    // Si ese día no trabaja
    if (horarios.length === 0) {
      return json(200, {
        ok: true,
        date,
        slots: []
      });
    }

    /*
      Consultar las citas existentes en Supabase
      para esa fecha.
    */

    const url =
      `${SUPABASE_URL}/rest/v1/appointments` +
      `?date=eq.${encodeURIComponent(date)}` +
      `&select=time,status`;

    const respuesta = await fetch(url, {
      method: "GET",

      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization":
          `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    const texto = await respuesta.text();

    if (!respuesta.ok) {

      console.error(
        "Error de Supabase:",
        respuesta.status,
        texto
      );

      return json(500, {
        ok: false,
        error:
          "No se pudieron consultar las citas."
      });
    }

    let citas = [];

    try {
      citas = JSON.parse(texto);
    } catch (error) {

      console.error(
        "Respuesta inesperada de Supabase:",
        texto
      );

      return json(500, {
        ok: false,
        error:
          "Supabase devolvió una respuesta no válida."
      });
    }

    /*
      Guardamos las horas ocupadas.
    */

    const ocupadas = new Set(
      Array.isArray(citas)
        ? citas
            .filter(cita => {
              return (
                cita.status !== "cancelled" &&
                cita.status !== "cancelada"
              );
            })
            .map(cita => {
              return String(cita.time).slice(0, 5);
            })
        : []
    );

    /*
      Construimos los horarios.
    */

    const slots = horarios.map(time => ({
      time,
      available: !ocupadas.has(time)
    }));

    return json(200, {
      ok: true,
      date,
      slots
    });

} catch (error) {

  console.error("ERROR COMPLETO AVAILABILITY:", error);

  return json(500, {
    ok: false,
    error: error.message || "Error interno del servidor.",
    name: error.name || null,
    cause: error.cause
      ? {
          name: error.cause.name || null,
          message: error.cause.message || null,
          code: error.cause.code || null,
          errno: error.cause.errno || null,
          hostname: error.cause.hostname || null
        }
      : null
  });
}
