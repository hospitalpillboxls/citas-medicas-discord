const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

// Horarios por día de la semana.
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


function json(statusCode, data) {

  return {
    statusCode,

    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },

    body: JSON.stringify(data)
  };
}


exports.handler = async function(event) {

  try {

    if (!SUPABASE_URL) {
      return json(500, {
        ok: false,
        error: "Falta la variable SUPABASE_URL en Netlify."
      });
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, {
        ok: false,
        error:
          "Falta la variable SUPABASE_SERVICE_ROLE_KEY en Netlify."
      });
    }


    const date = event.queryStringParameters?.date;


    if (!date) {
      return json(400, {
        ok: false,
        error: "Falta el parámetro date."
      });
    }


    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json(400, {
        ok: false,
        error: "Formato de fecha incorrecto."
      });
    }


    // Crear fecha evitando problemas de zona horaria.
    const fecha = new Date(`${date}T12:00:00`);

    if (Number.isNaN(fecha.getTime())) {
      return json(400, {
        ok: false,
        error: "Fecha inválida."
      });
    }


    const diaSemana = fecha.getDay();

    const horarios = SCHEDULE[diaSemana] || [];


    if (horarios.length === 0) {

      return json(200, {
        ok: true,
        date,
        slots: []
      });

    }


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

      console.error("Supabase:", texto);

      return json(500, {
        ok: false,
        error: "No se pudieron consultar las citas."
      });

    }


    let citas;

    try {
      citas = JSON.parse(texto);
    } catch {
      citas = [];
    }


    const ocupadas = new Set(
      citas.map(cita => String(cita.time).slice(0, 5))
    );


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

    console.error(error);

    return json(500, {

      ok: false,

      error: error.message || "Error interno."

    });

  }

};
