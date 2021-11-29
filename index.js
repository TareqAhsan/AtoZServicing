const express = require("express");
const app = express();
const cors = require("cors");
const admin = require("firebase-admin");
const ObjectId = require("mongodb").ObjectId;
require("dotenv").config();
const { MongoClient } = require("mongodb");
const fileUpload = require("express-fileupload");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const port = process.env.PORT || 5000;

const serviceAccount = require("./service-system-4e8ac-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middle ware
app.use(cors());
app.use(express.json());
app.use(fileUpload());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.aubya.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req.headers.authorization.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];
    //   console.log(token)
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("it_service");
    const servicesCollection = database.collection("services");
    const expertsCollection = database.collection("experts");
    const reviewsCollection = database.collection("reviews");
    const bookingCollection = database.collection("bookings");
    const usersCollection = database.collection("users");

    // mybooking and manage order for admin part
    //manage allorders from admin
    app.get("/manageorders", async (req, res) => {
      const result = await bookingCollection.find({}).toArray();
      res.send(result);
    });
    //update status from admin
    app.put("/updatestatus/:id", async (req, res) => {
      const status = req.body.status;
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const updateDoc = { $set: { status: status } };
      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //delete order from admin panel
    app.delete("/deleteOrder/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await bookingCollection.deleteOne(filter);
      res.send(result);
    });

    //mybookings
    app.get("/mybookings", async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const result = await bookingCollection.find({}).toArray();
      res.send(result);
    });

    //cancel my booking
    app.delete("/mybookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await bookingCollection.deleteOne(filter);
      res.send(result);
    });

    //End mybooking and manage order for admin part

    //get single service for booking
    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await servicesCollection.findOne(filter);
      res.send(result);
    });

    //get allservices

    app.get("/addservice/all", async (req, res) => {
      const result = await servicesCollection.find({}).toArray();
      res.send(result);
    });

    //get searchable services
    app.get("/addservice/search", async (req, res) => {
      const query = req.query.val;
      const result = await servicesCollection.find({}).toArray();
      const cursor = result.filter((service) =>
        service.serviceName.toLowerCase().includes(query.toLocaleLowerCase())
      );
      res.send(cursor);
    });

    //get it services
    app.get("/addservice/it", async (req, res) => {
      const result = await servicesCollection.find({}).toArray();
      const cursor = result.filter((service) =>
        service.category.toLowerCase().includes("it".toLowerCase())
      );
      res.send(cursor);
    });

    //get software services
    app.get("/addservice/soft", async (req, res) => {
      // console.log('hitting')
      const result = await servicesCollection.find({}).toArray();
      const cursor = result.filter((service) =>
        service.category.toLowerCase().includes("software".toLowerCase())
      );
      res.send(cursor);
    });

    //get experts
    app.get("/experts", async (req, res) => {
      const result = await expertsCollection.find({}).toArray();
      res.send(result);
    });
    //   get reviews
    app.get("/review", async (req, res) => {
      const result = await reviewsCollection.find({}).toArray();
      res.send(result);
    });

    //add a service from admin panel
    app.post("/addservice", async (req, res) => {
      const body = req.body;
      const result = await servicesCollection.insertOne(body);
      console.log(result);
      res.send(result);
    });

    //post review
    app.post("/review", async (req, res) => {
      const body = req.body;
      const result = await reviewsCollection.insertOne(body);
      console.log(result);
      res.send(result);
    });
    // booking a service
    app.post("/addbooking", async (req, res) => {
      const body = req.body;
      const result = await bookingCollection.insertOne(body);
      res.send(result);
    });

    //post api from useFirebase hooks to store userInfo in database
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //if the email already exist in db users Collection we use upsart api

    app.put("/users", async (req, res) => {
      const user = req.body;
      const email = req.body.email;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      // console.log(result);
      res.send(result);
    });

    //make a admin using put method
    app.put("/users/makeadmin", verifyToken, async (req, res) => {
      const email = req.body.email;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.send(result);
        }
      } else {
        res.status(403).json({ message: "You dont have access" });
      }
    });

    //  // check if the user is admin or not using get api with email
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = await usersCollection.findOne(filter);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.send({ admin: isAdmin });
    });

    // manage software/it/all services
    app.delete("/manageservice/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await servicesCollection.deleteOne(filter);
      res.send(result);
    });
    // add experts
    app.post("/experts", async (req, res) => {
      const body = req.body;
      console.log(req.files);
      const name = body.name;
      const expertise = body.expertise;
      const pic = req.files.image;
      const picData = pic.data;
      const encodedPic = picData.toString("base64");
      const imageBuffer = Buffer.from(encodedPic, "base64");
      const expert = {
        name,
        expertise,
        image: imageBuffer,
      };
      const result = await expertsCollection.insertOne(expert);
      res.send(result);
    });

    //get single data  payment gateway
    app.get("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await bookingCollection.findOne(filter);
      res.send(result);
    });
    // payment intent

    app.post("/create-payment-intent", async (req, res) => {
      const paymentInfo = req.body;
      const amount = paymentInfo.price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    //updatet payment info in bookings after payment
    app.put("/mybookings/:id",async(req,res)=>{
      const id = req.params.id
      const payment = req.body
      const filter = {_id:ObjectId(id)}
      const updatedDoc = {$set:{payment:payment}}
      const result = await bookingCollection.updateOne(filter,updatedDoc)
      res.send(result)
    });

    //jwt er env file
    //addexperts
    //payment
  } finally {
    //    await client.close()
  }
}
run().catch(console.dir);

//
app.get("/", (req, res) => {
  res.send("hello from all service");
});
app.listen(port, () => {
  console.log("listening on port ", port);
});
