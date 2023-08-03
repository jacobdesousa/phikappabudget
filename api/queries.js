const {response, request} = require("express");
const Pool = require('pg').Pool
const pool = new Pool({
    user: 'pks',
    host: 'localhost',
    database: 'api',
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

    pool.query('CREATE TABLE IF NOT EXISTS revenue_categories (id SERIAL PRIMARY KEY, name TEXT);',
        (error, results) => {
        if (error) {
            throw error;
        }
        console.log('Revenue Categories table setup.');
        });

    pool.query('CREATE TABLE IF NOT EXISTS revenue (id SERIAL PRIMARY KEY, date DATE, description TEXT, category_id NUMERIC, amount NUMERIC);',
        (error, results) => {
            if (error) {
                throw error;
            }
            console.log('Revenue table setup.');
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

const updateDues = (request, response) => {
    const id = request.body.id;
    const { first_instalment_date, first_instalment_amount, second_instalment_date, second_instalment_amount, third_instalment_date, third_instalment_amount, fourth_instalment_date, fourth_instalment_amount } = request.body;

    pool.query('UPDATE dues SET first_instalment_date = $1, first_instalment_amount = $2, second_instalment_date = $3, second_instalment_amount = $4, third_instalment_date = $5, third_instalment_amount = $6, fourth_instalment_date = $7, fourth_instalment_amount = $8 WHERE id = $9',
        [first_instalment_date, first_instalment_amount, second_instalment_date, second_instalment_amount, third_instalment_date, third_instalment_amount, fourth_instalment_date, fourth_instalment_amount, id] ,(error, results) => {
        if (error) {
            throw error;
        }
        response.status(200).send(`Dues modified with ID: ${id}`);
    });
}

const getRevenueCategories = (request, response) => {
    pool.query('SELECT * FROM revenue_categories',
        (error, results) => {
        if (error) {
            throw error;
        }
        response.status(200).json(results.rows);
    });
}

const addRevenueCategory = (request, response) => {
    const { name } = request.body;

    pool.query('INSERT INTO revenue_categories (name) VALUES ($1) RETURNING *',
        [name], (error, revenue_category_result) => {
            if (error) {
                throw error;
            }
            response.status(201).send(`Revenue Category created with id ${revenue_category_result.rows[0].id}`);
    });
}

const getRevenue = (request, response) => {
    pool.query('SELECT * FROM revenue', (error, results) => {
        if (error) {
            throw error;
        }
        response.status(200).json(results.rows);
    })
}

const addRevenue = (request, response) => {
    const { date, description, category_id, amount } = request.body;

    pool.query('INSERT INTO revenue (date, description, category_id, amount) VALUES ($1, $2, $3, $4) RETURNING *',
        [date, description, category_id, amount], (error, results) => {
            if (error) {
                throw error;
            }
            response.status(201).send(`Revenue created with id ${results.rows[0].id}`);
        })
}

module.exports = {
    setupTables,
    getBrothers,
    addBrother,
    editBrother,
    deleteBrother,
    getDues,
    updateDues,
    getRevenueCategories,
    addRevenueCategory,
    getRevenue,
    addRevenue
}