import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';


const app:express.Express = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(morgan('dev'));
// app.get('/', function(req, res) {
//     console.log('called endpoint')
// });

const port = process.env.PORT
app.listen(port);
console.log('Node + Express REST API skeleton server started on port: ' + port);

export default app;