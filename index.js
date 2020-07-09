const CheckoutSDK = require("checkout-sdk-node");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { db } = require("./db");

const app = express();

const port = 8080;
const ORDER_NAME = "test_order_1";
const cko = new CheckoutSDK.Checkout("sk_test_dda77733-fdf0-4511-b143-58fba9ee73fa", {
    pk: "pk_test_645271c7-eeb9-4e73-965e-732f3cedb0e7",
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

app.post("/getCardData", async (req, res) => {
    console.log("POST", "/getCardData");
    try {
        const { card } = req.body;

        const tokenData = await cko.tokens.request({
            type: "card",
            number: card.cardNumber,
            expiry_month: card.expireMonth,
            expiry_year: card.expireYear,
            cvv: card.cvv,
        });

        console.log("tokenData", tokenData);

        const payment = await cko.payments.request({
            source: {
                token: tokenData.token,
            },
            currency: "USD",
            amount: 0,
            reference: "Check card",
            capture: false,
        });

        console.log("payment", payment);
        console.log("tokenData.scheme.toLowerCase()", tokenData.scheme.toLowerCase());

        await db("cards").insert({
            name: card.cardName,
            token: payment.source.id,
            expires_on: new Date(tokenData.expires_on),
            expire_month: tokenData.expiry_month,
            expire_year: tokenData.expiry_year,
            payment_system: tokenData.scheme.toLowerCase(),
            last4: tokenData.last4,
        });

        const newCard = await db("cards").first().where("token", tokenData.token);

        res.status(200).send(newCard);
    } catch (err) {
        console.log("111", err);
        res.status(500).send(err);
    }
});

app.get("/cards", async (req, res) => {
    console.log("GET", "/cards");
    try {
        const cards = await db("cards");

        res.status(200).send(cards);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

app.post("/order", async (req, res) => {
    // console.log("POST", "/order");
    try {
        const { cardToken, currency, amount } = req.body;
        console.log(req.body);

        const orderIds = await db("orders").insert({
            status: "created",
            currency,
            amount,
            payment_card: cardToken,
        });

        const order = await db("orders").first().where("id", orderIds[0]);
        console.log(order);
        res.status(200).send(order);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

app.get("/orders", async (req, res) => {
    // console.log("GET", "/orders");
    try {
        const orders = await db("orders");

        res.status(200).send(orders);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

app.put("/order/createPayment", async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await db("orders").first().where("id", orderId);
        const payment = await cko.payments.request({
            source: {
                id: order.payment_card,
            },
            currency: order.currency,
            amount: order.amount,
            reference: `order_${order.id}`,
            capture: false,
        });

        await db("orders")
            .update({
                payment_id: payment.id,
            })
            .where("id", orderId);
        console.log(payment);
        res.status(200).send(payment);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

app.put("/order/capture", async (req, res) => {
    // console.log("PUT", "/order");
    try {
        const { orderId } = req.body;
        const order = await db("orders").first().where("id", orderId);

        const capture = await cko.payments.capture(order.payment_id, {
            reference: `capture_order_${orderId}`,
        });

        await db("orders")
            .update({
                status: "captured",
            })
            .where("id", orderId);

        res.status(200).send(capture);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

app.put("/order/refund", async (req, res) => {
    // console.log("PUT", "/order");
    try {
        const { orderId } = req.body;
        const order = await db("orders").first().where("id", orderId);

        const capture = await cko.payments.refund(order.payment_id, {
            reference: `refund_order_${orderId}`,
        });

        await db("orders")
            .update({
                status: "refunded",
            })
            .where("id", orderId);

        res.status(200).send(capture);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

app.put("/order/void", async (req, res) => {
    // console.log("PUT", "/order");
    try {
        const { orderId } = req.body;
        const order = await db("orders").first().where("id", orderId);

        const capture = await cko.payments.void(order.payment_id, {
            reference: `void_order_${orderId}`,
        });

        await db("orders")
            .update({
                status: "voided",
            })
            .where("id", orderId);

        res.status(200).send(capture);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

app.post("/payout", async (req, res) => {
    // console.log("PUT", "/order");
    try {
        const { cardToken, currency, amount } = req.body;

        const payment = await cko.payments.request({
            destination: {
                id: cardToken,
                first_name: "Test",
                last_name: "Test",
            },
            currency,
            amount,
            reference: "Check payout",
        });

        console.log(JSON.stringify(payment));

        res.status(200).send(payment);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
