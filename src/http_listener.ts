import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import { logger } from './core/logger';


const app:express.Express = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(morgan('dev'));
// app.get('/', function(req, res) {
//     console.log('called endpoint')
// });

const port = process.env.PORT
app.listen(port);
logger.info('Node + Express REST API skeleton server started on port: %s', port)

export default app;