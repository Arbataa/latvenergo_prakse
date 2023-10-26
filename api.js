const express = require('express'); // Express.js servera izveide
const bodyParser = require('body-parser'); // Middleware, lai apstrādātu JSON pieprasījumus
const app = express();
app.use(bodyParser.json()); // Middleware, lai apstrādātu JSON pieprasījumus

const PORT = process.env.PORT || 3000;

// loggerēšanas apstrāde middleware
app.use((req, res, next) => {
  // Ienākošo ziņojumu logošana
  console.log({
    type: 'messageIn',
    body: req.body,
    method: req.method,
    path: req.url,
    dateTime: new Date().toISOString()
  });
  
  // Pārraksta `res.write` un `res.end` funkcijas, lai uzkrātu pieprasījuma un atbildes datus
  let oldWrite = res.write;
  let oldEnd = res.end;
  const chunks = [];

  res.write = (...restArgs) => {
    chunks.push(Buffer.from(restArgs[0]));
    oldWrite.apply(res, restArgs);
  };

  res.end = (...restArgs) => {
    if (restArgs[0]) {
      chunks.push(Buffer.from(restArgs[0]));
    }

    const body = Buffer.concat(chunks).toString('utf8');
    // Izejošo ziņojumu logošana
    console.log({
      type: 'messageOut',
      body,
      dateTime: new Date().toISOString()
    });

    oldEnd.apply(res, restArgs);
  };

  res.on('finish', () => {
    console.log(`Outgoing Response: ${res.statusCode}`);
  });

  next();
});

// Error apstrādes middleware
app.use((err, req, res, next) => {
  // Kļūdu apstrādes middleware - logošana
  console.error('Error:', err);
  res.status(400).json({
    code: 400,
    message: 'Bad Request',
    fault: err.stack
  });
});

// Pieprasījumu validācijas middleware
function validateRequest(req, res, next) {
  const { query, page } = req.body;
  // Validācijas middleware - pārbaude, vai ienākošie dati atbilst prasībām
  if (!query || query.length < 3 || query.length > 10) {
    const error = new Error('Invalid query parameter');
    return next(error);
  }
  if (page && (isNaN(page) || page < 1)) {
    const error = new Error('Invalid page parameter');
    return next(error);
  }
  next();
}

// Maršruts priekš POST pieprasījuma
app.post('/api/products', validateRequest, async (req, res, next) => {
  const { query, page = 1 } = req.body;
  const limit = 2;
  const skip = (page - 1) * limit;

  try {
    // Izsaukums uz ārējo API izveide, izmantojot dinamisko import
    const fetch = await import('node-fetch');
    const response = await fetch.default(`https://dummyjson.com/products/search?q=${query}&limit=${limit}&skip=${skip}`);
    const data = await response.json();

    if (Array.isArray(data.products)) {
      const transformedProducts = data.products.map(product => ({
        // Datu transformācija
        title: product.title,
        description: product.description,
        final_price: (product.price * (1 - product.discountPercentage / 100)).toFixed(2),
      }));

      res.json(transformedProducts);
    } else {
      // Kļūdu apstrāde, ja API atbilde neatbilst sagaidītajam formātam
      const error = new Error('API response format is not as expected');
      return next(error);
    }
  } catch (error) {
    // Kļūdu apstrāde, ja notiek kļūda API pieprasījuma laikā
    next(error);
  }
});

//API startēšana
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});