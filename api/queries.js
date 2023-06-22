const {response} = require("express");
const Pool = require('pg').Pool
const pool = new Pool({
    user: 'pks',
    host: 'localhost',
    database: 'api',
    password: '1895',
    port: 5432,
});

const getBrothers = (request, response) => {
    pool.query('SELECT * FROM brothers ORDER BY last_name ASC', (error, results) => {
        if (error) {
            throw error;
        }
        response.status(200).json(results.rows);
    });
}

const addBrother = (request, response) => {
    const { last_name, first_name, email, phone, pledge_class, graduation, office, status } = request.body;

    pool.query('INSERT INTO brothers (last_name, first_name, email, phone, pledge_class, graduation, office, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [last_name, first_name, email, phone, pledge_class, graduation, office, status], (error, results) => {
           if (error) {
               throw error;
           }
           response.status(201).send(`User added with ID: ${results.rows[0].id}`);
        });
}

const editBrother = (request, response) => {
    const id = parseInt(request.params.id);
    const { last_name, first_name, email, phone, pledge_class, graduation, office, status } = request.body;

    pool.query('UPDATE brothers SET last_name = $1, first_name = $2, email = $3, phone = $4, pledge_class = $5, graduation = $6, office = $7, status = $8 WHERE id = $9',
        [last_name, first_name, email, phone, pledge_class, graduation, office, status, id], (error, results) => {
            if (error) {
                throw error;
            }
            response.status(200).send(`User modified with ID: ${id}`);
        });
}

const deleteBrother = (request, response) => {
    const id = parseInt(request.params.id);

    pool.query('DELETE FROM brothers WHERE id = $1', [id], (error, results) => {
        if (error) {
            throw error;
        }
        response.status(200).send(`User deleted with ID: ${id}`);
    });
}

module.exports = {
    getBrothers,
    addBrother,
    editBrother,
    deleteBrother,
}