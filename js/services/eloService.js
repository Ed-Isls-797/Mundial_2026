//
// Cubre el punto F del PDF (MIS-Mundial 2026): "Actualizar el Rating ELO"
// y el punto 1/2 de la 1a entrega (10/08/2026):
//   a. Obtencion del Rating
//   b. Calculo de la probabilidad esperada
//   c. Simulacion del juego del partido (resultado real -> S_A)
//   d. Actualizacion del Rating
//   e. Vistas de posibles escenarios
//
// Formula estandar ELO:
//   E_A = 1 / (1 + 10^((R_B - R_A) / 400))
//   R_A' = R_A + K * (S_A - E_A)
//
// S_A = 1 si gana, 0.5 si empata, 0 si pierde (visto desde el equipo A)

module.exports = function (db) {
    var K_FACTOR_DEFAULT = 30;

    function obtenerRating(idSeleccion, callback) {
        db.query('SELECT rating_actual FROM elo_rating WHERE id_seleccion = ?', [idSeleccion], function (err, rows) {
            if (err) return callback(err);
            if (rows.length) return callback(null, Number(rows[0].rating_actual));

            db.query(
                'INSERT INTO elo_rating (id_seleccion, rating_actual, rating_inicial) VALUES (?, 1500, 1500)',
                [idSeleccion],
                function (err2) { callback(err2, 1500); }
            );
        });
    }

    function calcularProbabilidadEsperada(ratingA, ratingB) {
        return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    }

    function calcularResultadoReal(golesA, golesB) {
        if (golesA > golesB) return 1;
        if (golesA === golesB) return 0.5;
        return 0;
    }

    function round2(n) {
        return Math.round(n * 100) / 100;
    }

    function actualizarRating(idPartido, idLocal, idVisitante, golesLocal, golesVisitante, kFactor, callback) {
        kFactor = kFactor || K_FACTOR_DEFAULT;

        obtenerRating(idLocal, function (err, ratingLocal) {
            if (err) return callback(err);
            obtenerRating(idVisitante, function (err2, ratingVisitante) {
                if (err2) return callback(err2);

                var probLocal = calcularProbabilidadEsperada(ratingLocal, ratingVisitante);
                var probVisitante = 1 - probLocal;
                var resultLocal = calcularResultadoReal(golesLocal, golesVisitante);
                var resultVisitante = 1 - resultLocal;

                var nuevoLocal = ratingLocal + kFactor * (resultLocal - probLocal);
                var nuevoVisitante = ratingVisitante + kFactor * (resultVisitante - probVisitante);

                db.query(
                    'UPDATE elo_rating SET rating_actual = ?, fecha_actualizacion = NOW() WHERE id_seleccion = ?',
                    [nuevoLocal, idLocal],
                    function (err3) {
                        if (err3) return callback(err3);

                        db.query(
                            'UPDATE elo_rating SET rating_actual = ?, fecha_actualizacion = NOW() WHERE id_seleccion = ?',
                            [nuevoVisitante, idVisitante],
                            function (err4) {
                                if (err4) return callback(err4);

                                db.query(
                                    'INSERT INTO elo_historial ' +
                                    '(id_partido, id_seleccion, rating_antes, rating_despues, probabilidad_esperada, resultado_real, k_factor) ' +
                                    'VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)',
                                    [
                                        idPartido, idLocal, ratingLocal, nuevoLocal, probLocal, resultLocal, kFactor,
                                        idPartido, idVisitante, ratingVisitante, nuevoVisitante, probVisitante, resultVisitante, kFactor
                                    ],
                                    function (err5) {
                                        if (err5) return callback(err5);
                                        callback(null, {
                                            local: {
                                                rating_antes: round2(ratingLocal),
                                                rating_despues: round2(nuevoLocal),
                                                prob_esperada: round2(probLocal)
                                            },
                                            visitante: {
                                                rating_antes: round2(ratingVisitante),
                                                rating_despues: round2(nuevoVisitante),
                                                prob_esperada: round2(probVisitante)
                                            }
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
            });
        });
    }

    function verEscenarios(idLocal, idVisitante, callback) {
        obtenerRating(idLocal, function (err, ratingLocal) {
            if (err) return callback(err);
            obtenerRating(idVisitante, function (err2, ratingVisitante) {
                if (err2) return callback(err2);

                var probLocal = calcularProbabilidadEsperada(ratingLocal, ratingVisitante);
                var probVisitante = 1 - probLocal;
                var kFactor = K_FACTOR_DEFAULT;

                var escenarios = [1, 0.5, 0].map(function (resultLocal) {
                    var resultVisitante = 1 - resultLocal;
                    return {
                        escenario: resultLocal === 1 ? 'Gana local' : resultLocal === 0.5 ? 'Empate' : 'Gana visitante',
                        rating_local_resultante: round2(ratingLocal + kFactor * (resultLocal - probLocal)),
                        rating_visitante_resultante: round2(ratingVisitante + kFactor * (resultVisitante - probVisitante))
                    };
                });

                callback(null, {
                    rating_local_actual: round2(ratingLocal),
                    rating_visitante_actual: round2(ratingVisitante),
                    probabilidad_esperada_local: round2(probLocal),
                    probabilidad_esperada_visitante: round2(probVisitante),
                    escenarios: escenarios
                });
            });
        });
    }

    function obtenerTablaRatingElo(callback) {
        db.query(
            'SELECT s.id_seleccion, s.nombre, s.bandera, e.rating_actual, e.rating_inicial, e.fecha_actualizacion ' +
            'FROM elo_rating e ' +
            'JOIN selecciones s ON s.id_seleccion = e.id_seleccion ' +
            'ORDER BY e.rating_actual DESC',
            callback
        );
    }

    return {
        obtenerRating: obtenerRating,
        calcularProbabilidadEsperada: calcularProbabilidadEsperada,
        calcularResultadoReal: calcularResultadoReal,
        actualizarRating: actualizarRating,
        verEscenarios: verEscenarios,
        obtenerTablaRatingElo: obtenerTablaRatingElo,
        K_FACTOR_DEFAULT: K_FACTOR_DEFAULT
    };
};