const {response} = require("express");
const Pool = require('pg').Pool
const pool = new Pool({
    user: 'pks',
    host: 'localhost',
    database: 'pks',
    password: '1895',
    port: 5432,
});

const setupTables = () => {
    pool.query('CREATE TABLE IF NOT EXISTS brothers (id SERIAL PRIMARY KEY, last_name TEXT, first_name TEXT, email TEXT, phone TEXT, pledge_class TEXT, graduation NUMERIC, office TEXT, status TEXT);',
        (error, results) => {
            if (error) {
                throw error;
            }
            console.log('Brothers table setup.');
        });

    pool.query('CREATE TABLE IF NOT EXISTS dues (id NUMERIC, first_instalment_date DATE, first_instalment_amount NUMERIC, second_instalment_date DATE, second_instalment_amount NUMERIC, third_instalment_date DATE, third_instalment_amount NUMERIC, fourth_instalment_date DATE, fourth_instalment_amount NUMERIC);',
        (error, results) => {
            if (error) {
                throw error;
            }
            console.log('Dues table setup.');
        });
}

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

    let addedBrotherId = -1;

    pool.query('INSERT INTO brothers (last_name, first_name, email, phone, pledge_class, graduation, office, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [last_name, first_name, email, phone, pledge_class, graduation, office, status], (error, brothers_results) => {
           if (error) {
               throw error;
           }

            pool.query('INSERT INTO dues (id, first_instalment_amount, second_instalment_amount, third_instalment_amount, fourth_instalment_amount) VALUES ($1, 0, 0, 0, 0) RETURNING *',
                [brothers_results.rows[0].id], (error, dues_results) => {
                    if (error) {
                        throw error;
                    }
                    response.status(201).send(`User added to brothers and dues tables with ID: ${dues_results.rows[0].id}`);
                });
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

const getDues = (request, response) => {
    pool.query('SELECT * FROM dues ORDER BY id ASC', (error, results) => {
        if (error) {
            throw error;
        }
        response.status(200).json(results.rows);
    });
}

module.exports = {
    setupTables,
    getBrothers,
    addBrother,
    editBrother,
    deleteBrother,
    getDues,
}