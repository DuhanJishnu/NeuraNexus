import { Request, Response } from 'express';

export const errorPage = (
  _req: Request,
  res: Response,
  status: number,
  title: string,
  message: string,
) => {
    res.status(status).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
        <style>
          body {
            font-family: sans-serif;
            background: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            text-align: center;
          }
          h1 {
            font-size: 2rem;
            margin-bottom: 1rem;
            color: #e74c3c;
          }
          p {
            font-size: 1rem;
            color: #555;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${title}</h1>
          <p>${message}</p>
        </div>
      </body>
      </html>
    `);
  };
