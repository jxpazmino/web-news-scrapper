var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static('/'));

// views is directory for all template files
app.set('views', __dirname + '/pages');
app.set('view engine', 'html');

// app.get('/', function(request, response) {
//   response.render('pages/index');
// });
app.get('/', function(request, response) {
  response.render('/');
});



app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
