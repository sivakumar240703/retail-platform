const http = require("http");

const PORT = process.env.PORT || 8081;
const APP_VERSION = process.env.APP_VERSION || "4.2.0";
const GIT_COMMIT = process.env.GIT_COMMIT || "local-development";

const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.url === "/") {
        res.writeHead(200);
        res.end(JSON.stringify({
            application: "Retail Platform",
            version: APP_VERSION,
            status: "DEVELOPMENT"
        }));
        return;
    }

    if (req.url === "/health") {
        res.writeHead(200);
        res.end(JSON.stringify({
            status: "healthy",
            version: APP_VERSION
        }));
        return;
    }

    if (req.url === "/payment") {
    res.writeHead(200);
    res.end(JSON.stringify({
        paymentStatus: "FIXED",
        version: APP_VERSION,
        message: "Payment processing is WORKING"
       }));
       return;
   }

    if (req.url === "/version") {
        res.writeHead(200);
        res.end(JSON.stringify({
            application: "Retail Platform",
            version: APP_VERSION,
            gitCommit: GIT_COMMIT
        }));
        return;
    }

    if (req.url === "/products") {
        res.writeHead(200);
        res.end(JSON.stringify({
            products: [
                "Laptop",
                "Mobile",
                "Headphones"
            ],
            category: "Retail",
            version: APP_VERSION
        }));
        return;
    }
    if (req.url === "/orders") {
        res.writeHead(200);
        res.end(JSON.stringify({
            orders: [
                "ORD-1001",
                "ORD-1002"
            ],
            version: APP_VERSION
        }));
        return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({
        error: "Endpoint not found"
    }));
});

server.listen(PORT, () => {
    console.log(`Retail Platform ${APP_VERSION} running on port ${PORT}`);
});