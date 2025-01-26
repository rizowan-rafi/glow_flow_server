require('dotenv').config()
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
// middleware 
app.use(cors({
    origin: ['http://localhost:5173', 'https://gigflow-client.web.app','https://console.firebase.google.com/project/gigflow-client/overview'],  // Adjust to your frontend URL
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type']
}));
app.use(express.json())
// middleware
const verifyToken = (req, res, next) => {
    // console.log('inside middleware : ', req.headers.authorization);
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'no token found' })
    }
    const token = req.headers.authorization.split(' ')[1]
    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) return res.status(400).send({ message: 'invalid token ' })
        req.decoded = decoded;
        next();
    })
    // next();

}




const verifyAdmin =async (req, res, next) => { 
    const email = req.decoded.email;
    const user = await userCollection.findOne({ email: email });
    const isAdmin = user?.role === 'admin'
    if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
    }
    next();
}


const verifyBuyer = async (req, res, next) => {
    const email = req.decoded.email;
    const user = await userCollection.findOne({ email: email });
    if (!user || user?.role !== 'Buyer') {
        return res.status(403).send({ message: 'forbidden access' })
    }
    next();
}

const verifyWorker = async (req, res, next) => {
    const email = req.decoded.email;
    const user = await userCollection.findOne({ email: email });
    if (!user || user?.role !== 'Worker') {
        return res.status(403).send({ message: 'forbidden access' })
    }
    next();
}

app.get('/', (req, res) => {
    res.send('GigFlow is running');
})


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.v8zqf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // await client.connect();

        // database Colllections 
        const userCollection = client.db("GigFlow").collection("users");
        const taskCollection = client.db("GigFlow").collection("tasks");
        const paymentCollection = client.db("GigFlow").collection("payments");
        const submissionCollection = client.db("GigFlow").collection("submissions");
        const withdrawCollection = client.db("GigFlow").collection("withdraws");
        const notificationCollection = client.db("GigFlow").collection("notifications");

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user)
            res.send(result);
        })

        app.get('/users',verifyToken, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        app.get('/userCount', async (req, res) => {
            const userCount = await userCollection.countDocuments();
            res.send({ userCount });
        })

        app.get('/users/:id',  async (req, res) => {
            const id = req.params.id;
            const user = await userCollection.findOne({ email: id });
            res.send(user);
        })

        app.get('/userRole/:id', async (req, res) => { 
            const id = req.params.id;
            const user = await userCollection.findOne({ email: id });
            res.send({ role: user?.role || '' });
        })

        app.get('/wcCount', async (req, res) => {
            const workerCount = await userCollection.countDocuments({ role: 'Worker' });
            const buyerCount = await userCollection.countDocuments({ role: 'Buyer' });
            res.send({ workerCount, buyerCount });
        })

        app.get('/wcSum', async (req, res) => {
            try {
                const result = await userCollection.aggregate([

                    { $group: { _id: null, totalRequiredWorkers: { $sum: "$coin" } } }
                ]).toArray();

                res.json({ total: result[0]?.totalRequiredWorkers || 0 });
            } catch (error) {
                res.status(500).json({ error: "Error fetching data" });
            }
        })

        app.get('/topWorker', async (req, res) => {
            try {
                const topWorkers = await userCollection
                    .find({ role: 'Worker' })
                    .sort({ coin: -1 })
                    .limit(6)
                    .toArray();

                res.send(topWorkers);
            } catch (error) {
                // console.error("Error fetching top workers:", error);
                res.status(500).send({ error: "Internal server error" });
            }
        });



        app.patch('/updateRole', verifyToken, async (req, res) => {
            const { id, role } = req.query;
            const filter = { _id: new ObjectId(id) }
            const update = { $set: { role: role } };
            const result = await userCollection.updateOne(filter, update);
            res.send(result);
        })

        app.delete('/deleteUser/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const result = await userCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        })

        // jwt token
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign({ user }, process.env.SECRET_KEY, { expiresIn: '1h' });
            res.send({ token });
        })

        // task Collection
        app.post('/tasks', async (req, res) => {
            const task = req.body;
            const result = await taskCollection.insertOne(task);
            res.send(result);
        })

        app.get('/tasks',verifyToken, async (req, res) => {
            const tasks = await taskCollection.find().toArray();
            res.send(tasks);
        })

        app.get('/taskCount', async (req, res) => {
            const taskCount = await taskCollection.countDocuments();
            res.send({ taskCount });
        })

        app.delete('/tasks/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const result = await taskCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        })

        app.patch('/taskUpdate/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const { title, task_detail, submission_detail } = req.body;
            const filter = { _id: new ObjectId(id) }
            const update = { $set: { title: title, detail: task_detail, submitInfo: submission_detail } };
            const result = await taskCollection.updateOne(filter, update);
            res.send(result);
        })

        app.delete('/taskDelete/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const result = await taskCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        })

        app.get('/tasks/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const tasks = await taskCollection.find({
                buyer_email: email
            }).sort({ deadline: -1 }).toArray();
            res.send(tasks);
        })



        app.get('/taskslist', verifyToken, async (req, res) => {
            const tasklist = await taskCollection.find({ required_worker: { $gt: 0 } }).toArray();
            res.send(tasklist);
        })

        app.get('/task/:taskid', verifyToken, async (req, res) => {
            const taskid = req.params.taskid;
            const task = await taskCollection.findOne({ _id: new ObjectId(taskid) });
            res.send(task);
        })

        app.patch('/task/:taskid', verifyToken, verifyToken, async (req, res) => {
            const taskid = req.params.taskid;
            const { required_worker } = req.body;
            const filter = { _id: new ObjectId(taskid) }
            const update = { $set: { required_worker } };
            const result = await taskCollection.updateOne(filter, update);
            res.send(result);
        })

        app.get('/taskCount/:email', async (req, res) => {
            const email = req.params.email;
            const count = await taskCollection.countDocuments({ buyer_email: email });
            res.send({ count });
        })

        // sum of total workers
        app.get('/workersCount/:email', async (req, res) => {
            const email = req.params.email;  // Get email from query params
            try {
                const result = await taskCollection.aggregate([
                    { $match: { buyer_email: email } },
                    { $group: { _id: null, totalRequiredWorkers: { $sum: "$required_worker" } } }
                ]).toArray();

                res.json({ total: result[0]?.totalRequiredWorkers || 0 });
            } catch (error) {
                res.status(500).json({ error: "Error fetching data" });
            }
        });

        // sum of total payment particular person
        app.get('/paymentsCount/:email', async (req, res) => {
            const email = req.params.email;  // Get email from query params
            try {
                const result = await paymentCollection.aggregate([
                    { $match: { email: email } },
                    { $group: { _id: null, totalRequiredWorkers: { $sum: "$amount" } } }
                ]).toArray();

                res.json({ total: result[0]?.totalRequiredWorkers || 0 });
            } catch (error) {
                res.status(500).json({ error: "Error fetching data" });
            }
        });

        // sum of total payment
        app.get('/totalPayment', verifyToken, async (req, res) => {
            try {
                const result = await paymentCollection.aggregate([
                    { $group: { _id: null, totalRequiredWorkers: { $sum: "$amount" } } }
                ]).toArray();

                res.json({ total: result[0]?.totalRequiredWorkers || 0 });
            } catch (error) {
                res.status(500).json({ error: "Error fetching data" });
            }
        })




        app.patch('/coins', verifyToken, async (req, res) => {
            const user = req.body;
            const filter = { email: user.email }
            const updateDoc = {
                $set: {
                    coin: user.coin,
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            // console.log(price)
            const amount = Math.round(parseInt(price * 100));
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        //payment collection
        app.post('/payments', verifyToken, async (req, res) => {
            const payment = req.body;
            const result = await paymentCollection.insertOne(payment);
            res.send(result);
        })

        app.get('/payments', verifyToken, async (req, res) => {
            const payments = await paymentCollection.find().toArray();
            res.send(payments);
        })

        // submission collection
        app.post('/submissions', verifyToken, async (req, res) => {
            const submission = req.body;
            const result = await submissionCollection.insertOne(submission);
            res.send(result);
        })

        app.get('/submissions/:email', verifyToken, async (req, res) => {
            let { page, limit } = req.query;
            page = parseInt(page) || 1;
            limit = parseInt(limit) || 2;
            const skip = (page - 1) * limit;
            const email = req.params.email;
            const items = await submissionCollection.find({ worker_email: email }).skip(skip).limit(limit).toArray();
            const totalItem = await submissionCollection.countDocuments();
            // res.send(items);
            res.json({
                items,
                totalPages: Math.ceil(totalItem / limit),
                currentPage: page,
                totalItem
            })
        })

        app.get('/subApproved/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const submissions = await submissionCollection.find({ worker_email: email, status: 'approved' }).toArray();
            res.send(submissions);
        })

        app.get('/subCount/:email', async (req, res) => {
            const email = req.params.email;
            const count = await submissionCollection.countDocuments({ worker_email: email });
            res.send({ count });
        })

        app.get('/subPendingCount/:email',  async (req, res) => {
            const email = req.params.email;
            const count = await submissionCollection.countDocuments({ worker_email: email, status: 'pending' });
            res.send({ count });
        })

        app.get('/subPayment/:email',  async (req, res) => {
            const email = req.params.email;
            try {
                const result = await submissionCollection.aggregate([
                    { $match: { worker_email: email, status: 'approved' } },
                    { $group: { _id: null, totalRequiredWorkers: { $sum: "$payable_amount" } } }
                ]).toArray();

                res.json({ total: result[0]?.totalRequiredWorkers || 0 });
            } catch (error) {
                res.status(500).json({ error: "Error fetching data" });
            }
        })

        app.get('/TaskSubmit/:id', verifyToken,  async (req, res) => {
            const id = req.params.id;
            const submission = await submissionCollection.findOne({ task_title: id });
            res.send(submission);
        })

        app.get('/submissionBuyer/:email', verifyToken,  async (req, res) => {
            const email = req.params.email;
            const submissions = await submissionCollection.find({ buyer_email: email }).toArray();
            res.send(submissions);
        })

        app.patch('/submissionStatus/:id', verifyToken,  async (req, res) => {
            const id = req.params.id;
            const { status } = req.body;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: status,
                },
            };
            const result = await submissionCollection.updateOne(filter, updateDoc);
            res.send(result);
        })



        // withdraw collection
        app.post('/withdraws', verifyToken,  async (req, res) => {
            const withdraw = req.body;
            const result = await withdrawCollection.insertOne(withdraw);
            res.send(result);
        })

        app.get('/withdraws', verifyToken,  async (req, res) => {
            const withdraws = await withdrawCollection.find().toArray();
            res.send(withdraws);

        })

        app.patch('/withdrawStatus/:id', verifyToken,  async (req, res) => {
            const id = req.params.id;
            const { status } = req.body;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: status,
                },
            };
            const result = await withdrawCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.patch('/withdrawCoin/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const { coin } = req.body;
            const filter = { email: id }
            const updateDoc = {
                $set: {
                    coin: parseInt(coin),
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // notification collection
        app.post('/notifications', verifyToken,  async (req, res) => {
            const notification = req.body;
            const result = await notificationCollection.insertOne(notification);
            res.send(result);
        })

        app.get('/notifications', verifyToken,  async (req, res) => {
            const { route, email } = req.query;
            const notifications = await notificationCollection.find({ actionRoute: route, toEmail: email }).toArray();
            res.send(notifications);
        })

        // check admin,buyer and worker
        app.get('/checkAdmin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email, role: 'Admin' });
            if (user) {
                res.send(true);
            } else {
                res.send(false);
            }
        })

        app.get('/checkBuyer/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email, role: 'Buyer' });
            if (user) {
                res.send(true);
            } else {
                res.send(false);
            }
        })

        app.get('/checkWorker/:email', verifyToken,  async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email, role: 'Worker' });
            if (user) {
                res.send(true);
            } else {
                res.send(false);
            }
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
