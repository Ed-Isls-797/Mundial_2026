//
// Cubre el punto 2 del PDF (2a entrega, 12/08/2026):
//   "Alimentación y funcionamiento del modelo Poisson"
//
// Idea: cada selección anota goles según una distribución de Poisson con
// media (lambda) estimada a partir de:
//   - su promedio histórico de goles a favor
//   - el promedio de goles que su rival suele recibir
//   - un ajuste multiplicativo según la relación de Índice de Fuerza (IF)
//
// P(X = k) = (lambda^k * e^-lambda) / k!

module.exports = function (db) {
    const indiceFuerzaService = require('./indiceFuerzaService')(db);

    const MAX_GOLES = 6; // suficiente para cubrir >99% de la masa de probabilidad

    function factorial(n) {
        let r = 1;
        for (let i = 2; i <= n; i++) r *= i;
        return r;
    }

    function poissonPMF(lambda, k) {
        return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
    }

    function round2(n) {
        return Math.round(n * 100) / 100;
    }

    // Obtiene promedio de goles a favor / en contra desde estadisticas_seleccion
    function obtenerEstadisticasGoles(idSeleccion, callback) {
        db.query(
            `SELECT goles_favor, goles_contra, partidos_jugados
             FROM estadisticas_seleccion WHERE id_seleccion = ?`,
            [idSeleccion],
            (err, rows) => {
                if (err) return callback(err);
                const s = rows[0];
                if (!s || !s.partidos_jugados) {
                    return callback(null, { promedioFavor: 1.2, promedioContra: 1.2 });
                }
                callback(null, {
                    promedioFavor: s.goles_favor / s.partidos_jugados,
                    promedioContra: s.goles_contra / s.partidos_jugados
                });
            }
        );
    }

    // Calcula lambda_local y lambda_visitante para un enfrentamiento
    function calcularLambdas(idLocal, idVisitante, callback) {
        obtenerEstadisticasGoles(idLocal, (err, statsLocal) => {
            if (err) return callback(err);
            obtenerEstadisticasGoles(idVisitante, (err2, statsVisitante) => {
                if (err2) return callback(err2);

                indiceFuerzaService.calcularIndiceFuerza(idLocal, (err3, ifLocal) => {
                    if (err3) return callback(err3);
                    indiceFuerzaService.calcularIndiceFuerza(idVisitante, (err4, ifVisitante) => {
                        if (err4) return callback(err4);

                        // Ventaja de localía estándar en modelos de goles (bono ~10%)
                        const BONUS_LOCAL = 1.10;

                        // Ajuste por relación de Índice de Fuerza (acotado entre 0.7 y 1.3
                        // para evitar lambdas extremos)
                        const ratioIF = ifLocal.indice_fuerza / (ifVisitante.indice_fuerza || 1);
                        const ajusteLocal = Math.max(0.7, Math.min(1.3, ratioIF));
                        const ajusteVisitante = Math.max(0.7, Math.min(1.3, 1 / ratioIF));

                        let lambdaLocal =
                            ((statsLocal.promedioFavor + statsVisitante.promedioContra) / 2) *
                            ajusteLocal * BONUS_LOCAL;

                        let lambdaVisitante =
                            ((statsVisitante.promedioFavor + statsLocal.promedioContra) / 2) *
                            ajusteVisitante;

                        // Evitar lambdas de 0 o negativos
                        lambdaLocal = Math.max(0.2, lambdaLocal);
                        lambdaVisitante = Math.max(0.2, lambdaVisitante);

                        callback(null, {
                            lambda_local: round2(lambdaLocal),
                            lambda_visitante: round2(lambdaVisitante),
                            indice_fuerza_local: ifLocal.indice_fuerza,
                            indice_fuerza_visitante: ifVisitante.indice_fuerza
                        });
                    });
                });
            });
        });
    }

    // Construye la matriz de probabilidades de marcador y agrega resultados
    function simularPoisson(idLocal, idVisitante, callback) {
        calcularLambdas(idLocal, idVisitante, (err, lambdas) => {
            if (err) return callback(err);

            const { lambda_local, lambda_visitante } = lambdas;

            let probLocal = 0, probEmpate = 0, probVisitante = 0;
            let marcadorMasProbable = { local: 0, visitante: 0, prob: 0 };
            const matriz = [];

            for (let gl = 0; gl <= MAX_GOLES; gl++) {
                const filaProbs = [];
                for (let gv = 0; gv <= MAX_GOLES; gv++) {
                    const p = poissonPMF(lambda_local, gl) * poissonPMF(lambda_visitante, gv);
                    filaProbs.push(round2(p * 100));

                    if (gl > gv) probLocal += p;
                    else if (gl === gv) probEmpate += p;
                    else probVisitante += p;

                    if (p > marcadorMasProbable.prob) {
                        marcadorMasProbable = { local: gl, visitante: gv, prob: p };
                    }
                }
                matriz.push(filaProbs);
            }

            callback(null, {
                lambda_local,
                lambda_visitante,
                indice_fuerza_local: lambdas.indice_fuerza_local,
                indice_fuerza_visitante: lambdas.indice_fuerza_visitante,
                probabilidad_local: round2(probLocal * 100),
                probabilidad_empate: round2(probEmpate * 100),
                probabilidad_visitante: round2(probVisitante * 100),
                marcador_mas_probable: {
                    resultado: `${marcadorMasProbable.local} - ${marcadorMasProbable.visitante}`,
                    probabilidad: round2(marcadorMasProbable.prob * 100)
                },
                matriz_marcadores: matriz, // [goles_local][goles_visitante] -> prob %
                max_goles: MAX_GOLES
            });
        });
    }

    return { calcularLambdas, simularPoisson, poissonPMF };
};