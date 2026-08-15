const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  // Permitir comprobación CORS
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  // Solo POST
  if (event.httpMethod !== "POST") {
    return json(405, {
      ok: false,
      error: "Método no permitido."
    });
  }

  try {
    // Comprobar variables de entorno
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, {
        ok: false,
        error: "Faltan las variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Netlify."
      });
    }

    // Leer datos enviados desde index.html
    let datos;

    try {
      datos = JSON.parse(event.body || "{}");
    } catch (error) {
      return json(400, {
        ok: false,
        error: "Los datos recibidos no tienen un formato válido."
      });
    }

    const date = String(datos.date || "").trim();
    const time = String(datos.time || "").trim();
    const name = String(datos.name || "").trim();
    const email = String(datos.email || "").trim();
    const phone = String(datos.phone || "").trim();

    // Validaciones
    if (!date) {
      return json(400, {
        ok: false,
        error: "Falta la fecha."
      });
    }

    if (!time) {
      return json(400, {
        ok: false,
        error: "Falta el horario."
      });
    }

    if (!name) {
      return json(400, {
        ok: false,
        error: "Falta el nombre."
      });
    }

    if (!email) {
      return json(400, {
        ok: false,
        error: "Falta el correo electrónico."
      });
    }

    if (!phone) {
      return json(400, {
        ok: false,
        error: "Falta el teléfono."
      });
    }

    // Validación sencilla del email
    if (!email.includes("@")) {
      return json(400, {
        ok: false,
        error: "El correo electrónico no es válido."
      });
    }

    /*
      1. Comprobar si ya existe una cita
      para esa fecha y hora.
    */

    const consultaUrl =
      `${SUPABASE_URL}/rest/v1/appointments` +
      `?date=eq.${encodeURIComponent(date)}` +
      `&time=eq.${encodeURIComponent(time)}` +
      `&select=id,status`;

    const consulta = await fetch(consultaUrl, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    const consultaTexto = await consulta.text();

    if (!consulta.ok) {
      console.error("Error consultando Supabase:", consultaTexto);

      return json(500, {
        ok: false,
        error: "No se pudo comprobar la disponibilidad."
      });
    }

    let citasExistentes;

    try {
      citasExistentes = JSON.parse(consultaTexto);
    } catch (error) {
      console.error("Respuesta Supabase:", consultaTexto);

      return json(500, {
        ok: false,
        error: "Supabase devolvió una respuesta inesperada."
      });
    }

    if (Array.isArray(citasExistentes) && citasExistentes.length > 0) {
      return json(409, {
        ok: false,
        error: "Ese horario acaba de ser reservado. Elige otro horario."
      });
    }

    /*
      2. Crear la cita
    */

    const nuevaCita = {
      date: date,
      time: time,
      name: name,
      email: email,
      phone: phone,
      status: "confirmed"
    };

    const insercion = await fetch(
      `${SUPABASE_URL}/rest/v1/appointments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify(nuevaCita)
      }
    );

    const insercionTexto = await insercion.text();

    if (!insercion.ok) {
      console.error(
        "Error insertando en Supabase:",
        insercion.status,
        insercionTexto
      );

      return json(500, {
        ok: false,
        error: "No se pudo guardar la cita en Supabase."
      });
    }

    let citaCreada;

    try {
      citaCreada = JSON.parse(insercionTexto);
    } catch (error) {
      citaCreada = null;
    }

    return json(200, {
      ok: true,
      message: "Cita reservada correctamente.",
      appointment: citaCreada
    });

  } catch (error) {
    console.error("Error en book.js:", error);

    return json(500, {
      ok: false,
      error: error.message || "Error interno del servidor."
    });
  }
};
