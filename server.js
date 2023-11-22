"use strict";

var express = require("express");
const { Pool } = require("pg");
var app = express();

app.set("port", process.env.PORT || 4000);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
});

const pool = new Pool({
  user: "root",
  host: "dpg-clbkso7t6quc739h16r0-a.frankfurt-postgres.render.com",
  database: "libraryshop",
  password: "2zptsswkjBFj0MfVGsxQrV7D74nBGD2v",
  port: 5432,
  ssl: true,
});

// app.get("/", async function (req, res) {
//   res.writeHead(200, { "Content-Type": "application/json" });

//   try {
//     const client = await pool.connect();
//     const result = await client.query("SELECT * FROM painting");
//     const response = { response: result.rows };
//     console.log(response);
//     res.end(JSON.stringify(response));
//     client.release();
//   } catch (err) {
//     console.error("Error executing query", err);
//     res.status(500).send("Internal Server Error");
//   }
// });

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

//
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
        release(); // Важно освободить соединение после выполнения запроса

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
        release(); // Важно освободить соединение после выполнения запроса

        if (error) {
          reject(error);
        } else {
          resolve(results.rows);
        }
      });
    });
  });
}

// app.get("/", function (req, res) {
//   res.writeHead(200, { "Content-Type": "application/json" });
//   var response = { response: "This is empty GET method." };
//   console.log(response);
//   res.end(JSON.stringify(response));
// });

app.get("/products/productDetail/:id", async (req, res) => {
  try {
    res.header("Content-Type", "application/json");
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    res.header("Access-Control-Allow-Methods", "GET, POST");

    const id = req.params.id;

    const productDetail = await getProductDetail(id);

    let zaza = JSON.stringify(productDetail);

    res.send(zaza);
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
        release(); // Важно освободить соединение после выполнения запроса

        if (error) {
          reject(error);
        } else {
          resolve(results.rows);
        }
      });
    });
  });
}

app.get("/products/productImage/:id", async (req, res) => {
  try {
    res.header("Content-Type", "image/jpeg");
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    res.header("Access-Control-Allow-Methods", "GET, POST");

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
        release(); // Важно освободить соединение после выполнения запроса

        if (error) {
          reject(error);
        } else {
          resolve(results[0].list_image);
        }
      });
    });
  });
}

// app.get("/:id", function (req, res) {
//   res.writeHead(200, { "Content-Type": "application/json" });
//   var response = {
//     response: "This is GET method with id=" + req.params.id + ".",
//   };
//   console.log(response);
//   res.end(JSON.stringify(response));
// });

app.post("/", function (req, res) {
  res.writeHead(200, { "Content-Type": "application/json" });
  var response = { response: "This is POST method." };
  console.log(response);
  res.end(JSON.stringify(response));
});

app.put("/", function (req, res) {
  res.writeHead(200, { "Content-Type": "application/json" });
  var response = { response: "This is PUT method." };
  console.log(response);
  res.end(JSON.stringify(response));
});

app.delete("/", function (req, res) {
  res.writeHead(200, { "Content-Type": "application/json" });
  var response = { response: "This is DELETE method." };
  console.log(response);
  res.end(JSON.stringify(response));
});

var server = app.listen(app.get("port"), function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log("Node.js API app listening at http://%s:%s", host, port);
});
