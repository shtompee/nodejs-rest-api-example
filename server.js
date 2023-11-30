"use strict";

var express = require("express");
var cors = require("cors");
const multer = require("multer");
const path = require("path");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer"); // Add this line
const sharp = require("sharp");
const fs = require("fs");
const config = require("./config/config_remote.json");
const truePassword = "1234";

var app = express();

app.set("port", process.env.PORT || config.server.port);

//Serve static files from the "public" directory
//app.use(express.static("public"));

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) =>
  res.sendFile(path.resolve(__dirname, "public", "index.html"))
);

app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
});

// Добавьте это middleware
app.use(bodyParser.urlencoded({ extended: false }));
// Добавьте это middleware
app.use(bodyParser.json());
app.use(cors());

const pool = new Pool({
  user: config.dbConfig.user,
  host: config.dbConfig.host,
  database: config.dbConfig.database,
  password: config.dbConfig.password,
  port: config.dbConfig.port,
  ssl: config.dbConfig.ssl,
});

//---------------------Upload------------------------

const upload = multer({
  dest: "uploads/",
});

app.post("/products/upload", upload.single("image"), (req, res) => {
  const { name, prod_year, price, paint_size, techlogy } = req.body;
  const image = req.file;

  // Check if a file was uploaded
  if (!image) {
    res.status(400).send("No file was uploaded.");
    return;
  }

  // Check if the file format is supported
  const supportedFormats = ["image/jpeg", "image/png", "image/gif"];
  if (!supportedFormats.includes(image.mimetype)) {
    res.status(401).send("Unsupported file format.");
    return;
  }

  //Generate thumbnail (list) image
  let uploadedPath = `uploads/${image.filename}`;
  let listPath = `uploads/${image.filename}-thumbnail.jpg`;
  sharp(image.path)
    .resize(200, 200, {
      fit: "inside",
    })
    .toFormat("jpeg", {
      quality: 100,
    })
    .toFile(listPath, (err) => {
      if (err) {
        console.error("Error generating thumbnail copy:", err);
        res.status(500).send("Internal Server Error");
        return;
      } else {
      }
    });

  let originalPath = `uploads/${image.filename}-original.jpg`;
  sharp(image.path)
    .resize(1000, 1000, {
      fit: "inside",
    })
    .toFormat("jpeg", {
      quality: 100,
    })
    .toFile(originalPath, (err) => {
      if (err) {
        console.error("Error generating original copy:", err);
        res.status(500).send("Internal Server Error");
        return;
      } else {
        const sale_status = 0;
        const queryValues = [
          name,
          prod_year,
          price,
          paint_size,
          sale_status,
          techlogy,
          Buffer.from(fs.readFileSync(listPath)),
          Buffer.from(fs.readFileSync(originalPath)),
          new Date(),
        ];

        //Insert data into MySQL database
        pool.connect((error, connection, release) => {
          if (error) {
            console.error("Error connecting to the database:", error);
            return;
          }

          const insertQuery =
            "INSERT INTO painting (id, name, prod_year, price, paint_size, sale_status, techlogy, list_image, full_image, prod_date) VALUES (nextval('id_seq'), $1,$2,$3,$4,$5,$6,$7,$8,$9)";

          connection.query(insertQuery, queryValues, (error, results) => {
            // Release the connection back to the pool
            release();

            if (error) {
              console.error("Error executing the SQL query:", error);
              res.status(500).send();
              return;
            }

            fs.unlink(listPath, (err) => {
              if (err) throw err;
              console.log("File list deleted");
            });

            fs.unlink(originalPath, (err) => {
              if (err) throw err;
              console.log("File original deleted");
            });

            fs.unlink(uploadedPath, (err) => {
              if (err) throw err;
              console.log("File uploaded deleted");
            });

            res.send("Form submitted and data inserted into the database.");
          });
        });
      }
    });
});

//---------------------Products------------------------

app.get("/products", async (req, res) => {
  try {
    const page = req.query.page;

    const itemsPerPage = req.query.itemsPerPage;

    const prodcutsWrapper = await getProdcutsWrapper(page, itemsPerPage);

    res.send(prodcutsWrapper);
  } catch (error) {
    console.error("Произошла ошибка:", error);
    res.status(500).json({
      error: "Произошла ошибка на сервере",
    });
  }
});

async function getProdcutsWrapper(page, itemsPerPage) {
  try {
    const [{ total }] = await getPaginatedCount();

    const productList = await getPaginatedData(page, itemsPerPage);

    const prodcutsWrapper = {
      total: total,
      productList: productList,
    };

    return JSON.stringify(prodcutsWrapper);
  } catch (error) {
    console.error("Произошла ошибка:", error);
    return JSON.stringify({
      error: "Произошла ошибка при получении данных",
    });
  }
}

function getPaginatedData(page, itemsPerPage) {
  const limit = Number(itemsPerPage);
  const offset = Number((page - 1) * itemsPerPage);

  return new Promise((resolve, reject) => {
    const query = `SELECT id, concat('data:image/jpeg;base64,', translate(encode(list_image, 'base64'), E'\n', '')) as list_image, name, prod_year, techlogy, paint_size, price, is_purchased FROM painting ORDER BY id ASC LIMIT $1 OFFSET $2`;

    pool.connect((error, connection, release) => {
      if (error) {
        reject(error);
        return;
      }

      connection.query(query, [limit, offset], (error, results) => {
        // Важно освободить соединение после выполнения запроса
        release();

        if (error) {
          reject(error);
        } else {
          resolve(results.rows);
        }
      });
    });
  });
}

function getPaginatedCount() {
  return new Promise((resolve, reject) => {
    const query = `SELECT COUNT(*) AS total FROM painting`;

    pool.connect((error, connection, release) => {
      if (error) {
        reject(error);
        return;
      }

      connection.query(query, (error, results) => {
        // Важно освободить соединение после выполнения запроса
        release();

        if (error) {
          reject(error);
        } else {
          resolve(results.rows);
        }
      });
    });
  });
}

app.get("/products/productDetail/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const productDetail = await getProductDetail(id);
    res.send(JSON.stringify(productDetail));
  } catch (error) {
    console.error("Произошла ошибка:", error);
    res.status(500).json({
      error: "Произошла ошибка на сервере",
    });
  }
});

function getProductDetail(id) {
  return new Promise((resolve, reject) => {
    const query = `SELECT id, concat('data:image/jpeg;base64,', translate(encode(full_image, 'base64'), E'\n', '')) as list_image, name, prod_year, techlogy, paint_size, price, is_purchased FROM painting WHERE id = $1`;
    pool.connect((error, connection, release) => {
      if (error) {
        reject(error);
        return;
      }

      connection.query(query, [Number(id)], (error, results) => {
        // Важно освободить соединение после выполнения запроса
        release();

        if (error) {
          reject(error);
        } else {
          resolve(results.rows);
        }
      });
    });
  });
}

app.delete("/products/remove/:id", async (req, res) => {
  const id = req.params.id;
  const password = req.query.password;
  if (password === truePassword) {
    removeProduct(id, password)
      .then(() => {
        res.send({
          message: "Product has been removed successfully.",
        });
      })
      .catch((error) => {
        console.error("Произошла ошибка:", error);
        res.status(401).json({ error: error });
      });
  } else {
    res.status(401).json({ error: "Неправильный пароль" });
  }
});

function removeProduct(id, password) {
  return new Promise((resolve, reject) => {
    const query = `DELETE FROM painting WHERE id = $1`;

    pool.connect((error, connection, release) => {
      if (error) {
        reject(error);
        return;
      }

      connection.query(query, [Number(id)], (error, results) => {
        release();

        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  });
}

app.put("/products/edit/:id", function (req, res) {
  const id = req.params.id;
  const password = req.query.password;
  const isProductPurchased = req.body["isProductPurchased"] === "true" ? 1 : 0;

  if (password === truePassword) {
    const updateQuery = `UPDATE painting SET name=$1, prod_year=$2, price=$3, paint_size=$4, techlogy=$5,is_purchased=$6 WHERE id=$7`;

    const values = [
      req.body["name"],
      req.body["prod_year"],
      req.body["price"],
      req.body["paint_size"],
      req.body["techlogy"],
      isProductPurchased,
      id,
    ];

    pool.connect((error, connection, release) => {
      if (error) {
        console.error("Произошла ошибка при подключении к базе данных:", error);
        res.status(400).json({ error: "Произошла ошибка на сервере" });
      } else {
        connection.query(updateQuery, values, (error, results) => {
          release();
          if (error) {
            console.error("Произошла ошибка при выполнении запроса:", error);
            res.status(400).json({ error: "Произошла ошибка на сервере" });
          } else {
            res.send({
              message: "Элемент успешно обновлен.",
            });
          }
        });
      }
    });
  } else {
    res.status(401).json({ error: "Неправильный пароль" });
  }
});

//---------------------Emailer------------------------

const transporter = nodemailer.createTransport({
  host: config.smtpConfig.host,
  port: config.smtpConfig.port,
  secure: config.smtpConfig.secure,
  pool: true,
  auth: {
    user: config.smtpConfig.auth.user,
    pass: config.smtpConfig.auth.pass,
  },
  tls: {
    // Используйте более современные версии протоколов, если это поддерживается сервером
    minVersion: config.smtpConfig.tls.minVersion,
  },
});

app.get("/products/productImage/:id", async (req, res) => {
  try {
    res.header("Content-Type", "image/jpeg");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    const id = req.params.id;
    const productImage = await getProductImage(id);
    res.send(productImage);
  } catch (error) {
    console.error("Произошла ошибка:", error);
    res.status(500).json({
      error: "Произошла ошибка на сервере",
    });
  }
});

function getProductImage(id) {
  return new Promise((resolve, reject) => {
    const query = `SELECT list_image FROM painting WHERE id = $1`;

    pool.connect((error, connection, release) => {
      if (error) {
        reject(error);
        return;
      }

      connection.query(query, [Number(id)], (error, results) => {
        release(); //Важно освободить соединение после выполнения запроса

        if (error) {
          reject(error);
        } else {
          resolve(results.rows[0].list_image);
        }
      });
    });
  });
}

// Маршрут для отправки письма
app.post("/products/send-email", (req, res) => {
  const { itemsPrice, itemsName, itemsIds, email, name, message, phone } =
    req.body;
  //console.log(req.body);
  const attachments = [];

  itemsIds.forEach((itemId, index) => {
    const imageId = parseInt(itemId); // Преобразуем значение к числовому типу
    if (!isNaN(imageId) && itemsName[index]) {
      // Проверяем, что imageId является числом (не NaN)

      //TODO: get from database
      var imageUrl = `${config.server.host}`;
      if (config.server.port !== null) {
        imageUrl = imageUrl.concat(`:${config.server.port}`);
      }
      imageUrl = imageUrl.concat(`/products/productImage/${imageId}`);

      console.log(imageUrl);

      attachments.push({
        filename: `${itemsName[index]}.jpg`,
        path: imageUrl,
        cid: `unique-image-id-${imageId}`,
      });
    }
  });

  const itemsNameHTML = itemsName
    .map((itemName) => `<li>${itemName}</li>`)
    .join("");
  const totalAmount = itemsPrice.reduce((acc, price) => acc + price, 0);
  const formattedContactNumber = phone.internationalNumber;
  const mailOptions = {
    from: config.smtpConfig.auth.user,
    to: email,

    bcc: "aminmama8121@gmail.com",
    subject: "Ваш заказ",
    attachments: attachments,
    html: `
    <html>
    <head>
      <style>
        /* Ваши стили здесь */
        body {
          font-family: Arial, sans-serif;
          background-color: #fff; /* Белый фон */
          color: #333; /* Цвет текста */
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 {
          color: #FF5733;
          text-align: center; /* Центрируем текст заголовка */
          margin-bottom: 80px
        }
        p {
          color: #FF5733;
          font-weight: bold;
          text-transform: uppercase;
          font-size: 16px;
          line-height: 1.6;
          color: #555;
          text-align: center;
        }
        ul {
          text-align: center;
          list-style-type: none; /* Убираем маркеры списка */
          padding: 0; /* Убираем отступы вокруг списка */
        }
        ul li {
          font-weight: bold;
          text-transform: uppercase;
          margin: 5px 0; /* Отступы между элементами списка */
          padding: 10px; /* Внутренний отступ для элементов списка */
          background-color: #FFF6EB; /* Фон элемента списка */
          border-radius: 5px; /* Закругленные углы элемента списка */
        }
        /* Дополнительные стили для элементов, если необходимо */
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Здравствуйте ${name}!<br> Благодарю за покупку</h1>
        <p>Ваш заказ:</p>
        <ul>
          ${itemsNameHTML}
        </ul>
        <p>Контактный номер: ${formattedContactNumber}</p>
        <p>Cумма Заказа: ${totalAmount} USD</p>
        <p>Ваше предпочтение к заказу:${message}</p>
      </div>
    </body>
  </html>
`,
  };

  // Отправка письма
  try {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Ошибка отправки письма:", error);
        res.status(500).json({ error: "Ошибка отправки письма" });
      } else {
        res.json({ message: "Письмо успешно отправлено" });
      }
    });
  } catch (error) {
    console.error("Ошибка при вызове sendMail:", error);
    res.status(500).json({ error: "Ошибка при вызове sendMail" });
  }
});

var server = app.listen(app.get("port"), function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log("Node.js API app listening at http://%s:%s", host, port);
});
