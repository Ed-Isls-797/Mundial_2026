const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Conexión a la base de datos
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',          
    password: '',  
    database: 'mundial', 
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

// Levantar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});