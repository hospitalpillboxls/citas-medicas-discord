const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

// =====================================================
// HORARIOS DISPONIBLES
// 0 = domingo
// 1 = lunes
// 2 = martes
// 3 = miércoles
// 4 = jueves
// 5 = viernes
// 6 = sábado
// =====================================================

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


// =====================================================
// RESPUESTA JSON
// =====================================================

function json(statusCode, body) {
  return {
    statusCode: statusCode,

    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    },

    body: JSON.stringify(body)
  };
}


// =====================================================
// FUNCIÓN PRINCIPAL
// =====================================================

exports.handler = async function (event) {
  try {

    // -------------------------------------------------
    // CORS
    // -------------------------------------------------

    if (event.httpMethod === "OPTIONS") {
      return json(200, {
        ok: true
      });
    }


    // -------------------------------------------------
    // SOLO GET
    // -------------------------------------------------

    if (event.httpMethod !== "GET") {
      return json(405, {
        ok: false,
        error: "Método no permitido."
      });
    }


    // -------------------------------------------------
    // COMPROBAR VARIABLES DE NETLIFY
    // -------------------------------------------------

    if (!SUPABASE_URL) {
      console.error("Falta SUPABASE_URL");

      return json(500, {
        ok: false,
        error: "Falta SUPABASE_URL en Netlify."
      });
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Falta SUPABASE_SERVICE_ROLE_KEY");

      return json(500, {
        ok: false,
        error: "Falta SUPABASE_SERVICE_ROLE_KEY en Netlify."
      });
    }


    // -------------------------------------------------
    // OBTENER FECHA
    // -------------------------------------------------

    const date =
      event.queryStringParameters &&
      event.queryStringParameters.date;


    if (!date) {
      return json(400, {
        ok: false,
        error: "Falta la fecha."
      });
    }


    // -------------------------------------------------
    // VALIDAR FORMATO
    // YYYY-MM-DD
    // -------------------------------------------------

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json(400, {
        ok: false,
        error: "La fecha debe tener formato YYYY-MM-DD."
      });
    }


    // -------------------------------------------------
    // CREAR FECHA EN UTC
    // -------------------------------------------------

    const fecha = new Date(
      date + "T12:00:00Z"
    );


    if (Number.isNaN(fecha.getTime())) {
      return json(400, {
        ok: false,
        error: "La fecha no es válida."
      });
    }


    // -------------------------------------------------
    // DÍA DE LA SEMANA
    // -------------------------------------------------

    const diaSemana = fecha.getUTCDay();

    const horarios =
      SCHEDULE[diaSemana] || [];


    // -------------------------------------------------
    // DÍA SIN CONSULTA
    // -------------------------------------------------

    if (horarios.length === 0) {
      return json(200, {
        ok: true,
        date: date,
        slots: []
      });
    }


    // -------------------------------------------------
    // CONSULTAR CITAS EN SUPABASE
    // -------------------------------------------------

    const supabaseUrl =
      SUPABASE_URL.replace(/\/$/, "");

    const url =
      supabaseUrl +
      "/rest/v1/appointments" +
      "?date=eq." +
      encodeURIComponent(date) +
      "&select=time,status";


    console.log(
      "Consultando Supabase:",
      url
    );


    const respuesta = await fetch(url, {
      method: "GET",

      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,

        "Authorization":
          "Bearer " +
          SUPABASE_SERVICE_ROLE_KEY,

        "Content-Type":
          "application/json"
      }
    });


    // -------------------------------------------------
    // LEER RESPUESTA
    // -------------------------------------------------

    const texto =
      await respuesta.text();


    if (!respuesta.ok) {

      console.error(
        "Supabase respondió con error:",
        respuesta.status,
        texto
      );

      return json(500, {
        ok: false,
        error: "No se pudieron consultar las citas.",
        supabase_status: respuesta.status
      });
    }


    // -------------------------------------------------
    // CONVERTIR JSON
    // -------------------------------------------------

    let citas;

    try {

      citas = JSON.parse(texto);

    } catch (error) {

      console.error(
        "Respuesta inválida de Supabase:",
        texto
      );

      return json(500, {
        ok: false,
        error:
          "Supabase devolvió una respuesta no válida."
      });
    }


    // -------------------------------------------------
    // ASEGURAR ARRAY
    // -------------------------------------------------

    if (!Array.isArray(citas)) {
      citas = [];
    }


    // -------------------------------------------------
    // HORAS OCUPADAS
    // -------------------------------------------------

    const ocupadas =
      new Set();


    for (const cita of citas) {

      // Citas canceladas NO bloquean horario

      if (
        cita.status === "cancelled" ||
        cita.status === "cancelada"
      ) {
        continue;
      }


      if (cita.time) {

        const hora =
          String(cita.time).slice(0, 5);

        ocupadas.add(hora);
      }
    }


    // -------------------------------------------------
    // CONSTRUIR SLOTS
    // -------------------------------------------------

    const slots =
      horarios.map(function (time) {

        return {
          time: time,

          available:
            !ocupadas.has(time)
        };

      });


    // -------------------------------------------------
    // RESPUESTA FINAL
    // -------------------------------------------------

    return json(200, {
      ok: true,
      date: date,
      slots: slots
    });


  } catch (error) {

    // -------------------------------------------------
    // ERROR GENERAL
    // -------------------------------------------------

    console.error(
      "Error en availability.js:",
      error
    );


    return json(500, {
      ok: false,

      error:
        error &&
        error.message
          ? error.message
          : "Error interno del servidor."
    });
  }
};
