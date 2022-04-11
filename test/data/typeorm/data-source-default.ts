import {DataSource} from "typeorm";
import path from "path";

export default new DataSource({
    type: 'better-sqlite3',
    database: path.join(__dirname, 'db.sqlite')
})
