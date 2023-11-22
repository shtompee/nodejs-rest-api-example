"use strict";

var express = require("express");
const { Pool } = require("pg");
var app = express();

app.set("port", process.env.PORT || 4000);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
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

app.get("/", async function (req, res) {
  res.writeHead(200, { "Content-Type": "application/json" });

  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT id, concat('data:image/jpeg;base64,', translate(encode(list_image, 'base64'), E'\n', '')) as list_image, name, prod_year, techlogy, paint_size, price, is_purchased FROM painting ORDER BY id ASC LIMIT $1 OFFSET $2"
    );
    const response = { response: result.rows };
    console.log(response);
    res.end(JSON.stringify(response));
    client.release();
  } catch (err) {
    console.error("Error executing query", err);
    res.status(500).send("Internal Server Error");
  }
});

// app.get("/", function (req, res) {
//   res.writeHead(200, { "Content-Type": "application/json" });
//   var response = { response: "This is empty GET method." };
//   console.log(response);
//   res.end(JSON.stringify(response));
// });

app.get("/:id", function (req, res) {
  res.writeHead(200, { "Content-Type": "application/json" });
  var response = {
    response: "This is GET method with id=" + req.params.id + ".",
  };
  console.log(response);
  res.end(JSON.stringify(response));
});

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
