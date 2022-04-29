import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import fileUpload from 'express-fileupload';

const app:express.Express = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(fileUpload({
    useTempFiles: true,
    limits: { fileSize: 50 * 1024 * 1024 },
}));

app.use(morgan('dev'));
const port = process.env.PORT
app.listen(port);
console.log('Node + Express REST API skeleton server started on port: ' + port);

export default app;