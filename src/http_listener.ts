import express from 'express';
import bodyParser from 'body-parser';
import expressPinoLogger from 'express-pino-logger';
import { logger } from './core/logger';
import fileUpload from 'express-fileupload';
const { countAllRequests } = require("./telemetry//monitoring");
const loggerExpress = expressPinoLogger({
    logger: logger,
    autoLogging: true,
  });

const app:express.Express = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(countAllRequests());
app.use(loggerExpress);
// app.get('/', function(req, res) {
//     console.log('called endpoint')
// });

const port = process.env.PORT || 3000;
app.use(fileUpload({
    useTempFiles: true,
    limits: { fileSize: 50 * 1024 * 1024 },
}));

app.listen(port);
logger.info('Node + Express REST API skeleton server started on port: %s', port);

export default app;