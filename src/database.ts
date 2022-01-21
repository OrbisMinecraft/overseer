import {Pool} from 'pg';
import {config} from "./config";


export const postgres = new Pool({
    user: config.dbUser,
    host: config.dbHost,
    database: config.dbName,
    password: config.dbPassword,
    port: config.dbPort,
});


export async function setup() {
    await postgres.query(`CREATE TABLE IF NOT EXISTS suggestions
                    (
                        id            SERIAL PRIMARY KEY,
                        message       VARCHAR(128),
                        title         VARCHAR(1000),
                        description   VARCHAR(5000),
                        author        VARCHAR(128),
                        status        INTEGER,
                        votes_for     INTEGER,
                        votes_against INTEGER,
                        votes         JSONB
                    )
    `)

    await postgres.end();
}
