const express = require('express')
const dotenv = require('dotenv')
const cors = require("cors")
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

dotenv.config()
const app = express()
const PORT = process.env.PORT || 8000

app.use(cors())
app.use(express.json())

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URI}/api/auth/jwks`))

const verifyToken = async (req, res, next) => {
  const header = req?.headers.authorization

  if (!header) {
    return res.status(401).json({
      message: "Unauthorized Access"
    })
  }

  const token = header.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Invalid Token"
    })
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    console.log(payload);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden" });
  }
}

async function run() {
  try {
    await client.connect();

    const db = client.db("studyNook")
    const roomsCollection = db.collection("rooms")
    const bookingsCollection = db.collection("bookings")
    const listingsCollection = db.collection("listings")

    app.get('/rooms', async (req, res) => {
      const result = await roomsCollection.find().toArray()
      res.json(result)
    })

    app.post('/rooms', verifyToken, async (req, res) => {
      const roomData = req.body
      const userIdFromToken = req.user?.id || req.user?.sub;

      const finalRoomData = {
        ...roomData,
        ownerId: userIdFromToken
      };

      const resultAllRooms = await roomsCollection.insertOne(finalRoomData)
      const resultMyListings = await listingsCollection.insertOne(finalRoomData)

      res.json({
        success: true,
        resultAllRooms,
        resultMyListings
      })
    });

  app.get('/my-listings', verifyToken, async (req, res) => {
  const userIdFromToken = req.user?.id || req.user?.sub;
  const result = await listingsCollection.find({ ownerId: userIdFromToken }).toArray()
  res.json(result)
});

    app.get('/rooms/:id', verifyToken, async (req, res) => {
      const { id } = req.params
      const result = await roomsCollection.findOne({ _id: new ObjectId(id) })
      res.json(result)
    });

    app.patch('/rooms/:id', verifyToken, async (req, res) => {
      const { id } = req.params
      const UpdateData = req.body
      const result = await roomsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: UpdateData }
      )
      res.json(result)
    });

    app.delete('/rooms/:id', verifyToken, async (req, res) => {
      const { id } = req.params
      const result = await roomsCollection.deleteOne({ _id: new ObjectId(id) })
      res.json(result)
    });

    app.post('/bookings', verifyToken, async (req, res) => {
      const bookingData = req.body
      const result = await bookingsCollection.insertOne(bookingData)
      res.json(result)
    });

    app.get('/bookings/:userId', verifyToken, async (req, res) => {
      const { userId } = req.params;
      const result = await bookingsCollection.find({ userId: userId }).toArray()
      res.json(result)
    });

    app.delete('/bookings/:bookingId', verifyToken, async (req, res) => {
      const { bookingId } = req.params;
      const result = await bookingsCollection.deleteOne({ _id: new ObjectId(bookingId) });
      res.json(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Server Is Runing!')
})

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})