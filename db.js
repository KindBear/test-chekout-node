const knex = require("knex");

const db = knex({
    client: "mysql",
    connection: {
        host: "127.0.0.1",
        user: "root",
        password: "password",
        database: "checkout",
    },
    pool: { min: 0, max: 5 },
});

module.exports = { db };
