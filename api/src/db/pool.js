const { Pool } = require("pg");
const { env } = require("../config/env");

const pool = new Pool(env.pg);

module.exports = { pool };


