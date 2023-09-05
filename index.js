const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
app.use(cors());
require("dotenv").config();
const jwt = require('jsonwebtoken');
app.use(express.json());
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.f7zs7lw.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({ error: true, message: "Unauthorized access" });
  }

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (error, decoded) {
    if (error) {
      return res.status(403).send({ error: true, message: "Unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection

    const gamefusionUserCollections = client
      .db("gamefusionUserDB")
      .collection("gamefusionUserCollections");

    const gamefusionGamesCollections = client
      .db("gamefusionGamesDB")
      .collection("gamefusionGamesCollections");

      const myGameFusionGamesCollections=client
      .db("myGameFusionGamesDB")
      .collection("myGameFusionGamesCollections");

      const gamefusionPaymentHistoryCollections = client
      .db("gamefusionPaymentHistoryDB")
      .collection("gamefusionPaymentHistoryCollections");





      const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await gamefusionUserCollections.findOne(query);
        if (user?.role !== "admin") {
          return res
            .status(403)
            .send({ error: true, message: "forbiden access" });
        }
        next();
      };
  
      app.get("/allusers/admin/:email", verifyJWT, async (req, res) => {
        const email = req.params.email;
      
        // Check if the currently authenticated user has admin role
        if (req.decoded.email !== email) {
          return res.status(403).send({ error: true, message: "Forbidden access" });
        }
      
        const query = { email: email };
        const user = await gamefusionUserCollections.findOne(query);

        if (!user) {
          return res.status(404).send({ error: true, message: "User not found" });
        }
      
        if (user.role === "admin") {
          res.send({ admin: true });
        } else {
          res.send({ admin: false });
        }
      });




      app.get("/allusers/user/:email", verifyJWT, async (req, res) => {
        const email = req.params.email;
        if (req.decoded.email !== email) {
          return res.send({ user: false });
        }
        const query = { email: email };
        const user = await gamefusionUserCollections.findOne(query);
        const result = { user: user?.role === "user" };
        res.send(result);
      });
  
      app.post("/jwt", async (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
          expiresIn: '1h',
        });
        res.send({ token });
      });
















      app.post("/create-payment-intent", async (req, res) => {
        try {
          const { price } = req.body;
          // Convert price to cents (assuming USD)
          const amount = Math.round(parseFloat(price) * 100);

          if (amount < 100) {
            return res.status(400).send({
              message: "Amount must be at least 1 USD.",
            });
          }
  
          const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: "usd",
            payment_method_types: ["card"],
          });
  
          res.send({
            clientSecret: paymentIntent.client_secret,
          });
        } catch (error) {
          console.error("Error creating payment intent:", error);
          res.status(400).send({ error: error.message });
        }
      });
  
      app.post('/payments',async(req,res)=>{
        let payment=req.body
        let result =await gamefusionPaymentHistoryCollections.insertOne(payment)
        let query={_id: {$in: payment.items.map((item)=> new ObjectId(item))}}
        let deleteResult= await myGameFusionGamesCollections.deleteMany(query)
      
        res.send({result,deleteResult})
      })


      app.get('/payments',async(req,res)=>{
        let query={}
        if(req.query?.email){
          query={email: req.query?.email}
        }
        let result =await gamefusionPaymentHistoryCollections.find(query).toArray()
        
      
        res.send(result)
      })



    app.post("/allusers", async (req, res) => {
      try {
        let users = req.body;
        let existingUser = await gamefusionUserCollections.findOne({
          email: users.email,
        });
        if (existingUser) {
          return res.status(400).send({ message: "User already exists" });
        }
        let result = await gamefusionUserCollections.insertOne(users);
        res.send(result);
      } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/allusers",verifyJWT,verifyAdmin, async (req, res) => {
      try {
        let result = await gamefusionUserCollections.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.patch("/allusers/:id", async (req, res) => {
      let roles = req.body;
      const id = req.params.id;

      let filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          role: roles.status,
        },
      };
      const result = await gamefusionUserCollections.updateOne(
        filter,
        updateDoc
      );

      res.send(result);
    });

    app.post("/games", async (req, res) => {
      try {
        let games = req.body;

        let result = await gamefusionGamesCollections.insertOne(games);
        res.send(result);
      } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/games", async (req, res) => {
      try {
        let query={}
        const options={
          sort:{"price":req.query.sort==='asc'?1:-1}
        }
  
      
        if (req.query?.search) {
          query.name = { $regex: req.query.search, $options: "i" };
        }
        if(req.query?.email){
          query={email:req.query?.email}
        }
        let result = await gamefusionGamesCollections.find(query,options).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/games/:id", async (req, res) => {
      try {
        let result = await gamefusionGamesCollections.findOne({
          _id: new ObjectId(req.params.id),
        });
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.delete("/games/:id", async (req, res) => {
      try {
        let result = await gamefusionGamesCollections.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.put("/games/:id", async (req, res) => {
      let updatedGames = req.body;
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };

      const updateDoc = {
        $set: {
          name: updatedGames.name,
          category: updatedGames.category,
          description: updatedGames.description,
          image: updatedGames.image,
          price: updatedGames.price,
        },
      };
      const result = await gamefusionGamesCollections.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });





    app.post("/mygames", async (req, res) => {
      try {
        let games = req.body;

        let result = await myGameFusionGamesCollections.insertOne(games);
        res.send(result);
      } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });



    app.get("/mygames", verifyJWT,async (req, res) => {
      try {

        let query={}
        if(req.query?.email){
          query={email:req.query?.email}
        }
        if (req.decoded.email !== req.query.email) {
          return res
            .status(403)
            .send({ error: true, message: "forbidden access" });
        }
        let result = await myGameFusionGamesCollections.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });


    app.delete("/mygames/:id", async (req, res) => {
      try {
        let result = await myGameFusionGamesCollections.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });









    // await client.db("admin").command({ ping: 1 });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Game Fusion Server");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
