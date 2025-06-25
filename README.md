# Personalized Health Tracker

The app enables users to mae sense of complex medical information.

### Features:

- Landing Page
- Demo page
- How It Works Page
- User Authentication
- Multi-Database Integration
- Active Content Management System (Coming soon)
- PIPEDA & HIPAA Compliance (Coming soon)

### Tech Stack:

- HTML
- Handlebars
- CSS
- Javascript
- Node.js
- Express.js
- Passport.js
- MongoDB
- PostgreSQL
- PaddleOCR
- HuggingFace
- OpenAI
- Anthropic

### Production

- Vercel
- Digital Ocean
- Railway

### Setup Steps

The rest of this readme provides an in-depth overview this project.

# Introduction

Many patients globally do not have complete access to their healthcare records.
Even when they do, the information is not provided in a way that allows patients
to understand their data while being provided with actionable takeaways.
Building a digital EHR is a big endeavour. My goal with this project is to built
a MVP/prototype to see if I can make the content management system(CMS) work as
intended.

This project was originally built with [WebFlow](https://WebFlow.com). WebFlow
is a great tool for HTML, CSS & JavaScript. On the downside, once you use their
CMS, it cannot be exported. I decided to export the code at this stage before
integrating a user authentication system, database/CMS, cybersecurity/PIPEDA
compliance, and other tools. Since exporting the original code, I have been
updating the code to ensure it is more readible, maintainable and scalable. The
remainder of this project will be built in VS code.

Other notes:

- The report bar charts & graphs were built with
  [Apex Charts](https://apexcharts.com/)
- Modals can be found on the Profile page.

Here is the VS code folder structure I am currently using:

```mermaid
graph TD;
    A[project-root] --> B[templates]
    A --> C[src]
    A --> D[public]

    B --> B1[auth/]
    B --> B2[user/]
    D --> D1[css]
    D --> D2[fonts]
    D --> D3[images]
    D --> D4[js]
```

Things to consider as the project scales:

- Implementing a build process to optimize Webflow-exported assets.
- Setting up environment-specific configurations.
- Implementing server-side rendering if needed for performance or SEO.

Once the folder structure is ready, install the necessary dependencies for
PostgreSQL. This installs PostgreSQL driver, Sequelize ORM, and dotenv for
environment variable management.

```pwsh
npm install pg sequelize dotenv
```

Create an env file in your root project to store database credentials. Be sure
to include .env in your gitignore file.

Install PostgreSQL and OpenSSL from their respective websites.

Navigate to the directory where you want to save the certificate and key files.
For PostgreSQL, this is typically the data directory, but you can generate them
anywhere and move them later. Run the following command as an administrator to
generate both the certificate and key in one step:

```pwsh
$openssl = 'C:\Program Files\OpenSSL-Win64\bin\openssl.exe'
```

```pwsh
& $openssl req -new -x509 -days 365 -nodes -text -out server.crt -keyout server.key -subj "/CN=localhost" -config 'C:\Program Files\OpenSSL-Win64\bin\cnf\openssl.cnf'
```

Let's break down this command:

<li> req: This is the command for X.509 Certificate Signing Request (CSR) management.</li>
<li> -new: Creates a new certificate request.</li>
<li> -x509: Outputs a self-signed certificate instead of a certificate request.</li>
<li> -days 365: The number of days the certificate will be valid.</li>
<li> -nodes: Creates a key without a passphrase.</li>
<li> -text: Outputs the certificate in plain text.</li>
<li> -out server.crt: Specifies the output filename for the certificate.</li>
<li> -keyout server.key: Specifies the output filename for the private key.</li>
<li> -subj "/CN=localhost": Sets the subject of the certificate. Replace "localhost" with your server's domain name if applicable.</li>

Check your /data folder or run the following to verify that the following files
were created:

```pwsh
Get-ChildItem server.crt, server.key
```

you can now update your postgresql.conf file with the paths to these files. Add
or modify these lines in postgresql.conf:

```config
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
```

** At this point we have a self-signed certificate, which is fine for
development or testing purposes. For a production environment, especially one
handling sensitive medical data, you should obtain a certificate from a trusted
Certificate Authority (CA). **

You can also generate a development / internal use CA using OpenSSL. Run the
following in your terminal or command prompt. Change the folder location to
where you want this saved. It my case it was the postgres folder: C:\Program
Files\PostgreSQL\17

```pwsh
openssl genpkey -algorithm RSA -out ca.key
openssl req -new -x509 -key ca.key -out ca.crt -days 365 -subj "/CN=My CA" -config "C:\Program Files\OpenSSL-Win64\openssl.cnf"
```

This will create ca.key (the private key) and ca.crt (the CA certificate).

Restarting your PostgreSQL service is an important step to apply the changes
we've made. Here's how you can do it on Windows:

Using the Services application: a. Press Win + R to open the Run dialog. b. Type
"services.msc" and press Enter. c. Scroll down to find the PostgreSQL service.
It will likely be named something like "postgresql-x64-17" (where 17 is your
version number). d. Right-click on the service and select "Restart".

Next install
[pgAdmin](https://www.postgresql.org/ftp/pgadmin/pgadmin4/v8.12/windows/) from
the website. pgAdmin is a powerful, open-source tool designed for managing
PostgreSQL databases. PgAdmin4 is a complete rewrite of pgAdmin, built using
Python and Javascript/jQuery.

Note: In database terms, rows are "records" and columns are "fields".

Any database, whether it's PostgreSQL or MySQL, is just a container for your
tables. Updates are made to the database itself, they are made to the tables.
And what you are really doing with the table is something with the records(rows)
or fields(columns).

SQL is considered the language itself. It stands for Structured Query Language.
Every database has its own version of SQL.

When creating tables, make sure to turn on primary key if you want a unique
identifier for that table.

To confirm that your PostgreSQL database is connected and the SSL is enabled, we
can use either the psql command-line tool or pgAdmin4.

** Using PSQL Command Line Tool**

1. Open command prompt
2. Connect to PostgreSQL:

```cmd
psql -h your_host -U your_username -d your_database
```

Replace your_host, your_username, and your_database with your actual PostgreSQL
host, username, and database name. You will be prompted to enter your password. 3. Run the query.

```SQL
SHOW ssl;
```

## User Authentication

Now that the database is established and connected, the next step is to setup
our user authentication with Passport.js and JWT.

Install necessary packages: In your project root, run:

```pwsh
npm install passport passport-jwt passport-local jsonwebtoken bcrypt
```

Install nodemon:

```pwsh
npm install -g nodemon
```

### MongoDB database

Once you have MongoDB community server and shell installed, use the following
commands:

1. Connect to the server:

```MongoDB Shell
mongosh
```

2. Connect to the specific database you want to access:

```MongoDB Shell
use HealthLyncDatabase
```

3. Connect to the specific collection within that database:

```MongoDB Shell
db.users
```

4. Add a single new entries:

```MongoDB Shell
db.users.insertOne({name: "Terry Patcher", email: "terryP@gmail.com", password: "password4", confirmPassword: "password4"})
```

Add multiple entries:

```MongoDB Shell
db.users.insertMany([{...},{...},etc.])
```

5. Fetch/find data:

```MongoDB Shell
db.users.find()
```

Filter for more specific data:

```MongoDB Shell
db.users.find({name: 'Terry Patcher'})
```

or for searching multiple parameters:

```MongoDB Shell
db.users.find({name: 'Terry Patcher', email: 'terryP@gmail.com'})
```

6. To drop a database:

```MongoDB Shell
db.users.drop()
```

### Public Key Cryptography

In your bash terminal, create a keyPair file as follows:

```bash
touch createKeypair.js
```

Once you have your initial cryptography code imported, run the script:

```bash
node createKeypair.js
```

This will create a private key and a public key.

JWT uses public key cryptography. Check out https://jwt.io to see some JWt
crypto libraries

### Jason Web Tokens (JWT)

A JWT is a compact, URL-safe means of transporting data on the web.

There are three important components:

1. Header - algorithm (ie RS256) & token type (ie JWT)

2. PayLoad - meta data about some entity. In most cases it will be about a user
   (ie user authentication data). The payload is easy to decode, so you don't
   want to store any sensitive information here.

   Claim types can be found at
   https://datatracker.ietf.org/doc/html/rfc7519#section-4

3. Signature - verify signature with public key cryptography

To get started, create an issueJWT.js file. Copy and paste the JWT from
https://jwt.io and store it as a variable. Also copy and paste the public and
private keys into separate files (priv_key.pem and pub_key.pem).

In your terminal, run:

```bash
npm install --save base64url
```

### Profile Page

### File Uploads

We used multer (a middleware for handling multipart/form-data) to handle file
uploads:

```pwsh
npm install multer
```

The current implementation:

<li>Sets up multer to handle file uploads</li>
<li>Creates an uploads directory in your public folder</li>
<li>Validates file types and sizes</li>
<li>Stores file information in the user's document</li>
<li>Includes error handling</li>

The files are stored in public/uploads/ and the information is saved in MongoDB.

To read and display file data, we used a combination of OCR (Optical Character
Recognition) and pattern matching to extract the specific data.

Packages involved in OCR and pattern matching:

```pwsh
npm install tesseract.js pdf-parse pdfjs-dist@2.16.105 ws
```

This implementation:

Uses PDF.js first for native text extraction Falls back to an enhanced Tesseract
configuration Adds better error handling and logging Includes confidence scoring
Has better text normalization

Uses WebSocket (ws) to create a real-time connection between server and client

Note that the data needs to be buffered and parsed.

<strong>Buffering</strong> refers to the process of temporarily storing data in
a buffer (a region of physical memory storage) while it is being transferred
from one place to another. It helps to smooth out data processing by ensuring
that data flows continuously and efficiently, preventing bottlenecks.

<strong>Parsing</strong> is the process of analyzing a string of symbols, either
in natural language, computer languages, or data formats, and converting it into
a structured format that can be easily processed. For example, when reading a
JSON file, a parser analyzes the JSON text and converts it into a JavaScript
object that can be easily accessed and manipulated in code.

### Reports Page

To install Plotly React:

```pwsh
npm install plotly.js-dist react-plotly.js react
```

### Medical Database

PostgreSQL database with pgvector for semantic search

### Retrieval Augmented Generation (RAG) chatbot

Start the local server with:

```pwsh
npm start
```

End the server with:

```pwsh
netstat -ano | findstr :3000
Stop-Process -Id 12345 -Force
```

Implemented OpenAI embeddings for converting text to vector representations

API Endpoints can be test with:

```pwsh
curl http://localhost:3000/api/rag/test
```

```pwsh
curl -X POST http://localhost:3000/api/rag/ask -H "Content-Type: application/json" -d '{"query":"What is LDL cholesterol and why is it important?"}'
```

## Deployment

For deploying this dynamic project I have chosen to used Vercel as it works well
with node.js/express.js projects.

To test your app locally, be sure to install the vercel CLI:

```pwsh
npm i -g vercel
```
