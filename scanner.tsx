import { html, Html } from "@elysiajs/html";
import { useEffect, useState } from "react";

const xx = () => {
  const [num, setNum] = useState("Hello World");

  useEffect(() => {
    console.log(num);
  }, []);

  return (
    <>
      {"<!doctype html>"}
      <html lang="en">
        <head>
          <title>Hello World</title>
        </head>
        <body>
          <h1>{num}</h1>
        </body>
      </html>
    </>
  );
};

export default xx();
