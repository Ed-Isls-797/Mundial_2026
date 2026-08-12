//
// Cubre el punto 3 del PDF (2a entrega, 12/08/2026): "Modelo Monte Carlo"
//
// Estrategia: reutiliza los lambdas (goles esperados) calculados por el
// modelo Poisson y simula N partidos independientes muestreando el marcador
// de cada equipo con el algoritmo de Knuth para variables Poisson.
// Con muchas simulaciones (ej. 10,000) las frecuencias observadas convergen
// a las probabilidades teóricas del modelo Poisson, pero además permiten
// obtener distribuciones más ricas (ej. marcador exacto más frecuente,
// promedio de goles simulado, intervalos de confianza empíricos).

module.exports = function (db) {
    const poissonService = require('./poissonService')(db);

    // Genera una muestra Poisson(lambda) usando el algoritmo de Knuth
    function muestraPoisson(lambda) {
        const L = Math.exp(-lambda);
        let k = 0;
        let p = 1;
        do {
            k++;
            p *= Math.random();
        } while (p > L);
        return k - 1;
    }

    function round2(n) {
        return Math.round(n * 100) / 100;
    }

    function simularMonteCarlo(idLocal, idVisitante, numSimulaciones, callback) {
        numSimulaciones = Math.min(Math.max(numSimulaciones || 10000, 100), 100000);

        poissonService.calcularLambdas(idLocal, idVisitante, (err, lambdas) => {
            if (err) return callback(err);

            const { lambda_local, lambda_visitante } = lambdas;

            let victoriasLocal = 0, empates = 0, victoriasVisitante = 0;
            let totalGolesLocal = 0, totalGolesVisitante = 0;
            const conteoMarcadores = {}; // "gl-gv" -> conteo

            for (let i = 0; i < numSimulaciones; i++) {
                const golesLocal = muestraPoisson(lambda_local);
                const golesVisitante = muestraPoisson(lambda_visitante);

                totalGolesLocal += golesLocal;
                totalGolesVisitante += golesVisitante;

                if (golesLocal > golesVisitante) victoriasLocal++;
                else if (golesLocal === golesVisitante) empates++;
                else victoriasVisitante++;

                const clave = `${golesLocal}-${golesVisitante}`;
                conteoMarcadores[clave] = (conteoMarcadores[clave] || 0) + 1;
            }

            // Top 5 marcadores más frecuentes
            const marcadoresOrdenados = Object.entries(conteoMarcadores)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([marcador, conteo]) => ({
                    marcador,
                    frecuencia: conteo,
                    porcentaje: round2((conteo / numSimulaciones) * 100)
                }));

            callback(null, {
                simulaciones: numSimulaciones,
                lambda_local,
                lambda_visitante,
                probabilidad_local: round2((victoriasLocal / numSimulaciones) * 100),
                probabilidad_empate: round2((empates / numSimulaciones) * 100),
                probabilidad_visitante: round2((victoriasVisitante / numSimulaciones) * 100),
                promedio_goles_local: round2(totalGolesLocal / numSimulaciones),
                promedio_goles_visitante: round2(totalGolesVisitante / numSimulaciones),
                marcadores_mas_frecuentes: marcadoresOrdenados
            });
        });
    }

    return { simularMonteCarlo, muestraPoisson };
};