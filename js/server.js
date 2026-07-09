require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Conexión a la base de datos
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// === ENDPOINTS===
// 1. Obtener todas las selecciones 
app.get('/api/confederaciones', (req, res) => {
    const query = `
        SELECT 
            s.id_seleccion,
            s.nombre AS nombre_seleccion,
            s.entrenador,
            s.historia,
            s.ventajas,
            s.desventajas,
            s.ranking,
            s.bandera,
            c.nombre AS nombre_continente,
            c.confederacion AS siglas_confederacion,
            g.nombre AS nombre_grupo
        FROM selecciones s
        INNER JOIN continentes c ON s.id_continente = c.id_continente
        LEFT JOIN grupo_selecciones gs ON s.id_seleccion = gs.id_seleccion
        LEFT JOIN grupos g ON gs.id_grupo = g.id_grupo
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error en la consulta:', err);
            return res.status(500).json({ error: 'Error al obtener las selecciones' });
        }
        res.json(results);
    });
});

//2.mostrar grupos
app.get('/api/grupos', (req, res) => {
    const query = `
        SELECT 
            g.nombre AS nombre_grupo,
            s.nombre AS nombre_seleccion
        FROM grupos g
        INNER JOIN grupo_selecciones gs ON g.id_grupo = gs.id_grupo
        INNER JOIN selecciones s ON gs.id_seleccion = s.id_seleccion
        ORDER BY g.nombre, s.ranking
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error en la consulta:', err);
            return res.status(500).json({ error: 'Error al obtener los grupos' });
        }

        const grupos = {};
        results.forEach(row => {
            if (!grupos[row.nombre_grupo]) grupos[row.nombre_grupo] = [];
            grupos[row.nombre_grupo].push(row.nombre_seleccion);
        });

        res.json(grupos);
    });
});
















// 2b. Listado simple de grupos (id + letra), para selects/filtros del admin
app.get('/api/grupos/lista', (req, res) => {
    db.query('SELECT id_grupo, nombre FROM grupos ORDER BY nombre', (err, results) => {
        if (err) {
            console.error('Error en la consulta:', err);
            return res.status(500).json({ error: 'Error al obtener el listado de grupos' });
        }
        res.json(results);
    });
});
 
// === MÓDULO DE RESULTADOS / PARTIDOS ===
 
// 3. Obtener las fases del torneo (Fase de grupos, Octavos, Cuartos, Semifinal, etc.)
app.get('/api/fases', (req, res) => {
    db.query('SELECT id_fase, nombre, orden FROM fases ORDER BY orden', (err, results) => {
        if (err) {
            console.error('Error en la consulta:', err);
            return res.status(500).json({ error: 'Error al obtener las fases' });
        }
        res.json(results);
    });
});
 
// 3b. Obtener los estadios disponibles
app.get('/api/estadios', (req, res) => {
    db.query('SELECT id_estadio, nombre, ciudad, pais, capacidad FROM estadios ORDER BY nombre', (err, results) => {
        if (err) {
            console.error('Error en la consulta:', err);
            return res.status(500).json({ error: 'Error al obtener los estadios' });
        }
        res.json(results);
    });
});
 
// 4. Obtener partidos (opcionalmente filtrados por fase o por grupo)
app.get('/api/partidos', (req, res) => {
    const { fase, grupo } = req.query;
 
    let query = `
        SELECT
            p.id_partido,
            f.nombre AS fase,
            gl.nombre AS grupo,
            p.id_local,
            sl.nombre AS local,
            sl.bandera AS bandera_local,
            p.id_visitante,
            sv.nombre AS visitante,
            sv.bandera AS bandera_visitante,
            p.goles_local,
            p.goles_visitante,
            p.penales_local,
            p.penales_visitante,
            p.fecha,
            p.id_estadio,
            e.nombre AS estadio,
            e.ciudad AS ciudad_estadio
        FROM partidos p
        INNER JOIN fases f ON p.id_fase = f.id_fase
        INNER JOIN selecciones sl ON p.id_local = sl.id_seleccion
        INNER JOIN selecciones sv ON p.id_visitante = sv.id_seleccion
        INNER JOIN estadios e ON p.id_estadio = e.id_estadio
        LEFT JOIN grupo_selecciones gsl ON gsl.id_seleccion = p.id_local
        LEFT JOIN grupos gl ON gl.id_grupo = gsl.id_grupo
        WHERE 1 = 1
    `;
    const params = [];
 
    if (fase) {
        query += ' AND f.nombre = ?';
        params.push(fase);
    }
    if (grupo) {
        query += ' AND gl.nombre = ?';
        params.push(grupo);
    }
 
    query += ' ORDER BY f.orden, p.fecha';
 
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Error en la consulta:', err);
            return res.status(500).json({ error: 'Error al obtener los partidos' });
        }
        // 'estado' se deriva: si ya tiene goles cargados, está jugado
        const partidos = results.map(p => ({
            ...p,
            estado: p.goles_local !== null && p.goles_visitante !== null ? 'jugado' : 'programado'
        }));
        res.json(partidos);
    });
});
 
// 5. Cargar (programar) un nuevo partido — usado por el administrador
app.post('/api/partidos', (req, res) => {
    const { id_fase, id_local, id_visitante, fecha, id_estadio } = req.body;
 
    if (!id_fase || !id_local || !id_visitante || !fecha || !id_estadio) {
        return res.status(400).json({
            error: 'Faltan datos obligatorios: fase, local, visitante, fecha y estadio son requeridos'
        });
    }
    if (Number(id_local) === Number(id_visitante)) {
        return res.status(400).json({ error: 'La selección local y visitante no pueden ser la misma' });
    }
 
    const query = `
        INSERT INTO partidos (id_fase, id_local, id_visitante, fecha, id_estadio)
        VALUES (?, ?, ?, ?, ?)
    `;
 
    db.query(query, [id_fase, id_local, id_visitante, fecha, id_estadio], (err, result) => {
        if (err) {
            console.error('Error en la consulta:', err);
            return res.status(500).json({ error: 'Error al programar el partido' });
        }
        res.status(201).json({ id_partido: result.insertId, mensaje: 'Partido programado correctamente' });
    });
});
 
// 6. Cargar/actualizar el RESULTADO de un partido — usado por el administrador
//    Si el partido pertenece a la Fase de grupos, recalcula automáticamente
//    la tabla de posiciones (clasificaciones) del grupo correspondiente.
app.put('/api/partidos/:id/resultado', (req, res) => {
    const { id } = req.params;
    const { goles_local, goles_visitante, penales_local, penales_visitante } = req.body;
 
    if (goles_local === undefined || goles_visitante === undefined) {
        return res.status(400).json({ error: 'Debes enviar goles_local y goles_visitante' });
    }
    if (goles_local < 0 || goles_visitante < 0) {
        return res.status(400).json({ error: 'Los goles no pueden ser negativos' });
    }
    if (goles_local === goles_visitante && (penales_local === undefined || penales_visitante === undefined)) {
        // Empate en fase eliminatoria: se aceptan penales opcionales; en fase de grupos un empate es válido tal cual.
    }
 
    const query = `
        UPDATE partidos
        SET goles_local = ?, goles_visitante = ?, penales_local = ?, penales_visitante = ?
        WHERE id_partido = ?
    `;
 
    db.query(
        query,
        [goles_local, goles_visitante, penales_local ?? null, penales_visitante ?? null, id],
        (err, result) => {
            if (err) {
                console.error('Error en la consulta:', err);
                return res.status(500).json({ error: 'Error al guardar el resultado' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Partido no encontrado' });
            }
 
            // ¿Este partido es de Fase de grupos? Si sí, recalculamos su tabla de posiciones.
            db.query(
                `SELECT f.nombre AS fase, p.id_local
                 FROM partidos p INNER JOIN fases f ON p.id_fase = f.id_fase
                 WHERE p.id_partido = ?`,
                [id],
                (err2, rows) => {
                    if (err2 || !rows.length) {
                        return res.json({ mensaje: 'Resultado guardado correctamente' });
                    }
 
                    if (rows[0].fase !== 'Fase de grupos') {
                        return res.json({ mensaje: 'Resultado guardado correctamente' });
                    }
 
                    db.query(
                        'SELECT id_grupo FROM grupo_selecciones WHERE id_seleccion = ?',
                        [rows[0].id_local],
                        (err3, grupoRows) => {
                            if (err3 || !grupoRows.length) {
                                return res.json({ mensaje: 'Resultado guardado correctamente' });
                            }
                            recalcularClasificacion(grupoRows[0].id_grupo, (err4) => {
                                if (err4) console.error('Error al recalcular la tabla:', err4);
                                res.json({ mensaje: 'Resultado guardado y tabla de posiciones actualizada' });
                            });
                        }
                    );
                }
            );
        }
    );
});
 
// 7. Eliminar un partido cargado por error
app.delete('/api/partidos/:id', (req, res) => {
    const { id } = req.params;
 
    db.query('DELETE FROM partidos WHERE id_partido = ?', [id], (err, result) => {
        if (err) {
            console.error('Error en la consulta:', err);
            return res.status(500).json({ error: 'Error al eliminar el partido' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Partido no encontrado' });
        }
        res.json({ mensaje: 'Partido eliminado correctamente' });
    });
});
 
// 8. Consultar la tabla de posiciones de un grupo (ya recalculada)
app.get('/api/clasificaciones', (req, res) => {
    const { grupo } = req.query;
 
    let query = `
        SELECT
            g.nombre AS grupo,
            s.nombre AS seleccion,
            s.bandera,
            c.PJ, c.PG, c.PE, c.PP, c.GF, c.GC, c.DG, c.Pts
        FROM clasificaciones c
        INNER JOIN grupos g ON c.id_grupo = g.id_grupo
        INNER JOIN selecciones s ON c.id_seleccion = s.id_seleccion
        WHERE 1 = 1
    `;
    const params = [];
    if (grupo) {
        query += ' AND g.nombre = ?';
        params.push(grupo);
    }
    query += ' ORDER BY g.nombre, c.Pts DESC, c.DG DESC, c.GF DESC';
 
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Error en la consulta:', err);
            return res.status(500).json({ error: 'Error al obtener la tabla de posiciones' });
        }
        res.json(results);
    });
});
 
// ---------------------------------------------------------------
// Recalcula PJ, PG, PE, PP, GF, GC, DG y Pts de un grupo completo
// a partir de los partidos de Fase de grupos que ya tienen marcador.
// ---------------------------------------------------------------
function recalcularClasificacion(idGrupo, callback) {
    const query = `
        SELECT
            gs.id_seleccion,
            COUNT(m.gf) AS PJ,
            COALESCE(SUM(CASE WHEN m.gf > m.gc THEN 1 ELSE 0 END), 0) AS PG,
            COALESCE(SUM(CASE WHEN m.gf = m.gc THEN 1 ELSE 0 END), 0) AS PE,
            COALESCE(SUM(CASE WHEN m.gf < m.gc THEN 1 ELSE 0 END), 0) AS PP,
            COALESCE(SUM(m.gf), 0) AS GF,
            COALESCE(SUM(m.gc), 0) AS GC,
            COALESCE(SUM(m.gf - m.gc), 0) AS DG,
            COALESCE(SUM(CASE WHEN m.gf > m.gc THEN 3 WHEN m.gf = m.gc THEN 1 ELSE 0 END), 0) AS Pts
        FROM grupo_selecciones gs
        LEFT JOIN (
            SELECT p.id_local AS id_seleccion, p.goles_local AS gf, p.goles_visitante AS gc
            FROM partidos p INNER JOIN fases f ON p.id_fase = f.id_fase
            WHERE f.nombre = 'Fase de grupos' AND p.goles_local IS NOT NULL
            UNION ALL
            SELECT p.id_visitante AS id_seleccion, p.goles_visitante AS gf, p.goles_local AS gc
            FROM partidos p INNER JOIN fases f ON p.id_fase = f.id_fase
            WHERE f.nombre = 'Fase de grupos' AND p.goles_local IS NOT NULL
        ) m ON m.id_seleccion = gs.id_seleccion
        WHERE gs.id_grupo = ?
        GROUP BY gs.id_seleccion
    `;
 
    db.query(query, [idGrupo], (err, filas) => {
        if (err) return callback(err);
        if (!filas.length) return callback(null);
 
        const valores = filas.map(f => [
            idGrupo, f.id_seleccion, f.PJ, f.PG, f.PE, f.PP, f.GF, f.GC, f.DG, f.Pts
        ]);
 
        const upsert = `
            INSERT INTO clasificaciones (id_grupo, id_seleccion, PJ, PG, PE, PP, GF, GC, DG, Pts)
            VALUES ?
            ON DUPLICATE KEY UPDATE
                PJ = VALUES(PJ), PG = VALUES(PG), PE = VALUES(PE), PP = VALUES(PP),
                GF = VALUES(GF), GC = VALUES(GC), DG = VALUES(DG), Pts = VALUES(Pts)
        `;
 
        db.query(upsert, [valores], (err2) => callback(err2));
    });
}







































// Levantar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
