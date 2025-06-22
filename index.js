const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
//middleware
const { ObjectId } = require('mongodb');

app.use(cors());
app.use(express.json());


// app.get('/', (req, res) => {
//   res.send('server running');
// })



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kgk5l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

console.log(uri);
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    //await client.db("admin").command({ ping: 1 });
    //console.log("Pinged your deployment. You successfully connected to MongoDB!");


    const database = client.db('roadmapDB');
    const userCollection = client.db('roadmapDB').collection('users');
    const roadmapItemCollection = client.db('roadmapDB').collection('roadmapItems');

    //users related api
    app.post('/users', async (req, res) => {
      const newUser = req.body;
      console.log('creating new user', newUser);

      const result = await userCollection.insertOne(newUser);
      res.send(result);
    })

    // app.get('/users', async (req, res) => {
    //   const cursor = userCollection.find();
    //   const result = await cursor.toArray();
    //   res.send(result);
    // })

    app.get('/users', async (req, res) => {
      try {
        const cursor = userCollection.find();
        const result = await cursor.toArray();
        res.send(result);
      } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).send({ message: 'Server error' });
      }
    });


    app.get('/roadmapItems', async (req, res) => {
      const cursor = roadmapItemCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/roadmapItems/:id', async (req, res) => {
      const id = req.params.id;
      const item = await roadmapItemCollection.findOne({ _id: new ObjectId(id) });
      res.send(item);
    });

    // upload upvote
    app.patch('/roadmapItems/:id/upvote', async (req, res) => {
      const id = req.params.id;
      const { userEmail } = req.body;

      try {
        const result = await roadmapItemCollection.updateOne(
          { _id: new ObjectId(id) },
          { $addToSet: { upvotes: userEmail } } // prevents duplicates
        );

        res.send(result);
      } catch (error) {
        console.error("Upvote error:", error);
        res.status(500).send({ error: 'Failed to upvote item' });
      }
    });



    // upload comment with unique _id
    app.post('/roadmapItems/:id/comments', async (req, res) => {
      const id = req.params.id;
      const { userEmail, comment } = req.body;

      const newComment = {
        _id: new ObjectId(), // ✅ Needed for edit/delete
        userEmail,
        comment,
        createdAt: new Date()
      };

      const result = await roadmapItemCollection.updateOne(
        { _id: new ObjectId(id) },
        { $push: { comments: newComment } }
      );

      res.send(result);
    });

    app.patch('/roadmapItems/:id/comments/:commentId', async (req, res) => {
      const { id, commentId } = req.params;
      const { comment } = req.body;

      const result = await roadmapItemCollection.updateOne(
        { _id: new ObjectId(id), "comments._id": new ObjectId(commentId) },
        { $set: { "comments.$.comment": comment, "comments.$.editedAt": new Date() } }
      );

      res.send(result);
    });


    app.delete('/roadmapItems/:id/comments/:commentId', async (req, res) => {
      const { id, commentId } = req.params;

      const result = await roadmapItemCollection.updateOne(
        { _id: new ObjectId(id) },
        { $pull: { comments: { _id: new ObjectId(commentId) } } }
      );

      res.send(result);
    });


    // app.post('/roadmapItems/:itemId/comments/:commentId/replies', async (req, res) => {
    //   const { itemId, commentId } = req.params;
    //   const { userEmail, reply } = req.body;

    //   const newReply = {
    //     _id: new ObjectId(),
    //     userEmail,
    //     reply,
    //     createdAt: new Date()
    //   };

    //   const result = await roadmapItemCollection.updateOne(
    //     {
    //       _id: new ObjectId(itemId),
    //       "comments._id": new ObjectId(commentId)
    //     },
    //     {
    //       $push: {
    //         "comments.$.replies": newReply
    //       }
    //     }
    //   );

    //   res.send(result);
    // });

    app.post('/roadmapItems/:itemId/comments/:commentId/reply', async (req, res) => {
      const { itemId, commentId } = req.params;
      const { userEmail, comment, parentIds = [] } = req.body;

      const reply = {
        _id: new ObjectId(),
        userEmail,
        comment,
        createdAt: new Date(),
        replies: []
      };

      const item = await roadmapItemCollection.findOne({ _id: new ObjectId(itemId) });

      if (!item) return res.status(404).send({ message: "Item not found" });

      let comments = item.comments || [];

      // Traverse nested replies based on parentIds
      let target = comments;
      for (const id of parentIds) {
        const parent = target.find(c => c._id.toString() === id);
        if (!parent) return res.status(400).send({ message: "Invalid nesting path" });
        if (!parent.replies) parent.replies = [];
        target = parent.replies;
      }

      // Limit depth to 3
      if (parentIds.length >= 3) {
        return res.status(400).send({ message: "Max nesting depth (3) exceeded" });
      }

      target.push(reply);

      const result = await roadmapItemCollection.updateOne(
        { _id: new ObjectId(itemId) },
        { $set: { comments } }
      );

      res.send(result);
    });



  } finally {
    // Ensures that the client will close when you finish/error
    //  await client.close();
  }
}
run().catch(console.dir);


// app.use("/", (req, res) => {
//   res.send("Marriage BD Server is running");
// });

app.listen(port, (req, res) => {
  console.log(`Running port is ${port}`);
});