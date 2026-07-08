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
app.get('/api/selecciones', (req, res) => {
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



// Levantar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
