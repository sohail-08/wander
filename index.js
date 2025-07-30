const dotenv = require("dotenv");
const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");


dotenv.config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();

const allowedOrigins = [
  "https://sunny-faun-0d2e90.netlify.app",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.s3bpn2t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

(async () => {
  try {
    await client.connect();

    const db = client.db("wanderBD");
    const usersCollection = db.collection("users");
    const packagesCollection = db.collection("packages");
    const bookingsCollection = db.collection("bookings");
    const storiesCollection = db.collection("stories");
    const guideApplicationsCollection = db.collection("guideApplications");
    const tourGuidesCollection = db.collection("tourGuides");
    const paymentsCollection = db.collection("payments");

    // Place all your routes here — copied from your original code
    app.get("/", (req, res) => {
      res.send("API is working");
    });

    // All other routes (e.g. /users, /packages, /bookings, etc.)
    // Paste your entire route logic from the original code here
    // Ensure all `app.get`, `app.post`, etc., are placed here
     //add user
        app.put("/users/:email", async (req, res) => {
            const email = req.params.email;
            const userData = req.body;
            const filter = { email };
            const options = { upsert: true };
            const updateDoc = { $set: userData };

            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });

        //get user by email
        app.get("/users/:email", async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email });
            res.send(user);
        });

        // get user based on role
        app.get("/users", async (req, res) => {
            const { role, search } = req.query;
            const filter = {};
            if (role) filter.role = role;
            if (search) {
                filter.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                ];
            }
            const users = await usersCollection.find(filter).toArray();
            res.send(users);
        });

        //delete user
        app.delete("/users/:id", async (req, res) => {
            const id = req.params.id;
            const result = await db.collection("users").deleteOne({ _id: new ObjectId(id) });

            if (result.deletedCount === 0) {
                return res.status(404).send({ message: "User not found" });
            }

            res.send({ message: "User deleted successfully" });
        });

        //get all packages
        app.get('/packages', async (req, res) => {
            const packages = await packagesCollection.find().toArray();
            res.send(packages);
        });
        //get package by id

        app.get("/packages/:id", async (req, res) => {
            const { id } = req.params;

            // Validate ObjectId
            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: "Invalid package ID format" });
            }

            try {
                const pkg = await packagesCollection.findOne({ _id: new ObjectId(id) });

                if (!pkg) {
                    return res.status(404).send({ message: "Package not found" });
                }

                res.send(pkg);
            } catch (error) {
                console.error("Error fetching package:", error);
                res.status(500).send({ message: "Server error fetching package" });
            }
        });


        //add a package
        app.post("/packages", async (req, res) => {
            const packageData = req.body;
            const result = await packagesCollection.insertOne(packageData);
            res.send(result);
        });
        //submit tour guide application
        app.post("/applications", async (req, res) => {
            const appData = req.body;
            const result = await guideApplicationsCollection.insertOne(appData);
            res.send(result);
        });

        //get all tour guide applications
        app.get("/applications", async (req, res) => {
            const apps = await guideApplicationsCollection.find().toArray();
            res.send(apps);
        });

        app.patch("/applications/:id/accept", async (req, res) => {
            const id = req.params.id;

            try {
                // 1. Find the application
                const appDoc = await guideApplicationsCollection.findOne({ _id: new ObjectId(id) });
                if (!appDoc) return res.status(404).send("Application not found");

                // 2. Update the user's role to "tourGuide"
                await usersCollection.updateOne(
                    { email: appDoc.email },
                    { $set: { role: "tourGuide" } }
                );

                // 3. Create a document in tourGuides collection
                const tourGuideDoc = {
                    name: appDoc.name,
                    email: appDoc.email,
                    photoURL: appDoc.photoURL || "",
                    title: appDoc.title,
                    reason: appDoc.reason,
                    experience: appDoc.experience,
                    languages: appDoc.languages,
                    specialty: appDoc.specialty,
                    cvLink: appDoc.cvLink,
                    joinedAt: new Date(),
                };

                const tourGuideResult = await db.collection("tourGuides").insertOne(tourGuideDoc);

                // 4. Remove the application
                await guideApplicationsCollection.deleteOne({ _id: new ObjectId(id) });

                res.send({
                    message: "Application accepted, user role updated, and tour guide created.",
                    tourGuideId: tourGuideResult.insertedId,
                });

            } catch (error) {
                console.error("Accept application error:", error);
                res.status(500).send("Something went wrong.");
            }
        });


        //delete application
        app.delete("/applications/:id", async (req, res) => {
            const id = req.params.id;
            const result = await guideApplicationsCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });




        // Get all tour guides
        app.get('/tour-guides', async (req, res) => {
            const guides = await tourGuidesCollection.find().toArray();
            res.send(guides);
        });


        //get tour guides by id
        app.get('/tour-guides/:id', async (req, res) => {
            const { id } = req.params;
            const guide = await tourGuidesCollection.findOne({ _id: new ObjectId(id) });
            res.send(guide);
        });

        //post story
        app.post("/stories", async (req, res) => {
            const story = req.body;
            const result = await storiesCollection.insertOne(story);
            res.send(result);
        });

        app.get("/stories", async (req, res) => {
            const email = req.query.email;
            const filter = email ? { authorEmail: email } : {};

            const stories = await storiesCollection.find(filter).toArray();
            res.send(stories);
        });

        //delete story
        app.delete("/stories/:id", async (req, res) => {
            const id = req.params.id;
            const result = await storiesCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        //get story by id
        app.get("/stories/:id", async (req, res) => {
            const id = req.params.id;
            const story = await storiesCollection.findOne({ _id: new ObjectId(id) });
            res.send(story);
        });

        //remove image
        app.put("/stories/:id/remove-image", async (req, res) => {
            const { image } = req.body;
            const id = req.params.id;

            const result = await storiesCollection.updateOne(
                { _id: new ObjectId(id) },
                { $pull: { images: image } }
            );

            res.send(result);
        });

        //update story
        app.put("/stories/:id", async (req, res) => {
            const id = req.params.id;
            const { title, text, newImages } = req.body;
            console.log("Received update:", { title, text, newImages });

            const result = await storiesCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: { title, text },
                    $push: { images: { $each: newImages } },
                }
            );

            res.send(result);
        });

        //add a new booking
        app.post("/bookings", async (req, res) => {
            const booking = req.body;
            booking.status = "Pending";
            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        });

        //get bookings by email
        app.get("/bookings", async (req, res) => {
            const email = req.query.email;
            const bookings = await bookingsCollection.find({ touristEmail: email }).toArray();
            res.send(bookings);
        });

        //get bookings assigned to guide
        app.get("/bookings/guide/:email", async (req, res) => {
            const email = req.params.email;
            const bookings = await bookingsCollection.find({ tourGuideEmail: email }).toArray();
            res.send(bookings);
        });

        // PATCH /bookings/:id
        app.patch("/bookings/:id", async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;

            const result = await bookingsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status } }
            );

            res.send(result);
        });


        // Get single booking by ID
        app.get("/bookings/:id", async (req, res) => {
            const { id } = req.params;
            const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
            res.send(booking);

        });

        //count bookings
        app.get("/bookings/count", async (req, res) => {
            const email = req.query.email;
            const count = await bookingsCollection.countDocuments({ touristEmail: email });
            res.send({ count });
        });


        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

        // Create Payment Intent
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price) * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                amount,
                currency: "bdt",
                payment_method_types: ["card"],
            });

            res.send({ clientSecret: paymentIntent.client_secret });
        });

        // Save Payment & Update Booking
        app.post("/payments", async (req, res) => {
            const payment = req.body;
            console.log("Booking ID to update:", payment.bookingId);

            // Save payment
            const result = await paymentsCollection.insertOne(payment);

            // Update booking status
            const bookingId = payment.bookingId;
            const updateResult = await bookingsCollection.updateOne(
                { _id: new ObjectId(bookingId) },
                {
                    $set: {
                        status: "In Review",
                        transactionId: payment.transactionId,
                    },
                }
            );

            res.send({ insertedId: result.insertedId, updated: updateResult.modifiedCount });
        });


        //admin dashboard info
        app.get("/stats", async (req, res) => {
            try {
                const totalPackages = await packagesCollection.countDocuments();
                const totalTourGuides = await tourGuidesCollection.countDocuments();
                const totalClients = await usersCollection.countDocuments({ role: "tourist" }); // or "client"
                const totalStories = await storiesCollection.countDocuments();

                const payments = await paymentsCollection.find().toArray();
                const totalPayment = payments.reduce((acc, payment) => acc + Number(payment.price || 0), 0);

                res.json({
                    totalPackages,
                    totalTourGuides,
                    totalClients,
                    totalStories,
                    totalPayment,
                });
            } catch (error) {
                console.error("Failed to fetch admin stats:", error);
                res.status(500).json({ message: "Internal Server Error" });
            }
        });


  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
})();
if (require.main === module) {
  app.listen(5000, () => {
    console.log("Server is running on port 5000");
  });
}

module.exports = app;
module.exports.handler = serverless(app);
