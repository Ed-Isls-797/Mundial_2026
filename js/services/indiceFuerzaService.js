//
// Cubre los puntos A, B, C del PDF (MIS-Mundial 2026):
//   A. Construir el índice de fuerza (IF)
//   B. Crear el IF mediante una suma de ponderaciones
//   C. Calcular el IF
//
// Rangos calibrados con los datos REALES de estadisticas_seleccion (48 filas, todas completas):
//   ranking_fifa      -> 1 a 103    (1 = mejor, se invierte)
//   valor_plantilla    -> 76,000,000 a 892,000,000
//   posesion_promedio  -> 42.40 a 62.00 (no se usa directo en el IF, ya aportado por forma/goles)
//   titulos_mundiales  -> 0 a 5
//   experiencia_mundiales -> 1 a 23

module.exports = function (db) {
    const eloService = require('./eloService')(db);

    // Rangos reales confirmados en la BD (ver diagnóstico previo)
    const RANGOS = {
        ranking_fifa: { min: 1, max: 103 },
        valor_plantilla: { min: 76000000, max: 892000000 },
        rating_elo: { min: 1000, max: 2000 }, // rango teórico razonable para ELO en un mundial
        titulos_experiencia: { min: 0, max: 100 } // (titulos*20 + experiencia*5) acotado a 100
    };

    function normalizar(valor, min, max) {
        if (valor == null) return 50; // valor neutro si falta el dato
        const v = Math.max(min, Math.min(max, valor));
        return ((v - min) / (max - min)) * 100;
    }

    function obtenerPonderaciones(callback) {
        db.query('SELECT factor, peso FROM ponderacion_indice_fuerza', (err, rows) => {
            if (err) return callback(err);
            const pesos = {};
            rows.forEach(r => { pesos[r.factor] = Number(r.peso); });
            callback(null, pesos);
        });
    }

    // B/C. Calcula el Índice de Fuerza de UNA selección, por suma de ponderaciones
    function calcularIndiceFuerza(idSeleccion, callback) {
        obtenerPonderaciones((err, pesos) => {
            if (err) return callback(err);

            db.query(
                `SELECT ranking_fifa, goles_favor, goles_contra, partidos_jugados,
                        partidos_ganados, valor_plantilla, titulos_mundiales, experiencia_mundiales
                 FROM estadisticas_seleccion WHERE id_seleccion = ?`,
                [idSeleccion],
                (err2, rows) => {
                    if (err2) return callback(err2);
                    const stats = rows[0];

                    eloService.obtenerRating(idSeleccion, (err3, ratingElo) => {
                        if (err3) return callback(err3);

                        const scoreElo = normalizar(ratingElo, RANGOS.rating_elo.min, RANGOS.rating_elo.max);

                        // Ranking FIFA invertido: 1 (mejor) -> ~100, 103 (peor) -> ~0
                        const scoreRanking = stats
                            ? normalizar(RANGOS.ranking_fifa.max - stats.ranking_fifa, 0, RANGOS.ranking_fifa.max - RANGOS.ranking_fifa.min)
                            : 50;

                        const scoreForma = stats && stats.partidos_jugados
                            ? (stats.partidos_ganados / stats.partidos_jugados) * 100
                            : 50;

                        const scorePlantilla = stats
                            ? normalizar(Number(stats.valor_plantilla), RANGOS.valor_plantilla.min, RANGOS.valor_plantilla.max)
                            : 50;

                        const scoreExperiencia = stats
                            ? normalizar((stats.titulos_mundiales * 20) + (stats.experiencia_mundiales * 5), 0, RANGOS.titulos_experiencia.max)
                            : 50;

                        const indiceFuerza =
                            scoreElo * (pesos.rating_elo || 0) +
                            scoreRanking * (pesos.ranking_fifa || 0) +
                            scoreForma * (pesos.forma_reciente || 0) +
                            scorePlantilla * (pesos.plantilla || 0) +
                            scoreExperiencia * (pesos.experiencia || 0);

                        callback(null, {
                            id_seleccion: idSeleccion,
                            rating_elo: round2(ratingElo),
                            score_elo: round2(scoreElo),
                            score_ranking: round2(scoreRanking),
                            score_forma: round2(scoreForma),
                            score_plantilla: round2(scorePlantilla),
                            score_experiencia: round2(scoreExperiencia),
                            indice_fuerza: round2(indiceFuerza)
                        });
                    });
                }
            );
        });
    }

    // Tabla completa de Índice de Fuerza para TODAS las selecciones
    function obtenerTablaIndiceFuerza(callback) {
        db.query('SELECT id_seleccion, nombre, bandera FROM selecciones ORDER BY nombre', (err, selecciones) => {
            if (err) return callback(err);

            const resultado = [];
            let pendientes = selecciones.length;
            if (!pendientes) return callback(null, resultado);

            selecciones.forEach(s => {
                calcularIndiceFuerza(s.id_seleccion, (err2, if_) => {
                    if (!err2) resultado.push({ nombre: s.nombre, bandera: s.bandera, ...if_ });
                    pendientes--;
                    if (pendientes === 0) {
                        resultado.sort((a, b) => b.indice_fuerza - a.indice_fuerza);
                        callback(null, resultado);
                    }
                });
            });
        });
    }

    function round2(n) {
        return Math.round(n * 100) / 100;
    }

    return { calcularIndiceFuerza, obtenerTablaIndiceFuerza, obtenerPonderaciones, normalizar };
};
